import { youbaoAdapter } from "../../lib/platforms/youbao";
import { clean, termsFor } from "../../lib/platforms/utils";

export const runtime = "edge";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const query = clean(url.searchParams.get("q") ?? "");
  if (query.length < 2 || query.length > 80) {
    return Response.json(
      { ok: false, error: "请输入2至80个字符的钱币名称", records: [] },
      { status: 400 }
    );
  }
  try {
    const platformRecords = await youbaoAdapter.search(query);
    const queryTerms = termsFor(query);

    // Convert PlatformRecord back to RealRecord format for backward compat
    const records = platformRecords
      .filter((r) => {
        const normalizedTitle = r.title.toLowerCase();
        return queryTerms.every((term) => normalizedTitle.includes(term));
      })
      .map((r) => {
        // Extract unit from priceLabel like "成交价/枚"
        const unitMatch = r.priceLabel.match(/成交价\/(.+)/);
        return {
          id: r.id,
          source: "邮宝" as const,
          title: r.title,
          condition: "未标注",
          price: r.price,
          unit: unitMatch?.[1] ?? "枚",
          quantity: "1",
          completedAt: r.time,
          status: r.status,
          url: r.url,
          fetchedAt: new Date().toISOString(),
        };
      });

    return Response.json({
      ok: true,
      query,
      records,
      sources: [
        {
          name: "邮宝",
          status: "live",
          fetchedAt: records[0]?.fetchedAt ?? new Date().toISOString(),
        },
      ],
      methodology: `仅保留邮宝页面标记为“交割成功”的公开记录；价格按原页面单位展示，不跨单位合并。`,
    });
  } catch {
    return Response.json(
      { ok: false, error: "公开数据源暂时无法访问，请稍后重试", records: [] },
      { status: 502 }
    );
  }
}
