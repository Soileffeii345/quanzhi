/**
 * 回填所有已有盒号但未录入 box_sales 的已完成成交。
 * 修复：NGC 链接不依赖评级分也能生成。
 */
import { database, databaseStats } from "./database.mjs";

function extractGrade(text) {
  const clean = String(text ?? "").replace(/\s+/g, " ").trim();
  return clean.match(/\b(?:PF|MS|AU|XF|VF|UNC|PR|SP)\s*\d{2}(?:\s+ULTRA\s+CAMEO|\s+DEEP\s+CAMEO|\s+CAMEO)?\b/i)?.[0]?.replace(/\s+/g, " ") ?? "待复核";
}

function buildCertUrl(box, grade) {
  if (box.company === "PCGS") {
    return `https://cn.pcgs.com/cert/${box.normalized}`;
  }
  // NGC: try with grade first, fall back to without
  const numericGrade = grade.match(/\d{2}/)?.[0] ?? "";
  if (numericGrade) {
    return `https://www.ngccoin.com/certlookup/${box.display}/${numericGrade}/`;
  }
  return `https://www.ngccoin.com/certlookup/${box.display}/`;
}

const options = Object.fromEntries(process.argv.slice(2).map((item) => item.split("=")));
const dryRun = options["dry-run"] === "true";

// Find all completed sales with box numbers that are NOT yet in box_sales
const missing = database.prepare(`
  SELECT DISTINCT i.normalized_box_code, i.display_box_code, i.grading_company,
         i.ocr_text, i.image_url,
         p.platform, p.platform_product_id, p.title, p.detail_url,
         p.price, p.price_with_fee, p.transacted_at, p.product_code
  FROM product_images i
  JOIN platform_products p
    ON p.platform=i.platform AND p.platform_product_id=i.platform_product_id
  WHERE i.normalized_box_code IS NOT NULL
    AND p.price IS NOT NULL
    AND p.transacted_at IS NOT NULL
    AND NOT EXISTS (
      SELECT 1 FROM box_sales bs
      WHERE bs.normalized_box_code = i.normalized_box_code
        AND bs.platform = i.platform
        AND bs.detail_url = p.detail_url
    )
  ORDER BY p.transacted_at DESC
`).all();

console.log(`Found ${missing.length} missing box sales to backfill`);

const insertSale = database.prepare(`
  INSERT INTO box_sales (
    normalized_box_code, display_box_code, grading_company, grade, coin_name,
    platform, platform_product_id, detail_url, official_cert_url, price,
    price_with_fee, transacted_at, product_code, evidence_image_url, ocr_text,
    ocr_confidence, verification_status, collected_at
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 'ocr_pending_review', ?)
  ON CONFLICT(normalized_box_code, platform, detail_url) DO UPDATE SET
    grade=excluded.grade, evidence_image_url=excluded.evidence_image_url,
    ocr_text=excluded.ocr_text, collected_at=excluded.collected_at
`);

let inserted = 0;
for (const m of missing) {
  const grade = extractGrade(m.ocr_text);
  const certUrl = buildCertUrl(
    { company: m.grading_company, normalized: m.normalized_box_code, display: m.display_box_code },
    grade
  );

  if (!dryRun) {
    insertSale.run(
      m.normalized_box_code, m.display_box_code, m.grading_company, grade, m.title,
      m.platform, m.platform_product_id, m.detail_url, certUrl,
      m.price, m.price_with_fee, m.transacted_at, m.product_code,
      m.image_url, m.ocr_text, new Date().toISOString()
    );
  }
  inserted++;
}

const stats = databaseStats();
console.log(JSON.stringify({
  found: missing.length,
  inserted,
  dryRun,
  database: stats,
  finishedAt: new Date().toISOString(),
}, null, 2));
