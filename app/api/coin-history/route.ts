export const runtime = "edge";

/**
 * Coin price history API.
 * Fetches from static JSON at /coin-data/{prefix}/{slug}.json
 *
 * Params:
 *   ?name=<coinName>  — look up by exact coin name (uses hash slug)
 *   ?slug=<slug>      — look up by pre-computed slug
 */

function coinSlug(name: string): string {
  let hash = 5381;
  for (let i = 0; i < name.length; i++)
    hash = ((hash << 5) + hash + name.charCodeAt(i)) | 0;
  return Math.abs(hash).toString(16).padStart(8, "0");
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const name = url.searchParams.get("name")?.trim() ?? "";
  let slug = url.searchParams.get("slug")?.trim() ?? "";

  if (!name && !slug) {
    return Response.json(
      { ok: false, error: "请提供 coin name 或 slug 参数" },
      { status: 400 }
    );
  }

  if (!slug) slug = coinSlug(name);

  try {
    const prefix = slug.slice(0, 2);
    const dataUrl = `${url.origin}/coin-data/${prefix}/${slug}.json`;
    const response = await fetch(dataUrl, {
      signal: AbortSignal.timeout(3000),
    });

    if (!response.ok) {
      return Response.json(
        { ok: false, error: "该币种暂未收录" },
        { status: 404 }
      );
    }

    const data = (await response.json()) as {
      coinName: string;
      slug: string;
      saleCount: number;
      priceStats: {
        low: number | null;
        high: number | null;
        avg: number | null;
        latest: number | null;
      };
      records: Array<{
        normalizedBoxCode: string;
        displayBoxCode: string;
        gradingCompany: string;
        grade: string;
        platform: string;
        detailUrl: string;
        officialCertUrl: string;
        price: number | null;
        priceWithFee: number | null;
        transactedAt: string;
        productCode: string;
        verificationStatus: string;
      }>;
    };

    return Response.json({ ok: true, ...data });
  } catch {
    return Response.json(
      { ok: false, error: "数据查询暂时不可用" },
      { status: 502 }
    );
  }
}
