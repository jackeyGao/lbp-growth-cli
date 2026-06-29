/**
 * TEA daily data sync
 */
const { TEA_DAILY_URL } = require('./config');
const { httpGet, httpPost } = require('./http');

function validateDailyPayload({ date, openFrom, pv }) {
  if (!date) {
    return '缺少必填参数 --date';
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return 'date 格式必须为 YYYY-MM-DD';
  }
  if (!openFrom) {
    return '缺少必填参数 --open-from';
  }
  if (pv === undefined || pv === null || Number.isNaN(pv)) {
    return '缺少必填参数 --pv';
  }
  if (!Number.isInteger(pv) || pv < 0) {
    return 'pv 必须是非负整数';
  }
  return null;
}

async function syncTeaDaily(ak, { date, openFrom, pv }) {
  const error = validateDailyPayload({ date, openFrom, pv });
  if (error) {
    return {
      ok: false,
      stage: 'args',
      message: error,
    };
  }

  const payload = {
    date,
    open_from: openFrom,
    pv,
  };

  const { status, body } = await httpPost(TEA_DAILY_URL, ak, payload);

  if (status >= 200 && status < 300 && body && body.id) {
    return {
      ok: true,
      stage: 'tea_daily',
      record: {
        id: body.id,
        date: body.date,
        open_from: body.open_from,
        pv: body.pv,
      },
    };
  }

  let hint = null;
  if (status === 400) {
    hint = '请求参数错误，请检查 x-api-key 是否缺失，以及 date/open_from/pv 是否完整';
  } else if (status === 401) {
    hint = 'API Key 无效或已撤销，请执行 `lbp-growth auth check` 重新配置';
  } else if (status === 403) {
    hint = '无权限访问。该接口仅允许 super_admin 角色调用';
  }

  return {
    ok: false,
    stage: 'tea_daily',
    message: `同步 TEA 每日点击数据失败: HTTP ${status}`,
    hint,
    status,
    body: body || null,
  };
}

async function listTeaDaily(ak, { startDate, endDate, openFrom, page = 1, pageSize = 100 } = {}) {
  const qs = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
  if (startDate) qs.append('startDate', startDate);
  if (endDate) qs.append('endDate', endDate);
  if (openFrom) qs.append('openFrom', openFrom);

  const url = `${TEA_DAILY_URL}?${qs}`;
  const { status, body } = await httpGet(url, ak);

  if (status >= 200 && status < 300 && body && body.items) {
    return {
      ok: true,
      stage: 'tea_list',
      items: body.items,
      total: body.total || 0,
      page: body.page || page,
      pageSize: body.pageSize || pageSize,
    };
  }

  let hint = null;
  if (status === 400) {
    hint = '请求参数错误，请检查 x-api-key 是否缺失';
  } else if (status === 401) {
    hint = 'API Key 无效或已撤销，请执行 `lbp-growth auth check` 重新配置';
  } else if (status === 403) {
    hint = '无权限访问。该接口仅允许 push_admin / super_admin 角色调用';
  }

  return {
    ok: false,
    stage: 'tea_list',
    message: `查询 TEA 每日点击数据失败: HTTP ${status}`,
    hint,
    status,
    body: body || null,
  };
}

module.exports = {
  validateDailyPayload,
  syncTeaDaily,
  listTeaDaily,
};
