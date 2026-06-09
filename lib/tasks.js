/**
 * Task management
 */
const { TASKS_URL, BASE_URL, BLOCKLIST_URL } = require('./config');
const { httpGet, httpPut, httpDelete } = require('./http');
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

module.exports = {
  listTasks,
  updateTask,
  getTaskRealtime,
  deleteTask,
  getBlocklist,
};
