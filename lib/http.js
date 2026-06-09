/**
 * HTTP utilities using native https module
 */
const https = require('https');
const { BEARER_TOKEN } = require('./config');

function makeRequest(url, options = {}) {
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
  makeRequest,
  httpGet,
  httpPost,
  httpPut,
  httpDelete,
};
