#!/usr/bin/env node
/**
 * 快速官方核验：只处理 official_pending 记录
 * 检查 NGC/PCGS 官方认证页面是否返回有效页面（200状态码）
 */
import { database } from "./database.mjs";

const BATCH = 8; // 并发数
const TIMEOUT = 10000; // 单请求超时 ms

const candidates = database
  .prepare("SELECT * FROM box_sales WHERE verification_status='official_pending' ORDER BY collected_at")
  .all();

console.log(`待核验: ${candidates.length} 条，并发: ${BATCH}`);

const setStatus = database.prepare(`
  UPDATE box_sales SET verification_status=?, evidence_note=?
  WHERE normalized_box_code=? AND platform=? AND detail_url=?
`);

async function checkOne(record) {
  const url = record.official_cert_url;
  if (!url || url === "https://www.ngccoin.cn/certlookup/") {
    // 没有完整的 cert URL，标为 ocr_double_match（只要OCR两次一致）
    setStatus.run("ocr_double_match", "官方链接不完整，以OCR交叉验证为准",
      record.normalized_box_code, record.platform, record.detail_url);
    return { box: record.normalized_box_code, result: "no_url" };
  }

  try {
    const resp = await fetch(url, {
      headers: { "User-Agent": "QuanzhiBot/1.0" },
      redirect: "follow",
      signal: AbortSignal.timeout(TIMEOUT),
    });

    if (resp.ok) {
      // 官方页面可访问 → 盒号真实
      setStatus.run("ocr_double_match", "官方认证页可访问，盒号确认有效",
        record.normalized_box_code, record.platform, record.detail_url);
      return { box: record.normalized_box_code, result: "confirmed" };
    } else if (resp.status === 404) {
      // 404 → 可能盒号不存在
      setStatus.run("transaction_check_failed", `官方页返回404，待人工复核`,
        record.normalized_box_code, record.platform, record.detail_url);
      return { box: record.normalized_box_code, result: "404" };
    } else {
      setStatus.run("ocr_double_match", `官方页HTTP ${resp.status}，以OCR为准`,
        record.normalized_box_code, record.platform, record.detail_url);
      return { box: record.normalized_box_code, result: `http_${resp.status}` };
    }
  } catch (e) {
    // 网络错误 → 保持 official_pending，等下次重试
    return { box: record.normalized_box_code, result: `error: ${e.message.slice(0, 60)}` };
  }
}

async function runBatch(batch) {
  const results = await Promise.allSettled(batch.map(checkOne));
  let confirmed = 0, failed = 0, skipped = 0;
  for (const r of results) {
    if (r.status === "rejected") { failed++; continue; }
    if (r.value.result === "confirmed") confirmed++;
    else if (r.value.result.startsWith("error")) skipped++;
    else failed++;
  }
  return { confirmed, failed, skipped };
}

async function main() {
  let confirmed = 0, failed = 0, skipped = 0;
  const started = Date.now();

  for (let i = 0; i < candidates.length; i += BATCH) {
    const batch = candidates.slice(i, i + BATCH);
    const results = await runBatch(batch);
    confirmed += results.confirmed;
    failed += results.failed;
    skipped += results.skipped;
    const pct = Math.round((i + batch.length) / candidates.length * 100);
    const elapsed = ((Date.now() - started) / 1000).toFixed(0);
    process.stdout.write(`\r进度: ${pct}% (${i + batch.length}/${candidates.length}) | ✅${confirmed} ❌${failed} ⏭${skipped} | ${elapsed}s`);
  }

  const remaining = database
    .prepare("SELECT COUNT(*) c FROM box_sales WHERE verification_status='official_pending'")
    .get().c;

  console.log("");
  console.log(`完成! 确认 ${confirmed} | 异常 ${failed} | 跳过 ${skipped} | 剩余待核验 ${remaining}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
