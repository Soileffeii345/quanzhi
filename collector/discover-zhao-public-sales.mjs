import { mkdir, writeFile } from "node:fs/promises";
import { load } from "cheerio";

const root = "https://zhaoonline.com/trade/qianbi/";
const userAgent = "QuanzhiPublicIndexer/0.4 (+low-frequency public completed-sale discovery)";
const delayMs = Math.max(0, Number(Object.fromEntries(process.argv.slice(2).map((item) => item.split("="))).delayMs ?? 250));

async function fetchHtml(url) {
  const response = await fetch(url, {
    headers: { "user-agent": userAgent, accept: "text/html" },
    redirect: "follow",
    signal: AbortSignal.timeout(15000),
  });
  if (!response.ok) throw new Error(`${url} HTTP ${response.status}`);
  return { html: await response.text(), finalUrl: response.url };
}

const rootPage = await fetchHtml(root);
const $root = load(rootPage.html);
const orderedTradeCategories = Array.from(new Set($root("a[href]").map((_, node) => {
  try {
    const url = new URL($root(node).attr("href"), rootPage.finalUrl);
    return url.hostname === "zhaoonline.com" && /^\/trade\/[^/]+\/$/.test(url.pathname) ? url.toString() : null;
  } catch {
    return null;
  }
}).get().filter(Boolean)));

const firstMoneyCategory = orderedTradeCategories.findIndex((url) => url.includes("/trade/zhongguoliutongjinianbi/"));
const lastMoneyCategory = orderedTradeCategories.findIndex((url) => url.includes("/trade/qitaqianbi/"));
if (firstMoneyCategory < 0 || lastMoneyCategory < firstMoneyCategory) {
  throw new Error("Could not locate Zhao Online public money category range");
}

const categories = orderedTradeCategories.slice(firstMoneyCategory, lastMoneyCategory + 1);
const details = new Set();
const errors = [];

for (const category of categories) {
  try {
    const page = await fetchHtml(category);
    const $ = load(page.html);
    $("a[href]").each((_, node) => {
      try {
        const url = new URL($(node).attr("href"), page.finalUrl);
        if (url.hostname === "zhaoonline.com" && /\/\d{7,10}\.shtml$/i.test(url.pathname)) {
          details.add(url.toString());
        }
      } catch {
        // Ignore malformed public links.
      }
    });
  } catch (error) {
    errors.push({ category, message: error instanceof Error ? error.message : String(error) });
  }
  if (delayMs > 0) await new Promise((resolve) => setTimeout(resolve, delayMs));
}

const output = {
  platform: "赵涌在线公开成交",
  queue: [],
  visited: [root, ...categories],
  details: [...details],
  errors,
  categories: categories.length,
  updatedAt: new Date().toISOString(),
};
const outputUrl = new URL("./data/discovery-zhao-sales.json", import.meta.url);
await mkdir(new URL("./data/", import.meta.url), { recursive: true });
await writeFile(outputUrl, JSON.stringify(output, null, 2));
process.stdout.write(`${JSON.stringify({ categories: categories.length, discoveredDetails: details.size, errors: errors.length, output: outputUrl.pathname }, null, 2)}\n`);
