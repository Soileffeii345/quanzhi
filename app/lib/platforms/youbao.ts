import { load } from "cheerio";
import { clean, termsFor } from "./utils";
import type { PlatformAdapter, RealRecord } from "../types";

async function fetchYoubao(query: string): Promise<RealRecord[]> {
  const sourceUrl = `https://www.youbao360.com/TradePostMore?name=${encodeURIComponent(query)}&type=3`;
  const response = await fetch(sourceUrl, {
    headers: { "User-Agent": "Quanzhi/0.1 (+public price lookup; low-frequency)" },
  });
  if (!response.ok) throw new Error(`邮宝返回 ${response.status}`);
  const html = await response.text();
  const $ = load(html);
  const fetchedAt = new Date().toISOString();
  const queryTerms = termsFor(query);
  const records: RealRecord[] = [];

  $(".bargainList .tbody a").each((_, element) => {
    const anchor = $(element);
    const href = anchor.attr("href");
    const title = clean(anchor.find(".goodName").text());
    const normalizedTitle = title.toLowerCase();
    const priceParts = anchor.find(".price").map((__, node) => clean($(node).text())).get();
    const priceAndUnit = priceParts[1] ?? "";
    const priceMatch = priceAndUnit.match(/([0-9]+(?:\.[0-9]+)?)\s*\/\s*(.+)/);
    const directChildren = anchor.children();
    const completedAt = clean(directChildren.filter(".validDay").last().text());
    const status = clean(directChildren.filter(".viewCnt").last().text());
    const quantity = clean(directChildren.filter(".number").first().text());
    if (!href || !title || !priceMatch || status !== "交割成功") return;
    if (!queryTerms.every((term) => normalizedTitle.includes(term))) return;
    const url = new URL(href, "https://www.youbao360.com").toString();
    const id = new URL(url).searchParams.get("ordersId") ?? url;
    records.push({
      id,
      source: "邮宝",
      title,
      condition: priceParts[0] || "未标注",
      price: Number(priceMatch[1]),
      unit: priceMatch[2],
      quantity,
      completedAt,
      status,
      url,
      fetchedAt,
    });
  });

  return records.slice(0, 30);
}

export const youbaoAdapter: PlatformAdapter = {
  name: "邮宝",
  async search(query) {
    const records = await fetchYoubao(query);
    return records.map((r) => ({
      id: r.id,
      source: r.source,
      title: r.title,
      price: r.price,
      priceLabel: `成交价/${r.unit}`,
      time: r.completedAt,
      timeLabel: "成交时间",
      status: "交割成功",
      url: r.url,
      match: "keyword" as const,
    }));
  },
};
