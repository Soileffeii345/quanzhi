#!/usr/bin/env node

import { mkdir, writeFile } from "node:fs/promises";
import { load } from "cheerio";
import { database, saveIndexedProduct } from "./database.mjs";

const options = Object.fromEntries(process.argv.slice(2).map((item) => item.replace(/^--/, "").split("=")));
const concurrency = Math.max(1, Math.min(6, Number(options.concurrency ?? 4)));
const root = "https://zhaoonline.com/trade/qianbi/";
const userAgent = "QuanzhiPublicIndexer/1.0 (+public current-listing snapshot)";
const now = new Date().toISOString();

async function fetchHtml(url) {
  const response = await fetch(url, {
    headers: { "user-agent": userAgent, accept: "text/html", referer: root },
    redirect: "follow",
    signal: AbortSignal.timeout(30000),
  });
  if (!response.ok) throw new Error(`${url} HTTP ${response.status}`);
  return { html: await response.text(), finalUrl: response.url };
}

function moneyCategories(html, base) {
  const $ = load(html);
  const ordered = Array.from(new Set($("a[href]").map((_, node) => {
    try {
      const url = new URL($(node).attr("href"), base);
      return url.hostname === "zhaoonline.com" && /^\/trade\/[^/]+\/$/.test(url.pathname) ? url.toString() : null;
    } catch { return null; }
  }).get().filter(Boolean)));
  const first = ordered.findIndex((url) => url.includes("/trade/zhongguoliutongjinianbi/"));
  const last = ordered.findIndex((url) => url.includes("/trade/qitaqianbi/"));
  if (first < 0 || last < first) throw new Error("无法定位赵涌在线钱币分类范围");
  return ordered.slice(first, last + 1);
}

function detailUrls(html, base) {
  const $ = load(html);
  return Array.from(new Set($("a[href]").map((_, node) => {
    try {
      const url = new URL($(node).attr("href"), base);
      return url.hostname === "zhaoonline.com" && /\/\d{7,10}\.shtml$/i.test(url.pathname)
        ? url.toString().replace("/trade/", "/")
        : null;
    } catch { return null; }
  }).get().filter(Boolean)));
}

function parseAuction(html) {
  const json = html.match(/var\s+auction\s*=\s*(\{.+?\});\s*$/m)?.[1];
  return json ? JSON.parse(json) : null;
}

const listingUpsert = database.prepare(`
  INSERT INTO platform_listing_state (
    platform, platform_product_id, title, detail_url, price, product_code,
    listing_status, coverage_scope, first_seen_at, last_seen_at, last_checked_at,
    recognized_box_count, queryable_box_count, source_snapshot_at
  ) VALUES (?, ?, ?, ?, ?, ?, 'active', 'public_current_money_categories', ?, ?, ?, 0, 0, ?)
  ON CONFLICT(platform, platform_product_id) DO UPDATE SET
    title=excluded.title, detail_url=excluded.detail_url, price=excluded.price,
    product_code=excluded.product_code, listing_status='active',
    coverage_scope=excluded.coverage_scope, last_seen_at=excluded.last_seen_at,
    last_checked_at=excluded.last_checked_at, source_snapshot_at=excluded.source_snapshot_at
`);
const observationInsert = database.prepare(`INSERT OR REPLACE INTO listing_observations
  (platform, platform_product_id, observed_at, listing_status, price, source_snapshot_at)
  VALUES ('赵涌在线', ?, ?, 'active', ?, ?)`);

const rootPage = await fetchHtml(root);
const categories = moneyCategories(rootPage.html, rootPage.finalUrl);
const candidates = new Set();
const errors = [];
for (const category of categories) {
  try {
    const page = await fetchHtml(category);
    for (const url of detailUrls(page.html, page.finalUrl)) candidates.add(url);
  } catch (error) {
    errors.push({ stage: "category", url: category, message: error instanceof Error ? error.message : String(error) });
  }
}

const urls = [...candidates];
const active = [];
let cursor = 0;
async function worker() {
  while (cursor < urls.length) {
    const index = cursor++;
    const url = urls[index];
    try {
      const page = await fetchHtml(url);
      const auction = parseAuction(page.html);
      if (!auction || String(auction.status) !== "2") continue;
      const images = Array.from(new Set((auction.pictures ?? []).map((picture) => picture.src)
        .filter((src) => /^https:\/\/img3\.zhaoonline\.com\//.test(src))));
      if (!auction.id || !auction.auctionName || images.length === 0) throw new Error("详情页缺少商品字段或原图");
      const detailUrl = new URL(auction.detailLink, "https://zhaoonline.com").toString();
      const record = {
        id: String(auction.id),
        platform: "赵涌在线",
        title: String(auction.auctionName).replace(/\s+/g, " ").trim(),
        detailUrl,
        price: Number(auction.currentPrice) || null,
        priceWithFee: null,
        transactedAt: auction.endAt ?? "",
        productCode: String(auction.auctionNo ?? auction.id),
        sourceImageUrls: images,
      };
      saveIndexedProduct(record, images.map((imageUrl) => ({ imageUrl, ocrText: "", ocrConfidence: null, box: null })), []);
      database.exec("BEGIN IMMEDIATE");
      try {
        const firstSeen = database.prepare(`SELECT first_seen_at FROM platform_listing_state
          WHERE platform='赵涌在线' AND platform_product_id=?`).get(record.id)?.first_seen_at ?? now;
        listingUpsert.run("赵涌在线", record.id, record.title, record.detailUrl, record.price, record.productCode,
          firstSeen, now, now, now);
        observationInsert.run(record.id, now, record.price, now);
        database.exec("COMMIT");
      } catch (error) {
        database.exec("ROLLBACK");
        throw error;
      }
      active.push(record);
    } catch (error) {
      errors.push({ stage: "detail", url, message: error instanceof Error ? error.message : String(error) });
    }
  }
}
await Promise.all(Array.from({ length: concurrency }, () => worker()));

// A listing disappearing from this unauthenticated public snapshot is not proof of sale.
// Mark it unknown until its detail page is checked again; never manufacture a sold status.
const activeIds = new Set(active.map((item) => item.id));
const previous = database.prepare(`SELECT platform_product_id FROM platform_listing_state
  WHERE platform='赵涌在线' AND listing_status='active'`).all();
const markUnknown = database.prepare(`UPDATE platform_listing_state
  SET listing_status='unknown', last_checked_at=?
  WHERE platform='赵涌在线' AND platform_product_id=?`);
for (const row of previous) if (!activeIds.has(String(row.platform_product_id))) markUnknown.run(now, row.platform_product_id);

const output = {
  platform: "赵涌在线",
  scope: "public_current_money_categories",
  coverageNote: "覆盖无需登录即可访问的钱币分类当前在售快照；网站登录后可见但公开页未暴露的商品不计为已覆盖。",
  categories: categories.length,
  candidates: urls.length,
  active: active.length,
  details: active.map((item) => item.detailUrl),
  records: active,
  errors,
  updatedAt: now,
};
await mkdir(new URL("./data/", import.meta.url), { recursive: true });
await writeFile(new URL("./data/zhao-active.json", import.meta.url), JSON.stringify(output, null, 2));
console.log(JSON.stringify({ categories: categories.length, candidates: urls.length, active: active.length, errors: errors.length, updatedAt: now }, null, 2));
