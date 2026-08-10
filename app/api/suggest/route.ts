export const runtime = "edge";
import { scoreCoinSearch } from "../../lib/search-ranking";

// Precomputed at build time — loaded from public/coin-data/index.json
let coinCache: Array<{ coinName: string; slug: string; saleCount: number; keywords: string }> | null = null;

async function getCoinIndex(requestUrl: string): Promise<Array<{ coinName: string; slug: string; saleCount: number; keywords: string }>> {
  if (coinCache) return coinCache;
  try {
    const url = new URL("/coin-data/index.json", requestUrl);
    const resp = await fetch(url.toString());
    if (resp.ok) {
      const data = await resp.json() as { coins?: Array<{ coinName: string; slug: string; saleCount: number; keywords?: string }> };
      coinCache = (data.coins ?? []).map(c => ({ ...c, keywords: c.keywords || '' })).sort((a, b) => b.saleCount - a.saleCount);
      return coinCache;
    }
  } catch { /* fall through */ }
  return [];
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const q = (url.searchParams.get("q") ?? "").trim().toLowerCase();

  if (q.length < 1) {
    return Response.json({ suggestions: [] });
  }

  const coins = await getCoinIndex(request.url);
  const scored = coins
    .map((c) => ({ ...c, _score: scoreCoinSearch(q, c) }))
    .filter((c) => (c as Record<string, unknown>)._score as number > 0)
    .sort((a, b) => (b as Record<string, unknown>)._score as number - (a as Record<string, unknown>)._score as number)
    .slice(0, 8)
    .map((c) => ({
      name: c.coinName,
      slug: c.slug,
      count: c.saleCount,
    }));

  return Response.json({ suggestions: scored });
}
