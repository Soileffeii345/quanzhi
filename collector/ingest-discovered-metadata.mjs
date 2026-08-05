import { readFile } from "node:fs/promises";
import { load } from "cheerio";
import { database, databaseStats, saveIndexedProduct } from "./database.mjs";

const options = Object.fromEntries(process.argv.slice(2).map((item) => item.split("=")));
const platform = options.platform ?? "yijin";
const concurrency = Math.max(1, Math.min(8, Number(options.concurrency ?? 4)));
const limit = Number(options.limit ?? 0);
const offset = Number(options.offset ?? 0);
const discoveryPath = new URL(`./data/discovery-${platform}.json`, import.meta.url);
const discovery = JSON.parse(await readFile(discoveryPath, "utf8"));
const urls = discovery.details.slice(offset, limit > 0 ? offset + limit : undefined);
const userAgent = "QuanzhiPublicIndexer/0.3 (+low-frequency public metadata indexing)";

function clean(value) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function numberFrom(value) {
  const match = String(value ?? "").match(/([0-9,]+(?:\.\d+)?)/);
  return match ? Number(match[1].replaceAll(",", "")) : null;
}

function normalizeYijinImage(value, base) {
  return new URL(value.replace("/images/../", "/"), base).toString();
}

async function parseYijin(url) {
  const response = await fetch(url, { headers: { "user-agent": userAgent }, redirect: "follow", signal: AbortSignal.timeout(15000) });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const html = await response.text();
  const $ = load(html);
  const finalUrl = response.url;
  const id = finalUrl.match(/detail\/(\d+)\.html/i)?.[1]
    ?? finalUrl.match(/(?:aid|id)[\/=](\d+)/i)?.[1]
    ?? url.match(/(\d{4,})/)?.[1];
  if (!id) throw new Error("无法识别商品ID");
  const title = clean($("h2.cointit,h1,.detail-title,.auc-title").first().text()) || clean($("title").text()).replace(/[_-].*易金在线.*$/, "");
  const text = clean($("body").text());
  const price = numberFrom(text.match(/(?:成交价格|成交价|当前价)[：:]?\s*¥?\s*[0-9,.]+/)?.[0]);
  const transactedAt = text.match(/(?:成交时间|结拍时间|结束时间)[：:]?\s*(20\d{2}-\d{2}-\d{2}(?:\s+\d{2}:\d{2}(?::\d{2})?)?)/)?.[1] ?? "";
  const productCode = $(".dmc-detailview .p1 span[title]").attr("title")?.trim() ?? text.match(/产品编号[：:]?\s*([A-Z0-9-]+)/i)?.[1] ?? String(id);
  const sourceImageUrls = Array.from(new Set($("img").map((_, node) => $(node).attr("data-original") || $(node).attr("src") || "").get()
    .filter((image) => image.includes("AuctionImages") && !/small_sell|medium_sell|list_sell/.test(image))
    .map((image) => normalizeYijinImage(image, finalUrl))));
  if (!title || sourceImageUrls.length === 0) throw new Error("页面没有商品标题或原图");
  return { id, platform: "易金在线", title, detailUrl: finalUrl, price, priceWithFee: null, transactedAt, productCode, sourceImageUrls };
}

async function parseZhao(url) {
  const response = await fetch(url, { headers: { "user-agent": userAgent, referer: "https://zhaoonline.com/trade/qianbi/" }, redirect: "follow", signal: AbortSignal.timeout(15000) });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const html = await response.text();
  const json = html.match(/var\s+auction\s*=\s*(\{.+?\});\s*$/m)?.[1];
  if (!json) throw new Error("页面缺少公开商品数据");
  const auction = JSON.parse(json);
  if (platform === "zhao-sales" && String(auction.status) !== "3") {
    throw new Error(`not a completed public sale (status ${auction.status})`);
  }
  const sourceImageUrls = Array.from(new Set((auction.pictures ?? []).map((picture) => picture.src).filter((image) => /^https:\/\/img3\.zhaoonline\.com\//.test(image))));
  if (!auction.id || !auction.auctionName || sourceImageUrls.length === 0) throw new Error("页面没有商品标题或原图");
  return {
    id: auction.id,
    platform: "赵涌在线",
    title: clean(auction.auctionName),
    detailUrl: new URL(auction.detailLink, "https://zhaoonline.com").toString(),
    price: Number(auction.currentPrice) || null,
    priceWithFee: auction.currentPrice && auction.buyChargeFee ? Math.round(Number(auction.currentPrice) * (1 + Number(auction.buyChargeFee) / 100) * 100) / 100 : null,
    transactedAt: auction.endAt ?? "",
    productCode: String(auction.auctionNo ?? auction.id),
    sourceImageUrls,
  };
}

const existing = new Set(database.prepare("SELECT detail_url FROM platform_products").all().map((row) => row.detail_url));
const queue = urls.filter((url) => !existing.has(url));
const result = { platform, discovered: urls.length, skippedExisting: urls.length - queue.length, indexed: 0, images: 0, failed: 0, errors: [] };
let cursor = 0;

async function worker() {
  while (cursor < queue.length) {
    const index = cursor;
    cursor += 1;
    const url = queue[index];
    try {
      const page = platform === "yijin" ? await parseYijin(url) : await parseZhao(url);
      const images = page.sourceImageUrls.map((imageUrl) => ({ imageUrl, ocrText: "", ocrConfidence: null, box: null }));
      saveIndexedProduct(page, images, []);
      result.indexed += 1;
      result.images += images.length;
    } catch (error) {
      result.failed += 1;
      if (result.errors.length < 200) result.errors.push({ url, message: error instanceof Error ? error.message : String(error) });
    }
  }
}

await Promise.all(Array.from({ length: concurrency }, () => worker()));
process.stdout.write(`${JSON.stringify({ ...result, database: databaseStats(), finishedAt: new Date().toISOString() }, null, 2)}\n`);
