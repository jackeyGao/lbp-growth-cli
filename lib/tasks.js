/**
 * Task management
 */
const { TASKS_URL, BASE_URL, BLOCKLIST_URL, BATCH_CONFIRM_URL } = require('./config');
const { httpGet, httpPut, httpDelete, httpDownload } = require('./http');
const fs = require('fs');

async function listTasks(ak, { day, page = 1, pageSize = 20 } = {}) {
  const qs = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
  if (day) qs.append('day', day);

  const url = `${TASKS_URL}?${qs}`;
  const { status, body } = await httpGet(url, ak);

  if (status >= 200 && status < 300 && body.items) {
    // Add preview URL for each task
    body.items.forEach(it => {
      if (it.id) {
        it.previewUrl = `${BASE_URL}/sync/${it.id}`;
      }
    });

    return {
      ok: true,
      stage: 'list',
      items: body.items,
      total: body.total || 0,
      page: body.page || page,
      page_size: body.pageSize || pageSize,
    };
  }

  return {
    ok: false,
    stage: 'list',
    message: `查询失败: HTTP ${status}`,
  };
}

async function updateTask(ak, taskId, fields) {
  const payload = {};

  if (fields.pushCount !== undefined) payload.pushCount = fields.pushCount;
  if (fields.readCount !== undefined) payload.readCount = fields.readCount;
  if (fields.clickCount !== undefined) payload.clickCount = fields.clickCount;
  if (fields.readRate !== undefined) payload.readRate = fields.readRate;
  if (fields.actionRate !== undefined) payload.actionRate = fields.actionRate;
  if (fields.overallRate !== undefined) payload.overallRate = fields.overallRate;

  if (Object.keys(payload).length === 0) {
    return {
      ok: false,
      stage: 'args',
      message: '至少需要提供一个待更新字段',
    };
  }

  const url = `${TASKS_URL}/${taskId}`;
  const { status, body } = await httpPut(url, ak, payload);

  if (status >= 200 && status < 300) {
    const tid = body.id || taskId;
    if (tid) {
      body.previewUrl = `${BASE_URL}/sync/${tid}`;
    }

    return {
      ok: true,
      stage: 'update',
      updated_fields: payload,
      task: body,
    };
  }

  return {
    ok: false,
    stage: 'update',
    message: `更新失败: HTTP ${status}`,
  };
}

async function getTaskRealtime(ak, taskId) {
  const url = `${TASKS_URL}/${taskId}/realtime`;
  const { status, body } = await httpGet(url, ak);

  if (status >= 200 && status < 300 && body.id) {
    return {
      ok: true,
      stage: 'realtime',
      task: body,
    };
  }

  let hint = null;
  if (status === 404) {
    hint = '任务 id 不存在';
  } else if (status === 401) {
    hint = 'API Key 无效或已撤销';
  }

  return {
    ok: false,
    stage: 'realtime',
    task_id: taskId,
    message: `获取实时指标失败: HTTP ${status}`,
    hint,
  };
}

async function deleteTask(ak, taskId, confirm = false) {
  if (!confirm) {
    return {
      ok: true,
      dry_run: true,
      stage: 'delete',
      task_id: taskId,
      message: '未执行真实删除。仅 draft 状态任务可被删除，确认后追加 --confirm',
      hint: '删除是不可恢复的操作，请先用 `lbp-growth tasks list` 确认任务状态',
    };
  }

  const url = `${TASKS_URL}/${taskId}`;
  const { status, body } = await httpDelete(url, ak);

  if (status >= 200 && status < 300 && body.deleted) {
    return {
      ok: true,
      stage: 'delete',
      task_id: body.id || taskId,
      deleted: true,
    };
  }

  let hint = null;
  if (status === 403) {
    hint = '服务端只允许删除 status=draft 的任务，当前任务不是草稿状态';
  } else if (status === 404) {
    hint = '任务 id 不存在，请用 `lbp-growth tasks list` 确认 id 是否正确';
  } else if (status === 401) {
    hint = 'API Key 无效或已撤销，请执行 `lbp-growth auth check` 重新配置';
  }

  return {
    ok: false,
    stage: 'delete',
    task_id: taskId,
    message: `删除失败: HTTP ${status}`,
    hint,
  };
}

async function getBlocklist(ak, output) {
  const { status, body } = await httpGet(BLOCKLIST_URL, ak);

  if (status >= 200 && status < 300 && body.blocklist) {
    const blocklist = body.blocklist;
    const result = {
      ok: true,
      stage: 'blocklist',
      count: blocklist.length,
      blocklist,
    };

    if (output) {
      fs.writeFileSync(output, JSON.stringify(blocklist, null, 2), 'utf8');
      result.output_file = output;
    }

    return result;
  }

  let hint = null;
  if (status === 401) {
    hint = 'API Key 无效或已撤销，请执行 `lbp-growth auth check` 重新配置';
  }

  return {
    ok: false,
    stage: 'blocklist',
    message: `获取失败: HTTP ${status}`,
    hint,
  };
}

function generateBatchConfirmUrl(taskIds) {
  // 支持单个 taskId 或数组
  const ids = Array.isArray(taskIds) ? taskIds : [taskIds];

  if (ids.length === 0) {
    return {
      ok: false,
      stage: 'args',
      message: '至少需要提供一个 taskId',
    };
  }

  if (ids.length > 20) {
    return {
      ok: false,
      stage: 'args',
      message: '单次最多处理 20 个任务',
      provided: ids.length,
    };
  }

  // 构建 URL 参数
  const params = ids.map(id => `task_id=${encodeURIComponent(id)}`).join('&');
  const url = `${BATCH_CONFIRM_URL}?${params}`;

  return {
    ok: true,
    stage: 'batch_confirm',
    url,
    task_count: ids.length,
    task_ids: ids,
    hint: '请在浏览器中打开此链接（需已登录并具有 push_admin 权限）',
    rules: [
      '仅 status=draft（草稿）状态的任务可以被确认',
      '任务创建时间必须在 7 天内',
      '单次最多处理 20 个任务',
      '每个任务独立处理，部分成功、部分失败是正常情况',
    ],
  };
}

async function downloadTaskRawCsv(ak, taskId, outputPath) {
  const url = `${TASKS_URL}/${taskId}/csv/raw`;
  const result = await httpDownload(url, ak, outputPath);

  if (result.status >= 200 && result.status < 300 && result.outputPath) {
    return {
      ok: true,
      stage: 'download_raw_csv',
      task_id: taskId,
      output_path: result.outputPath,
      message: `原始 AppID 列表已下载到 ${result.outputPath}`,
    };
  }

  let hint = null;
  if (result.status === 404) {
    hint = '指定任务不存在，或任务没有源文件';
  } else if (result.status === 401) {
    hint = 'API Key 无效或已撤销';
  } else if (result.status === 400) {
    hint = '请求参数错误，请检查 x-api-key 是否缺失';
  }

  return {
    ok: false,
    stage: 'download_raw_csv',
    task_id: taskId,
    message: `下载原始 CSV 失败: HTTP ${result.status}`,
    hint,
    body: result.body || null,
  };
}

async function downloadTaskFailureCsv(ak, taskId, outputPath) {
  const url = `${TASKS_URL}/${taskId}/csv/failure`;
  const result = await httpDownload(url, ak, outputPath);

  if (result.status >= 200 && result.status < 300 && result.outputPath) {
    return {
      ok: true,
      stage: 'download_failure_csv',
      task_id: taskId,
      output_path: result.outputPath,
      message: `失败 AppID 列表已下载到 ${result.outputPath}`,
    };
  }

  let hint = null;
  if (result.status === 404) {
    hint = '指定任务不存在，或没有失败记录';
  } else if (result.status === 401) {
    hint = 'API Key 无效或已撤销';
  } else if (result.status === 400) {
    hint = '请求参数错误，请检查 x-api-key 是否缺失';
  }

  return {
    ok: false,
    stage: 'download_failure_csv',
    task_id: taskId,
    message: `下载失败 CSV 失败: HTTP ${result.status}`,
    hint,
    body: result.body || null,
  };
}

async function downloadTaskRealtimeClickCsv(ak, taskId, outputPath) {
  const url = `${TASKS_URL}/${taskId}/csv/realtime_click`;
  const result = await httpDownload(url, ak, outputPath);

  if (result.status >= 200 && result.status < 300 && result.outputPath) {
    return {
      ok: true,
      stage: 'download_realtime_click_csv',
      task_id: taskId,
      output_path: result.outputPath,
      message: `实时点击 AppID 列表已下载到 ${result.outputPath}`,
    };
  }

  let hint = null;
  if (result.status === 404) {
    hint = '指定任务不存在，或没有实时点击记录';
  } else if (result.status === 401) {
    hint = 'API Key 无效或已撤销';
  } else if (result.status === 400) {
    hint = '请求参数错误，请检查 x-api-key 是否缺失';
  }

  return {
    ok: false,
    stage: 'download_realtime_click_csv',
    task_id: taskId,
    message: `下载实时点击 CSV 失败: HTTP ${result.status}`,
    hint,
    body: result.body || null,
  };
}

module.exports = {
  listTasks,
  updateTask,
  getTaskRealtime,
  deleteTask,
  getBlocklist,
  generateBatchConfirmUrl,
  downloadTaskRawCsv,
  downloadTaskFailureCsv,
  downloadTaskRealtimeClickCsv,
};
