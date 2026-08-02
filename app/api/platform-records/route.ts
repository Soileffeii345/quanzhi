import { load } from "cheerio";

export const runtime = "edge";

type PlatformRecord = {
  id: string;
  source: "赵涌在线" | "易金在线";
  title: string;
  price: number;
  priceLabel: string;
  time: string;
  timeLabel: string;
  status: string;
  url: string;
  match: "exact-box" | "keyword";
};

function clean(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function termsFor(query: string) {
  return clean(query).toLowerCase().split(" ").filter(Boolean);
}

function matches(title: string, query: string) {
  const normalized = title.toLowerCase();
  return termsFor(query).every((term) => normalized.includes(term));
}

function matchType(title: string, query: string): PlatformRecord["match"] {
  const compactQuery = query.toUpperCase().replace(/[^A-Z0-9]/g, "");
  const compactTitle = title.toUpperCase().replace(/[^A-Z0-9]/g, "");
  return /^\d{7,12}$/.test(compactQuery) && compactTitle.includes(compactQuery) ? "exact-box" : "keyword";
}

async function fetchZhao(query: string): Promise<PlatformRecord[]> {
  const response = await fetch("https://zhaoonline.com/query.shtml", {
    method: "POST",
    headers: {
      "content-type": "application/x-www-form-urlencoded; charset=UTF-8",
      "accept": "text/html,application/xhtml+xml",
      "referer": "https://zhaoonline.com/trade/qianbi/",
    },
    body: new URLSearchParams({ keyword: query, "q.types": "1" }),
  });
  if (!response.ok) throw new Error(`赵涌在线返回 ${response.status}`);
  const $ = load(await response.text());
  const records: PlatformRecord[] = [];
  $("a.search-list-item[href]").each((_, node) => {
    const link = $(node);
    const title = clean(link.text());
    const href = link.attr("href");
    const itemText = clean(link.closest(".item-main").text());
    const priceMatch = itemText.match(/[￥¥]\s*([0-9,]+(?:\.\d+)?)/);
    const timeMatch = itemText.match(/(20\d{2}-\d{2}-\d{2}(?:\s+\d{2}:\d{2}(?::\d{2})?)?)/);
    if (!href || !title || !priceMatch || !timeMatch || !matches(title, query)) return;
    const detailUrl = new URL(href, "https://zhaoonline.com").toString();
    records.push({ id: `zhao-${detailUrl}`, source: "赵涌在线", title, price: Number(priceMatch[1].replaceAll(",", "")), priceLabel: "当前价/页面价", time: timeMatch[1], timeLabel: "结标时间", status: "公开页面", url: detailUrl, match: matchType(title, query) });
  });
  return records.slice(0, 12);
}

async function fetchYijin(query: string): Promise<PlatformRecord[]> {
  const response = await fetch("https://www.yjzx.com/web2020/material/list.html", {
    headers: { "user-agent": "Quanzhi/0.2 (+public low-frequency lookup)" },
  });
  if (!response.ok) throw new Error(`易金在线返回 ${response.status}`);
  const $ = load(await response.text());
  const records: PlatformRecord[] = [];
  $("a[href*='/web2020/sell/detail/']").each((_, node) => {
    const link = $(node);
    const title = clean(link.text()).replace(/^(寄售商品|自主上传)\s*/, "");
    const href = link.attr("href");
    const itemText = clean(link.parent().text());
    const priceMatch = itemText.match(/售\s*价[：:]\s*[￥¥]?\s*([0-9,]+(?:\.\d+)?)/);
    const timeMatch = itemText.match(/成交时间[：:]\s*([^ ]+(?:\s+\d{2}:\d{2}(?::\d{2})?)?)/);
    if (!href || !title || !priceMatch || !timeMatch || !matches(title, query)) return;
    records.push({ id: `yijin-${href}`, source: "易金在线", title, price: Number(priceMatch[1].replaceAll(",", "")), priceLabel: "成交价", time: timeMatch[1], timeLabel: "成交时间", status: "已成交", url: new URL(href, "https://www.yjzx.com").toString(), match: matchType(title, query) });
  });
  return records.filter((record, index, list) => list.findIndex((item) => item.url === record.url) === index).slice(0, 12);
}

export async function GET(request: Request) {
  const query = clean(new URL(request.url).searchParams.get("q") ?? "");
  if (query.length < 2 || query.length > 80) return Response.json({ ok: false, error: "请输入2至80个字符", records: [] }, { status: 400 });
  const results = await Promise.allSettled([fetchZhao(query), fetchYijin(query)]);
  const records = results.flatMap((result) => result.status === "fulfilled" ? result.value : []);
  return Response.json({
    ok: true,
    query,
    records,
    sources: [
      { name: "赵涌在线", status: results[0].status === "fulfilled" ? "live" : "unavailable" },
      { name: "易金在线", status: results[1].status === "fulfilled" ? "live" : "unavailable" },
      { name: "金币云集", status: "link-only" },
      { name: "麦稀奇", status: "protected-link-only" },
    ],
    fetchedAt: new Date().toISOString(),
    methodology: "仅展示公开页面中同时存在商品标题、价格、时间和详情链接的记录。关键词相关不等于同一枚；只有完整盒号一致才标记为同一枚。",
  });
}
