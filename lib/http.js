/**
 * HTTP utilities using native https module
 * API 文档: 使用 multipart/form-data 格式上传文件
 */
const https = require('https');
const fs = require('fs');
const path = require('path');
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

// 生成 multipart/form-data boundary
function generateBoundary() {
  return '----FormBoundary' + Math.random().toString(36).substring(2);
}

// 构建 multipart/form-data 请求体
function buildMultipartBody(fields, fileField, filePath, boundary) {
  const chunks = [];

  // 添加普通字段
  for (const [key, value] of Object.entries(fields)) {
    chunks.push(Buffer.from(`--${boundary}\r\n`));
    chunks.push(Buffer.from(`Content-Disposition: form-data; name="${key}"\r\n\r\n`));
    chunks.push(Buffer.from(String(value)));
    chunks.push(Buffer.from('\r\n'));
  }

  // 添加文件字段
  if (fileField && filePath && fs.existsSync(filePath)) {
    const fileName = path.basename(filePath);
    const fileContent = fs.readFileSync(filePath);

    chunks.push(Buffer.from(`--${boundary}\r\n`));
    chunks.push(Buffer.from(
      `Content-Disposition: form-data; name="${fileField}"; filename="${fileName}"\r\n`
    ));
    chunks.push(Buffer.from('Content-Type: text/csv\r\n\r\n'));
    chunks.push(fileContent);
    chunks.push(Buffer.from('\r\n'));
  }

  // 结束 boundary
  chunks.push(Buffer.from(`--${boundary}--\r\n`));

  return Buffer.concat(chunks);
}

function makeRequest(url, options = {}) {
  checkConfig();

  return new Promise((resolve, reject) => {
    const { method = 'GET', headers = {}, body, ak, multipart } = options;

    const defaultHeaders = {
      'X-Api-Key': ak,
      ...headers,
    };

    // 如果不是 multipart，添加 Content-Type
    if (!multipart && body && typeof body === 'object') {
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
      if (Buffer.isBuffer(body)) {
        req.write(body);
      } else if (typeof body === 'string') {
        req.write(body);
      } else {
        req.write(JSON.stringify(body));
      }
    }

    req.end();
  });
}

// multipart/form-data POST 请求（用于文件上传）
function httpPostMultipart(url, ak, fields, fileField, filePath) {
  const boundary = generateBoundary();
  const body = buildMultipartBody(fields, fileField, filePath, boundary);

  return makeRequest(url, {
    method: 'POST',
    ak,
    headers: {
      'Content-Type': `multipart/form-data; boundary=${boundary}`,
      'Content-Length': body.length,
    },
    body,
    multipart: true,
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
  httpPostMultipart,
  httpPut,
  httpDelete,
  buildMultipartBody,
};
