import type { RealRecord } from "../../lib/types";
import { youbaoAdapter } from "../../lib/platforms/youbao";
import { termsFor, clean } from "../../lib/platforms/utils";

export const runtime = "edge";

/* ------------------------------------------------------------------ */
/*  Local box database lookup for coin name                             */
/* ------------------------------------------------------------------ */

type CertInfo = {
  ok: boolean;
  coinName: string;
  grade: string;
  year: string;
  agency: string;
  certUrl: string;
  source: "database" | "live" | "none";
};

/**
 * Look up coin name from our local static JSON box database.
 * The database is at public/box-data/{prefix}/{normalizedCode}.json
 */
async function lookupLocalDatabase(
  normalizedCode: string,
  origin: string
): Promise<{ coinName: string; grade: string; detailUrl: string } | null> {
  const digits = normalizedCode.replace(/\D/g, "");
  if (digits.length < 2) return null;

  const prefix = digits.slice(0, 2);

  try {
    // Fetch from our own origin (works in both dev and production)
    const dbUrl = `${origin}/box-data/${prefix}/${digits}.json`;
    const response = await fetch(dbUrl, {
      signal: AbortSignal.timeout(3000),
    });

    if (!response.ok) return null;

    const data = (await response.json()) as {
      ok?: boolean;
      records?: Array<{
        coinName?: string;
        grade?: string;
        detailUrl?: string;
      }>;
    };

    const record = data.records?.[0];
    if (record?.coinName) {
      return {
        coinName: record.coinName,
        grade: record.grade ?? "",
        detailUrl: record.detailUrl ?? "",
      };
    }
  } catch {
    /* silent fallback */
  }

  return null;
}

/* ------------------------------------------------------------------ */
/*  Keyword extraction for platform search                             */
/* ------------------------------------------------------------------ */

/**
 * Convert a coin name from NGC/PCGS into effective search keywords
 * for Chinese coin platforms.
 */
function coinNameToKeywords(coinName: string): string {
  let kw = coinName
    .replace(/\b(\d+)\s*g\b/gi, "$1克")
    .replace(/\b(\d+)\s*(?:Yuan|Y|圆|元)\b/gi, "$1元")
    .replace(/\b(\d+)\s*10Y\b/gi, "$1元")
    .replace(
      /\b(?:NGC|PCGS|PF|MS|AU|XF|VF|UNC|PR|SP|ULTRA\s*CAMEO|DEEP\s*CAMEO|FIRST\s*DAY\s*OF\s*ISSUE|FIRST\s*RELEASES|EARLY\s*RELEASES|ANNIVERSARY|COMMEMORATIVE)\b/gi,
      ""
    )
    .replace(/\b\d{2}\b/g, "")
    .replace(/\s+/g, " ")
    .trim();

  if (kw.length < 3) kw = coinName;
  return kw;
}

/* ------------------------------------------------------------------ */
/*  API route                                                           */
/* ------------------------------------------------------------------ */

export async function GET(request: Request) {
  const url = new URL(request.url);
  const rawCode = clean(url.searchParams.get("code") ?? "");

  if (!rawCode || rawCode.length < 7) {
    return Response.json(
      { ok: false, error: "请输入完整盒号（NGC 7+3位或PCGS 8位）" },
      { status: 400 }
    );
  }

  // Determine agency and normalize
  const upper = rawCode.toUpperCase();
  const agency = upper.startsWith("PCGS")
    ? "PCGS"
    : upper.startsWith("NGC") || /\d{7}-\d{3}/.test(upper)
      ? "NGC"
      : "待确认";

  const normalizedCode = upper.replace(/^(NGC|PCGS)\s*/i, "").trim();
  const normalizedDigits = normalizedCode.replace(/\D/g, "");

  // Build cert URLs
  const certUrl =
    agency === "PCGS"
      ? `https://cn.pcgs.com/cert/${normalizedDigits}`
      : `https://www.ngccoin.com/certlookup/${normalizedCode}/`;

  let certInfo: CertInfo = {
    ok: false,
    coinName: "",
    grade: "",
    year: "",
    agency,
    certUrl,
    source: "none",
  };

  let sameModelRecords: RealRecord[] = [];
  let searchKeywords = "";

  try {
    // Step 1: Try local database lookup
    const origin = url.origin;
    const dbRecord = await lookupLocalDatabase(normalizedCode, origin);

    if (dbRecord) {
      certInfo = {
        ok: true,
        coinName: dbRecord.coinName,
        grade: dbRecord.grade,
        year: "",
        agency,
        certUrl,
        source: "database",
      };
      searchKeywords = coinNameToKeywords(dbRecord.coinName);
    }

    // Step 2: If we have keywords (from database or manual), search 邮宝
    if (searchKeywords.length >= 2) {
      try {
        const rawRecords = await youbaoAdapter.search(searchKeywords);
        const queryTerms = termsFor(searchKeywords);
        sameModelRecords = rawRecords
          .filter((r) => {
            const t = r.title.toLowerCase();
            return queryTerms.every((term) => t.includes(term));
          })
          .slice(0, 10)
          .map((r) => {
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
      } catch {
        /* keyword search is best-effort */
      }
    }

    const methodology = certInfo.ok
      ? `数据库已收录此盒号，币名"${certInfo.coinName}"。已用关键词"${searchKeywords}"搜索邮宝同款成交。`
      : `数据库未收录此盒号。请点击${agency}官方链接核对币种信息后，用币名重新搜索。`;

    return Response.json({
      ok: true,
      query: rawCode,
      cert: certInfo,
      searchKeywords,
      sameModelRecords,
      methodology,
      certUrl,
    });
  } catch {
    return Response.json(
      { ok: false, error: "查询暂时不可用，请稍后重试" },
      { status: 502 }
    );
  }
}
