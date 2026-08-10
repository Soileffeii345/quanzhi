#!/usr/bin/env node

/**
 * 泉知每日轻量更新
 *
 * 设计原则：
 *   - 只处理增量数据（不重扫已有）
 *   - 每日运行时间控制在 20 分钟内
 *   - 失败不阻塞，单步骤失败记录后继续
 *   - 最终导出 + 构建 + Cloudflare Workers 部署
 *
 * 用法：
 *   node collector/daily-lightweight.mjs             # 完整更新
 *   node collector/daily-lightweight.mjs --dry-run    # 仅检查，不写入
 *   node collector/daily-lightweight.mjs --no-deploy   # 跳过构建和部署
 */

import { execSync } from "node:child_process";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { database } from "./database.mjs";

const collectorDir = dirname(fileURLToPath(import.meta.url));
const rootDir = resolve(collectorDir, "..");
const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
const noDeploy = args.includes("--no-deploy");

// ── 日志 ──────────────────────────────────────────────
const logLines = [];
function log(msg) {
  const ts = new Date().toISOString().slice(0, 19).replace("T", " ");
  const line = `[${ts}] ${msg}`;
  logLines.push(line);
  process.stdout.write(line + "\n");
}

// ── 工具函数 ──────────────────────────────────────────
function run(script, description, timeout = 600_000) {
  log(`▶ ${description}`);
  if (dryRun) {
    log(`  [dry-run] 跳过: node collector/${script}`);
    return true;
  }
  const scriptPath = resolve(collectorDir, script);
  if (!existsSync(scriptPath)) {
    log(`  ⚠ 脚本不存在: ${scriptPath}`);
    return false;
  }
  try {
    const t0 = Date.now();
    execSync(`node "${scriptPath}"`, {
      cwd: rootDir,
      stdio: "pipe",
      timeout,
      maxBuffer: 10 * 1024 * 1024,
    });
    const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
    log(`  ✓ 完成 (${elapsed}s)`);
    return true;
  } catch (error) {
    const stderr = error.stderr?.toString().slice(-300) || error.message;
    log(`  ✗ 失败: ${stderr.replace(/\n/g, " ")}`);
    return false;
  }
}

function checkDB() {
  // Safety: ensure DB is not locked by another process
  try {
    database.prepare("SELECT COUNT(*) FROM box_sales").get();
    return true;
  } catch {
    return false;
  }
}

async function buildAndDeploy() {
  if (dryRun || noDeploy) {
    log("⏭ 跳过构建和部署");
    return true;
  }

  // Step 1: Build
  log("▶ 构建网站 (vinext build)");
  try {
    const t0 = Date.now();
    execSync("npm run build", {
      cwd: rootDir,
      stdio: "pipe",
      timeout: 300_000,
      maxBuffer: 10 * 1024 * 1024,
    });
    const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
    log(`  ✓ 构建完成 (${elapsed}s)`);

  } catch (error) {
    const stderr = error.stderr?.toString().slice(-300) || error.message;
    log(`  ✗ 构建失败: ${stderr.replace(/\n/g, " ")}`);
    return false;
  }

  // Step 2: Deploy to Cloudflare Workers
  log("▶ 部署到 Cloudflare Workers");
  try {
    const t0 = Date.now();
    execSync("npx wrangler deploy --config wrangler.jsonc", {
      cwd: resolve(rootDir, "dist", "server"),
      stdio: "pipe",
      timeout: 300_000,
      maxBuffer: 2 * 1024 * 1024,
    });
    const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
    log(`  ✓ 已部署到 Cloudflare (${elapsed}s)`);
    log(`  🌐 https://quanzhi.quanzhi.workers.dev`);
    return true;
  } catch (error) {
    const stdout = error.stdout?.toString() || "";
    const urlMatch = stdout.match(/https:\/\/[a-z0-9-]+\.quanzhi\.workers\.dev/);
    if (urlMatch) log(`  ⚠ 部署可能已成功: ${urlMatch[0]}`);
    const stderr = error.stderr?.toString().slice(-300) || error.message;
    log(`  ✗ 部署失败: ${stderr.replace(/\n/g, " ")}`);
    return false;
  }
}

// ── 主流程 ────────────────────────────────────────────
async function main() {
  const startTime = Date.now();
  log("═══════════════════════════════════════════");
  log("泉知 · 每日轻量更新");
  log("═══════════════════════════════════════════");

  if (!checkDB()) {
    log("❌ 数据库无法访问（可能被其他进程锁定），退出");
    return 1;
  }

  const before = {
    products: database.prepare("SELECT COUNT(*) c FROM platform_products").get().c,
    sales: database.prepare("SELECT COUNT(*) c FROM box_sales").get().c,
    pending: database.prepare("SELECT COUNT(*) c FROM product_images WHERE ocr_text IS NULL").get().c,
    unverified: database.prepare("SELECT COUNT(*) c FROM box_sales WHERE verification_status IN ('ocr_pending_review','ocr_mismatch')").get().c,
  };
  log(`起始状态: ${before.products} 商品 · ${before.sales} 条盒号 · ${before.pending} 待OCR · ${before.unverified} 待验证`);

  const results = [];

  // Phase 1: 发现新商品 (快速, API only, ~3 min)
  log("\n── Phase 1: 发现 ──");
  results.push({ step: "易金发现", ok: run("discover-yijin-products.mjs", "易金在线新品发现", 180_000) });
  results.push({ step: "赵涌发现", ok: run("discover-zhao-public-sales.mjs", "赵涌在线新品发现", 180_000) });

  // Phase 2: 下载新图片 (~5 min)
  log("\n── Phase 2: 图片 ──");
  results.push({ step: "易金图片", ok: run("backfill-yijin-images.mjs", "易金图片回填", 300_000) });
  results.push({ step: "赵涌图片", ok: run("backfill-zhao-images.mjs", "赵涌图片回填", 300_000) });

  // Phase 3: OCR + 验证 (~10 min, limit to 100 images max)
  log("\n── Phase 3: OCR ──");
  // ocr-pending-images.mjs accepts limit/concurrency params
  results.push({ step: "OCR识别", ok: run("ocr-pending-images.mjs", "OCR 识别新图片 (limit=100)", 600_000) });
  results.push({ step: "盒号验证", ok: run("verify-candidate-boxes.mjs", "二次验证候选盒号 (limit=200)", 300_000) });

  // Phase 4: 官方核验
  log("\n── Phase 4: 核验 ──");
  results.push({ step: "官方核验", ok: run("verify-official-and-transaction.mjs", "核验官方评级与成交", 120_000) });

  // Phase 5: 导出静态 JSON
  log("\n── Phase 5: 导出 ──");
  const keywordOk = run("backfill-keywords.mjs", "回填关键词字段", 30_000);
  results.push({ step: "关键词回填", ok: keywordOk });
  const auditOk = keywordOk && run("audit-data.mjs", "验证发布数据真实性与完整性", 60_000);
  results.push({ step: "数据审计", ok: auditOk });
  if (auditOk) {
    results.push({ step: "静态导出", ok: run("export-static-box-index.mjs", "导出静态盒号索引", 120_000) });
    results.push({ step: "HTML导出", ok: run("export-database-html.mjs", "导出全量数据表", 60_000) });
  } else {
    log("  ✗ 数据审计未通过，停止导出与发布，保留上一版网站数据");
    results.push({ step: "静态导出", ok: false });
    results.push({ step: "HTML导出", ok: false });
  }

  // Phase 6: 构建 + Cloudflare Workers 部署
  log("\n── Phase 6: 发布 ──");
  const deployed = auditOk ? await buildAndDeploy() : false;
  results.push({ step: "构建部署", ok: deployed });

  // ── Summary ──
  const after = {
    products: database.prepare("SELECT COUNT(*) c FROM platform_products").get().c,
    sales: database.prepare("SELECT COUNT(*) c FROM box_sales WHERE verification_status='ocr_double_match'").get().c,
    pending: database.prepare("SELECT COUNT(*) c FROM product_images WHERE ocr_text IS NULL").get().c,
  };

  const elapsed = ((Date.now() - startTime) / 60_000).toFixed(1);
  log("\n═══════════════════════════════════════════");
  log(`更新完成 · 耗时 ${elapsed} 分钟`);
  log(`  商品: ${before.products} → ${after.products} (+${after.products - before.products})`);
  log(`  盒号: ${before.sales} → ${after.sales} (+${after.sales - before.sales})`);
  log(`  待OCR: ${after.pending}`);

  const passed = results.filter((r) => r.ok).length;
  const failed = results.filter((r) => !r.ok);
  log(`  步骤: ${passed}/${results.length} 成功`);
  if (failed.length > 0) {
    log(`  失败: ${failed.map((f) => f.step).join(", ")}`);
  }
  log("═══════════════════════════════════════════");

  // Write log
  const logEntry = { timestamp: new Date().toISOString(), elapsed, passed, total: results.length, results, before, after };
  await writeFile(resolve(collectorDir, "data", "last-update.json"), JSON.stringify(logEntry, null, 2));
  // Append to history
  const historyPath = resolve(collectorDir, "data", "update-history.jsonl");
  await writeFile(historyPath, JSON.stringify(logEntry) + "\n", { flag: "a" });

  return failed.length === 0 ? 0 : 1;
}

main()
  .then((code) => process.exit(code))
  .catch((error) => {
    log(`❌ 脚本崩溃: ${error.message}`);
    process.exit(2);
  });
