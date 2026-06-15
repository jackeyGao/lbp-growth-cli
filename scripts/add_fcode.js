#!/usr/bin/env node
/**
 * CSV 第四列 tenant_id → F 码 转换脚本
 * 用法: node add_fcode.js <input.csv> [--limit N] [--output out.csv] [--verbose] [--concurrency N]
 *
 * 默认只处理前 100 行用于测试。
 * 查询方式：通过 bytedcli aeolus query 访问数据集 1836069 的 `[租户维度数据]` 表。
 */

const fs = require("fs");
const readline = require("readline");
const { spawn } = require("child_process");

const DATASET_ID = "1836069";
const AEOLUS_REGION = "cn";
const BYTEDCLI_TIMEOUT_MS = 60000;

function parseArgs() {
  const args = process.argv.slice(2);
  const file = args.find((a) => !a.startsWith("--"));
  const limitIdx = args.indexOf("--limit");
  const limit = limitIdx >= 0 ? parseInt(args[limitIdx + 1], 10) || 100 : 100;
  const outIdx = args.indexOf("--output");
  const output = outIdx >= 0 ? args[outIdx + 1] : null;
  const verbose = args.includes("--verbose");
  const concurrencyIdx = args.indexOf("--concurrency");
  const concurrency = concurrencyIdx >= 0 ? parseInt(args[concurrencyIdx + 1], 10) || 10 : 10;
  return { file, limit, output, verbose, concurrency };
}

function log(msg, verboseOnly = false) {
  if (verboseOnly) {
    if (global.verbose) console.log(`[VERBOSE] ${msg}`);
  } else {
    console.log(msg);
  }
}

async function readCSV(path, maxRows) {
  log(`→ 打开文件: ${path}`);
  const stream = fs.createReadStream(path, "utf8");
  const rl = readline.createInterface({ input: stream });
  const rows = [];
  let lineCount = 0;
  for await (const line of rl) {
    lineCount++;
    if (rows.length >= maxRows + 1) {
      log(`→ 已达到 ${maxRows + 1} 行（含表头），停止读取`);
      break;
    }
    rows.push(line.split(","));
  }
  log(`→ 共读取 ${rows.length} 行（含表头），原始文件总行数约 ${lineCount}`);
  return rows;
}

function runBytedCli(args) {
  return new Promise((resolve, reject) => {
    const cmd = "bytedcli";
    const fullArgs = ["--json", ...args];
    log(`[BYTEDCLI] ${cmd} ${fullArgs.join(" ")}`, true);
    const proc = spawn(cmd, fullArgs, { stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    let killed = false;

    const timer = setTimeout(() => {
      killed = true;
      proc.kill("SIGTERM");
      reject(new Error(`bytedcli 超时（>${BYTEDCLI_TIMEOUT_MS}ms）`));
    }, BYTEDCLI_TIMEOUT_MS);

    proc.stdout.on("data", (d) => { stdout += d; });
    proc.stderr.on("data", (d) => { stderr += d; });

    proc.on("close", (code) => {
      clearTimeout(timer);
      if (killed) return;
      log(`[BYTEDCLI] exit=${code} stdout=${stdout.length} stderr=${stderr.length}`, true);
      if (code !== 0 && !stdout.trim()) {
        return reject(new Error(stderr || `bytedcli exited ${code}`));
      }
      try {
        const json = JSON.parse(stdout);
        resolve(json);
      } catch (e) {
        reject(new Error(`非 JSON: ${stdout.slice(0, 200)}`));
      }
    });
  });
}

async function querySingleTenant(tenantId) {
  const sql = `SELECT tenant_id, display_id FROM \`[租户维度数据]\` PREWHERE tenant_id = '${tenantId}' LIMIT 1`;
  try {
    const res = await runBytedCli(["aeolus", "query", "-r", AEOLUS_REGION, DATASET_ID, sql]);
    if (res.status === "success" && res.data?.rows?.length) {
      const row = res.data.rows[0];
      return { tenantId, fCode: row[1], ok: true };
    }
    return { tenantId, fCode: null, ok: false, reason: res.error?.message || "无数据" };
  } catch (e) {
    return { tenantId, fCode: null, ok: false, reason: e.message };
  }
}

async function runWithConcurrency(items, fn, concurrency) {
  const results = [];
  let index = 0;
  async function worker() {
    while (index < items.length) {
      const i = index++;
      const item = items[i];
      const result = await fn(item);
      results[i] = result;
      if (result.ok) {
        log(`[${i + 1}/${items.length}] ✓ ${result.tenantId.slice(0, 16)}... → ${result.fCode}`);
      } else {
        log(`[${i + 1}/${items.length}] ✗ ${result.tenantId.slice(0, 16)}... 失败: ${result.reason}`);
      }
    }
  }
  const workers = Array.from({ length: concurrency }, () => worker());
  await Promise.all(workers);
  return results;
}

async function main() {
  const { file, limit, output, verbose, concurrency } = parseArgs();
  global.verbose = verbose;

  if (!file || !fs.existsSync(file)) {
    console.error("Usage: node add_fcode.js <input.csv> [--limit N] [--output out.csv] [--verbose] [--concurrency N]");
    process.exit(1);
  }

  log(`开始处理: ${file}`);
  log(`参数: limit=${limit}, concurrency=${concurrency}`);

  const rows = await readCSV(file, limit);
  if (rows.length === 0) {
    console.error("CSV 为空");
    process.exit(1);
  }

  const header = rows[0];
  const dataRows = rows.slice(1);
  const tenantIdIdx = 3;

  log(`表头列数: ${header.length}`);
  log(`数据行数: ${dataRows.length}`);

  const uniqueIds = [];
  const seen = new Set();
  for (const row of dataRows) {
    const tid = row[tenantIdIdx]?.trim();
    if (tid && !seen.has(tid)) {
      seen.add(tid);
      uniqueIds.push(tid);
    }
  }
  log(`去重后 tenant_id 数量: ${uniqueIds.length}`);

  log(`\n开始并发查询（并发数: ${concurrency}）...`);
  const results = await runWithConcurrency(uniqueIds, querySingleTenant, concurrency);

  const idToFCode = new Map();
  let resolved = 0;
  for (const r of results) {
    if (r.ok) {
      idToFCode.set(r.tenantId, r.fCode);
      resolved++;
    }
  }

  log(`\n查询完成: ${resolved} / ${uniqueIds.length} 个成功`);

  // 组装输出
  const newHeader = [...header, "f_code"];
  const outLines = [newHeader.join(",")];
  for (const row of dataRows) {
    const tid = row[tenantIdIdx]?.trim();
    const fCode = idToFCode.get(tid) || "";
    outLines.push([...row, fCode].join(","));
  }

  const outPath = output || file.replace(/\.csv$/, "_with_fcode.csv");
  fs.writeFileSync(outPath, outLines.join("\n") + "\n", "utf8");

  log(`\n✅ 完成！`);
  log(`输出文件: ${outPath}`);
  log(`总行数: ${dataRows.length}`);
  log(`成功解析 F 码: ${resolved} / ${uniqueIds.length}`);

  if (resolved < uniqueIds.length) {
    log(`\n⚠️  有 ${uniqueIds.length - resolved} 个 tenant_id 未解析。可能是数据集中无该租户记录。`);
  }
}

main().catch((e) => {
  console.error("脚本异常退出:", e);
  process.exit(1);
});
