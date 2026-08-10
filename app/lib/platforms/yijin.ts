import { load } from "cheerio";
import { clean, matches, matchType, money } from "./utils";
import type { PlatformAdapter, PlatformImageCandidate, PlatformRecord } from "../types";

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
    records.push({
      id: `yijin-${href}`,
      source: "易金在线",
      title,
      price: Number(priceMatch[1].replaceAll(",", "")),
      priceLabel: "成交价",
      time: timeMatch[1],
      timeLabel: "成交时间",
      status: "已成交",
      url: new URL(href, "https://www.yjzx.com").toString(),
      match: matchType(title, query),
    });
  });
  return records
    .filter(
      (record, index, list) => list.findIndex((item) => item.url === record.url) === index
    )
    .slice(0, 12);
}

async function yijinImageCandidates(query: string): Promise<PlatformImageCandidate[]> {
  const searchUrl = `https://www.yjzx.com/web2020/search/speed/history?status=3&searchFlag=2&query=${encodeURIComponent(query)}`;
  const response = await fetch(searchUrl, {
    headers: { "user-agent": "Quanzhi/0.3 (+public low-frequency image lookup)" },
  });
  if (!response.ok) throw new Error(`易金在线返回 ${response.status}`);
  const $ = load(await response.text());
  const links = Array.from(
    new Set(
      $("a[href*='/web2020/sell/detail/']")
        .map((_, node) => new URL($(node).attr("href")!, searchUrl).toString())
        .get()
    )
  ).slice(0, 4);

  const details = await Promise.allSettled(
    links.map(async (url) => {
      const detailResponse = await fetch(url, {
        headers: { "user-agent": "Quanzhi/0.3 (+public low-frequency image lookup)" },
      });
      if (!detailResponse.ok) throw new Error("detail unavailable");
      const detail = load(await detailResponse.text());
      const pageText = clean(detail("body").text());
      const title =
        clean(detail("h1,h2,.detail-title,.goods-name").first().text()) ||
        clean(detail("title").text()).replace(/\s*-\s*易金在线.*$/, "");
      const priceMatch = pageText.match(
        /(?:成交价格|成交价|售\s*价|商品价格)[：:]?\s*[￥¥]\s*([0-9,]+(?:\.\d+)?)/
      );
      const timeMatch = pageText.match(
        /(?:成交时间|上架时间)[：:]?\s*(20\d{2}-\d{2}-\d{2}(?:\s+\d{2}:\d{2}(?::\d{2})?)?)/
      );
      return detail("img")
        .map((_, node) => detail(node).attr("data-original") || detail(node).attr("src") || "")
        .get()
        .filter(
          (image) =>
            image.includes("AuctionImages") &&
            !image.includes("small_sell") &&
            !image.includes("list_sell")
        )
        .slice(0, 2)
        .map(
          (image, index): PlatformImageCandidate => ({
            id: `yijin-${url}-${index}`,
            source: "易金在线",
            title,
            url,
            imageUrl: new URL(image, url).toString(),
            price: priceMatch
              ? Number(priceMatch[1].replaceAll(",", ""))
              : money(pageText),
            priceLabel: pageText.includes("成交") ? "成交价" : "页面价",
            time: timeMatch?.[1] ?? "页面未标明",
            timeLabel: pageText.includes("成交时间") ? "成交时间" : "页面时间",
          })
        );
    })
  );

  return details.flatMap((result) => (result.status === "fulfilled" ? result.value : [])).slice(0, 6);
}

export const yijinAdapter: PlatformAdapter = {
  name: "易金在线",
  search: fetchYijin,
  imageCandidates: yijinImageCandidates,
};
