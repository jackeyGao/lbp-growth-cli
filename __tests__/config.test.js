/**
 * @jest-environment node
 */
const config = require('../lib/config');

describe('config', () => {
  test('should export required constants', () => {
    expect(config.BASE_URL).toBeDefined();
    expect(config.BEARER_TOKEN).toBeDefined();
    expect(config.PUSH_URL).toBeDefined();
    expect(config.TASKS_URL).toBeDefined();
    expect(config.BLOCKLIST_URL).toBeDefined();
    expect(config.CRED_FILE).toBeDefined();
    expect(config.MAX_CSV_BYTES).toBe(30 * 1024 * 1024);
    expect(config.MAX_ROWS_PER_FILE).toBe(150000);
  });

  test('CRED_FILE should be in home directory', () => {
    expect(config.CRED_FILE).toContain('.lbp_growth');
    expect(config.CRED_FILE).toContain('credentials.json');
  });
});
