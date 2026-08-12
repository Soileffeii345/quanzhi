#!/usr/bin/env node
import { database } from "./database.mjs";

const args = Object.fromEntries(process.argv.slice(2).map((arg) => arg.replace(/^--/, "").split("=")));
const limit = Math.max(1, Math.min(200, Number(args.limit ?? 40)));
const delayMs = Math.max(500, Number(args.delay ?? 1500));
const candidates = database.prepare(`SELECT * FROM box_sales
  WHERE verification_status='official_pending'
  ORDER BY collected_at LIMIT ?`).all(limit);
const update = database.prepare(`UPDATE box_sales SET verification_status=?, evidence_note=?
  WHERE normalized_box_code=? AND platform=? AND detail_url=?`);

function normalizedText(value) {
  return String(value ?? "").replace(/[^0-9A-Za-z]/g, "").toUpperCase();
}

async function verify(record) {
  if (!record.official_cert_url) return { result: "missing_url" };
  try {
    const response = await fetch(record.official_cert_url, {
      redirect: "follow",
      signal: AbortSignal.timeout(15000),
      headers: { "user-agent": "Mozilla/5.0 QuanzhiVerifier/1.0" },
    });
    const html = await response.text();
    const page = normalizedText(html);
    const box = normalizedText(record.display_box_code);
    const gradeNumber = String(record.grade).match(/\d{2}/)?.[0] ?? "";
    const pageHasBox = box.length >= 8 && page.includes(box);
    const pageHasGrade = !gradeNumber || page.includes(gradeNumber);
    if (response.ok && pageHasBox && pageHasGrade) {
      update.run("verified", "官方认证页包含完整盒号，且评级信息一致或原记录无可比评级", record.normalized_box_code, record.platform, record.detail_url);
      return { result: "verified" };
    }
    if (response.status === 404) {
      update.run("transaction_check_failed", "官方认证页返回404，待人工复核", record.normalized_box_code, record.platform, record.detail_url);
      return { result: "404" };
    }
    return { result: response.ok ? "content_mismatch" : `http_${response.status}` };
  } catch (error) {
    return { result: "network_error", error: error instanceof Error ? error.message : String(error) };
  }
}

const summary = { checked: 0, verified: 0, failed: 0, deferred: 0 };
for (const record of candidates) {
  const result = await verify(record);
  summary.checked += 1;
  if (result.result === "verified") summary.verified += 1;
  else if (result.result === "404") summary.failed += 1;
  else summary.deferred += 1;
  await new Promise((resolve) => setTimeout(resolve, delayMs));
}
summary.remaining = database.prepare("SELECT COUNT(*) count FROM box_sales WHERE verification_status='official_pending'").get().count;
console.log(JSON.stringify(summary, null, 2));
