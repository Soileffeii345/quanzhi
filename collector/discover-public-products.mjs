import { mkdir, readFile, writeFile } from "node:fs/promises";
import { load } from "cheerio";

const options = Object.fromEntries(process.argv.slice(2).map((item) => item.split("=")));
const platform = options.platform ?? "yijin";
const maxPages = Number(options.maxPages ?? 5000);
const delayMs = Number(options.delayMs ?? 350);
const dataDir = new URL("./data/", import.meta.url);
const checkpointUrl = new URL(`./data/discovery-${platform}.json`, import.meta.url);
const userAgent = "QuanzhiPublicIndexer/0.2 (+low-frequency public product discovery)";

const configs = {
  yijin: {
    name: "易金在线",
    hosts: new Set(["yjzx.com", "www.yjzx.com"]),
    seeds: [
      "https://www.yjzx.com/",
      "https://www.yjzx.com/web2020/material/list.html",
      "https://www.yjzx.com/web2020/sell/list.html",
      "https://www.yjzx.com/AucList/index/zid/3325/status/1.html",
      "https://www.yjzx.com/AucList/lists/status/1/zid/3326.html",
    ],
    isDetail(url) {
      return /\/web2020\/sell\/detail\/\d+\.html$/i.test(url.pathname)
        || /\/Auc(?:Detail|Item)\//i.test(url.pathname)
        || /\/(?:auction|item)-detail\.shtml$/i.test(url.pathname);
    },
    shouldFollow(url) {
      return /\/(?:web2020\/(?:material|sell|search)|AucList|AucDetail|History|Shop|Sell)\//i.test(url.pathname)
        || url.pathname === "/";
    },
  },
  zhao: {
    name: "赵涌在线",
    hosts: new Set(["zhaoonline.com", "www.zhaoonline.com"]),
    seeds: [
      "https://zhaoonline.com/trade/qianbi/",
      "https://zhaoonline.com/query.shtml",
    ],
    isDetail(url) {
      return /\/\d{7,10}\.shtml$/i.test(url.pathname) || (url.pathname === "/auction-detail.shtml" && /^\d{7,10}$/.test(url.searchParams.get("id") ?? ""));
    },
    shouldFollow(url) {
      return /\/(?:trade\/qianbi|query|auction|qianbi|jinbi|yinbi|xianjin|jizhibi)/i.test(`${url.pathname}${url.search}`)
        || /page|category|class|type|status/i.test(url.search);
    },
  },
};

const config = configs[platform];
if (!config) throw new Error("platform 只能是 yijin 或 zhao");

let state = { platform: config.name, queue: [...config.seeds], visited: [], details: [], errors: [], startedAt: new Date().toISOString() };
try {
  const saved = JSON.parse(await readFile(checkpointUrl, "utf8"));
  if (saved.platform === config.name) state = saved;
} catch {
  // First run has no checkpoint.
}

const queue = [...state.queue];
const queued = new Set(queue);
const visited = new Set(state.visited);
const details = new Set(state.details);
const errors = [...state.errors];

function canonical(value, base) {
  try {
    const url = new URL(value, base);
    url.hash = "";
    if (!config.hosts.has(url.hostname.toLowerCase())) return null;
    url.protocol = "https:";
    ["utm_source", "utm_medium", "utm_campaign", "spm"].forEach((key) => url.searchParams.delete(key));
    return url;
  } catch {
    return null;
  }
}

async function saveCheckpoint() {
  const snapshot = {
    ...state,
    queue,
    visited: [...visited],
    details: [...details],
    errors: errors.slice(-500),
    updatedAt: new Date().toISOString(),
  };
  await mkdir(dataDir, { recursive: true });
  await writeFile(checkpointUrl, JSON.stringify(snapshot, null, 2));
}

let processedThisRun = 0;
while (queue.length > 0 && processedThisRun < maxPages) {
  const current = queue.shift();
  if (!current || visited.has(current)) continue;
  visited.add(current);
  processedThisRun += 1;
  try {
    const response = await fetch(current, { headers: { "user-agent": userAgent, accept: "text/html" }, redirect: "follow" });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const finalUrl = canonical(response.url, current) ?? new URL(current);
    if (config.isDetail(finalUrl)) details.add(finalUrl.toString());
    const contentType = response.headers.get("content-type") ?? "";
    if (!contentType.includes("text/html")) continue;
    const $ = load(await response.text());
    $("a[href]").each((_, node) => {
      const url = canonical($(node).attr("href"), finalUrl);
      if (!url) return;
      const value = url.toString();
      if (config.isDetail(url)) {
        details.add(value);
        return;
      }
      if (config.shouldFollow(url) && !visited.has(value) && !queued.has(value)) {
        queued.add(value);
        queue.push(value);
      }
    });
  } catch (error) {
    errors.push({ url: current, message: error instanceof Error ? error.message : String(error), at: new Date().toISOString() });
  }
  if (processedThisRun % 20 === 0) await saveCheckpoint();
  if (delayMs > 0) await new Promise((resolve) => setTimeout(resolve, delayMs));
}

await saveCheckpoint();
process.stdout.write(`${JSON.stringify({
  platform: config.name,
  processedThisRun,
  visitedPages: visited.size,
  queuedPages: queue.length,
  discoveredDetails: details.size,
  errors: errors.length,
  checkpoint: checkpointUrl.pathname,
}, null, 2)}\n`);
