/**
 * @jest-environment node
 */
const fs = require('fs');
const os = require('os');
const path = require('path');
const push = require('../lib/push');

// Mock the http module
jest.mock('../lib/http', () => ({
  httpPostMultipart: jest.fn(),
}));

const { httpPostMultipart } = require('../lib/http');

describe('push', () => {
  beforeEach(() => {
    httpPostMultipart.mockClear();
  });

  describe('createPush', () => {
    test('should return error when format=card but no content', async () => {
      const result = await push.createPush({
        ak: 'test_ak',
        name: 'Test',
        formatType: 'card',
        content: null,
        apps: 'app1,app2',
        confirm: false,
      });

      expect(result.ok).toBe(false);
      expect(result.stage).toBe('args');
      expect(result.message).toContain('content');
    });

    test('should return error when format=releaseNote but no releaseNoteIds', async () => {
      const result = await push.createPush({
        ak: 'test_ak',
        name: 'Test',
        formatType: 'releaseNote',
        releaseNoteIds: null,
        apps: 'app1,app2',
        confirm: false,
      });

      expect(result.ok).toBe(false);
      expect(result.stage).toBe('args');
      expect(result.message).toContain('release-note-ids');
    });

    test('should return error when no apps or csv', async () => {
      const result = await push.createPush({
        ak: 'test_ak',
        name: 'Test',
        formatType: 'card',
        content: 'hello',
        apps: null,
        csvPath: null,
        confirm: false,
      });

      expect(result.ok).toBe(false);
      expect(result.stage).toBe('args');
      expect(result.message).toContain('apps');
    });

    test('should return dry-run preview when not confirmed', async () => {
      const result = await push.createPush({
        ak: 'test_ak',
        name: 'Test Push',
        formatType: 'card',
        content: 'Hello World',
        apps: 'app1,app2,app3',
        confirm: false,
      });

      expect(result.ok).toBe(true);
      expect(result.dry_run).toBe(true);
      expect(result.request_preview.name).toBe('Test Push');
      expect(result.request_preview.app_count).toBe(3);
    });

    test('should push successfully when confirmed', async () => {
      httpPostMultipart.mockResolvedValue({
        status: 200,
        body: {
          taskId: 'task-123',
          previewUrl: '/sync/task-123',
          totalCount: 100,
        },
      });

      const result = await push.createPush({
        ak: 'test_ak',
        name: 'Test Push',
        formatType: 'card',
        content: 'Hello World',
        apps: 'app1,app2',
        confirm: true,
      });

      expect(result.ok).toBe(true);
      expect(result.task_id).toBe('task-123');
      expect(result.preview_url).toContain('/sync/task-123');
    });

    test('should handle scheduled push', async () => {
      const result = await push.createPush({
        ak: 'test_ak',
        name: 'Scheduled Push',
        formatType: 'card',
        content: 'Hello',
        apps: 'app1',
        scheduleType: 'scheduled',
        scheduleTime: null,
        confirm: false,
      });

      expect(result.ok).toBe(false);
      expect(result.message).toContain('schedule-time');
    });

    test('should handle API error', async () => {
      httpPostMultipart.mockResolvedValue({
        status: 400,
        body: { error: 'Invalid params' },
      });

      const result = await push.createPush({
        ak: 'test_ak',
        name: 'Test',
        formatType: 'card',
        content: 'Hello',
        apps: 'app1',
        confirm: true,
      });

      expect(result.ok).toBe(false);
      expect(result.stage).toBe('push');
    });

    test('should use csv file when provided', async () => {
      const tmpFile = path.join(os.tmpdir(), `test_csv_${Date.now()}.csv`);
      fs.writeFileSync(tmpFile, 'app_id\napp1\napp2\napp3');

      const result = await push.createPush({
        ak: 'test_ak',
        name: 'CSV Push',
        formatType: 'card',
        content: 'Hello',
        csvPath: tmpFile,
        confirm: false,
      });

      expect(result.ok).toBe(true);
      expect(result.request_preview.app_count).toBe(3);

      fs.unlinkSync(tmpFile);
    });
  });
});
