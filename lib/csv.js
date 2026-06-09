/**
 * CSV utilities
 */
const fs = require('fs');
const path = require('path');
const os = require('os');
const { MAX_CSV_BYTES, MAX_ROWS_PER_FILE } = require('./config');

function parseCSV(content) {
  const lines = content.split('\n').filter(l => l.trim());
  if (lines.length === 0) return [];

  const header = lines[0].trim().toLowerCase();
  const data = lines.slice(1);

  // Skip header if it looks like a header
  if (header === 'app_id' || header === 'bot_id') {
    return data.map(l => l.split(',')[0].trim()).filter(Boolean);
  }

  return lines.map(l => l.split(',')[0].trim()).filter(Boolean);
}

/**
 * 验证 CSV 格式是否符合要求
 * - 必须只有一列
 * - 每行内容必须以 'cli_' 开头
 */
function validateCSVFormat(csvPath) {
  const content = fs.readFileSync(csvPath, 'utf8');
  const lines = content.split('\n').filter(l => l.trim());

  if (lines.length === 0) {
    return {
      valid: false,
      error: 'CSV 文件为空',
    };
  }

  const errors = [];
  let hasHeader = false;
  let startIndex = 0;

  // 检查第一行是否是表头
  const firstLine = lines[0].trim();
  if (firstLine.toLowerCase() === 'app_id' || firstLine.toLowerCase() === 'bot_id') {
    hasHeader = true;
    startIndex = 1;
  }

  // 验证每一行
  for (let i = startIndex; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    // 检查是否只有一列
    const columns = line.split(',');
    if (columns.length > 1) {
      errors.push(`第 ${i + 1} 行包含多列数据`);
    }

    // 检查是否以 cli_ 开头
    const value = columns[0].trim();
    if (!value.startsWith('cli_')) {
      errors.push(`第 ${i + 1} 行内容不以 'cli_' 开头: ${value.slice(0, 50)}`);
    }
  }

  if (errors.length > 0) {
    return {
      valid: false,
      error: 'CSV 格式错误',
      details: errors.slice(0, 10), // 最多显示 10 个错误
      totalErrors: errors.length,
    };
  }

  return {
    valid: true,
    hasHeader,
    rowCount: lines.length - (hasHeader ? 1 : 0),
  };
}

function buildCSVFromApps(apps) {
  const lines = ['app_id', ...apps];
  return lines.join('\n');
}

function countCSVRows(csvPath) {
  const content = fs.readFileSync(csvPath, 'utf8');
  const rows = parseCSV(content);
  return {
    count: rows.length,
    sample: rows.slice(0, 10),
  };
}

function createTempCSV(apps) {
  const content = buildCSVFromApps(apps);
  const tmpPath = path.join(os.tmpdir(), `lbp_push_${Date.now()}.csv`);
  fs.writeFileSync(tmpPath, content);
  return tmpPath;
}

function checkCSVLimits(csvPath, strict = true) {
  const stats = fs.statSync(csvPath);
  const { count } = countCSVRows(csvPath);
  const issues = [];

  if (stats.size > MAX_CSV_BYTES) {
    issues.push(`CSV 文件大小 ${stats.size.toLocaleString()} 字节，超过服务端建议上限 ${MAX_CSV_BYTES.toLocaleString()} 字节 (30MB)`);
  }

  if (count > MAX_ROWS_PER_FILE) {
    issues.push(`CSV 行数 ${count.toLocaleString()}，超过单次建议上限 ${MAX_ROWS_PER_FILE.toLocaleString()} 条`);
  }

  if (issues.length === 0) return null;

  return {
    ok: strict ? false : true,
    stage: 'limits',
    strict,
    size_bytes: stats.size,
    row_count: count,
    max_bytes: MAX_CSV_BYTES,
    max_rows: MAX_ROWS_PER_FILE,
    issues,
    hint: '使用 `lbp-growth csv split <file>` 拆分大文件',
  };
}

function encodeCSVBase64(csvPath) {
  const content = fs.readFileSync(csvPath);
  return content.toString('base64');
}

function splitCSV(inputPath, outDir, rowsPerFile = MAX_ROWS_PER_FILE, prefix = 'part') {
  if (!fs.existsSync(inputPath)) {
    return {
      ok: false,
      stage: 'split',
      message: `输入文件不存在: ${inputPath}`,
      input: inputPath,
      total_rows: 0,
      rows_per_file: rowsPerFile,
      chunk_count: 0,
    };
  }

  const actualOutDir = outDir || path.dirname(inputPath);
  if (!fs.existsSync(actualOutDir)) {
    fs.mkdirSync(actualOutDir, { recursive: true });
  }

  const content = fs.readFileSync(inputPath, 'utf8');
  const rows = parseCSV(content);

  const total = rows.length;
  const perFile = Math.max(1, rowsPerFile);
  const chunks = [];

  for (let i = 0, idx = 1; i < total; i += perFile, idx++) {
    const part = rows.slice(i, i + perFile);
    const outPath = path.join(actualOutDir, `${prefix}_${String(idx).padStart(3, '0')}.csv`);
    fs.writeFileSync(outPath, `app_id\n${part.join('\n')}`);

    const stats = fs.statSync(outPath);
    chunks.push({
      index: idx,
      path: outPath,
      rows: part.length,
      bytes: stats.size,
    });
  }

  return {
    ok: true,
    stage: 'split',
    input: inputPath,
    total_rows: total,
    rows_per_file: perFile,
    chunk_count: chunks.length,
    chunks,
    next_step: "对每个分片分别调用 `lbp-growth push --csv <chunk_path> --name '<name>_part_NN'`",
  };
}

module.exports = {
  parseCSV,
  buildCSVFromApps,
  countCSVRows,
  createTempCSV,
  checkCSVLimits,
  encodeCSVBase64,
  validateCSVFormat,
  splitCSV,
};
