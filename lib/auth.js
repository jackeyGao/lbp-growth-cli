/**
 * Authentication management
 */
const fs = require('fs');
const path = require('path');
const { CRED_DIR, CRED_FILE, ME_URL } = require('./config');
const { httpGet } = require('./http');

function maskAk(ak) {
  if (!ak || ak.length < 10) return '***';
  return `${ak.slice(0, 4)}...${ak.slice(-4)}`;
}

function loadAk() {
  if (!fs.existsSync(CRED_FILE)) return null;
  try {
    const data = JSON.parse(fs.readFileSync(CRED_FILE, 'utf8'));
    return data.api_key || null;
  } catch {
    return null;
  }
}

async function verifyAk(ak) {
  try {
    const { status, body } = await httpGet(ME_URL, ak);
    if (status >= 200 && status < 300 && body.valid === true) {
      return { valid: true, info: `valid (userId=${body.userId || 'unknown'})`, userId: body.userId };
    }
    return { valid: false, info: `HTTP ${status}: ${JSON.stringify(body)}`, userId: null };
  } catch (error) {
    return { valid: false, info: `Error: ${error.message}`, userId: null };
  }
}

function saveAk(ak) {
  if (!fs.existsSync(CRED_DIR)) {
    fs.mkdirSync(CRED_DIR, { recursive: true, mode: 0o700 });
  }
  fs.writeFileSync(CRED_FILE, JSON.stringify({ api_key: ak }, null, 2), { mode: 0o600 });
  return CRED_FILE;
}

async function checkAuth() {
  const ak = loadAk();
  if (!ak) {
    return {
      ok: false,
      stage: 'auth',
      ak_status: 'missing',
      message: '未找到本地凭据，需要用户提供 API Key',
    };
  }

  const { valid, info, userId } = await verifyAk(ak);
  if (valid) {
    return {
      ok: true,
      stage: 'auth',
      ak_status: 'valid',
      ak_masked: maskAk(ak),
      user_id: userId,
      credentials_path: CRED_FILE,
      message: `AK 有效: ${info}`,
    };
  }

  return {
    ok: false,
    stage: 'auth',
    ak_status: 'invalid',
    ak_masked: maskAk(ak),
    message: `AK 无效: ${info}`,
  };
}

async function saveAuth(ak) {
  const trimmed = ak.trim();
  if (!trimmed) {
    return {
      ok: false,
      stage: 'auth',
      message: '空的 API Key',
    };
  }

  const { valid, info, userId } = await verifyAk(trimmed);
  if (!valid) {
    return {
      ok: false,
      stage: 'auth',
      ak_status: 'invalid',
      message: `校验失败: ${info}`,
    };
  }

  saveAk(trimmed);
  return {
    ok: true,
    stage: 'auth',
    ak_status: 'valid',
    ak_masked: maskAk(trimmed),
    user_id: userId,
    credentials_path: CRED_FILE,
    message: `已保存: ${info}`,
  };
}

function showAuth() {
  const ak = loadAk();
  if (!ak) {
    return {
      ok: false,
      stage: 'auth',
      ak_status: 'missing',
      message: '未配置 API Key',
    };
  }

  return {
    ok: true,
    stage: 'auth',
    ak_masked: maskAk(ak),
    credentials_path: CRED_FILE,
  };
}

module.exports = {
  maskAk,
  loadAk,
  verifyAk,
  saveAk,
  checkAuth,
  saveAuth,
  showAuth,
};
