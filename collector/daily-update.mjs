#!/usr/bin/env node

/**
 * 泉知每日数据更新脚本
 *
 * 流程：
 *   1. 发现易金在线公开新商品
 *   2. 发现赵涌在线公开新成交
 *   3. 下载新商品图片
 *   4. OCR 识别图片中的盒号
 *   5. 验证候选盒号
 *   6. 导出静态 JSON 到 public/box-data/
 *
 * 用法：
 *   node collector/daily-update.mjs
 *   node collector/daily-update.mjs --quick   (仅导出，跳过采集)
 *   node collector/daily-update.mjs --cron    (静默模式，用于定时任务)
 */

import { execSync } from "node:child_process";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { writeFile } from "node:fs/promises";

const collectorDir = dirname(fileURLToPath(import.meta.url));
const rootDir = resolve(collectorDir, "..");
const args = process.argv.slice(2);
const quick = args.includes("--quick");
const cron = args.includes("--cron");

function log(message) {
  const timestamp = new Date().toISOString().slice(0, 19).replace("T", " ");
  const line = `[${timestamp}] ${message}`;
  if (!cron) process.stdout.write(line + "\n");
}

function run(script, description) {
  log(`开始：${description}`);
  try {
    const scriptPath = resolve(collectorDir, script);
    execSync(`node "${scriptPath}"`, {
      cwd: rootDir,
      stdio: cron ? "pipe" : "inherit",
      timeout: 600_000, // 10 minutes per step
    });
    log(`完成：${description}`);
    return true;
  } catch (error) {
    log(`失败：${description} — ${error.message}`);
    return false;
  }
}

async function main() {
  log("================================================");
  log("泉知每日更新开始");
  log("================================================");

  const results = [];

  if (quick) {
    log("快速模式：仅执行 OCR + 验证 + 导出");
  } else {
    // Step 1: Discover new products
    results.push(run("discover-yijin-products.mjs", "发现易金在线公开新商品"));
    results.push(run("discover-zhao-public-sales.mjs", "发现赵涌在线公开新成交"));

    // Step 2: Download new images
    results.push(run("backfill-yijin-images.mjs", "下载易金在线新品图片"));
    results.push(run("backfill-zhao-images.mjs", "下载赵涌在线新品图片"));
  }

  // Step 3: OCR pending images
  results.push(run("ocr-pending-images.mjs", "OCR 识别待处理图片"));

  // Step 4: Verify candidate boxes
  results.push(run("verify-candidate-boxes.mjs", "验证候选盒号"));

  // Step 5: Verify against official records
  results.push(run("verify-official-and-transaction.mjs", "核验官方评级与成交记录"));

  // Step 6: Export to static JSON
  results.push(run("export-static-box-index.mjs", "导出静态盒号索引"));

  // Step 7: Rebuild site
  log("开始：重新构建网站");
  try {
    execSync("npm run build", { cwd: rootDir, stdio: cron ? "pipe" : "inherit", timeout: 300_000 });
    log("完成：重新构建网站");
    results.push(true);
  } catch (error) {
    log(`失败：重新构建网站 — ${error.message}`);
    results.push(false);
  }

  // Summary
  const success = results.filter(Boolean).length;
  const total = results.length;
  log("================================================");
  log(`每日更新完成：${success}/${total} 步骤成功`);
  log("================================================");

  // Write log file
  const logEntry = {
    timestamp: new Date().toISOString(),
    success,
    total,
    quick,
  };
  await writeFile(
    resolve(collectorDir, "data", "last-update.json"),
    JSON.stringify(logEntry, null, 2)
  );

  return success === total ? 0 : 1;
}

main()
  .then((code) => process.exit(code))
  .catch((error) => {
    log(`更新脚本异常退出：${error.message}`);
    process.exit(2);
  });
