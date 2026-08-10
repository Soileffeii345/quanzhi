import { zhaoAdapter } from "../../lib/platforms/zhao";
import { yijinAdapter } from "../../lib/platforms/yijin";
import { clean } from "../../lib/platforms/utils";
import type { SourceStatus } from "../../lib/types";

export const runtime = "edge";

export async function GET(request: Request) {
  const query = clean(new URL(request.url).searchParams.get("q") ?? "");
  if (query.length < 2 || query.length > 80)
    return Response.json(
      { ok: false, error: "请输入2至80个字符", records: [] },
      { status: 400 }
    );

  const results = await Promise.allSettled([
    zhaoAdapter.search(query),
    yijinAdapter.search(query),
  ]);

  const records = results.flatMap((result) =>
    result.status === "fulfilled" ? result.value : []
  );

  const sources: SourceStatus[] = [
    {
      name: "赵涌在线",
      status: results[0].status === "fulfilled" ? "live" : "unavailable",
    },
    {
      name: "易金在线",
      status: results[1].status === "fulfilled" ? "live" : "unavailable",
    },
    { name: "金币云集", status: "link-only" },
    { name: "麦稀奇", status: "protected-link-only" },
  ];

  return Response.json({
    ok: true,
    query,
    records,
    sources,
    fetchedAt: new Date().toISOString(),
    methodology:
      "仅展示公开页面中同时存在商品标题、价格、时间和详情链接的记录。关键词相关不等于同一枚；只有完整盒号一致才标记为同一枚。",
  });
}
