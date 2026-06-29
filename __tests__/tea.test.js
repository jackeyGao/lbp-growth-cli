/**
 * @jest-environment node
 */
const tea = require('../lib/tea');

jest.mock('../lib/http', () => ({
  httpGet: jest.fn(),
  httpPost: jest.fn(),
}));

const { httpGet, httpPost } = require('../lib/http');
const { TEA_DAILY_URL } = require('../lib/config');

describe('tea', () => {
  beforeEach(() => {
    httpGet.mockClear();
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

  describe('listTeaDaily', () => {
    test('should get tea daily data with filters', async () => {
      const mockItems = [
        {
          id: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
          date: '2026-06-01',
          open_from: 'instruction_do_you_know_me',
          pv: 1286,
        },
      ];
      httpGet.mockResolvedValue({
        status: 200,
        body: { items: mockItems, total: 1, page: 1, pageSize: 100 },
      });

      const result = await tea.listTeaDaily('test_ak', {
        startDate: '2026-06-01',
        endDate: '2026-06-30',
        openFrom: 'instruction_do_you_know_me',
        page: 1,
        pageSize: 100,
      });

      expect(httpGet).toHaveBeenCalledWith(
        `${TEA_DAILY_URL}?page=1&pageSize=100&startDate=2026-06-01&endDate=2026-06-30&openFrom=instruction_do_you_know_me`,
        'test_ak'
      );
      expect(result.ok).toBe(true);
      expect(result.items).toHaveLength(1);
      expect(result.total).toBe(1);
      expect(result.pageSize).toBe(100);
    });

    test('should use default page size 100', async () => {
      httpGet.mockResolvedValue({
        status: 200,
        body: { items: [], total: 0, page: 1, pageSize: 100 },
      });

      const result = await tea.listTeaDaily('test_ak');

      expect(httpGet).toHaveBeenCalledWith(`${TEA_DAILY_URL}?page=1&pageSize=100`, 'test_ak');
      expect(result.ok).toBe(true);
      expect(result.pageSize).toBe(100);
    });

    test('should return admin role hint on 403', async () => {
      httpGet.mockResolvedValue({
        status: 403,
        body: { error: 'Forbidden' },
      });

      const result = await tea.listTeaDaily('test_ak');

      expect(result.ok).toBe(false);
      expect(result.hint).toContain('push_admin');
      expect(result.hint).toContain('super_admin');
    });
  });
});
