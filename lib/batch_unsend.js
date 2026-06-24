/**
 * Batch unsend with progress tracking and resume support
 *
 * - Reads app_ids from CSV, splits into chunks of 200 (API limit)
 * - Persists state to ~/.lbp_growth/batch_unsend/{taskId}.json
 * - Each chunk stores its app_ids and API result for inspection
 * - Worker pool with configurable concurrency
 * - Auto-retry failed chunks (max 3 retries)
 * - Resume automatically if previous run was interrupted
 */
const fs = require('fs');
const path = require('path');
const { unsendTask } = require('./tasks');
const { parseCSV } = require('./csv');
const { CRED_DIR } = require('./config');

const BATCH_UNSEND_DIR = path.join(CRED_DIR, 'batch_unsend');

function ensureBatchDir() {
  if (!fs.existsSync(BATCH_UNSEND_DIR)) {
    fs.mkdirSync(BATCH_UNSEND_DIR, { recursive: true });
  }
}

function getStatePath(taskId) {
  return path.join(BATCH_UNSEND_DIR, `${taskId}.json`);
}

function loadBatchState(taskId) {
  const statePath = getStatePath(taskId);
  if (!fs.existsSync(statePath)) return null;
  try {
    const content = fs.readFileSync(statePath, 'utf8');
    return JSON.parse(content);
  } catch (e) {
    return null;
  }
}

function saveBatchState(state) {
  ensureBatchDir();
  const statePath = getStatePath(state.task_id);
  const tmpPath = `${statePath}.tmp`;
  fs.writeFileSync(tmpPath, JSON.stringify(state, null, 2), 'utf8');
  fs.renameSync(tmpPath, statePath);
}

function createChunks(allAppIds, chunkSize) {
  const chunks = [];
  for (let i = 0; i < allAppIds.length; i += chunkSize) {
    const slice = allAppIds.slice(i, i + chunkSize);
    chunks.push({
      index: chunks.length,
      app_ids: slice,
      status: 'pending',
      retries: 0,
      result: null,
      started_at: null,
      completed_at: null,
    });
  }
  return chunks;
}

function updateStats(state) {
  state.completed = state.chunks
    .filter(c => c.status === 'done')
    .reduce((sum, c) => sum + c.app_ids.length, 0);
  state.failed = state.chunks
    .filter(c => c.status === 'failed')
    .reduce((sum, c) => sum + c.app_ids.length, 0);
  state.updated_at = new Date().toISOString();
}

async function runChunk(ak, state, chunk) {
  chunk.started_at = new Date().toISOString();

  try {
    const appIds = chunk.app_ids;
    if (!appIds || appIds.length === 0) {
      chunk.status = 'done';
      chunk.completed_at = new Date().toISOString();
      chunk.result = { total_count: 0, success_count: 0, skipped_count: 0 };
      return;
    }

    const result = await unsendTask(ak, state.task_id, appIds);

    if (result.ok) {
      chunk.status = 'done';
      chunk.completed_at = new Date().toISOString();
      chunk.result = {
        total_count: result.total_count,
        success_count: result.success_count,
        skipped_count: result.skipped_count,
      };
    } else {
      chunk.retries++;
      if (chunk.retries >= 3) {
        chunk.status = 'failed';
        chunk.completed_at = new Date().toISOString();
        chunk.result = {
          message: result.message,
          hint: result.hint,
          status: result.status,
        };
      } else {
        chunk.status = 'pending';
      }
    }
  } catch (error) {
    chunk.retries++;
    if (chunk.retries >= 3) {
      chunk.status = 'failed';
      chunk.completed_at = new Date().toISOString();
      chunk.result = {
        message: error.message || '未知异常',
      };
    } else {
      chunk.status = 'pending';
    }
  }
}

async function createBatchUnsendJob(ak, taskId, csvPath, concurrency, confirm) {
  const existingState = loadBatchState(taskId);

  if (existingState) {
    if (existingState.status === 'completed') {
      return {
        ok: true,
        stage: 'batch_unsend',
        message: '该任务已批量撤回完成',
        task_id: taskId,
        total: existingState.total,
        completed: existingState.completed,
        failed: existingState.failed,
        hint: '如需重新执行，请手动删除状态文件: ' + getStatePath(taskId),
      };
    }

    if (!confirm) {
      return {
        ok: true,
        dry_run: true,
        stage: 'batch_unsend',
        message: `检测到未完成的批量撤回任务：共 ${existingState.total} 个 app_id，已分 ${existingState.chunks.length} 批，${existingState.concurrency} 并发执行中`,
        task_id: taskId,
        total: existingState.total,
        completed: existingState.completed,
        failed: existingState.failed,
        remaining: existingState.total - existingState.completed,
        hint: '追加 --confirm 以恢复执行',
      };
    }

    return runBatchUnsendJob(ak, taskId, concurrency);
  }

  if (!csvPath) {
    return {
      ok: false,
      stage: 'batch_unsend_init',
      message: '首次执行需要提供 --csv 指定 app_id CSV 文件',
    };
  }

  if (!fs.existsSync(csvPath)) {
    return {
      ok: false,
      stage: 'batch_unsend_init',
      message: `CSV 文件不存在: ${csvPath}`,
    };
  }

  const content = fs.readFileSync(csvPath, 'utf8');
  const allAppIds = parseCSV(content);

  if (allAppIds.length === 0) {
    return {
      ok: false,
      stage: 'batch_unsend_init',
      message: 'CSV 文件为空或没有有效数据',
    };
  }

  const chunkSize = 200;
  const chunks = createChunks(allAppIds, chunkSize);

  const state = {
    task_id: taskId,
    csv_file: path.resolve(csvPath),
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    concurrency,
    total: allAppIds.length,
    chunk_size: chunkSize,
    completed: 0,
    failed: 0,
    status: 'pending',
    chunks,
  };

  saveBatchState(state);

  if (!confirm) {
    return {
      ok: true,
      dry_run: true,
      stage: 'batch_unsend',
      message: `已初始化批量撤回任务，共 ${allAppIds.length} 个 app_id，将分为 ${chunks.length} 批（每批 200 个），${concurrency} 并发 worker 执行。未执行真实操作`,
      task_id: taskId,
      csv_file: csvPath,
      total_app_ids: allAppIds.length,
      total_chunks: chunks.length,
      chunk_size: chunkSize,
      concurrency,
      hint: '追加 --confirm 开始执行',
    };
  }

  return runBatchUnsendJob(ak, taskId, concurrency);
}

async function runBatchUnsendJob(ak, taskId, concurrency) {
  const state = loadBatchState(taskId);
  if (!state) {
    return {
      ok: false,
      stage: 'batch_unsend',
      message: `未找到任务状态文件，请先提供 --csv 初始化: ${taskId}`,
    };
  }

  if (state.status === 'completed') {
    return getBatchUnsendStatus(taskId);
  }

  state.concurrency = concurrency || state.concurrency || 3;

  // Reset any chunks left in 'running' from a previous interrupted run
  state.chunks.forEach(c => {
    if (c.status === 'running') {
      c.status = 'pending';
      c.started_at = null;
    }
  });

  state.status = 'running';
  updateStats(state);
  saveBatchState(state);

  const startTime = Date.now();

  try {
    const running = new Set();

    while (true) {
      // Fill worker pool
      while (running.size < state.concurrency) {
        const nextChunk = state.chunks.find(c =>
          c.status === 'pending' || (c.status === 'failed' && c.retries < 3)
        );
        if (!nextChunk) break;

        nextChunk.status = 'running';
        const p = runChunk(ak, state, nextChunk).finally(() => {
          running.delete(p);
          updateStats(state);
          saveBatchState(state);
        });
        running.add(p);
      }

      if (running.size === 0) break;
      await Promise.race(running);
    }

    const allDone = state.chunks.every(c => c.status === 'done');
    state.status = allDone ? 'completed' : 'failed';
    updateStats(state);
    saveBatchState(state);

    const elapsedSeconds = Math.round((Date.now() - startTime) / 1000);

    return {
      ok: allDone,
      stage: 'batch_unsend',
      task_id: taskId,
      status: state.status,
      total: state.total,
      completed: state.completed,
      failed: state.failed,
      elapsed_seconds: elapsedSeconds,
      ...(state.status === 'failed' ? {
        hint: `部分 chunk 失败，请执行 \`lbp-growth tasks unsend-status ${taskId}\` 查看详情`,
      } : {}),
    };
  } catch (error) {
    updateStats(state);
    state.status = 'interrupted';
    saveBatchState(state);
    throw error;
  }
}

function getBatchUnsendStatus(taskId, detail = false) {
  const state = loadBatchState(taskId);
  if (!state) {
    return {
      ok: false,
      stage: 'unsend_status',
      message: `未找到该任务的批量撤回记录: ${taskId}`,
      hint: '请确认 taskId 是否正确，或先执行 unsend 初始化',
    };
  }

  const totalChunks = state.chunks.length;
  const doneChunks = state.chunks.filter(c => c.status === 'done').length;
  const failedChunks = state.chunks.filter(c => c.status === 'failed').length;
  const pendingChunks = state.chunks.filter(c => c.status === 'pending').length;
  const runningChunks = state.chunks.filter(c => c.status === 'running').length;

  const percentage = state.total > 0 ? ((state.completed / state.total) * 100).toFixed(2) : '0.00';

  const createdAt = new Date(state.created_at).getTime();
  const elapsedMs = Date.now() - createdAt;
  const elapsedSeconds = Math.round(elapsedMs / 1000);

  let estimatedRemainingSeconds = null;
  if (state.completed > 0 && state.status === 'running') {
    const avgMsPerApp = elapsedMs / state.completed;
    const remainingApps = state.total - state.completed;
    estimatedRemainingSeconds = Math.round((avgMsPerApp * remainingApps) / 1000);
  }

  const result = {
    ok: true,
    stage: 'unsend_status',
    task_id: taskId,
    status: state.status,
    progress: `${state.completed} / ${state.total}`,
    percentage: `${percentage}%`,
    completed_chunks: doneChunks,
    failed_chunks: failedChunks,
    pending_chunks: pendingChunks,
    running_chunks: runningChunks,
    total_chunks: totalChunks,
    elapsed_seconds: elapsedSeconds,
    estimated_remaining_seconds: estimatedRemainingSeconds,
    csv_file: state.csv_file,
    state_file: getStatePath(taskId),
    updated_at: state.updated_at,
  };

  if (detail) {
    result.chunks = state.chunks.map(c => ({
      index: c.index,
      app_ids: c.app_ids,
      status: c.status,
      result: c.result,
      retries: c.retries,
      started_at: c.started_at,
      completed_at: c.completed_at,
    }));
  }

  return result;
}

module.exports = {
  createBatchUnsendJob,
  runBatchUnsendJob,
  getBatchUnsendStatus,
};
