/**
 * Configuration constants
 */
const path = require('path');
const os = require('os');

// API Configuration
const BASE_URL = 'https://bytedance.aiforce.cloud/app/app_4k4t296e2nsut';
const BEARER_TOKEN = 'YUr2kr1PlHD6u3Chjud1mL7Ufu_ZhgT5p9ZWgGDVRuY';

// API Endpoints
const ME_URL = `${BASE_URL}/openapi/me`;
const PUSH_URL = `${BASE_URL}/openapi/push`;
const TASKS_URL = `${BASE_URL}/openapi/tasks`;
const BLOCKLIST_URL = `${BASE_URL}/openapi/user/blocklist`;

// Credentials
const CRED_DIR = path.join(os.homedir(), '.lbp_growth');
const CRED_FILE = path.join(CRED_DIR, 'credentials.json');

// CSV Limits
const MAX_CSV_BYTES = 30 * 1024 * 1024; // 30MB
const MAX_ROWS_PER_FILE = 150000;       // 150k rows

// Default pagination
const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 200;

module.exports = {
  BASE_URL,
  BEARER_TOKEN,
  ME_URL,
  PUSH_URL,
  TASKS_URL,
  BLOCKLIST_URL,
  CRED_DIR,
  CRED_FILE,
  MAX_CSV_BYTES,
  MAX_ROWS_PER_FILE,
  DEFAULT_PAGE_SIZE,
  MAX_PAGE_SIZE,
};
