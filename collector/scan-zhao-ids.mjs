// Mass ID-range scanner for 赵涌在线.
// Detail IDs are sequential and dense (~100% valid).
// We ONLY ingest graded coins (ratingAgency=NGC/PCGS) to maximize box number yield.
import { database, saveIndexedProduct } from "./database.mjs";

const CONCURRENCY = 8;
const START_ID = 10350000;
const END_ID = 10460000; // ~110,000 IDs to scan

function clean(s) { return (s ?? "").replace(/\s+/g, " ").trim(); }

async function parseZhaoDetail(url, id) {
  const resp = await fetch(url, {
    headers: {
      "user-agent": "QuanzhiIndexer/2.0",
      referer: "https://zhaoonline.com/trade/qianbi/",
    },
    redirect: "follow",
    signal: AbortSignal.timeout(10000),
  });
  if (!resp.ok) return null;
  const html = await resp.text();
  const jsonMatch = html.match(/var\s+auction\s*=\s*(\{.+?\});\s*$/m);
  if (!jsonMatch) return null;

  const auction = JSON.parse(jsonMatch[1]);
  if (!auction.id || !auction.auctionName) return null;

  // ONLY ingest graded coins — they have NGC/PCGS cert numbers on slab images
  const agency = (auction.ratingAgency || "").toUpperCase();
  if (!agency.includes("NGC") && !agency.includes("PCGS") && agency !== "PMG" && agency !== "CGC") {
    return null; // skip non-graded
  }

  const sourceImageUrls = Array.from(new Set(
    (auction.pictures ?? []).map(p => p.src).filter(src => /^https:\/\/img3\.zhaoonline\.com\//.test(src))
  ));
  if (sourceImageUrls.length === 0) return null;

  return {
    id: auction.id,
    platform: "赵涌在线",
    title: clean(auction.auctionName),
    detailUrl: new URL(auction.detailLink, "https://zhaoonline.com").toString(),
    price: Number(auction.currentPrice) || null,
    priceWithFee: auction.currentPrice && auction.buyChargeFee
      ? Math.round(Number(auction.currentPrice) * (1 + Number(auction.buyChargeFee) / 100) * 100) / 100
      : null,
    transactedAt: auction.endAt ?? "",
    productCode: String(auction.auctionNo ?? auction.id),
    sourceImageUrls,
  };
}

// 赵涌裸 ID 返回 404，需要 category 前缀。用任意 category 都会自动重定向到正确的。
async function tryFetch(id) {
  try {
    const url = `https://zhaoonline.com/xiongmaoxilie-jiujin/${id}.shtml`;
    return await parseZhaoDetail(url, id);
  } catch {
    return null;
  }
}

async function main() {
  console.log(`赵涌 ID 扫描: ${START_ID} → ${END_ID} (${END_ID - START_ID} IDs, ${CONCURRENCY} workers)`);

  const existingUrls = new Set(
    database.prepare("SELECT detail_url FROM platform_products WHERE platform = '赵涌在线'").all().map(r => r.detail_url)
  );
  console.log(`已有赵涌 platform_products: ${existingUrls.size}`);

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
      } catch (e) {
        errors++;
      }

      // Progress report
      if (scanned % 500 === 0) {
        const elapsed = Math.max(1, Math.round((Date.now() - startTime) / 1000));
        const rate = Math.round(scanned / elapsed);
        const productTotal = database.prepare("SELECT COUNT(*) c FROM platform_products WHERE platform = '赵涌在线'").get().c;
        const imageTotal = database.prepare("SELECT COUNT(*) c FROM product_images WHERE platform = '赵涌在线'").get().c;
        const pendingOcr = database.prepare("SELECT COUNT(*) c FROM product_images WHERE platform = '赵涌在线' AND ocr_text = '' AND ocr_confidence IS NULL").get().c;
        console.log(`[${id}/${END_ID}] scanned:${scanned} graded:${graded} ingested:${ingested} imgs:${images} skip:${skipped} miss:${missing} | rate:${rate}/s | DB:${productTotal}p ${imageTotal}i OCR:${pendingOcr}`);
      }
    }
  }

  await Promise.all(Array.from({ length: CONCURRENCY }, () => worker()));

  const totalElapsed = Math.round((Date.now() - startTime) / 1000);
  console.log(`\n════════════════════════════════`);
  console.log(`扫描完成! ${totalElapsed}s`);
  console.log(`  扫描: ${scanned} | 评级币: ${graded} | 新入库: ${ingested} | 新图片: ${images}`);
  console.log(`  跳过: ${skipped} | 缺失: ${missing} | 错误: ${errors}`);
  console.log(`  命中率: ${((graded / Math.max(1, scanned)) * 100).toFixed(1)}%`);
  console.log(`════════════════════════════════`);
}

main().catch(console.error);
