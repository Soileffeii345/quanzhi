// Mass ID-range scanner for 易金在线.
// Detail IDs are dense (~100% valid from 50K to 630K).
// We ONLY ingest graded coins (rating = NGC/PCGS/PMG) to maximize box number yield.
// Images come from data-original="..." attributes (large_sell_*.jpg) on detail pages.
// Box numbers are extracted later by the OCR pipeline.

import { database, saveIndexedProduct } from "./database.mjs";

const options = Object.fromEntries(process.argv.slice(2).map(a => a.split("=")));
const START_ID = Number(options.start ?? 100000);
const END_ID   = Number(options.end   ?? 630000);
const CONCURRENCY = Math.max(1, Math.min(8, Number(options.concurrency ?? 8)));

function clean(s) { return (s ?? "").replace(/\s+/g, " ").trim(); }

function normalizeImageUrl(raw) {
  // data-original URLs contain /images/../AuctionImages/ — normalize
  try {
    return new URL(raw.replace(/\/images\/\.\.\//, "/")).toString();
  } catch {
    return raw.replace(/\/images\/\.\.\//, "/");
  }
}

async function parseYijinDetail(url, id) {
  const resp = await fetch(url, {
    headers: {
      "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
      referer: "https://www.yjzx.com/web2020/sell/list.html",
      "accept-language": "zh-CN,zh;q=0.9",
    },
    redirect: "follow",
    signal: AbortSignal.timeout(12000),
  });
  if (!resp.ok || resp.status === 403) return null;
  const html = await resp.text();

  // Coin name: <h2 class="cointit">...</h2>
  const titleMatch = html.match(/<h2\s+class="cointit"\s*>(.*?)<\/h2>/is);
  if (!titleMatch) return null;
  const title = clean(titleMatch[1]);
  if (!title) return null;

  // Rating/Grading: <p class="rating">...</p>
  const ratingMatch = html.match(/<p\s+class="rating"\s*>(.*?)<\/p>/is);
  const ratingText = ratingMatch ? clean(ratingMatch[1]) : "";

  // ONLY graded coins
  const ratingUpper = ratingText.toUpperCase();
  const isNGC  = ratingUpper.includes("NGC");
  const isPCGS = ratingUpper.includes("PCGS");
  const isPMG  = ratingUpper.includes("PMG");
  const isCGC  = ratingUpper.includes("CGC");
  if (!isNGC && !isPCGS && !isPMG && !isCGC) return null;

  // Determine grading company from rating text
  let gradingCompany = "";
  if (isPCGS) gradingCompany = "PCGS";
  else if (isNGC) gradingCompany = "NGC";
  else if (isPMG)  gradingCompany = "PMG";
  else if (isCGC)  gradingCompany = "CGC";

  // Status: "已成交" = sold, otherwise = active listing
  const isSold = /已成交/.test(html);

  // Price
  let price = null;
  let priceWithFee = null;
  if (isSold) {
    // 成交价格： <span class="price">¥27100</span>
    const priceMatch = html.match(/成交价格[：:][^¥]*¥(\d+(?:\.\d+)?)/i);
    if (priceMatch) price = Number(priceMatch[1]);
  } else {
    // 当前价格 or 商品价格
    const priceMatch = html.match(/(?:当前价格|商品价格)[^¥]*?¥\s*(\d+(?:\.\d+)?)/i);
    if (priceMatch) price = Number(priceMatch[1]);
  }

  // Transaction / listing time
  let transactedAt = "";
  if (isSold) {
    const timeMatch = html.match(/成交时间[：:]\s*<span[^>]*>(\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2})/i);
    if (timeMatch) transactedAt = timeMatch[1];
  } else {
    const timeMatch = html.match(/上架时间[：:]\s*<span[^>]*>(\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2})/i);
    if (timeMatch) transactedAt = timeMatch[1];
  }

  // Product code: 产品编号：<span title="KH142337">KH142337</span>
  const codeMatch = html.match(/产品编号[：:][^<]*<span[^>]*title="([^"]*)"/i);
  const productCode = codeMatch ? codeMatch[1] : "";

  // Image URLs from data-original attributes (large size for OCR)
  const imgRegex = /data-original="(https:\/\/images\.yjzx\.com\/[^"]*large_sell_[^"]+\.jpg)"/g;
  const sourceImageUrls = [...new Set([...html.matchAll(imgRegex)].map(m => normalizeImageUrl(m[1])))];

  if (sourceImageUrls.length === 0) return null;

  return {
    id,
    platform: "易金在线",
    title,
    detailUrl: url,
    price,
    priceWithFee,
    transactedAt,
    productCode,
    gradingCompany,
    isSold,
    sourceImageUrls,
  };
}

async function tryFetch(id) {
  try {
    const url = `https://www.yjzx.com/web2020/sell/detail/${id}.html`;
    return await parseYijinDetail(url, id);
  } catch {
    return null;
  }
}

async function main() {
  const totalIds = END_ID - START_ID;
  console.log(`易金 ID 扫描: ${START_ID} → ${END_ID} (${totalIds} IDs, ${CONCURRENCY} workers)`);

  const existingUrls = new Set(
    database.prepare("SELECT detail_url FROM platform_products WHERE platform = '易金在线'").all().map(r => r.detail_url)
  );
  console.log(`已有易金 platform_products: ${existingUrls.size}`);

  let scanned = 0, graded = 0, ingested = 0, images = 0, skipped = 0, missing = 0, errors = 0;
  let cursor = START_ID;
  const startTime = Date.now();

  async function worker() {
    while (cursor <= END_ID) {
      const id = cursor++;
      if (id > END_ID) break;
      scanned++;
      try {
        const page = await tryFetch(id);
        if (!page) {
          missing++;
        } else if (existingUrls.has(page.detailUrl)) {
          skipped++;
        } else {
          graded++;
          const pageImages = page.sourceImageUrls.map(imageUrl => ({
            imageUrl, ocrText: "", ocrConfidence: null, box: null,
          }));
          saveIndexedProduct(page, pageImages, []);
          ingested++;
          images += pageImages.length;
          existingUrls.add(page.detailUrl);
        }
      } catch {
        errors++;
      }

      // Progress report every 500 scans
      if (scanned % 500 === 0) {
        const elapsed = Math.max(1, Math.round((Date.now() - startTime) / 1000));
        const rate = Math.round(scanned / elapsed);
        const productTotal = database.prepare("SELECT COUNT(*) c FROM platform_products WHERE platform = '易金在线'").get().c;
        const imageTotal = database.prepare("SELECT COUNT(*) c FROM product_images WHERE platform = '易金在线'").get().c;
        console.log(`[${id}/${END_ID}] scanned:${scanned} graded:${graded} new:${ingested} imgs:${images} skip:${skipped} miss:${missing} err:${errors} | ${rate}/s | DB:${productTotal}p ${imageTotal}i`);
      }
    }
  }

  await Promise.all(Array.from({ length: CONCURRENCY }, () => worker()));

  const totalElapsed = Math.round((Date.now() - startTime) / 1000);
  const productTotal = database.prepare("SELECT COUNT(*) c FROM platform_products WHERE platform = '易金在线'").get().c;
  const imageTotal  = database.prepare("SELECT COUNT(*) c FROM product_images WHERE platform = '易金在线'").get().c;
  const pendingOcr  = database.prepare("SELECT COUNT(*) c FROM product_images WHERE platform = '易金在线' AND ocr_text = '' AND ocr_confidence IS NULL").get().c;

  console.log(`\n════════════════════════════════`);
  console.log(`扫描完成! ${totalElapsed}s (${Math.round(totalElapsed / 60)}min)`);
  console.log(`  扫描: ${scanned} | 评级币: ${graded} | 新入库: ${ingested} | 新图片: ${images}`);
  console.log(`  跳过(已有): ${skipped} | 缺失: ${missing} | 错误: ${errors}`);
  console.log(`  命中率: ${((graded / Math.max(1, scanned)) * 100).toFixed(2)}%`);
  console.log(`  DB: ${productTotal} products, ${imageTotal} images, ${pendingOcr} pending OCR`);
  console.log(`════════════════════════════════`);
}

main().catch(console.error);
