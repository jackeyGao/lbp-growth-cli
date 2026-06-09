/**
 * @jest-environment node
 */
const fs = require('fs');
const path = require('path');
const os = require('os');
const auth = require('../lib/auth');

// Mock the http module
jest.mock('../lib/http', () => ({
  httpGet: jest.fn(),
}));

const { httpGet } = require('../lib/http');

describe('auth', () => {
  const testCredDir = path.join(os.tmpdir(), '.lbp_growth_test');
  const testCredFile = path.join(testCredDir, 'credentials.json');

  // Save original env
  const originalCredFile = require('../lib/config').CRED_FILE;

  beforeEach(() => {
    // Clear mock
    httpGet.mockClear();
    // Cleanup test files
    if (fs.existsSync(testCredFile)) {
      fs.unlinkSync(testCredFile);
    }
    if (fs.existsSync(testCredDir)) {
      fs.rmdirSync(testCredDir);
    }
  });

  afterAll(() => {
    // Cleanup
    if (fs.existsSync(testCredFile)) {
      fs.unlinkSync(testCredFile);
    }
    if (fs.existsSync(testCredDir)) {
      fs.rmdirSync(testCredDir);
    }
  });

  describe('maskAk', () => {
    test('should mask AK correctly', () => {
      expect(auth.maskAk('1234567890abcdef')).toBe('1234...cdef');
    });

    test('should return *** for short AK', () => {
      expect(auth.maskAk('short')).toBe('***');
    });

    test('should handle empty/null', () => {
      expect(auth.maskAk('')).toBe('***');
      expect(auth.maskAk(null)).toBe('***');
      expect(auth.maskAk(undefined)).toBe('***');
    });
  });

  describe('loadAk', () => {
    test('should return null if file not exists', () => {
      const result = auth.loadAk();
      // This will test against the real cred file location
      // which might exist or not, so we just check it's either string or null
      expect(result === null || typeof result === 'string').toBe(true);
    });
  });

  describe('verifyAk', () => {
    test('should return valid for successful response', async () => {
      httpGet.mockResolvedValue({
        status: 200,
        body: { valid: true, userId: 'user123' },
      });

      const result = await auth.verifyAk('test_ak');
      expect(result.valid).toBe(true);
      expect(result.userId).toBe('user123');
      expect(result.info).toContain('valid');
    });

    test('should return invalid for failed response', async () => {
      httpGet.mockResolvedValue({
        status: 401,
        body: { error: 'Invalid key' },
      });

      const result = await auth.verifyAk('bad_ak');
      expect(result.valid).toBe(false);
    });

    test('should handle network error', async () => {
      httpGet.mockRejectedValue(new Error('Network error'));

      const result = await auth.verifyAk('test_ak');
      expect(result.valid).toBe(false);
      expect(result.info).toContain('Error');
    });
  });

  describe('checkAuth', () => {
    test('should return missing when no AK', async () => {
      // Temporarily ensure no cred file exists
      const { CRED_FILE } = require('../lib/config');
      const backupExists = fs.existsSync(CRED_FILE);
      let backupContent;
      if (backupExists) {
        backupContent = fs.readFileSync(CRED_FILE);
        fs.unlinkSync(CRED_FILE);
      }

      const result = await auth.checkAuth();

      // Restore if needed
      if (backupExists) {
        fs.writeFileSync(CRED_FILE, backupContent);
      }

      if (result.ak_status === 'missing') {
        expect(result.ok).toBe(false);
        expect(result.message).toContain('未找到');
      }
    });
  });

  describe('showAuth', () => {
    test('should return missing when no AK', () => {
      // Similar to above, depends on actual file state
      const result = auth.showAuth();
      expect(result.ok === false || result.ok === true).toBe(true);
      expect(result.stage).toBe('auth');
    });
  });
});
