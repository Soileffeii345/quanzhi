"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import TopBar from "../components/TopBar";
import PriceTrend from "../components/PriceTrend";
import { scoreCoinSearch } from "../lib/search-ranking";

type CoinData = {
  coinName: string;
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

function coinSlug(name: string): string {
  let hash = 5381;
  for (let i = 0; i < name.length; i++)
    hash = ((hash << 5) + hash + name.charCodeAt(i)) | 0;
  return Math.abs(hash).toString(16).padStart(8, "0");
}

const PLATFORM_CONFIG: Record<string, { color: string; bg: string }> = {
  "赵涌在线": { color: "#2563eb", bg: "#eff4ff" },
  "易金在线": { color: "#ea580c", bg: "#fff7ed" },
  "邮宝": { color: "#059669", bg: "#ecfdf3" },
};

export default function CoinPage({ searchParams }: { searchParams?: { name?: string } }) {
  const urlName = typeof window !== "undefined"
    ? new URLSearchParams(window.location.search).get("name") ?? ""
    : searchParams?.name ?? "";
  const [name, setName] = useState(urlName);
  const [data, setData] = useState<CoinData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [gradeFilter, setGradeFilter] = useState("全部");

  const initialName = urlName;
  const didFetch = useRef(false);

  const fetchCoin = useCallback(async function fetchCoin(coinName: string) {
    setLoading(true);
    setError("");
    try {
      const indexResponse = await fetch("/coin-data/index.json", { signal: AbortSignal.timeout(5000) });
      const index = indexResponse.ok
        ? await indexResponse.json() as { coins?: Array<{ coinName: string; slug: string; saleCount: number; keywords?: string }> }
        : { coins: [] };
      const bestMatch = (index.coins ?? [])
        .map((coin) => ({ ...coin, score: scoreCoinSearch(coinName, coin) }))
        .filter((coin) => coin.score > 0)
        .sort((a, b) => b.score - a.score || b.saleCount - a.saleCount)[0];
      if (!bestMatch) {
        setData(null);
        setError("暂未找到相关币种，请尝试更短的名称、年份或系列名");
        return;
      }
      const slug = bestMatch.slug || coinSlug(bestMatch.coinName);
      const response = await fetch(
        `/coin-data/${slug.slice(0, 2)}/${slug}.json`,
        { signal: AbortSignal.timeout(5000) }
      );
      if (!response.ok) {
        setError("该币种暂未收录或数据不可用");
        return;
      }
      const result = (await response.json()) as CoinData;
      setData(result);
      setName(bestMatch.coinName);
      window.history.replaceState(null, "", `?name=${encodeURIComponent(bestMatch.coinName)}`);
      setGradeFilter("全部");
    } catch {
      setError("查询超时，请稍后重试");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (initialName && !didFetch.current) {
      didFetch.current = true;
      void fetchCoin(initialName);
    }
  });

  function searchSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = name.trim();
    if (trimmed) {
      window.history.replaceState(null, "", `?name=${encodeURIComponent(trimmed)}`);
      fetchCoin(trimmed);
    }
  }

  const trendRecords =
    data?.records
      .filter((r) => r.price !== null && r.transactedAt)
      .map((r) => ({
        price: r.price!,
        transactedAt: r.transactedAt,
        platform: r.platform,
      })) ?? [];

  // Unique grades for filter
  const allGrades = [...new Set(data?.records.map((r) => r.grade).filter(Boolean) ?? [])].sort((a, b) => {
    const na = parseInt(a.match(/\d+/)?.[0] ?? "0") || 0;
    const nb = parseInt(b.match(/\d+/)?.[0] ?? "0") || 0;
    return nb - na;
  });

  const filteredRecords = gradeFilter === "全部"
    ? (data?.records ?? [])
    : (data?.records ?? []).filter((r) => r.grade === gradeFilter);

  return (
    <main>
      <TopBar activePage="coin" />

      <section style={{
        maxWidth: 960,
        margin: "0 auto",
        padding: "32px 20px",
      }}>
        {/* Search bar */}
        <form
          onSubmit={searchSubmit}
          style={{
            display: "flex",
            gap: 8,
            marginBottom: 28,
            maxWidth: 600,
          }}
        >
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="输入币种名称（如 2024年30克熊猫金币）"
            style={{
              flex: 1,
              padding: "11px 16px",
              fontSize: 14,
              border: "1px solid #d0d5dd",
              borderRadius: 10,
              outline: "none",
              color: "#101828",
              background: "#fff",
            }}
          />
          <button
            type="submit"
            style={{
              padding: "11px 22px",
              background: "#155eef",
              color: "#fff",
              border: "none",
              borderRadius: 10,
              fontSize: 14,
              fontWeight: 600,
              cursor: "pointer",
              boxShadow: "0 3px 8px rgba(21,94,239,.22)",
            }}
          >
            查询
          </button>
        </form>

        {loading && (
          <div style={{ textAlign: "center", padding: 56, color: "#98a2b3" }}>
            正在加载币种数据…
          </div>
        )}

        {error && (
          <div style={{
            textAlign: "center",
            padding: 48,
            background: "#fef2f2",
            borderRadius: 14,
            color: "#dc2626",
            fontSize: 14,
          }}>
            {error}
          </div>
        )}

        {data && (
          <>
            {/* Header */}
            <div style={{ marginBottom: 24 }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: "#155eef", textTransform: "uppercase", letterSpacing: 1 }}>
                币种详情
              </span>
              <h1 style={{
                fontSize: 28,
                fontWeight: 800,
                margin: "6px 0 10px",
                color: "#101828",
                letterSpacing: "-1px",
              }}>
                {data.coinName}
              </h1>
              <div style={{ display: "flex", gap: 20, flexWrap: "wrap", fontSize: 13, color: "#667085" }}>
                <span>收录 <b style={{ color: "#155eef" }}>{data.saleCount}</b> 条成交记录</span>
                {data.priceStats.latest && (
                  <span>
                    最新成交价{" "}
                    <b style={{ color: "#155eef" }}>
                      ¥{data.priceStats.latest.toLocaleString()}
                    </b>
                  </span>
                )}
                {data.priceStats.avg && (
                  <span>
                    均价{" "}
                    <b style={{ color: "#155eef" }}>
                      ¥{data.priceStats.avg.toLocaleString()}
                    </b>
                  </span>
                )}
              </div>
            </div>

            {/* Price stats */}
            <div className="stat-grid" style={{
              display: "grid",
              gap: 10,
              marginBottom: 20,
            }}>
              {[
                { label: "最低成交价", value: data.priceStats.low, sub: "历史最低" },
                { label: "最高成交价", value: data.priceStats.high, sub: "历史最高" },
                { label: "成交均价", value: data.priceStats.avg, sub: `${data.saleCount} 条记录` },
                { label: "最新成交价", value: data.priceStats.latest, sub: "最近一笔" },
              ].map((stat) => (
                <div
                  key={stat.label}
                  className="stat-card"
                  style={{
                    background: "#fff",
                    border: "1px solid #e4e7ec",
                    borderRadius: 12,
                    padding: "16px 18px",
                  }}
                >
                  <div style={{ fontSize: 11, color: "#98a2b3", marginBottom: 4 }}>{stat.label}</div>
                  <div style={{ fontSize: 22, fontWeight: 800, color: "#101828" }}>
                    {stat.value !== null ? `¥${stat.value.toLocaleString()}` : "—"}
                  </div>
                  <div style={{ fontSize: 10, color: "#c0c7d0", marginTop: 2 }}>{stat.sub}</div>
                </div>
              ))}
            </div>

            {/* Price trend chart */}
            {trendRecords.length >= 2 && (
              <div style={{
                background: "#fff",
                borderRadius: 14,
                border: "1px solid #e4e7ec",
                padding: 20,
                marginBottom: 20,
              }}>
                <h3 style={{
                  fontSize: 15,
                  fontWeight: 700,
                  margin: "0 0 14px",
                  color: "#101828",
                }}>
                  📈 价格趋势
                </h3>
                <PriceTrend records={trendRecords} />
              </div>
            )}

            {/* Grade filter pills */}
            {allGrades.length > 1 && (
              <div style={{
                display: "flex",
                gap: 7,
                flexWrap: "wrap",
                marginBottom: 16,
                alignItems: "center",
              }}>
                <span style={{ fontSize: 12, fontWeight: 600, color: "#667085", marginRight: 4 }}>评级筛选：</span>
                {["全部", ...allGrades].map((grade) => (
                  <button
                    key={grade}
                    onClick={() => setGradeFilter(grade)}
                    style={{
                      padding: "5px 13px",
                      fontSize: 12,
                      border: gradeFilter === grade ? "1px solid #155eef" : "1px solid #e4e7ec",
                      borderRadius: 999,
                      background: gradeFilter === grade ? "#eff4ff" : "#fff",
                      color: gradeFilter === grade ? "#155eef" : "#667085",
                      fontWeight: gradeFilter === grade ? 600 : 400,
                      cursor: "pointer",
                      fontFamily: "inherit",
                    }}
                  >
                    {grade}
                    {grade !== "全部" && (
                      <span style={{ marginLeft: 4, fontSize: 10, opacity: 0.7 }}>
                        ({data.records.filter((r) => r.grade === grade).length})
                      </span>
                    )}
                  </button>
                ))}
              </div>
            )}

            {/* Records table */}
            <div style={{
              background: "#fff",
              borderRadius: 14,
              border: "1px solid #e4e7ec",
              overflow: "hidden",
            }}>
              <div style={{
                padding: "13px 18px",
                borderBottom: "1px solid #e4e7ec",
                fontSize: 14,
                fontWeight: 700,
                color: "#101828",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}>
                <span>成交记录（{filteredRecords.length} 条）</span>
                {gradeFilter !== "全部" && (
                  <span style={{ fontSize: 11, fontWeight: 400, color: "#155eef" }}>
                    已筛选：{gradeFilter}
                  </span>
                )}
              </div>
              <div style={{ overflowX: "auto" }}>
                <table style={{
                  width: "100%",
                  borderCollapse: "collapse",
                  fontSize: 13,
                }}>
                  <thead>
                    <tr style={{ background: "#f9fafb" }}>
                      <th style={thStyle}>评级盒号</th>
                      <th style={thStyle}>评级</th>
                      <th style={thStyle}>平台</th>
                      <th style={thStyle}>成交时间</th>
                      <th style={{ ...thStyle, textAlign: "right" }}>成交价</th>
                      <th style={{ ...thStyle, textAlign: "center" }}>链接</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredRecords.map((r, i) => {
                      const platformCfg = PLATFORM_CONFIG[r.platform] ?? { color: "#6b7280", bg: "#f9fafb" };
                      return (
                        <tr
                          key={`${r.normalizedBoxCode}-${r.platform}-${i}`}
                          style={{ borderTop: "1px solid #f3f4f6" }}
                        >
                          <td style={tdStyle}>
                            <code style={{
                              fontSize: 12,
                              background: "#f3f4f6",
                              padding: "3px 7px",
                              borderRadius: 5,
                              fontWeight: 600,
                              color: "#374151",
                            }}>
                              {r.displayBoxCode}
                            </code>
                          </td>
                          <td style={tdStyle}>
                            <span style={{
                              fontSize: 11,
                              padding: "3px 7px",
                              borderRadius: 4,
                              background: "#eff4ff",
                              color: "#175cd3",
                              fontWeight: 600,
                            }}>
                              {r.gradingCompany} {r.grade}
                            </span>
                          </td>
                          <td style={tdStyle}>
                            <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
                              <span style={{
                                width: 7,
                                height: 7,
                                borderRadius: "50%",
                                background: platformCfg.color,
                                flexShrink: 0,
                              }} />
                              {r.platform}
                            </span>
                          </td>
                          <td style={{ ...tdStyle, color: "#667085", fontSize: 12 }}>
                            {r.transactedAt}
                          </td>
                          <td style={{
                            ...tdStyle,
                            textAlign: "right",
                            fontWeight: 700,
                            color: "#155eef",
                            fontSize: 15,
                            fontFamily: "Georgia, serif",
                          }}>
                            {r.price !== null ? `¥${r.price.toLocaleString()}` : (
                              <span style={{ color: "#059669", fontSize: 12, fontWeight: 600 }}>在售</span>
                            )}
                          </td>
                          <td style={{ ...tdStyle, textAlign: "center" }}>
                            {r.detailUrl ? (
                              <a
                                href={r.detailUrl}
                                target="_blank"
                                rel="noreferrer"
                                style={{
                                  color: "#155eef",
                                  fontSize: 11,
                                  textDecoration: "none",
                                  padding: "4px 9px",
                                  borderRadius: 5,
                                  background: "#eff4ff",
                                  whiteSpace: "nowrap",
                                }}
                              >
                                原始交易 ↗
                              </a>
                            ) : (
                              <span style={{ color: "#c0c7d0", fontSize: 12 }}>—</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              {filteredRecords.length === 0 && (
                <div style={{ textAlign: "center", padding: 36, color: "#98a2b3", fontSize: 13 }}>
                  该评级暂无记录
                </div>
              )}
            </div>
          </>
        )}

        {!data && !loading && !error && (
          <div style={{
            textAlign: "center",
            padding: 64,
            background: "#f9fafb",
            borderRadius: 14,
          }}>
            <div style={{ fontSize: 44, marginBottom: 14 }}>🪙</div>
            <b style={{ display: "block", marginBottom: 6, fontSize: 16, color: "#101828" }}>
              输入币种名称查看成交历史
            </b>
            <p style={{ color: "#667085", margin: 0, fontSize: 13 }}>
              可搜索「熊猫金币」「袁大头」等关键词
            </p>
          </div>
        )}
      </section>

      <footer style={{
        maxWidth: 960,
        margin: "0 auto",
        padding: "24px 20px",
        borderTop: "1px solid #e4e7ec",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        flexWrap: "wrap",
        gap: 12,
        color: "#98a2b3",
        fontSize: 12,
      }}>
        <Link href="/" style={{ color: "inherit", textDecoration: "none", display: "flex", alignItems: "center", gap: 8 }}>
          <span className="brand-seal" style={{ width: 24, height: 24, fontSize: 12, borderRadius: 7 }}>泉</span>
          <span>泉知</span>
        </Link>
        <span>数据以原始交易页为准</span>
      </footer>
    </main>
  );
}

const thStyle: React.CSSProperties = {
  padding: "10px 14px",
  textAlign: "left",
  fontWeight: 600,
  fontSize: 11,
  color: "#6b7280",
  borderBottom: "2px solid #e5e7eb",
};

const tdStyle: React.CSSProperties = {
  padding: "11px 14px",
  borderBottom: "1px solid #f3f4f6",
};
