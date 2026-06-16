/**
 * Authentication management
 */
const fs = require('fs');
const path = require('path');
const { CRED_DIR, CRED_FILE, ME_URL, BASE_URL, getEffectiveBearerToken } = require('./config');
const { httpGet } = require('./http');
const https = require('https');

function maskAk(ak) {
  if (!ak || ak.length < 10) return '***';
  return `${ak.slice(0, 4)}...${ak.slice(-4)}`;
}

function maskBearerToken(token) {
  if (!token || token.length < 10) return '***';
  return `${token.slice(0, 6)}...${token.slice(-6)}`;
}

function loadCredentials() {
  if (!fs.existsSync(CRED_FILE)) return { apiKey: null, bearerToken: null };
  try {
    const data = JSON.parse(fs.readFileSync(CRED_FILE, 'utf8'));
    return {
      apiKey: data.api_key || data.apiKey || null,
      bearerToken: data.bearer_token || data.bearerToken || null,
    };
  } catch {
    return { apiKey: null, bearerToken: null };
  }
}

// 兼容旧代码，只返回 apiKey
function loadAk() {
  const creds = loadCredentials();
  return creds.apiKey;
}

async function verifyAk(ak, bearerToken) {
  // 没有显式传入 Bearer Token 时，复用统一 HTTP 工具，便于遵循全局配置优先级。
  if (!bearerToken) {
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

  return new Promise((resolve) => {
    const req = https.request(ME_URL, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${bearerToken}`,
        'X-Api-Key': ak,
        'Content-Type': 'application/json',
      },
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const body = JSON.parse(data);
          if (res.statusCode >= 200 && res.statusCode < 300 && body.valid === true) {
            resolve({ valid: true, info: `valid (userId=${body.userId || 'unknown'})`, userId: body.userId });
          } else {
            resolve({ valid: false, info: `HTTP ${res.statusCode}: ${JSON.stringify(body)}`, userId: null });
          }
        } catch {
          resolve({ valid: false, info: `HTTP ${res.statusCode}: ${data}`, userId: null });
        }
      });
    });

    req.on('error', (error) => {
      resolve({ valid: false, info: `Error: ${error.message}`, userId: null });
    });

    req.setTimeout(10000, () => {
      req.destroy();
      resolve({ valid: false, info: 'Timeout', userId: null });
    });

    req.end();
  });
}

// 验证 Bearer Token（通过尝试访问任务列表接口）
async function verifyBearerToken(token) {
  return new Promise((resolve) => {
    const url = `${BASE_URL}/openapi/tasks?page=1&pageSize=1`;
    const req = https.request(url, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        // 200 表示 token 有效，401/403 表示无效
        if (res.statusCode === 200) {
          resolve({ valid: true, info: 'valid' });
        } else if (res.statusCode === 401) {
          resolve({ valid: false, info: 'Unauthorized (401)' });
        } else if (res.statusCode === 403) {
          resolve({ valid: false, info: 'Forbidden (403)' });
        } else {
          // 其他状态码（如 404, 500等），只要不等于401/403，可能表示token有效但接口有其他问题
          resolve({ valid: res.statusCode !== 401 && res.statusCode !== 403, info: `HTTP ${res.statusCode}` });
        }
      });
    });

    req.on('error', (error) => {
      resolve({ valid: false, info: `Error: ${error.message}` });
    });

    req.setTimeout(10000, () => {
      req.destroy();
      resolve({ valid: false, info: 'Timeout' });
    });

    req.end();
  });
}

function saveCredentials(apiKey, bearerToken) {
  if (!fs.existsSync(CRED_DIR)) {
    fs.mkdirSync(CRED_DIR, { recursive: true, mode: 0o700 });
  }
  const data = {};
  if (apiKey) data.api_key = apiKey;
  if (bearerToken) data.bearer_token = bearerToken;
  fs.writeFileSync(CRED_FILE, JSON.stringify(data, null, 2), { mode: 0o600 });
  return CRED_FILE;
}

// 兼容旧代码
function saveAk(ak) {
  return saveCredentials(ak, null);
}

async function checkAuth() {
  const creds = loadCredentials();
  const bearerToken = creds.bearerToken || getEffectiveBearerToken();
  const results = {
    ok: false,
    stage: 'auth',
    api_key: { status: 'missing', masked: null },
    bearer_token: { status: 'missing', masked: null },
  };

  // 先检查 Bearer Token
  if (bearerToken) {
    const { valid, info } = await verifyBearerToken(bearerToken);
    results.bearer_token = {
      status: valid ? 'valid' : 'invalid',
      masked: maskBearerToken(bearerToken),
      message: info,
    };
  }

  // 检查 API Key（需要 Bearer Token）
  if (creds.apiKey) {
    const { valid, info, userId } = await verifyAk(creds.apiKey, bearerToken);
    results.api_key = {
      status: valid ? 'valid' : 'invalid',
      masked: maskAk(creds.apiKey),
      user_id: userId,
      message: info,
    };
  }

  // 判断是否全部通过
  if (results.api_key.status === 'valid' && results.bearer_token.status === 'valid') {
    results.ok = true;
    results.message = '所有凭据有效';
  } else if (results.api_key.status === 'missing' && results.bearer_token.status === 'missing') {
    results.message = '未配置任何凭据';
  } else {
    const issues = [];
    if (results.api_key.status === 'missing') issues.push('缺少 API Key');
    if (results.api_key.status === 'invalid') issues.push('API Key 无效');
    if (results.bearer_token.status === 'missing') issues.push('缺少 Bearer Token');
    if (results.bearer_token.status === 'invalid') issues.push('Bearer Token 无效');
    results.message = issues.join(', ');
  }

  results.credentials_path = CRED_FILE;
  return results;
}

async function saveAuth(apiKey, bearerToken) {
  const trimmedAk = apiKey ? apiKey.trim() : '';
  const trimmedBearer = bearerToken ? bearerToken.trim() : '';
  const existingCreds = loadCredentials();
  const effectiveBearer = trimmedBearer || getEffectiveBearerToken();

  if (!trimmedAk) {
    return {
      ok: false,
      stage: 'auth',
      message: 'API Key 不能为空',
    };
  }

  if (!effectiveBearer) {
    return {
      ok: false,
      stage: 'auth',
      message: 'Bearer Token 不能为空，请传入参数或配置 LBP_BEARER_TOKEN',
    };
  }

  // 先验证 Bearer Token
  const bearerResult = await verifyBearerToken(effectiveBearer);
  if (!bearerResult.valid) {
    return {
      ok: false,
      stage: 'auth',
      message: `Bearer Token 无效：${bearerResult.info}`,
    };
  }

  // 使用验证通过的 Bearer Token 来验证 AK
  const akResult = await verifyAk(trimmedAk, effectiveBearer);

  if (!akResult.valid) {
    return {
      ok: false,
      stage: 'auth',
      message: `API Key 无效：${akResult.info}`,
    };
  }

  // 两个都验证通过后保存。命令行传入的 token 会写入文件；环境变量/配置文件提供的 token 不会被复制写入。
  const bearerToSave = trimmedBearer || existingCreds.bearerToken || null;
  saveCredentials(trimmedAk, bearerToSave);

  return {
    ok: true,
    stage: 'auth',
    api_key: {
      status: 'valid',
      masked: maskAk(trimmedAk),
      user_id: akResult.userId,
    },
    bearer_token: {
      status: 'valid',
      masked: maskBearerToken(effectiveBearer),
    },
    credentials_path: CRED_FILE,
    message: '所有凭据已保存并验证通过',
  };
}

function showAuth() {
  const creds = loadCredentials();

  if (!creds.apiKey && !creds.bearerToken) {
    return {
      ok: false,
      stage: 'auth',
      message: '未配置任何凭据',
    };
  }

  return {
    ok: true,
    stage: 'auth',
    api_key: creds.apiKey ? { masked: maskAk(creds.apiKey) } : null,
    bearer_token: creds.bearerToken ? { masked: maskBearerToken(creds.bearerToken) } : null,
    credentials_path: CRED_FILE,
  };
}

module.exports = {
  maskAk,
  maskBearerToken,
  loadAk,
  loadCredentials,
  verifyAk,
  verifyBearerToken,
  saveAk,
  saveCredentials,
  checkAuth,
  saveAuth,
  showAuth,
};
