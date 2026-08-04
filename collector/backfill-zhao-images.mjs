import { mkdir, writeFile } from "node:fs/promises";
import { createWorker } from "tesseract.js";
import { databaseStats, saveIndexedProduct } from "./database.mjs";

const args = Object.fromEntries(process.argv.slice(2).map((item) => item.split("=")));
const start = Number(args.start ?? 10439677);
const end = Number(args.end ?? Math.max(1, start - 49));
const outputRoot = new URL("./output/", import.meta.url);
const userAgent = "QuanzhiBoxIndexer/0.1 (+low-frequency public product image indexing)";

if (!Number.isInteger(start) || !Number.isInteger(end) || start < end) {
  throw new Error("用法：node collector/backfill-zhao-images.mjs start=10439677 end=10439600");
}

function clean(value) {
  return value.replace(/\s+/g, " ").trim();
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

async function fetchDetail(id) {
  const requestUrl = `https://zhaoonline.com/auction-detail.shtml?id=${id}`;
  const response = await fetch(requestUrl, { headers: { "user-agent": userAgent, referer: "https://zhaoonline.com/trade/qianbi/" }, redirect: "follow" });
  if (!response.ok) return null;
  const html = await response.text();
  const json = html.match(/var\s+auction\s*=\s*(\{.+?\});\s*$/m)?.[1];
  if (!json) return null;
  const auction = JSON.parse(json);
  if (auction.status !== "3" || !String(auction.auctionKeywords ?? "").includes("钱币")) return null;
  const sourceImageUrls = Array.from(new Set((auction.pictures ?? []).map((picture) => picture.src).filter((url) => /^https:\/\/img3\.zhaoonline\.com\//.test(url))));
  if (!auction.auctionName || !auction.currentPrice || !auction.endAt || sourceImageUrls.length === 0) return null;
  return {
    id,
    platform: "赵涌在线",
    title: clean(auction.auctionName),
    detailUrl: new URL(auction.detailLink, "https://zhaoonline.com").toString(),
    price: Number(auction.currentPrice),
    priceWithFee: auction.buyChargeFee ? Math.round(Number(auction.currentPrice) * (1 + Number(auction.buyChargeFee) / 100) * 100) / 100 : null,
    transactedAt: auction.endAt,
    productCode: String(auction.auctionNo ?? id),
    sourceImageUrls,
  };
}

await mkdir(new URL("pages/", outputRoot), { recursive: true });
await mkdir(new URL("boxes/", outputRoot), { recursive: true });
let worker = await createWorker("eng");
const summary = { platform: "赵涌在线", start, end, pages: 0, images: 0, boxes: 0, errors: [] };

async function recognizeWithTimeout(imageUrl, timeoutMs = 20000) {
  let timer;
  try {
    return await Promise.race([
      worker.recognize(imageUrl),
      new Promise((_, reject) => { timer = setTimeout(() => reject(new Error("OCR_TIMEOUT")), timeoutMs); }),
    ]);
  } catch (error) {
    if (error instanceof Error && error.message === "OCR_TIMEOUT") {
      await worker.terminate().catch(() => undefined);
      worker = await createWorker("eng");
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

try {
  for (let id = start; id >= end; id -= 1) {
    try {
      const page = await fetchDetail(id);
      if (!page) continue;
      summary.pages += 1;
      const images = [];
      const sales = [];
      for (const imageUrl of page.sourceImageUrls) {
        let result;
        try {
          result = await recognizeWithTimeout(imageUrl);
        } catch (error) {
          images.push({ imageUrl, ocrText: "", ocrConfidence: 0, box: null, error: error instanceof Error ? error.message : String(error) });
          summary.images += 1;
          continue;
        }
        const ocrText = clean(result.data.text);
        const box = extractBox(ocrText);
        images.push({ imageUrl, ocrText, ocrConfidence: Math.round(result.data.confidence), box });
        summary.images += 1;
        if (!box) continue;
        const grade = extractGrade(ocrText);
        const numericGrade = grade.match(/\d{2}/)?.[0] ?? "";
        const officialCertUrl = box.company === "NGC" && numericGrade
          ? `https://www.ngccoin.com/certlookup/${box.display}/${numericGrade}/`
          : box.company === "PCGS"
            ? `https://cn.pcgs.com/cert/${box.normalized}`
            : "";
        if (!officialCertUrl) continue;
        sales.push({
          normalizedBoxCode: box.normalized,
          displayBoxCode: box.display,
          gradingCompany: box.company,
          grade,
          coinName: page.title,
          platform: page.platform,
          detailUrl: page.detailUrl,
          officialCertUrl,
          price: page.price,
          priceWithFee: page.priceWithFee,
          transactedAt: page.transactedAt,
          productCode: page.productCode,
          sourceImageUrls: page.sourceImageUrls,
          boxEvidenceImageUrl: imageUrl,
          ocrText,
          ocrConfidence: Math.round(result.data.confidence),
          verificationStatus: "image_exact",
          evidenceNote: "平台商品原图OCR包含完整盒号；上线展示前仍需抽样复核。",
          collectedAt: new Date().toISOString(),
        });
      }
      await writeFile(new URL(`pages/zhao-${id}.json`, outputRoot), JSON.stringify({ ...page, images }, null, 2));
      saveIndexedProduct(page, images, sales);
      for (const sale of sales) {
        await writeFile(new URL(`boxes/${sale.normalizedBoxCode}.json`, outputRoot), JSON.stringify([sale], null, 2));
        summary.boxes += 1;
      }
    } catch (error) {
      summary.errors.push({ id, message: error instanceof Error ? error.message : String(error) });
    }
  }
} finally {
  await worker.terminate();
}

const result = { ...summary, database: databaseStats(), finishedAt: new Date().toISOString() };
await writeFile(new URL("last-run-zhao.json", outputRoot), JSON.stringify(result, null, 2));
process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
