/**
 * @jest-environment node
 */
const tea = require('../lib/tea');

jest.mock('../lib/http', () => ({
  httpPost: jest.fn(),
}));

const { httpPost } = require('../lib/http');
const { TEA_DAILY_URL } = require('../lib/config');

describe('tea', () => {
  beforeEach(() => {
    httpPost.mockClear();
  });

  describe('validateDailyPayload', () => {
    test('should validate required fields', () => {
      expect(tea.validateDailyPayload({ date: '', openFrom: 'foo', pv: 1 })).toContain('--date');
      expect(tea.validateDailyPayload({ date: '2026-06-01', openFrom: '', pv: 1 })).toContain('--open-from');
      expect(tea.validateDailyPayload({ date: '2026-06-01', openFrom: 'foo' })).toContain('--pv');
    });

    test('should validate date format and pv', () => {
      expect(tea.validateDailyPayload({ date: '2026/06/01', openFrom: 'foo', pv: 1 })).toContain('YYYY-MM-DD');
      expect(tea.validateDailyPayload({ date: '2026-06-01', openFrom: 'foo', pv: -1 })).toContain('非负整数');
      expect(tea.validateDailyPayload({ date: '2026-06-01', openFrom: 'foo', pv: 1.2 })).toContain('非负整数');
    });

    test('should pass valid payload', () => {
      expect(tea.validateDailyPayload({ date: '2026-06-01', openFrom: 'instruction_do_you_know_me', pv: 1286 })).toBeNull();
    });
  });

  describe('syncTeaDaily', () => {
    test('should post to tea daily endpoint and return record', async () => {
      httpPost.mockResolvedValue({
        status: 200,
        body: {
          id: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
          date: '2026-06-01',
          open_from: 'instruction_do_you_know_me',
          pv: 1286,
        },
      });

      const result = await tea.syncTeaDaily('test_ak', {
        date: '2026-06-01',
        openFrom: 'instruction_do_you_know_me',
        pv: 1286,
      });

      expect(httpPost).toHaveBeenCalledWith(TEA_DAILY_URL, 'test_ak', {
        date: '2026-06-01',
        open_from: 'instruction_do_you_know_me',
        pv: 1286,
      });
      expect(result.ok).toBe(true);
      expect(result.record.id).toBe('a1b2c3d4-e5f6-7890-abcd-ef1234567890');
    });

    test('should return super admin hint on 403', async () => {
      httpPost.mockResolvedValue({
        status: 403,
        body: { error: 'Forbidden' },
      });

      const result = await tea.syncTeaDaily('test_ak', {
        date: '2026-06-01',
        openFrom: 'instruction_do_you_know_me',
        pv: 1286,
      });

      expect(result.ok).toBe(false);
      expect(result.hint).toContain('super_admin');
    });
  });
});
