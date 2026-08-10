import { zhaoAdapter } from "../../lib/platforms/zhao";
import { yijinAdapter } from "../../lib/platforms/yijin";
import { clean } from "../../lib/platforms/utils";

export const runtime = "nodejs";

const allowedImageHosts = new Set(["images.yjzx.com", "img3.zhaoonline.com"]);

export async function GET(request: Request) {
  const url = new URL(request.url);
  const image = url.searchParams.get("image");

  /* proxy mode: fetch a single image through our server */
  if (image) {
    let target: URL;
    try {
      target = new URL(image);
    } catch {
      return new Response("无效图片地址", { status: 400 });
    }
    if (target.protocol !== "https:" || !allowedImageHosts.has(target.hostname))
      return new Response("不允许的图片来源", { status: 403 });

    const response = await fetch(target, {
      headers: {
        referer: target.hostname.includes("zhaoonline")
          ? "https://zhaoonline.com/"
          : "https://www.yjzx.com/",
      },
    });
    if (!response.ok || !response.body)
      return new Response("图片读取失败", { status: 502 });

    return new Response(response.body, {
      headers: {
        "content-type":
          response.headers.get("content-type") || "image/jpeg",
        "cache-control": "public, max-age=86400",
      },
    });
  }

  /* discovery mode: return image candidates for OCR scanning */
  const query = clean(url.searchParams.get("q") ?? "");
  const compact = query.replace(/^(NGC|PCGS)\s*/i, "").replace(/[^0-9]/g, "");
  if (!/^\d{8,12}$/.test(compact))
    return Response.json(
      { ok: false, error: "请输入完整评级盒号", candidates: [] },
      { status: 400 }
    );

  const results = await Promise.allSettled([
    yijinAdapter.imageCandidates?.(query) ?? [],
    zhaoAdapter.imageCandidates?.(query) ?? [],
  ]);

  return Response.json({
    ok: true,
    query,
    candidates: results.flatMap((result) =>
      result.status === "fulfilled" ? result.value : []
    ),
    sources: [
      { name: "易金在线", status: results[0].status },
      { name: "赵涌在线", status: results[1].status },
    ],
    fetchedAt: new Date().toISOString(),
    methodology:
      "仅扫描本次公开搜索返回的有限候选商品图片；完整盒号逐位一致才算命中。",
  });
}
