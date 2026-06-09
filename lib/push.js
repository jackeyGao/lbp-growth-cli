/**
 * Push task management
 * API 文档: 使用 multipart/form-data 格式上传文件
 */
const fs = require('fs');
const path = require('path');
const os = require('os');
const { PUSH_URL, MAX_ROWS_PER_FILE } = require('./config');
const { httpPost } = require('./http');
const { createTempCSV, countCSVRows, checkCSVLimits, encodeCSVBase64, validateCSVFormat } = require('./csv');

async function createPush({
  ak,
  name,
  formatType,
  content,
  releaseNoteIds,
  apps,
  csvPath,
  scheduleType = 'immediate',
  scheduleTime,
  strictLimits = true,
  confirm = false,
}) {
  // Parameter validation
  if (formatType === 'card' && !content) {
    return {
      ok: false,
      stage: 'args',
      message: 'format=card 时 --content 必填',
    };
  }

  if (formatType === 'releaseNote' && !releaseNoteIds) {
    return {
      ok: false,
      stage: 'args',
      message: 'format=releaseNote 时 --release-note-ids 必填',
    };
  }

  if (scheduleType === 'scheduled' && !scheduleTime) {
    return {
      ok: false,
      stage: 'args',
      message: 'schedule-type=scheduled 时 --schedule-time 必填',
    };
  }

  // Prepare CSV
  let actualCsvPath = csvPath;
  let cleanupCsv = false;

  if (!actualCsvPath) {
    if (!apps) {
      return {
        ok: false,
        stage: 'args',
        message: '--apps 或 --csv 必须提供其一',
      };
    }

    const appList = apps.split(',').map(a => a.trim()).filter(Boolean);
    if (appList.length === 0) {
      return {
        ok: false,
        stage: 'args',
        message: 'app 列表为空',
      };
    }

    actualCsvPath = createTempCSV(appList);
    cleanupCsv = true;
  }

  // Count and check limits
  const { count: rowsCount, sample: previewApps } = countCSVRows(actualCsvPath);
  const more = rowsCount - previewApps.length;

  const limits = checkCSVLimits(actualCsvPath, strictLimits);
  if (limits && strictLimits) {
    if (cleanupCsv) {
      try { fs.unlinkSync(actualCsvPath); } catch {}
    }
    return {
      ok: false,
      stage: 'limits',
      message: 'CSV 超出限制',
      limits_warning: limits,
    };
  }

  // Validate CSV format (single column, cli_ prefix)
  const formatValidation = validateCSVFormat(actualCsvPath);
  if (!formatValidation.valid) {
    if (cleanupCsv) {
      try { fs.unlinkSync(actualCsvPath); } catch {}
    }
    return {
      ok: false,
      stage: 'args',
      message: formatValidation.error,
      details: formatValidation.details,
      total_errors: formatValidation.totalErrors,
    };
  }

  // Dry-run mode
  if (!confirm) {
    const stats = fs.statSync(actualCsvPath);
    const preview = {
      name,
      format: formatType,
      content: formatType === 'card' ? content : null,
      schedule_type: scheduleType,
      schedule_time: scheduleTime,
      app_count: rowsCount,
      app_sample: previewApps,
      app_more: Math.max(0, more),
      csv_size_bytes: stats.size,
    };

    if (cleanupCsv) {
      try { fs.unlinkSync(actualCsvPath); } catch {}
    }

    return {
      ok: true,
      dry_run: true,
      stage: 'preview',
      message: '未执行真实推送。确认无误后追加 --confirm',
      request_preview: preview,
      limits_warning: limits,
    };
  }

  // Real push using JSON + Base64
  let fileBase64;
  try {
    fileBase64 = encodeCSVBase64(actualCsvPath);
  } finally {
    if (cleanupCsv) {
      try { fs.unlinkSync(actualCsvPath); } catch {}
    }
  }

  // Build payload
  const payload = {
    fileContent: fileBase64,
    name,
    format: formatType,
  };

  if (content && formatType === 'card') {
    // content 必须是有效的 JSON，直接传递（不需要 base64）
    try {
      // 验证 content 是有效的 JSON
      JSON.parse(content);
      payload.content = content;
    } catch (e) {
      return {
        ok: false,
        stage: 'args',
        message: 'content 必须是有效的 JSON 字符串',
        error: e.message,
      };
    }
  }

  if (formatType === 'releaseNote' && releaseNoteIds) {
    const ids = releaseNoteIds.split(',').map(x => x.trim()).filter(Boolean);
    payload.releaseNoteIds = JSON.stringify(ids);
  }

  payload.scheduleType = scheduleType;
  if (scheduleTime) {
    payload.scheduleTime = scheduleTime;
  }

  // Send request
  const { status, body } = await httpPost(PUSH_URL, ak, payload);

  if (status >= 200 && status < 300 && body.taskId) {
    const previewUrl = body.previewUrl || '';
    const fullPreview = previewUrl.startsWith('/')
      ? `${PUSH_URL.replace('/openapi/push', '')}${previewUrl}`
      : previewUrl;

    return {
      ok: true,
      stage: 'push',
      task_id: body.taskId,
      preview_url: fullPreview,
      total_count: body.totalCount || 0,
      raw: body,
    };
  }

  return {
    ok: false,
    stage: 'push',
    message: `推送失败: HTTP ${status}`,
    raw: body,
  };
}

module.exports = {
  createPush,
};
