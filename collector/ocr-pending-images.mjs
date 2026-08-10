import { createWorker } from "tesseract.js";
import { database, databaseStats } from "./database.mjs";

const options = Object.fromEntries(process.argv.slice(2).map((item) => item.split("=")));
const limit = Math.max(1, Number(options.limit ?? 100));
const concurrency = Math.max(1, Math.min(8, Number(options.concurrency ?? 8)));
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
  const clean = String(text ?? "").replace(/\s+/g, " ").trim();

  // NGC format 1: 7+3 with separator "8201459-017" or "8201459 017"
  const ngcSep = clean.match(/\b(\d{7})\s*[-–—\s]\s*(\d{3})\b/);
  if (ngcSep) return { company: "NGC", display: `${ngcSep[1]}-${ngcSep[2]}`, normalized: `${ngcSep[1]}${ngcSep[2]}` };

  // NGC format 2: 10 consecutive digits (OCR merged across separator)
  const ngc10 = clean.match(/\b(\d{10})\b/);
  if (ngc10) {
    const d = ngc10[1];
    return { company: "NGC", display: `${d.slice(0, 7)}-${d.slice(7)}`, normalized: d };
  }

  // PCGS format 1: explicit PCGS prefix (fuzzy: P C G S, PCCS, PC6S, etc.) + 8 digits
  const pcgsFuzzy = clean.match(/\b(?:P\s*C\s*G\s*S|PCCS|PC6S|PC\s*GS|Professional\s*Coin)\b.{0,120}?\b(\d{8})\b/i);
  if (pcgsFuzzy) return { company: "PCGS", display: pcgsFuzzy[1], normalized: pcgsFuzzy[1] };

  // PCGS format 2: original strict PCGS prefix
  const pcgs = clean.match(/\bPCGS\D{0,120}(\d{8})\b/i);
  if (pcgs) return { company: "PCGS", display: pcgs[1], normalized: pcgs[1] };

  // PCGS format 3: standalone 8-digit number with grade nearby (fallback for when "PCGS" unreadable)
  // Only match if the number starts with 8 (Chinese PCGS range) and there's grade text nearby
  const pcgsStandalone = clean.match(/(?:MS|PF|AU|XF|VF|UNC|PR|SP)\s*\d{2,3}\D{0,80}?\b(\d{8})\b/i);
  if (pcgsStandalone && /^[8]/.test(pcgsStandalone[1])) {
    return { company: "PCGS", display: pcgsStandalone[1], normalized: pcgsStandalone[1] };
  }

  // NGC format 3: 10-digit after grade (e.g. "MS 70 8201459017")
  const afterGrade = clean.match(/(?:MS|PF|AU|XF|VF|UNC|PR|SP)\s*\d{2,3}\D{1,20}?(\d{10})(?:\s|$)/i);
  if (afterGrade) {
    const d = afterGrade[1];
    return { company: "NGC", display: `${d.slice(0, 7)}-${d.slice(7)}`, normalized: d };
  }

  return null;
}

function extractGrade(text) {
  return text.match(/\b(?:PF|MS|AU|XF|VF|UNC|PR|SP)\s*\d{2}(?:\s+ULTRA\s+CAMEO|\s+DEEP\s+CAMEO|\s+CAMEO)?\b/i)?.[0].replace(/\s+/g, " ") ?? "待复核";
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

// Retry wrapper for DB writes — SQLite serializes writes, so retry on lock
function dbRun(stmt, ...params) {
  for (let attempt = 0; attempt < 10; attempt++) {
    try {
      return stmt.run(...params);
    } catch (e) {
      if (e.errstr === 'database is locked' && attempt < 9) {
        const delay = 50 + Math.random() * 200;
        const waitStart = Date.now();
        while (Date.now() - waitStart < delay) { /* spin */ }
        continue;
      }
      throw e;
    }
  }
}

// Prevent unhandled rejections in Tesseract workers from crashing the process
process.on('unhandledRejection', (reason) => {
  if (reason?.message === 'OCR_TIMEOUT') return; // expected
  // Log but don't crash — Tesseract internal worker.postMessage null errors
});

const result = { requested: limit, selected: pending.length, processed: 0, boxes: 0, timedOut: 0, failed: 0 };
let cursor = 0;

async function runWorker() {
  let ocr = null;
  let imagesSinceRecycle = 0;

  async function ensureWorker() {
    if (!ocr) {
      ocr = await createWorker("eng");
      imagesSinceRecycle = 0;
    }
  }

  try {
    await ensureWorker();
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
        dbRun(updateImage,ocrText, confidence, box?.normalized ?? null, box?.display ?? null, box?.company ?? null, now, image.platform, image.platform_product_id, image.image_url);
        if (box && image.price && image.transacted_at) {
          const grade = extractGrade(ocrText);
          const officialCertUrl = buildCertUrl(box, grade);
          if (officialCertUrl) {
            dbRun(insertSale,box.normalized, box.display, box.company, grade, image.title, image.platform, image.platform_product_id, image.detail_url, officialCertUrl, image.price, image.price_with_fee, image.transacted_at, image.product_code, image.image_url, ocrText, confidence, now);
            result.boxes += 1;
          }
        }
        result.processed += 1;
        imagesSinceRecycle++;
        // Recycle worker every 100 images to prevent state corruption
        if (imagesSinceRecycle >= 100) {
          await ocr.terminate().catch(() => {});
          ocr = null;
          await ensureWorker();
        }
      } catch (error) {
        const timedOut = error instanceof Error && error.message === "OCR_TIMEOUT";
        result[timedOut ? "timedOut" : "failed"] += 1;
        try { dbRun(updateImage,"", 0, null, null, null, new Date().toISOString(), image.platform, image.platform_product_id, image.image_url); } catch {}
        // Recycle worker on any error
        await ocr.terminate().catch(() => {});
        ocr = null;
        await ensureWorker();
      } finally {
        clearTimeout(timer);
      }
    }
  } finally {
    await ocr?.terminate().catch(() => undefined);
  }
}

const startedAt = Date.now();
await Promise.all(Array.from({ length: concurrency }, () => runWorker()));
process.stdout.write(`${JSON.stringify({ ...result, elapsedSeconds: Math.round((Date.now() - startedAt) / 1000), database: databaseStats(), finishedAt: new Date().toISOString() }, null, 2)}\n`);
