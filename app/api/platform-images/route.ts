import { load } from "cheerio";

export const runtime = "nodejs";

type Candidate = {
  id: string;
  source: "易金在线" | "赵涌在线";
  title: string;
  url: string;
  imageUrl: string;
  price: number | null;
  priceLabel: string;
  time: string;
  timeLabel: string;
};

const allowedImageHosts = new Set(["images.yjzx.com", "img3.zhaoonline.com"]);

function clean(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function money(value: string) {
  const match = value.match(/[￥¥]\s*([0-9,]+(?:\.\d+)?)/);
  return match ? Number(match[1].replaceAll(",", "")) : null;
}

async function yijinCandidates(query: string): Promise<Candidate[]> {
  const searchUrl = `https://www.yjzx.com/web2020/search/speed/history?status=3&searchFlag=2&query=${encodeURIComponent(query)}`;
  const response = await fetch(searchUrl, { headers: { "user-agent": "Quanzhi/0.3 (+public low-frequency image lookup)" } });
  if (!response.ok) throw new Error(`易金在线返回 ${response.status}`);
  const $ = load(await response.text());
  const links = Array.from(new Set($("a[href*='/web2020/sell/detail/']").map((_, node) => new URL($(node).attr("href")!, searchUrl).toString()).get())).slice(0, 4);
  const details = await Promise.allSettled(links.map(async (url) => {
    const detailResponse = await fetch(url, { headers: { "user-agent": "Quanzhi/0.3 (+public low-frequency image lookup)" } });
    if (!detailResponse.ok) throw new Error("detail unavailable");
    const detail = load(await detailResponse.text());
    const pageText = clean(detail("body").text());
    const title = clean(detail("h1,h2,.detail-title,.goods-name").first().text()) || clean(detail("title").text()).replace(/\s*-\s*易金在线.*$/, "");
    const priceMatch = pageText.match(/(?:成交价格|成交价|售\s*价|商品价格)[：:]?\s*[￥¥]\s*([0-9,]+(?:\.\d+)?)/);
    const timeMatch = pageText.match(/(?:成交时间|上架时间)[：:]?\s*(20\d{2}-\d{2}-\d{2}(?:\s+\d{2}:\d{2}(?::\d{2})?)?)/);
    return detail("img").map((_, node) => detail(node).attr("data-original") || detail(node).attr("src") || "").get()
      .filter((image) => image.includes("AuctionImages") && !image.includes("small_sell") && !image.includes("list_sell"))
      .slice(0, 2)
      .map((image, index): Candidate => ({ id: `yijin-${url}-${index}`, source: "易金在线", title, url, imageUrl: new URL(image, url).toString(), price: priceMatch ? Number(priceMatch[1].replaceAll(",", "")) : money(pageText), priceLabel: pageText.includes("成交") ? "成交价" : "页面价", time: timeMatch?.[1] ?? "页面未标明", timeLabel: pageText.includes("成交时间") ? "成交时间" : "页面时间" }));
  }));
  return details.flatMap((result) => result.status === "fulfilled" ? result.value : []).slice(0, 6);
}

async function zhaoCandidates(query: string): Promise<Candidate[]> {
  const response = await fetch("https://zhaoonline.com/query.shtml", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded; charset=UTF-8", accept: "text/html", referer: "https://zhaoonline.com/trade/qianbi/" },
    body: new URLSearchParams({ keyword: query, "q.types": "1" }),
  });
  if (!response.ok) throw new Error(`赵涌在线返回 ${response.status}`);
  const $ = load(await response.text());
  const links = Array.from(new Set($("img[src*='img3.zhaoonline.com']").map((_, node) => $(node).closest("a[href]").attr("href") || "").get()))
    .filter((href) => href && !href.includes("/jiteyoupiao/") && !href.includes("/cika/"))
    .slice(0, 4);
  const details = await Promise.allSettled(links.map(async (href) => {
    const url = new URL(href, "https://zhaoonline.com").toString();
    const detailResponse = await fetch(url, { headers: { accept: "text/html", referer: "https://zhaoonline.com/trade/qianbi/" } });
    if (!detailResponse.ok) throw new Error("detail unavailable");
    const detail = load(await detailResponse.text());
    const pageText = clean(detail("body").text());
    const title = clean(detail("h1,.product-title,.title").first().text()) || clean(detail("title").text()).replace(/[-_].*赵涌在线.*$/, "");
    const timeMatch = pageText.match(/20\d{2}-\d{2}-\d{2}(?:\s+\d{2}:\d{2}(?::\d{2})?)?/);
    return detail("img[data-original*='img3.zhaoonline.com']").map((_, node) => detail(node).attr("data-original") || "").get().slice(0, 2)
      .map((image, index): Candidate => ({ id: `zhao-${url}-${index}`, source: "赵涌在线", title, url, imageUrl: image.replace(/!\d+(?:x\d+)?$/, "!800x800"), price: money(pageText), priceLabel: "当前价/页面价", time: timeMatch?.[0] ?? "页面未标明", timeLabel: "结标时间" }));
  }));
  return details.flatMap((result) => result.status === "fulfilled" ? result.value : []).slice(0, 6);
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const image = url.searchParams.get("image");
  if (image) {
    let target: URL;
    try { target = new URL(image); } catch { return new Response("无效图片地址", { status: 400 }); }
    if (target.protocol !== "https:" || !allowedImageHosts.has(target.hostname)) return new Response("不允许的图片来源", { status: 403 });
    const response = await fetch(target, { headers: { referer: target.hostname.includes("zhaoonline") ? "https://zhaoonline.com/" : "https://www.yjzx.com/" } });
    if (!response.ok || !response.body) return new Response("图片读取失败", { status: 502 });
    return new Response(response.body, { headers: { "content-type": response.headers.get("content-type") || "image/jpeg", "cache-control": "public, max-age=86400" } });
  }

  const query = clean(url.searchParams.get("q") ?? "");
  const compact = query.replace(/^(NGC|PCGS)\s*/i, "").replace(/[^0-9]/g, "");
  if (!/^\d{8,12}$/.test(compact)) return Response.json({ ok: false, error: "请输入完整评级盒号", candidates: [] }, { status: 400 });
  const results = await Promise.allSettled([yijinCandidates(query), zhaoCandidates(query)]);
  return Response.json({ ok: true, query, candidates: results.flatMap((result) => result.status === "fulfilled" ? result.value : []), sources: [{ name: "易金在线", status: results[0].status }, { name: "赵涌在线", status: results[1].status }], fetchedAt: new Date().toISOString(), methodology: "仅扫描本次公开搜索返回的有限候选商品图片；完整盒号逐位一致才算命中。" });
}
