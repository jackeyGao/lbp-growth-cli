/**
 * @jest-environment node
 */
const { execSync } = require('child_process');
const path = require('path');

const CLI_PATH = path.join(__dirname, '..', 'bin', 'lbp-growth');

describe('CLI Integration', () => {
  describe('help and version', () => {
    test('should show version', () => {
      const output = execSync(`node ${CLI_PATH} --version`, { encoding: 'utf8' });
      expect(output).toContain('0.1.0');
    });

    test('should show help', () => {
      const output = execSync(`node ${CLI_PATH} --help`, { encoding: 'utf8' });
      expect(output).toContain('LBP Growth CLI');
      expect(output).toContain('auth');
      expect(output).toContain('push');
      expect(output).toContain('tasks');
    });

    test('should show auth help', () => {
      const output = execSync(`node ${CLI_PATH} auth --help`, { encoding: 'utf8' });
      expect(output).toContain('check');
      expect(output).toContain('save');
      expect(output).toContain('show');
    });
  });

  describe('auth commands', () => {
    test('auth check should require credentials', () => {
      try {
        execSync(`node ${CLI_PATH} auth check`, { encoding: 'utf8' });
        fail('Should have thrown');
      } catch (error) {
        const output = error.stdout || error.stderr || error.message;
        expect(output).toContain('ok');
        expect(output).toContain('false');
        expect(error.status).toBe(2);
      }
    });

    test('auth show should require credentials', () => {
      try {
        execSync(`node ${CLI_PATH} auth show`, { encoding: 'utf8' });
        fail('Should have thrown');
      } catch (error) {
        expect(error.status).toBe(2);
      }
    });
  });

  describe('csv commands', () => {
    const fs = require('fs');
    const os = require('os');

    test('csv split should work without auth', () => {
      const tmpFile = path.join(os.tmpdir(), `cli_test_${Date.now()}.csv`);
      fs.writeFileSync(tmpFile, 'app_id\napp1\napp2\napp3');

      const output = execSync(
        `node ${CLI_PATH} csv split ${tmpFile} --rows-per-file 2`,
        { encoding: 'utf8' }
      );

      const result = JSON.parse(output);
      expect(result.ok).toBe(true);
      expect(result.total_rows).toBe(3);
      expect(result.chunk_count).toBe(2);

      fs.unlinkSync(tmpFile);
    });

    test('csv split should error on non-existent file', () => {
      try {
        execSync(
          `node ${CLI_PATH} csv split /nonexistent/file.csv`,
          { encoding: 'utf8' }
        );
        fail('Should have thrown');
      } catch (error) {
        const output = error.stdout || error.stderr;
        const result = JSON.parse(output);
        expect(result.ok).toBe(false);
        expect(error.status).toBe(1);
      }
    });
  });

  describe('push command', () => {
    test('push should require auth', () => {
      try {
        execSync(
          `node ${CLI_PATH} push --name test --format card --content hello --apps app1`,
          { encoding: 'utf8' }
        );
        fail('Should have thrown');
      } catch (error) {
        const output = error.stdout || error.stderr;
        expect(output).toContain('NO_AK');
        expect(error.status).toBe(2);
      }
    });
  });

  describe('review command', () => {
    test('review should require auth', () => {
      try {
        execSync(`node ${CLI_PATH} review`, { encoding: 'utf8' });
        fail('Should have thrown');
      } catch (error) {
        const output = error.stdout || error.stderr;
        expect(output).toContain('NO_AK');
        expect(error.status).toBe(2);
      }
    });
  });

  describe('tasks command', () => {
    test('tasks list should require auth', () => {
      try {
        execSync(`node ${CLI_PATH} tasks list`, { encoding: 'utf8' });
        fail('Should have thrown');
      } catch (error) {
        const output = error.stdout || error.stderr;
        expect(output).toContain('NO_AK');
        expect(error.status).toBe(2);
      }
    });
  });

  describe('blocklist command', () => {
    test('blocklist should require auth', () => {
      try {
        execSync(`node ${CLI_PATH} blocklist`, { encoding: 'utf8' });
        fail('Should have thrown');
      } catch (error) {
        const output = error.stdout || error.stderr;
        expect(output).toContain('NO_AK');
        expect(error.status).toBe(2);
      }
    });
  });
});