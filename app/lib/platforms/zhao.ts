import { load } from "cheerio";
import { clean, matches, matchType, money } from "./utils";
import type { PlatformAdapter, PlatformImageCandidate, PlatformRecord } from "../types";

async function fetchZhao(query: string): Promise<PlatformRecord[]> {
  const response = await fetch("https://zhaoonline.com/query.shtml", {
    method: "POST",
    headers: {
      "content-type": "application/x-www-form-urlencoded; charset=UTF-8",
      accept: "text/html,application/xhtml+xml",
      referer: "https://zhaoonline.com/trade/qianbi/",
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
    records.push({
      id: `zhao-${new URL(href, "https://zhaoonline.com").toString()}`,
      source: "赵涌在线",
      title,
      price: Number(priceMatch[1].replaceAll(",", "")),
      priceLabel: "当前价/页面价",
      time: timeMatch[1],
      timeLabel: "结标时间",
      status: "公开页面",
      url: new URL(href, "https://zhaoonline.com").toString(),
      match: matchType(title, query),
    });
  });
  return records.slice(0, 12);
}

async function zhaoImageCandidates(query: string): Promise<PlatformImageCandidate[]> {
  const response = await fetch("https://zhaoonline.com/query.shtml", {
    method: "POST",
    headers: {
      "content-type": "application/x-www-form-urlencoded; charset=UTF-8",
      accept: "text/html",
      referer: "https://zhaoonline.com/trade/qianbi/",
    },
    body: new URLSearchParams({ keyword: query, "q.types": "1" }),
  });
  if (!response.ok) throw new Error(`赵涌在线返回 ${response.status}`);
  const $ = load(await response.text());
  const links = Array.from(
    new Set(
      $("img[src*='img3.zhaoonline.com']")
        .map((_, node) => $(node).closest("a[href]").attr("href") || "")
        .get()
    )
  )
    .filter((href) => href && !href.includes("/jiteyoupiao/") && !href.includes("/cika/"))
    .slice(0, 4);

  const details = await Promise.allSettled(
    links.map(async (href) => {
      const url = new URL(href, "https://zhaoonline.com").toString();
      const detailResponse = await fetch(url, {
        headers: { accept: "text/html", referer: "https://zhaoonline.com/trade/qianbi/" },
      });
      if (!detailResponse.ok) throw new Error("detail unavailable");
      const detail = load(await detailResponse.text());
      const pageText = clean(detail("body").text());
      const title =
        clean(detail("h1,.product-title,.title").first().text()) ||
        clean(detail("title").text()).replace(/[-_].*赵涌在线.*$/, "");
      const timeMatch = pageText.match(/20\d{2}-\d{2}-\d{2}(?:\s+\d{2}:\d{2}(?::\d{2})?)?/);
      return detail("img[data-original*='img3.zhaoonline.com']")
        .map((_, node) => detail(node).attr("data-original") || "")
        .get()
        .slice(0, 2)
        .map(
          (image, index): PlatformImageCandidate => ({
            id: `zhao-${url}-${index}`,
            source: "赵涌在线",
            title,
            url,
            imageUrl: image.replace(/!\d+(?:x\d+)?$/, "!800x800"),
            price: money(pageText),
            priceLabel: "当前价/页面价",
            time: timeMatch?.[0] ?? "页面未标明",
            timeLabel: "结标时间",
          })
        );
    })
  );

  return details.flatMap((result) => (result.status === "fulfilled" ? result.value : [])).slice(0, 6);
}

export const zhaoAdapter: PlatformAdapter = {
  name: "赵涌在线",
  search: fetchZhao,
  imageCandidates: zhaoImageCandidates,
};
