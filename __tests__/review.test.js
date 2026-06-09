/**
 * @jest-environment node
 */
const review = require('../lib/review');

// Mock the http module
jest.mock('../lib/http', () => ({
  httpGet: jest.fn(),
}));

const { httpGet } = require('../lib/http');

describe('review', () => {
  beforeEach(() => {
    httpGet.mockClear();
  });

  describe('yesterday', () => {
    test('should return date string', () => {
      const result = review.yesterday();
      expect(typeof result).toBe('string');
      expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });
  });

  describe('generateReview', () => {
    test('should return error when API fails', async () => {
      httpGet.mockResolvedValue({
        status: 401,
        body: { error: 'Unauthorized' },
      });

      const result = await review.generateReview('bad_ak', '2026-06-09');

      expect(result.ok).toBe(false);
      expect(result.stage).toBe('review');
    });

    test('should generate review successfully', async () => {
      const mockTasks = [
        {
          id: 'task1',
          name: 'Test Task',
          status: 'sent',
          totalCount: 1000,
          pushCount: 900,
          readCount: 450,
          clickCount: 90,
          readRate: 50,
          actionRate: 20,
          overallRate: 10,
        },
      ];

      httpGet.mockResolvedValue({
        status: 200,
        body: { items: mockTasks, total: 1, page: 1, pageSize: 200 },
      });

      const result = await review.generateReview('test_ak', '2026-06-09');

      expect(result.ok).toBe(true);
      expect(result.day).toBe('2026-06-09');
      expect(result.summary.task_count).toBe(1);
      expect(result.summary.push_count).toBe(900);
      expect(result.reportMd).toContain('LBP 推送复盘');
    });

    test('should calculate rates correctly', async () => {
      const mockTasks = [
        {
          id: 'task1',
          pushCount: 100,
          readCount: 50,
          clickCount: 10,
        },
      ];

      httpGet.mockResolvedValue({
        status: 200,
        body: { items: mockTasks, total: 1 },
      });

      const result = await review.generateReview('test_ak', '2026-06-09');

      expect(result.summary.read_rate).toBe(50); // 50/100
      expect(result.summary.action_rate).toBe(20); // 10/50
      expect(result.summary.overall_rate).toBe(10); // 10/100
    });

    test('should use yesterday when no day provided', async () => {
      httpGet.mockResolvedValue({
        status: 200,
        body: { items: [], total: 0 },
      });

      const result = await review.generateReview('test_ak');

      expect(result.day).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });
  });
});
