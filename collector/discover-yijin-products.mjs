import { mkdir, writeFile } from "node:fs/promises";
import { load } from "cheerio";

const maxPages = Number(Object.fromEntries(process.argv.slice(2).map((item) => item.split("="))).pages ?? 5);
const output = new URL("./data/yijin-product-ids.json", import.meta.url);
const ids = new Set();
let page = 1;

while (page <= maxPages) {
  const url = `https://www.yjzx.com/web2020/sell/list.html?page=${page}`;
  const response = await fetch(url, { headers: { "user-agent": "QuanzhiBoxIndexer/0.1 (+low-frequency public product discovery)" } });
  if (!response.ok) throw new Error(`易金列表第 ${page} 页返回 ${response.status}`);
  const $ = load(await response.text());
  const pageIds = Array.from(new Set($("a[href*='/web2020/sell/detail/']").map((_, node) => $(node).attr("href")?.match(/detail\/(\d+)\.html/)?.[1] ?? "").get().filter(Boolean)));
  if (pageIds.length === 0) break;
  pageIds.forEach((id) => ids.add(Number(id)));
  const next = $("a[rel='next']").attr("href");
  if (!next) break;
  page += 1;
}

await mkdir(new URL("./data/", import.meta.url), { recursive: true });
await writeFile(output, JSON.stringify({ platform: "易金在线", discoveredAt: new Date().toISOString(), pages: page, ids: [...ids] }, null, 2));
process.stdout.write(`${JSON.stringify({ pages: page, products: ids.size, output: output.pathname }, null, 2)}\n`);
