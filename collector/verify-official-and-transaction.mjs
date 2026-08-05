import { load } from "cheerio";
import { database } from "./database.mjs";

const candidates = database.prepare(`
  SELECT * FROM box_sales
  WHERE verification_status IN ('ocr_double_match', 'transaction_check_failed', 'official_pending')
  ORDER BY collected_at
`).all();

const setStatus = database.prepare(`
  UPDATE box_sales SET verification_status=?, evidence_note=?
  WHERE normalized_box_code=? AND platform=? AND detail_url=?
`);

const syncTransactionPrice = database.prepare(`
  UPDATE box_sales SET price=?, price_with_fee=?
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
    const imageName = new URL(record.evidence_image_url).pathname.split("/").pop();

    if (record.platform === "赵涌在线") {
      const json = html.match(/var\s+auction\s*=\s*(\{.+?\});\s*$/m)?.[1];
      if (!json) return { ok: false, reason: "transaction page lacks public auction data" };
      const auction = JSON.parse(json);
      const imageUrls = (auction.pictures ?? []).map((picture) => picture.src);
      const hasImage = Boolean(imageName && imageUrls.some((url) => url.includes(imageName)));
      const isCompleted = String(auction.status) === "3";
      let hasPrice = sameNumber(auction.currentPrice, record.price);
      const hasTime = !record.transacted_at || auction.endAt === record.transacted_at;
      let priceNote = "";
      if (hasImage && hasTime && !hasPrice && Number.isFinite(Number(auction.currentPrice))) {
        const currentPrice = Number(auction.currentPrice);
        const feeRate = Number(auction.buyChargeFee);
        const priceWithFee = Number.isFinite(feeRate)
          ? Math.round(currentPrice * (1 + feeRate / 100) * 100) / 100
          : null;
        syncTransactionPrice.run(currentPrice, priceWithFee, record.normalized_box_code, record.platform, record.detail_url);
        hasPrice = true;
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
for (const record of candidates) {
  const [official, transaction] = await Promise.all([verifyOfficial(record), verifyTransaction(record)]);
  const status = transaction.active
    ? "active_listing"
    : official.ok && transaction.ok
    ? "verified"
    : transaction.ok
      ? "official_pending"
      : "transaction_check_failed";
  const note = `second OCR matched; ${official.reason}; ${transaction.reason}`;
  setStatus.run(status, note, record.normalized_box_code, record.platform, record.detail_url);
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

const statusCounts = database.prepare("SELECT verification_status status, COUNT(1) count FROM box_sales GROUP BY verification_status ORDER BY status").all();
process.stdout.write(`${JSON.stringify({ checked: candidates.length, results, statusCounts, finishedAt: new Date().toISOString() }, null, 2)}\n`);
