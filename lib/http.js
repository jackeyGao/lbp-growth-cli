/**
 * HTTP utilities using native https module
 */
const https = require('https');
const { BEARER_TOKEN, getBearerToken } = require('./config');

function checkConfig() {
  if (!BEARER_TOKEN) {
    const error = new Error(
      '缺少 LBP_BEARER_TOKEN 配置\n\n' +
      '请通过以下任一方式配置:\n' +
      '1. 环境变量: export LBP_BEARER_TOKEN="your_token_here"\n' +
      '2. 全局配置: echo \'{ "bearerToken": "your_token" }\' > ~/.lbp_growth/config.json\n' +
      '3. 项目配置: echo \'{ "bearerToken": "your_token" }\' > .lbp-growth.json'
    );
    error.code = 'MISSING_BEARER_TOKEN';
    throw error;
  }
}

function makeRequest(url, options = {}) {
  checkConfig();

  return new Promise((resolve, reject) => {
    const { method = 'GET', headers = {}, body, ak } = options;

    const defaultHeaders = {
      'Authorization': `Bearer ${BEARER_TOKEN}`,
      'X-Api-Key': ak,
      ...headers,
    };

    if (body && typeof body === 'object') {
      defaultHeaders['Content-Type'] = 'application/json';
    }

    const req = https.request(url, {
      method,
      headers: defaultHeaders,
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          resolve({ status: res.statusCode, body: parsed });
        } catch {
          resolve({ status: res.statusCode, body: data });
        }
      });
    });

    req.on('error', reject);

    if (body) {
      req.write(typeof body === 'string' ? body : JSON.stringify(body));
    }

    req.end();
  });
}

function httpGet(url, ak) {
  return makeRequest(url, { method: 'GET', ak });
}

function httpPost(url, ak, body) {
  return makeRequest(url, { method: 'POST', ak, body });
}

function httpPut(url, ak, body) {
  return makeRequest(url, { method: 'PUT', ak, body });
}

function httpDelete(url, ak) {
  return makeRequest(url, { method: 'DELETE', ak });
}

module.exports = {
  checkConfig,
  makeRequest,
  httpGet,
  httpPost,
  httpPut,
  httpDelete,
};
