import { load } from "cheerio";
import { database } from "./database.mjs";

const options = Object.fromEntries(process.argv.slice(2).map((entry) => {
  const [key, value = "true"] = entry.replace(/^--/, "").split("=");
  return [key, value];
}));
const limit = Math.max(1, Number(options.limit ?? 200));
const activeLimit = Math.max(1, Number(options["active-limit"] ?? 1200));
const concurrency = Math.max(1, Math.min(6, Number(options.concurrency ?? 3)));
const dryRun = options["dry-run"] === "true";
// NGC/PCGS currently reject automated checks. Transaction verification is
// still authoritative for publication; run with --skip-official=false only
// when an approved official lookup channel is available.
const skipOfficial = options["skip-official"] !== "false";
const verbose = options.verbose === "true";
const requestedStatus = options.status ?? "";

const activeCandidates = database.prepare(`
  SELECT * FROM box_sales
  WHERE verification_status IN ('active_listing', 'youbao_active')
  ORDER BY collected_at
  LIMIT ?
`).all(activeLimit);

const verificationCandidates = requestedStatus
  ? database.prepare(`
      SELECT * FROM box_sales
      WHERE verification_status = ?
      ORDER BY collected_at
      LIMIT ?
    `).all(requestedStatus, limit)
  : database.prepare(`
  SELECT * FROM box_sales
  WHERE verification_status IN ('ocr_double_match', 'transaction_check_failed', 'official_pending')
  ORDER BY CASE verification_status
    WHEN 'ocr_double_match' THEN 0
    WHEN 'official_pending' THEN 1
    ELSE 2
  END, collected_at
  LIMIT ?
`).all(limit);
const candidates = [...activeCandidates, ...verificationCandidates];

const setStatus = database.prepare(`
  UPDATE box_sales SET verification_status=?, evidence_note=?
  WHERE normalized_box_code=? AND platform=? AND detail_url=?
`);

const syncTransaction = database.prepare(`
  UPDATE box_sales
  SET price=?, price_with_fee=?,
      transacted_at=CASE WHEN ? <> '' THEN ? ELSE transacted_at END,
      collected_at=datetime('now')
  WHERE normalized_box_code=? AND platform=? AND detail_url=?
`);

function compactDigits(value) {
  return String(value ?? "").replace(/\D/g, "");
}

async function verifyOfficial(record) {
  try {
    const response = await fetch(record.official_cert_url, {
      headers: { "user-agent": "Mozilla/5.0 QuanzhiVerification/0.2" },
      redirect: "follow",
      signal: AbortSignal.timeout(15000),
    });
    if (!response.ok) return { ok: false, reason: `official HTTP ${response.status}` };
    const text = await response.text();
    const hasCode = compactDigits(text).includes(record.normalized_box_code);
    const gradeNumber = record.grade.match(/\d{2}/)?.[0] ?? "";
    const hasGrade = !gradeNumber || new RegExp(`(?:PF|MS|AU|XF|VF)?\\s*${gradeNumber}`, "i").test(text);
    if (/exceeded our limits|try again later|too many requests|captcha/i.test(text)) {
      return { ok: false, reason: "official rate limit" };
    }
    return hasCode && hasGrade
      ? { ok: true, reason: "official page contains box code and grade" }
      : { ok: false, reason: "official page did not confirm box code and grade" };
  } catch (error) {
    return { ok: false, reason: `official unavailable: ${error instanceof Error ? error.message : String(error)}` };
  }
}

function sameNumber(left, right) {
  return Number.isFinite(Number(left)) && Number(left) === Number(right);
}

async function verifyTransaction(record) {
  try {
    const response = await fetch(record.detail_url, {
      headers: {
        "user-agent": "QuanzhiVerification/0.2 (+low-frequency evidence check)",
        referer: record.platform === "赵涌在线" ? "https://zhaoonline.com/trade/qianbi/" : "https://www.yjzx.com/",
      },
      redirect: "follow",
      signal: AbortSignal.timeout(15000),
    });
    if (!response.ok) return { ok: false, reason: `transaction HTTP ${response.status}` };
    const html = await response.text();
    const imageName = record.evidence_image_url
      ? new URL(record.evidence_image_url).pathname.split("/").pop()
      : "";

    if (record.platform === "赵涌在线") {
      const json = html.match(/var\s+auction\s*=\s*(\{.+?\});\s*$/m)?.[1];
      if (!json) return { ok: false, reason: "transaction page lacks public auction data" };
      const auction = JSON.parse(json);
      const imageUrls = (auction.pictures ?? []).map((picture) => picture.src);
      const hasImage = Boolean(imageName && imageUrls.some((url) => url.includes(imageName)));
      const isCompleted = String(auction.status) === "3";
      const currentPrice = Number(auction.currentPrice);
      const feeRate = Number(auction.buyChargeFee);
      const priceWithFee = Number.isFinite(currentPrice) && Number.isFinite(feeRate)
        ? Math.round(currentPrice * (1 + feeRate / 100) * 100) / 100
        : null;
      const sourceTime = isCompleted ? String(auction.endAt ?? "") : "";
      if (!dryRun && Number.isFinite(currentPrice) && currentPrice > 0) {
        syncTransaction.run(currentPrice, priceWithFee, sourceTime, sourceTime, record.normalized_box_code, record.platform, record.detail_url);
      }
      let hasPrice = sameNumber(auction.currentPrice, record.price) || (Number.isFinite(currentPrice) && currentPrice > 0);
      const hasTime = !isCompleted || Boolean(sourceTime);
      let priceNote = "";
      if (!sameNumber(currentPrice, record.price) && Number.isFinite(currentPrice) && currentPrice > 0) {
        priceNote = `; refreshed stale price ${record.price} -> ${currentPrice}`;
      }
      if (!isCompleted) {
        return {
          ok: false,
          active: true,
          reason: `active listing status:${auction.status}; image:${hasImage}; currentPrice:${auction.currentPrice}`,
        };
      }
      return hasImage && hasPrice && hasTime
        ? { ok: true, reason: `completed auction confirms image, price and time${priceNote}` }
        : { ok: false, reason: `auction mismatch image:${hasImage} price:${hasPrice} time:${hasTime} sourcePrice:${auction.currentPrice} dbPrice:${record.price}` };
    }

    const $ = load(html);
    const text = $("body").text().replace(/\s+/g, " ").replaceAll(",", "");
    const hasImage = Boolean(imageName && html.includes(imageName));
    if (record.platform === "易金在线") {
      const isActive = /立即购买/.test(text) && /当前售价/.test(text);
      const currentPrice = Number(text.match(/(?:当前售价|成交价格)[：:]?\s*¥?\s*(\d+(?:\.\d+)?)/)?.[1] ?? 0);
      const sourceTime = text.match(/(?:上架时间|成交时间)[：:]?\s*(20\d{2}-\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2})/)?.[1] ?? "";
      if (!dryRun && currentPrice > 0) {
        syncTransaction.run(currentPrice, null, isActive ? "" : sourceTime, isActive ? "" : sourceTime, record.normalized_box_code, record.platform, record.detail_url);
      }
      if (isActive && hasImage && currentPrice > 0) {
        return { ok: false, active: true, reason: `active Yijin listing confirms image and current price ${currentPrice}` };
      }
      if (isActive) {
        return { ok: false, reason: `Yijin active listing mismatch image:${hasImage} price:${currentPrice}` };
      }
    }
    const priceText = String(record.price).replace(/\.0+$/, "");
    const hasPrice = !record.price || text.includes(priceText);
    const hasTime = !record.transacted_at || text.includes(record.transacted_at);
    return hasImage && hasPrice && hasTime
      ? { ok: true, reason: "transaction page confirms image, price and time" }
      : { ok: false, reason: `transaction mismatch image:${hasImage} price:${hasPrice} time:${hasTime}` };
  } catch (error) {
    return { ok: false, reason: `transaction unavailable: ${error instanceof Error ? error.message : String(error)}` };
  }
}

const results = [];
let cursor = 0;
async function runWorker() {
  while (cursor < candidates.length) {
    const record = candidates[cursor++];
  const [official, transaction] = await Promise.all([
    skipOfficial ? Promise.resolve({ ok: false, reason: "official check deferred" }) : verifyOfficial(record),
    verifyTransaction(record),
  ]);
  const status = transaction.active
    ? "active_listing"
    : official.ok && transaction.ok
    ? "verified"
    : transaction.ok
      ? "official_pending"
      : "transaction_check_failed";
  const note = `second OCR matched; ${official.reason}; ${transaction.reason}`;
  if (!dryRun) {
    setStatus.run(status, note, record.normalized_box_code, record.platform, record.detail_url);
  }
  results.push({
    boxCode: record.display_box_code,
    platform: record.platform,
    status,
    official,
    transaction,
    detailUrl: record.detail_url,
    officialUrl: record.official_cert_url,
  });
  }
}
await Promise.all(Array.from({ length: concurrency }, () => runWorker()));

const statusCounts = database.prepare("SELECT verification_status status, COUNT(1) count FROM box_sales GROUP BY verification_status ORDER BY status").all();
const resultCounts = Object.groupBy(results, (result) => result.status);
const summary = Object.fromEntries(Object.entries(resultCounts).map(([status, rows]) => [status, rows.length]));
process.stdout.write(`${JSON.stringify({ checked: candidates.length, activeChecked: activeCandidates.length, limit, activeLimit, concurrency, dryRun, skipOfficial, summary, ...(verbose ? { results } : {}), statusCounts, finishedAt: new Date().toISOString() }, null, 2)}\n`);
