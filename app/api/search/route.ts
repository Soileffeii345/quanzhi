import { load } from "cheerio";

export const runtime = "edge";

type SourceRecord = {
  id: string;
  source: "邮宝";
  title: string;
  condition: string;
  price: number;
  unit: string;
  quantity: string;
  completedAt: string;
  status: string;
  url: string;
  fetchedAt: string;
};

function cleanText(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

async function fetchYoubao(query: string): Promise<SourceRecord[]> {
  const sourceUrl = `https://www.youbao360.com/TradePostMore?name=${encodeURIComponent(query)}&type=3`;
  const response = await fetch(sourceUrl, {
    headers: { "User-Agent": "Quanzhi/0.1 (+public price lookup; low-frequency)" },
  });
  if (!response.ok) throw new Error(`邮宝返回 ${response.status}`);
  const html = await response.text();
  const $ = load(html);
  const fetchedAt = new Date().toISOString();
  const queryTerms = cleanText(query).toLowerCase().split(" ").filter(Boolean);
  const records: SourceRecord[] = [];

  $(".bargainList .tbody a").each((_, element) => {
    const anchor = $(element);
    const href = anchor.attr("href");
    const title = cleanText(anchor.find(".goodName").text());
    const normalizedTitle = title.toLowerCase();
    const priceParts = anchor.find(".price").map((__, node) => cleanText($(node).text())).get();
    const priceAndUnit = priceParts[1] ?? "";
    const priceMatch = priceAndUnit.match(/([0-9]+(?:\.[0-9]+)?)\s*\/\s*(.+)/);
    const directChildren = anchor.children();
    const completedAt = cleanText(directChildren.filter(".validDay").last().text());
    const status = cleanText(directChildren.filter(".viewCnt").last().text());
    const quantity = cleanText(directChildren.filter(".number").first().text());
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

export async function GET(request: Request) {
  const url = new URL(request.url);
  const query = cleanText(url.searchParams.get("q") ?? "");
  if (query.length < 2 || query.length > 80) {
    return Response.json({ ok: false, error: "请输入2至80个字符的钱币名称", records: [] }, { status: 400 });
  }
  try {
    const records = await fetchYoubao(query);
    return Response.json({
      ok: true,
      query,
      records,
      sources: [{ name: "邮宝", status: "live", fetchedAt: records[0]?.fetchedAt ?? new Date().toISOString() }],
      methodology: "仅保留邮宝页面标记为“交割成功”的公开记录；价格按原页面单位展示，不跨单位合并。",
    });
  } catch {
    return Response.json({ ok: false, error: "公开数据源暂时无法访问，请稍后重试", records: [] }, { status: 502 });
  }
}
