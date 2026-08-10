import { database } from "./database.mjs";
import { PUBLISHED_SALE_STATUSES, sqlIn } from "./publication-policy.mjs";

const checks = [
  ["SQLite integrity", () => database.prepare("PRAGMA integrity_check").get().integrity_check === "ok"],
  ["Foreign-key violations", () => database.prepare("PRAGMA foreign_key_check").all().length === 0],
  ["Invalid certificate number", () => database.prepare(`SELECT COUNT(*) c FROM box_sales WHERE normalized_box_code = '' OR normalized_box_code GLOB '*[^0-9]*' OR length(normalized_box_code) NOT IN (8, 10)`).get().c === 0],
  ["Published records missing transaction time", () => database.prepare(`SELECT COUNT(*) c FROM box_sales WHERE verification_status IN (${sqlIn(PUBLISHED_SALE_STATUSES)}) AND trim(transacted_at) = ''`).get().c === 0],
  ["Published records missing evidence URL", () => database.prepare(`SELECT COUNT(*) c FROM box_sales WHERE verification_status IN (${sqlIn(PUBLISHED_SALE_STATUSES)}) AND trim(evidence_image_url) = ''`).get().c === 0],
  ["Published records missing source URL", () => database.prepare(`SELECT COUNT(*) c FROM box_sales WHERE verification_status IN (${sqlIn(PUBLISHED_SALE_STATUSES)}) AND trim(detail_url) = ''`).get().c === 0],
  ["Published records missing keywords", () => database.prepare(`SELECT COUNT(*) c FROM box_sales WHERE verification_status IN (${sqlIn(PUBLISHED_SALE_STATUSES)}) AND trim(keywords) = ''`).get().c === 0],
  ["Published records with invalid price", () => database.prepare(`SELECT COUNT(*) c FROM box_sales WHERE verification_status IN (${sqlIn(PUBLISHED_SALE_STATUSES)}) AND (price IS NULL OR price <= 0)`).get().c === 0],
  ["Published records with unexpected source domain", () => database.prepare(`SELECT COUNT(*) c FROM box_sales WHERE verification_status IN (${sqlIn(PUBLISHED_SALE_STATUSES)}) AND NOT ((platform = '赵涌在线' AND detail_url LIKE 'https://zhaoonline.com/%') OR (platform = '易金在线' AND detail_url LIKE 'https://www.yjzx.com/%') OR (platform = '邮宝' AND detail_url LIKE 'https://%'))`).get().c === 0],
  ["Duplicate published source records", () => database.prepare(`SELECT COUNT(*) c FROM (SELECT platform, product_code, normalized_box_code, COUNT(*) n FROM box_sales WHERE verification_status IN (${sqlIn(PUBLISHED_SALE_STATUSES)}) GROUP BY platform, product_code, normalized_box_code HAVING n > 1)`).get().c === 0],
];

let failed = false;
for (const [name, check] of checks) {
  const passed = check();
  console.log(`${passed ? "PASS" : "FAIL"}  ${name}`);
  failed ||= !passed;
}

const statusCounts = database.prepare("SELECT verification_status, COUNT(*) count FROM box_sales GROUP BY verification_status ORDER BY count DESC").all();
console.log("\nStatus counts:");
for (const row of statusCounts) console.log(`  ${row.verification_status}: ${row.count}`);

if (failed) process.exitCode = 1;
