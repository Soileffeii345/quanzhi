import { createWorker, PSM } from "tesseract.js";
import { database } from "./database.mjs";

const options = Object.fromEntries(process.argv.slice(2).map((item) => item.split("=")));
const concurrency = Math.max(1, Math.min(4, Number(options.concurrency ?? 2)));
const limit = Math.max(1, Number(options.limit ?? 10000));

const candidates = database.prepare(`
  SELECT normalized_box_code, platform, detail_url, evidence_image_url
  FROM box_sales
  WHERE verification_status IN ('ocr_pending_review', 'ocr_mismatch')
  ORDER BY collected_at
  LIMIT ?
`).all(limit);

const setStatus = database.prepare(`
  UPDATE box_sales
  SET verification_status=?, evidence_note=?
  WHERE normalized_box_code=? AND platform=? AND detail_url=?
`);

function allDigits(text) {
  return String(text ?? "").replace(/\D/g, "");
}

// Retry wrapper for DB writes
function dbRun(stmt, ...params) {
  for (let attempt = 0; attempt < 10; attempt++) {
    try { return stmt.run(...params); }
    catch (e) {
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

const recognitionModes = [PSM.SPARSE_TEXT, PSM.SINGLE_BLOCK, PSM.SINGLE_LINE, PSM.RAW_LINE];
const result = { selected: candidates.length, matched: 0, mismatched: 0, timedOut: 0, failed: 0 };
let cursor = 0;

async function runWorker() {
  let worker = await createWorker("eng");
  await worker.setParameters({
    tessedit_char_whitelist: "0123456789-",
    tessedit_pageseg_mode: PSM.SPARSE_TEXT,
    user_defined_dpi: "300",
  });
  try {
    while (cursor < candidates.length) {
      const index = cursor;
      cursor += 1;
      const candidate = candidates[index];
      try {
        const attempts = [];
        let matchedAttempt = null;
        for (const mode of recognitionModes) {
          await worker.setParameters({ tessedit_pageseg_mode: mode });
          let timer;
          try {
            const recognized = await Promise.race([
              worker.recognize(candidate.evidence_image_url),
              new Promise((_, reject) => { timer = setTimeout(() => reject(new Error("OCR_TIMEOUT")), 25000); }),
            ]);
            const recognizedDigits = allDigits(recognized.data.text);
            const attempt = { mode, confidence: Math.round(recognized.data.confidence), recognizedDigits };
            attempts.push(attempt);
            if (recognizedDigits.includes(candidate.normalized_box_code)) {
              matchedAttempt = attempt;
              break;
            }
          } finally {
            clearTimeout(timer);
          }
        }
        if (matchedAttempt) {
          dbRun(setStatus,"ocr_double_match", `首轮OCR与增强数字OCR逐位一致；模式 ${matchedAttempt.mode}，可信度 ${matchedAttempt.confidence}。`, candidate.normalized_box_code, candidate.platform, candidate.detail_url);
          result.matched += 1;
        } else {
          dbRun(setStatus,"ocr_mismatch", `四种版面模式均未包含完整候选盒号；不得进入正式索引。`, candidate.normalized_box_code, candidate.platform, candidate.detail_url);
          result.mismatched += 1;
        }
      } catch (error) {
        const timedOut = error instanceof Error && error.message === "OCR_TIMEOUT";
        dbRun(setStatus,timedOut ? "ocr_retry_needed" : "ocr_failed", timedOut ? "二次OCR超时，等待重试。" : `二次OCR失败：${error instanceof Error ? error.message : String(error)}`, candidate.normalized_box_code, candidate.platform, candidate.detail_url);
        result[timedOut ? "timedOut" : "failed"] += 1;
        if (timedOut) {
          await worker.terminate().catch(() => undefined);
          worker = await createWorker("eng");
          await worker.setParameters({ tessedit_char_whitelist: "0123456789-", tessedit_pageseg_mode: PSM.SPARSE_TEXT, user_defined_dpi: "300" });
        }
      }
    }
  } finally {
    await worker.terminate().catch(() => undefined);
  }
}

const startedAt = Date.now();
await Promise.all(Array.from({ length: concurrency }, () => runWorker()));
const statusCounts = database.prepare("SELECT verification_status status, COUNT(1) count FROM box_sales GROUP BY verification_status ORDER BY status").all();
process.stdout.write(`${JSON.stringify({ ...result, elapsedSeconds: Math.round((Date.now() - startedAt) / 1000), statusCounts, finishedAt: new Date().toISOString() }, null, 2)}\n`);
