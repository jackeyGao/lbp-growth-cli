/**
 * @jest-environment node
 */
const tasks = require('../lib/tasks');

// Mock the http module
jest.mock('../lib/http', () => ({
  httpGet: jest.fn(),
  httpPut: jest.fn(),
  httpDelete: jest.fn(),
  httpDownload: jest.fn(),
}));

const { httpGet, httpPut, httpDelete, httpDownload } = require('../lib/http');

describe('tasks', () => {
  beforeEach(() => {
    httpGet.mockClear();
    httpPut.mockClear();
    httpDelete.mockClear();
    httpDownload.mockClear();
  });

  describe('listTasks', () => {
    test('should return tasks on success', async () => {
      const mockTasks = [
        { id: 'task1', name: 'Task 1', status: 'draft', totalCount: 100 },
        { id: 'task2', name: 'Task 2', status: 'sent', totalCount: 200 },
      ];

      httpGet.mockResolvedValue({
        status: 200,
        body: { items: mockTasks, total: 2, page: 1, pageSize: 20 },
      });

      const result = await tasks.listTasks('test_ak', { day: '2026-06-09' });

      expect(result.ok).toBe(true);
      expect(result.items).toHaveLength(2);
      expect(result.items[0].previewUrl).toBeDefined();
    });

    test('should return error on failure', async () => {
      httpGet.mockResolvedValue({
        status: 401,
        body: { error: 'Unauthorized' },
      });

      const result = await tasks.listTasks('bad_ak');

      expect(result.ok).toBe(false);
      expect(result.message).toContain('401');
    });
  });

  describe('updateTask', () => {
    test('should return error when no fields provided', async () => {
      const result = await tasks.updateTask('test_ak', 'task1', {});

      expect(result.ok).toBe(false);
      expect(result.stage).toBe('args');
      expect(result.message).toContain('至少');
    });

    test('should update task successfully', async () => {
      httpPut.mockResolvedValue({
        status: 200,
        body: { id: 'task1', name: 'Task 1', readCount: 1000 },
      });

      const result = await tasks.updateTask('test_ak', 'task1', { readCount: 1000 });

      expect(result.ok).toBe(true);
      expect(result.updated_fields).toEqual({ readCount: 1000 });
    });

    test('should handle update failure', async () => {
      httpPut.mockResolvedValue({
        status: 404,
        body: { error: 'Not found' },
      });

      const result = await tasks.updateTask('test_ak', 'bad_id', { readCount: 1000 });

      expect(result.ok).toBe(false);
    });
  });

  describe('deleteTask', () => {
    test('should return dry-run without confirm', async () => {
      const result = await tasks.deleteTask('test_ak', 'task1', false);

      expect(result.ok).toBe(true);
      expect(result.dry_run).toBe(true);
      expect(result.task_id).toBe('task1');
    });

    test('should delete successfully with confirm', async () => {
      httpDelete.mockResolvedValue({
        status: 200,
        body: { deleted: true, id: 'task1' },
      });

      const result = await tasks.deleteTask('test_ak', 'task1', true);

      expect(result.ok).toBe(true);
      expect(result.deleted).toBe(true);
    });

    test('should provide hint for non-draft task', async () => {
      httpDelete.mockResolvedValue({
        status: 403,
        body: { error: 'Forbidden' },
      });

      const result = await tasks.deleteTask('test_ak', 'task1', true);

      expect(result.ok).toBe(false);
      expect(result.hint).toContain('draft');
    });
  });

  describe('getBlocklist', () => {
    test('should return blocklist', async () => {
      httpGet.mockResolvedValue({
        status: 200,
        body: { blocklist: ['user1', 'user2', 'user3'] },
      });

      const result = await tasks.getBlocklist('test_ak');

      expect(result.ok).toBe(true);
      expect(result.count).toBe(3);
      expect(result.blocklist).toEqual(['user1', 'user2', 'user3']);
    });

    test('should save to file when output specified', async () => {
      const fs = require('fs');
      const os = require('os');
      const path = require('path');

      const tmpFile = path.join(os.tmpdir(), `blocklist_${Date.now()}.json`);

      httpGet.mockResolvedValue({
        status: 200,
        body: { blocklist: ['user1'] },
      });

      const result = await tasks.getBlocklist('test_ak', tmpFile);

      expect(result.ok).toBe(true);
      expect(result.output_file).toBe(tmpFile);
      expect(fs.existsSync(tmpFile)).toBe(true);

      // Cleanup
      fs.unlinkSync(tmpFile);
    });

    test('should handle auth error', async () => {
      httpGet.mockResolvedValue({
        status: 401,
        body: { error: 'Unauthorized' },
      });

      const result = await tasks.getBlocklist('bad_ak');

      expect(result.ok).toBe(false);
      expect(result.hint).toContain('API Key');
    });
  });

  describe('downloadTaskRawCsv', () => {
    test('should download raw csv successfully', async () => {
      const fs = require('fs');
      const os = require('os');
      const path = require('path');
      const tmpFile = path.join(os.tmpdir(), `raw_${Date.now()}.csv`);

      httpDownload.mockResolvedValue({
        status: 200,
        outputPath: tmpFile,
      });

      const result = await tasks.downloadTaskRawCsv('test_ak', 'task1', tmpFile);

      expect(result.ok).toBe(true);
      expect(result.output_path).toBe(tmpFile);
      expect(result.stage).toBe('download_raw_csv');
    });

    test('should handle 404 for raw csv', async () => {
      httpDownload.mockResolvedValue({
        status: 404,
        body: { error: 'Not found' },
      });

      const result = await tasks.downloadTaskRawCsv('test_ak', 'bad_id', '/tmp/out.csv');

      expect(result.ok).toBe(false);
      expect(result.hint).toContain('没有源文件');
    });
  });

  describe('downloadTaskFailureCsv', () => {
    test('should download failure csv successfully', async () => {
      const fs = require('fs');
      const os = require('os');
      const path = require('path');
      const tmpFile = path.join(os.tmpdir(), `failure_${Date.now()}.csv`);

      httpDownload.mockResolvedValue({
        status: 200,
        outputPath: tmpFile,
      });

      const result = await tasks.downloadTaskFailureCsv('test_ak', 'task1', tmpFile);

      expect(result.ok).toBe(true);
      expect(result.output_path).toBe(tmpFile);
      expect(result.stage).toBe('download_failure_csv');
    });

    test('should handle 404 for failure csv', async () => {
      httpDownload.mockResolvedValue({
        status: 404,
        body: { error: 'Not found' },
      });

      const result = await tasks.downloadTaskFailureCsv('test_ak', 'bad_id', '/tmp/out.csv');

      expect(result.ok).toBe(false);
      expect(result.hint).toContain('没有失败记录');
    });
  });

  describe('downloadTaskRealtimeClickCsv', () => {
    test('should download realtime click csv successfully', async () => {
      const os = require('os');
      const path = require('path');
      const tmpFile = path.join(os.tmpdir(), `realtime_click_${Date.now()}.csv`);

      httpDownload.mockResolvedValue({
        status: 200,
        outputPath: tmpFile,
      });

      const result = await tasks.downloadTaskRealtimeClickCsv('test_ak', 'task1', tmpFile);

      expect(result.ok).toBe(true);
      expect(result.output_path).toBe(tmpFile);
      expect(result.stage).toBe('download_realtime_click_csv');
    });

    test('should handle 404 for realtime click csv', async () => {
      httpDownload.mockResolvedValue({
        status: 404,
        body: { error: 'Not found' },
      });

      const result = await tasks.downloadTaskRealtimeClickCsv('test_ak', 'bad_id', '/tmp/out.csv');

      expect(result.ok).toBe(false);
      expect(result.hint).toContain('没有实时点击记录');
    });
  });
});
