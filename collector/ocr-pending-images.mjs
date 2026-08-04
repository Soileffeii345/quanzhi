import { createWorker } from "tesseract.js";
import { database, databaseStats } from "./database.mjs";

const options = Object.fromEntries(process.argv.slice(2).map((item) => item.split("=")));
const limit = Math.max(1, Number(options.limit ?? 100));
const concurrency = Math.max(1, Math.min(4, Number(options.concurrency ?? 2)));
const platform = options.platform ?? "";

const pending = database.prepare(`
  SELECT i.platform, i.platform_product_id, i.image_url,
         p.title, p.detail_url, p.price, p.price_with_fee,
         p.transacted_at, p.product_code
  FROM product_images i
  JOIN platform_products p
    ON p.platform=i.platform AND p.platform_product_id=i.platform_product_id
  WHERE i.ocr_text='' AND i.ocr_confidence IS NULL
    AND (?='' OR i.platform=?)
  ORDER BY p.transacted_at DESC, i.platform, i.platform_product_id
  LIMIT ?
`).all(platform, platform, limit);

const updateImage = database.prepare(`
  UPDATE product_images
  SET ocr_text=?, ocr_confidence=?, normalized_box_code=?,
      display_box_code=?, grading_company=?, scanned_at=?
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

function clean(value) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function extractBox(text) {
  const ngc = text.match(/\b(\d{7})\s*[- ]\s*(\d{3})\b/);
  if (ngc) return { company: "NGC", display: `${ngc[1]}-${ngc[2]}`, normalized: `${ngc[1]}${ngc[2]}` };
  const pcgs = text.match(/\bPCGS\D{0,30}(\d{8})\b/i);
  return pcgs ? { company: "PCGS", display: pcgs[1], normalized: pcgs[1] } : null;
}

function extractGrade(text) {
  return text.match(/\b(?:PF|MS|AU|XF|VF)\s*\d{2}(?:\s+ULTRA\s+CAMEO)?\b/i)?.[0].replace(/\s+/g, " ") ?? "待复核";
}

const result = { requested: limit, selected: pending.length, processed: 0, boxes: 0, timedOut: 0, failed: 0 };
let cursor = 0;

async function runWorker() {
  let ocr = await createWorker("eng");
  try {
    while (cursor < pending.length) {
      const index = cursor;
      cursor += 1;
      const image = pending[index];
      let timer;
      try {
        const recognized = await Promise.race([
          ocr.recognize(image.image_url),
          new Promise((_, reject) => { timer = setTimeout(() => reject(new Error("OCR_TIMEOUT")), 20000); }),
        ]);
        const ocrText = clean(recognized.data.text);
        const confidence = Math.round(recognized.data.confidence);
        const box = extractBox(ocrText);
        const now = new Date().toISOString();
        updateImage.run(ocrText, confidence, box?.normalized ?? null, box?.display ?? null, box?.company ?? null, now, image.platform, image.platform_product_id, image.image_url);
        if (box && image.price && image.transacted_at) {
          const grade = extractGrade(ocrText);
          const numericGrade = grade.match(/\d{2}/)?.[0] ?? "";
          const officialCertUrl = box.company === "NGC" && numericGrade
            ? `https://www.ngccoin.com/certlookup/${box.display}/${numericGrade}/`
            : box.company === "PCGS" ? `https://cn.pcgs.com/cert/${box.normalized}` : "";
          if (officialCertUrl) {
            insertSale.run(box.normalized, box.display, box.company, grade, image.title, image.platform, image.platform_product_id, image.detail_url, officialCertUrl, image.price, image.price_with_fee, image.transacted_at, image.product_code, image.image_url, ocrText, confidence, now);
            result.boxes += 1;
          }
        }
        result.processed += 1;
      } catch (error) {
        const timedOut = error instanceof Error && error.message === "OCR_TIMEOUT";
        result[timedOut ? "timedOut" : "failed"] += 1;
        updateImage.run("", 0, null, null, null, new Date().toISOString(), image.platform, image.platform_product_id, image.image_url);
        if (timedOut) {
          await ocr.terminate().catch(() => undefined);
          ocr = await createWorker("eng");
        }
      } finally {
        clearTimeout(timer);
      }
    }
  } finally {
    await ocr.terminate().catch(() => undefined);
  }
}

const startedAt = Date.now();
await Promise.all(Array.from({ length: concurrency }, () => runWorker()));
process.stdout.write(`${JSON.stringify({ ...result, elapsedSeconds: Math.round((Date.now() - startedAt) / 1000), database: databaseStats(), finishedAt: new Date().toISOString() }, null, 2)}\n`);
