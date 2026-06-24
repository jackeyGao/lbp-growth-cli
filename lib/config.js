/**
 * Configuration constants
 * BEARER_TOKEN 安全处理：优先从环境变量读取，支持本地配置文件
 */
const fs = require('fs');
const path = require('path');
const os = require('os');

// 尝试从多个来源获取 BEARER_TOKEN
function getBearerToken() {
  // 1. 环境变量（最高优先级，适合 CI/CD）
  if (process.env.LBP_BEARER_TOKEN) {
    return process.env.LBP_BEARER_TOKEN;
  }

  // 2. 本地配置文件（适合开发环境）
  const configPath = path.join(os.homedir(), '.lbp_growth', 'config.json');
  if (fs.existsSync(configPath)) {
    try {
      const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
      if (config.bearerToken) {
        return config.bearerToken;
      }
    } catch (e) {
      // 忽略读取错误
    }
  }

  // 3. 项目级配置文件
  const localConfigPath = path.join(process.cwd(), '.lbp-growth.json');
  if (fs.existsSync(localConfigPath)) {
    try {
      const config = JSON.parse(fs.readFileSync(localConfigPath, 'utf8'));
      if (config.bearerToken) {
        return config.bearerToken;
      }
    } catch (e) {
      // 忽略读取错误
    }
  }

  return null;
}

const BEARER_TOKEN = getBearerToken();

const BASE_URL = 'https://bytedance.aiforce.cloud/app/app_4k4t296e2nsut';

// API Endpoints
const ME_URL = `${BASE_URL}/openapi/me`;
const PUSH_URL = `${BASE_URL}/openapi/push`;
const TASKS_URL = `${BASE_URL}/openapi/tasks`;
const UNSEND_URL = `${BASE_URL}/openapi/unsend`;
const BLOCKLIST_URL = `${BASE_URL}/openapi/user/blocklist`;

// Web Batch Confirm URL (需要 Cookie 登录态)
const BATCH_CONFIRM_URL = `${BASE_URL}/batch-confirm`;

// Credentials
const CRED_DIR = path.join(os.homedir(), '.lbp_growth');
const CRED_FILE = path.join(CRED_DIR, 'credentials.json');

// CSV Limits
const MAX_CSV_BYTES = 30 * 1024 * 1024;
const MAX_ROWS_PER_FILE = 150000;

// Default pagination
const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 200;

// 从 credentials.json 读取 bearer token
function getBearerTokenFromCredentials() {
  if (!fs.existsSync(CRED_FILE)) return null;
  try {
    const data = JSON.parse(fs.readFileSync(CRED_FILE, 'utf8'));
    return data.bearer_token || data.bearerToken || null;
  } catch {
    return null;
  }
}

// 获取 bearer token（优先顺序：环境变量 > 配置文件 > credentials.json）
function getEffectiveBearerToken() {
  // 1. 环境变量或配置文件
  const token = getBearerToken();
  if (token) return token;

  // 2. credentials.json
  return getBearerTokenFromCredentials();
}

module.exports = {
  BEARER_TOKEN,
  BASE_URL,
  ME_URL,
  PUSH_URL,
  TASKS_URL,
  UNSEND_URL,
  BLOCKLIST_URL,
  BATCH_CONFIRM_URL,
  CRED_DIR,
  CRED_FILE,
  MAX_CSV_BYTES,
  MAX_ROWS_PER_FILE,
  DEFAULT_PAGE_SIZE,
  MAX_PAGE_SIZE,
  getBearerToken,
  getBearerTokenFromCredentials,
  getEffectiveBearerToken,
};
