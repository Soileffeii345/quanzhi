/**
 * 重新扫描已有 OCR 文字但未提取出盒号的图片。
 * 使用更宽松的盒号识别规则。
 */
import { database, databaseStats } from "./database.mjs";

// ---- 改进后的盒号提取 ----

function extractBox(text) {
  const clean = String(text ?? "").replace(/\s+/g, " ").trim();
  if (!clean) return null;

  // NGC format 1: 7+3 with separator "8201459-017" or "8201459 017"
  const ngcSep = clean.match(/\b(\d{7})\s*[-–—\s]\s*(\d{3})\b/);
  if (ngcSep) {
    return {
      company: "NGC",
      display: `${ngcSep[1]}-${ngcSep[2]}`,
      normalized: `${ngcSep[1]}${ngcSep[2]}`,
    };
  }

  // NGC format 2: 10 consecutive digits (OCR merged across separator)
  // Only match if it's a full 10-digit number (not part of a longer number like a phone)
  const ngc10 = clean.match(/\b(\d{10})\b/);
  if (ngc10) {
    const d = ngc10[1];
    return {
      company: "NGC",
      display: `${d.slice(0, 7)}-${d.slice(7)}`,
      normalized: d,
    };
  }

  // PCGS format 1: explicit PCGS prefix + 8 digits
  const pcgsFuzzy = clean.match(/\b(?:P\s*C\s*G\s*S|PCCS|PC6S|PC\s*GS|Professional\s*Coin)\b.{0,120}?\b(\d{8})\b/i);
  if (pcgsFuzzy) {
    return {
      company: "PCGS",
      display: pcgsFuzzy[1],
      normalized: pcgsFuzzy[1],
    };
  }

  // PCGS format 2: original strict PCGS prefix
  const pcgsPrefix = clean.match(/\bPCGS\D{0,120}(\d{8})\b/i);
  if (pcgsPrefix) {
    return {
      company: "PCGS",
      display: pcgsPrefix[1],
      normalized: pcgsPrefix[1],
    };
  }

  // PCGS format 3: 8 isolated digits near PCGS-related text
  const pcgsNear = clean.match(/\b(?:PCGS|Professional\s*Coin)\b.{0,120}?\b(\d{8})\b/i);
  if (pcgsNear) {
    return {
      company: "PCGS",
      display: pcgsNear[1],
      normalized: pcgsNear[1],
    };
  }

  // PCGS format 4: standalone 8-digit number with grade nearby
  // (fallback when "PCGS" text is unreadable on holographic label)
  // Only match if number starts with 8 (Chinese PCGS range)
  const pcgsStandalone = clean.match(/(?:MS|PF|AU|XF|VF|UNC|PR|SP)\s*\d{2,3}\D{0,80}?\b(\d{8})\b/i);
  if (pcgsStandalone && /^[8]/.test(pcgsStandalone[1])) {
    return {
      company: "PCGS",
      display: pcgsStandalone[1],
      normalized: pcgsStandalone[1],
    };
  }

  // NGC format 3: 10-digit number not word-bounded but appears after coin description
  // Look for patterns like "MS 70 8201459017" or "PF 70 8616098030"
  const afterGrade = clean.match(/(?:MS|PF|AU|XF|VF|UNC|PR|SP)\s*\d{2,3}\D{1,20}?(\d{10})(?:\s|$)/i);
  if (afterGrade) {
    const d = afterGrade[1];
    return {
      company: "NGC",
      display: `${d.slice(0, 7)}-${d.slice(7)}`,
      normalized: d,
    };
  }

  return null;
}

function extractGrade(text) {
  const clean = String(text ?? "").replace(/\s+/g, " ").trim();
  return clean.match(/\b(?:PF|MS|AU|XF|VF|UNC|PR|SP)\s*\d{2}(?:\s+ULTRA\s+CAMEO|\s+DEEP\s+CAMEO|\s+CAMEO)?\b/i)?.[0]?.replace(/\s+/g, " ") ?? "待复核";
}

function buildCertUrl(box, grade) {
  if (box.company === "PCGS") {
    return `https://cn.pcgs.com/cert/${box.normalized}`;
  }
  const numericGrade = grade.match(/\d{2}/)?.[0] ?? "";
  if (numericGrade) {
    return `https://www.ngccoin.com/certlookup/${box.display}/${numericGrade}/`;
  }
  return `https://www.ngccoin.com/certlookup/${box.display}/`;
}

// ---- Main ----

const options = Object.fromEntries(process.argv.slice(2).map((item) => item.split("=")));
const limit = Math.max(1, Number(options.limit ?? 5000));
const dryRun = options["dry-run"] === "true";

// Find images that have OCR text with digits but no box extracted
const candidates = database.prepare(`
  SELECT i.platform, i.platform_product_id, i.image_url, i.ocr_text,
         p.title, p.detail_url, p.price, p.price_with_fee,
         p.transacted_at, p.product_code
  FROM product_images i
  JOIN platform_products p
    ON p.platform=i.platform AND p.platform_product_id=i.platform_product_id
  WHERE i.normalized_box_code IS NULL
    AND i.ocr_text != ''
    AND i.ocr_text != ' '
    AND i.ocr_text GLOB '*[0-9][0-9][0-9][0-9][0-9][0-9][0-9]*'
  ORDER BY p.transacted_at DESC
  LIMIT ?
`).all(limit);

console.log(`Found ${candidates.length} images with digits but no box extracted`);

const updateImage = database.prepare(`
  UPDATE product_images
  SET normalized_box_code=?, display_box_code=?, grading_company=?
  WHERE platform=? AND platform_product_id=? AND image_url=?
`);

const insertSale = database.prepare(`
  INSERT INTO box_sales (
    normalized_box_code, display_box_code, grading_company, grade, coin_name,
    platform, platform_product_id, detail_url, official_cert_url, price,
    price_with_fee, transacted_at, product_code, evidence_image_url, ocr_text,
    ocr_confidence, verification_status, collected_at
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'ocr_pending_review', ?)
  ON CONFLICT(normalized_box_code, platform, detail_url) DO UPDATE SET
    grade=excluded.grade, evidence_image_url=excluded.evidence_image_url,
    ocr_text=excluded.ocr_text, ocr_confidence=excluded.ocr_confidence,
    collected_at=excluded.collected_at
`);

let extracted = 0;
let inserted = 0;

for (const img of candidates) {
  const box = extractBox(img.ocr_text);

  if (box) {
    extracted++;
    updateImage.run(box.normalized, box.display, box.company, img.platform, img.platform_product_id, img.image_url);

    // Only create box_sale if we have price AND transaction time (completed sale)
    if (img.price && img.transacted_at) {
      const grade = extractGrade(img.ocr_text);
      const certUrl = buildCertUrl(box, grade);
      if (certUrl && !dryRun) {
        insertSale.run(
          box.normalized, box.display, box.company, grade, img.title,
          img.platform, img.platform_product_id, img.detail_url, certUrl,
          img.price, img.price_with_fee, img.transacted_at, img.product_code,
          img.image_url, img.ocr_text, 0, new Date().toISOString()
        );
        inserted++;
      }
    }
  }
}

const stats = databaseStats();
console.log(JSON.stringify({
  scanned: candidates.length,
  extracted,
  inserted,
  dryRun,
  database: stats,
  finishedAt: new Date().toISOString(),
}, null, 2));
