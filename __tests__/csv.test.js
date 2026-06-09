/**
 * @jest-environment node
 */
const fs = require('fs');
const path = require('path');
const os = require('os');
const csv = require('../lib/csv');

describe('csv', () => {
  const tmpDir = os.tmpdir();

  describe('parseCSV', () => {
    test('should parse CSV with header', () => {
      const content = 'app_id\napp1\napp2\napp3';
      const result = csv.parseCSV(content);
      expect(result).toEqual(['app1', 'app2', 'app3']);
    });

    test('should parse CSV without header', () => {
      const content = 'app1\napp2\napp3';
      const result = csv.parseCSV(content);
      expect(result).toEqual(['app1', 'app2', 'app3']);
    });

    test('should skip bot_id header', () => {
      const content = 'bot_id\napp1\napp2';
      const result = csv.parseCSV(content);
      expect(result).toEqual(['app1', 'app2']);
    });

    test('should filter empty lines', () => {
      const content = 'app_id\n\napp1\n\napp2\n';
      const result = csv.parseCSV(content);
      expect(result).toEqual(['app1', 'app2']);
    });
  });

  describe('buildCSVFromApps', () => {
    test('should build CSV from apps array', () => {
      const result = csv.buildCSVFromApps(['app1', 'app2', 'app3']);
      expect(result).toBe('app_id\napp1\napp2\napp3');
    });
  });

  describe('countCSVRows', () => {
    test('should count rows correctly', () => {
      const tmpFile = path.join(tmpDir, `test_count_${Date.now()}.csv`);
      fs.writeFileSync(tmpFile, 'app_id\napp1\napp2\napp3');

      const result = csv.countCSVRows(tmpFile);
      expect(result.count).toBe(3);
      expect(result.sample).toEqual(['app1', 'app2', 'app3']);

      fs.unlinkSync(tmpFile);
    });

    test('should return first 10 samples only', () => {
      const tmpFile = path.join(tmpDir, `test_count2_${Date.now()}.csv`);
      const apps = Array.from({ length: 20 }, (_, i) => `app${i + 1}`);
      fs.writeFileSync(tmpFile, 'app_id\n' + apps.join('\n'));

      const result = csv.countCSVRows(tmpFile);
      expect(result.count).toBe(20);
      expect(result.sample).toHaveLength(10);

      fs.unlinkSync(tmpFile);
    });
  });

  describe('createTempCSV', () => {
    test('should create temp CSV file', () => {
      const result = csv.createTempCSV(['app1', 'app2']);
      expect(fs.existsSync(result)).toBe(true);
      expect(fs.readFileSync(result, 'utf8')).toBe('app_id\napp1\napp2');
      fs.unlinkSync(result);
    });
  });

  describe('checkCSVLimits', () => {
    test('should return null for valid CSV', () => {
      const tmpFile = path.join(tmpDir, `test_limit_${Date.now()}.csv`);
      fs.writeFileSync(tmpFile, 'app_id\napp1');

      const result = csv.checkCSVLimits(tmpFile, true);
      expect(result).toBeNull();

      fs.unlinkSync(tmpFile);
    });

    test('should detect oversized file', () => {
      const tmpFile = path.join(tmpDir, `test_big_${Date.now()}.csv`);
      // Create a file bigger than 30MB
      const bigContent = 'x'.repeat(31 * 1024 * 1024);
      fs.writeFileSync(tmpFile, bigContent);

      const result = csv.checkCSVLimits(tmpFile, true);
      expect(result).not.toBeNull();
      expect(result.ok).toBe(false);
      expect(result.issues.length).toBeGreaterThan(0);

      fs.unlinkSync(tmpFile);
    });
  });

  describe('encodeCSVBase64', () => {
    test('should encode CSV to base64', () => {
      const tmpFile = path.join(tmpDir, `test_b64_${Date.now()}.csv`);
      fs.writeFileSync(tmpFile, 'app_id\napp1');

      const result = csv.encodeCSVBase64(tmpFile);
      const decoded = Buffer.from(result, 'base64').toString('utf8');
      expect(decoded).toBe('app_id\napp1');

      fs.unlinkSync(tmpFile);
    });
  });

  describe('splitCSV', () => {
    test('should split CSV into chunks', () => {
      const inputFile = path.join(tmpDir, `test_split_${Date.now()}.csv`);
      const apps = Array.from({ length: 10 }, (_, i) => `app${i + 1}`);
      fs.writeFileSync(inputFile, 'app_id\n' + apps.join('\n'));

      const outDir = path.join(tmpDir, `test_out_${Date.now()}`);
      const result = csv.splitCSV(inputFile, outDir, 3, 'part');

      expect(result.ok).toBe(true);
      expect(result.total_rows).toBe(10);
      expect(result.chunk_count).toBe(4); // 3+3+3+1

      // Cleanup
      fs.rmSync(outDir, { recursive: true, force: true });
      fs.unlinkSync(inputFile);
    });

    test('should return error for non-existent file', () => {
      const result = csv.splitCSV('/nonexistent/file.csv');
      expect(result.ok).toBe(false);
      expect(result.message).toContain('不存在');
    });
  });
});
