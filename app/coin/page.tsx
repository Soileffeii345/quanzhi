"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import TopBar from "../components/TopBar";
import PriceTrend from "../components/PriceTrend";
import { scoreCoinSearch } from "../lib/search-ranking";
import { platformSearchUrl } from "../lib/platform-urls";

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

type CoinCandidate = {
  coinName: string;
  slug: string;
  saleCount: number;
  latestPrice?: number | null;
  score: number;
};

function coinTags(name: string): string[] {
  const tags: string[] = [];
  const year = name.match(/(?:19|20)\d{2}年?/);
  const weight = name.match(/\d+(?:\.\d+)?(?:克|公斤|盎司)/);
  if (year) tags.push(year[0].replace(/年?$/, "年"));
  if (name.includes("金币") || name.includes("金质")) tags.push("金");
  else if (name.includes("银币") || name.includes("银质")) tags.push("银");
  if (weight) tags.push(weight[0]);
  if (name.includes("精制")) tags.push("精制");
  else if (name.includes("普制")) tags.push("普制");
  return [...new Set(tags)];
}

function tagValue(name: string, kind: "year" | "material" | "weight" | "finish"): string {
  const tags = coinTags(name);
  if (kind === "year") return tags.find((tag) => /^\d{4}年$/.test(tag)) ?? "";
  if (kind === "material") return tags.find((tag) => tag === "金" || tag === "银") ?? "其他";
  if (kind === "weight") return tags.find((tag) => /(?:克|公斤|盎司)$/.test(tag)) ?? "其他";
  return tags.find((tag) => tag === "普制" || tag === "精制") ?? "其他";
}

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
  const [candidates, setCandidates] = useState<CoinCandidate[]>([]);
  const [gradeFilter, setGradeFilter] = useState("全部");
  const [minPrice, setMinPrice] = useState("");
  const [maxPrice, setMaxPrice] = useState("");
  const [yearFilter, setYearFilter] = useState("全部");
  const [materialFilter, setMaterialFilter] = useState("全部");
  const [weightFilter, setWeightFilter] = useState("全部");
  const [finishFilter, setFinishFilter] = useState("全部");
  const [candidateSort, setCandidateSort] = useState("relevance");
  const [recordSort, setRecordSort] = useState("latest");
  const [savedCoins, setSavedCoins] = useState<string[]>([]);

  const initialName = urlName;
  const didFetch = useRef(false);

  const fetchCoin = useCallback(async function fetchCoin(coinName: string) {
    setLoading(true);
    setError("");
    setCandidates([]);
    setData(null);
    try {
      const indexResponse = await fetch("/coin-data/index.json", { signal: AbortSignal.timeout(5000) });
      const index = indexResponse.ok
        ? await indexResponse.json() as { coins?: Array<{ coinName: string; slug: string; saleCount: number; latestPrice?: number | null; keywords?: string }> }
        : { coins: [] };
      const matches = (index.coins ?? [])
        .map((coin) => ({ ...coin, score: scoreCoinSearch(coinName, coin) }))
        .filter((coin) => coin.score > 0)
        .sort((a, b) => b.score - a.score || b.saleCount - a.saleCount);
      const normalizedQuery = coinName.trim().toLowerCase().replace(/\s+/g, "");
      const exactMatch = matches.find(
        (coin) => coin.coinName.trim().toLowerCase().replace(/\s+/g, "") === normalizedQuery
      );
      const bestMatch = exactMatch ?? matches[0];
      if (!bestMatch) {
        setData(null);
        setError("暂未找到相关币种，请尝试更短的名称、年份或系列名");
        return;
      }

      // A series keyword such as “熊猫” can match many years and specifications.
      // Do not silently turn it into whichever individual coin happens to rank first.
      if (!exactMatch && matches.length > 1) {
        setCandidates(matches.slice(0, 24));
        setYearFilter("全部");
        setMaterialFilter("全部");
        setWeightFilter("全部");
        setFinishFilter("全部");
        setCandidateSort("relevance");
        setName(coinName);
        window.history.replaceState(null, "", `?name=${encodeURIComponent(coinName)}`);
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

  useEffect(() => {
    const timer = window.setTimeout(() => {
      try {
        const raw = window.localStorage.getItem("quanzhi-saved-coins");
        setSavedCoins(raw ? JSON.parse(raw) : []);
      } catch {
        setSavedCoins([]);
      }
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  function toggleSavedCoin(coinName: string) {
    const next = savedCoins.includes(coinName)
      ? savedCoins.filter((item) => item !== coinName)
      : [coinName, ...savedCoins].slice(0, 100);
    setSavedCoins(next);
    window.localStorage.setItem("quanzhi-saved-coins", JSON.stringify(next));
  }

  function searchSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = name.trim();
    if (trimmed) {
      window.history.replaceState(null, "", `?name=${encodeURIComponent(trimmed)}`);
      fetchCoin(trimmed);
    }
  }

  // Unique grades for filter
  const allGrades = [...new Set(data?.records.map((r) => r.grade).filter(Boolean) ?? [])].sort((a, b) => {
    const na = parseInt(a.match(/\d+/)?.[0] ?? "0") || 0;
    const nb = parseInt(b.match(/\d+/)?.[0] ?? "0") || 0;
    return nb - na;
  });

  const filteredRecords = gradeFilter === "全部"
    ? (data?.records ?? [])
    : (data?.records ?? []).filter((r) => r.grade === gradeFilter);
  const trendRecords = filteredRecords
    .filter((record) => record.price !== null && record.transactedAt)
    .map((record) => ({
      price: record.price!,
      transactedAt: record.transactedAt,
      platform: record.platform,
      detailUrl: record.detailUrl,
    }));
  const parsedMinPrice = minPrice === "" ? null : Number(minPrice);
  const parsedMaxPrice = maxPrice === "" ? null : Number(maxPrice);
  const invalidPriceRange = parsedMinPrice !== null && parsedMaxPrice !== null && parsedMinPrice > parsedMaxPrice;
  const inPriceRange = (price: number | null | undefined) => {
    if (parsedMinPrice === null && parsedMaxPrice === null) return true;
    if (price === null || price === undefined) return false;
    if (parsedMinPrice !== null && price < parsedMinPrice) return false;
    if (parsedMaxPrice !== null && price > parsedMaxPrice) return false;
    return true;
  };
  const filterOptions = (kind: "year" | "material" | "weight" | "finish") =>
    [...new Set(candidates.map((coin) => tagValue(coin.coinName, kind)).filter(Boolean))].sort((a, b) =>
      kind === "year" ? b.localeCompare(a, "zh-CN", { numeric: true }) : a.localeCompare(b, "zh-CN", { numeric: true })
    );
  const candidatePriceValues = candidates.map((coin) => coin.latestPrice).filter((price): price is number => typeof price === "number");
  const totalCandidateSales = candidates.reduce((sum, coin) => sum + coin.saleCount, 0);
  const candidateYears = filterOptions("year").filter((item) => item !== "其他");
  const visibleCandidates = candidates
    .filter((coin) => !invalidPriceRange && inPriceRange(coin.latestPrice))
    .filter((coin) => yearFilter === "全部" || tagValue(coin.coinName, "year") === yearFilter)
    .filter((coin) => materialFilter === "全部" || tagValue(coin.coinName, "material") === materialFilter)
    .filter((coin) => weightFilter === "全部" || tagValue(coin.coinName, "weight") === weightFilter)
    .filter((coin) => finishFilter === "全部" || tagValue(coin.coinName, "finish") === finishFilter)
    .sort((a, b) => {
      if (candidateSort === "price-asc") return (a.latestPrice ?? Infinity) - (b.latestPrice ?? Infinity);
      if (candidateSort === "price-desc") return (b.latestPrice ?? -1) - (a.latestPrice ?? -1);
      if (candidateSort === "sales") return b.saleCount - a.saleCount;
      if (candidateSort === "year") return tagValue(b.coinName, "year").localeCompare(tagValue(a.coinName, "year"), "zh-CN", { numeric: true });
      return b.score - a.score || b.saleCount - a.saleCount;
    });
  const visibleRecords = filteredRecords
    .filter((record) => !invalidPriceRange && inPriceRange(record.price))
    .sort((a, b) => {
      if (recordSort === "price-asc") return (a.price ?? Infinity) - (b.price ?? Infinity);
      if (recordSort === "price-desc") return (b.price ?? -1) - (a.price ?? -1);
      return (b.transactedAt || "").localeCompare(a.transactedAt || "");
    });
  const platformCoverage = ["赵涌在线", "易金在线", "邮宝"].map((platform) => ({
    platform,
    count: data?.records.filter((record) => record.platform === platform).length ?? 0,
    url: data ? platformSearchUrl(platform, data.coinName) : "",
  }));

  const priceFilter = (
    <div style={{ display: "flex", alignItems: "center", gap: 7, flexWrap: "wrap" }}>
      <span style={{ fontSize: 12, fontWeight: 600, color: "#667085" }}>价格区间</span>
      <input
        type="number"
        min="0"
        inputMode="numeric"
        value={minPrice}
        onChange={(event) => setMinPrice(event.target.value)}
        placeholder="最低价"
        aria-label="最低价格"
        style={{ width: 92, padding: "6px 9px", border: "1px solid #d0d5dd", borderRadius: 7, fontSize: 12 }}
      />
      <span style={{ color: "#98a2b3" }}>—</span>
      <input
        type="number"
        min="0"
        inputMode="numeric"
        value={maxPrice}
        onChange={(event) => setMaxPrice(event.target.value)}
        placeholder="最高价"
        aria-label="最高价格"
        style={{ width: 92, padding: "6px 9px", border: "1px solid #d0d5dd", borderRadius: 7, fontSize: 12 }}
      />
      {(minPrice || maxPrice) && (
        <button
          type="button"
          onClick={() => { setMinPrice(""); setMaxPrice(""); }}
          style={{ padding: "6px 10px", border: 0, background: "transparent", color: "#155eef", cursor: "pointer", fontSize: 12 }}
        >
          清除
        </button>
      )}
      {invalidPriceRange && <span style={{ color: "#dc2626", fontSize: 12 }}>最低价不能高于最高价</span>}
    </div>
  );

  const selectStyle: React.CSSProperties = {
    padding: "7px 28px 7px 10px",
    border: "1px solid #d0d5dd",
    borderRadius: 8,
    background: "#fff",
    color: "#344054",
    fontSize: 12,
  };

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

        {!loading && candidates.length > 0 && (
          <section style={{ marginBottom: 28 }}>
            <div style={{ marginBottom: 14 }}>
              <h1 style={{ margin: "0 0 6px", fontSize: 24, color: "#101828" }}>
                “{name}”有多个相关币种
              </h1>
              <p style={{ margin: 0, color: "#667085", fontSize: 14 }}>
                请选择年份和规格后查看行情，系统不会再自动跳到某一个年份。
              </p>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 10, marginBottom: 16 }}>
              {[
                ["相关币种", `${candidates.length} 种`],
                ["年份覆盖", candidateYears.length > 1 ? `${candidateYears.at(-1)}—${candidateYears[0]}` : candidateYears[0] ?? "待识别"],
                ["最新成交价范围", candidatePriceValues.length ? `¥${Math.min(...candidatePriceValues).toLocaleString()}—¥${Math.max(...candidatePriceValues).toLocaleString()}` : "暂无价格"],
                ["成交样本", `${totalCandidateSales.toLocaleString()} 条`],
              ].map(([label, value]) => (
                <div key={label} style={{ padding: "12px 14px", background: "#f8faff", border: "1px solid #e4eaf5", borderRadius: 10 }}>
                  <span style={{ display: "block", color: "#667085", fontSize: 11, marginBottom: 4 }}>{label}</span>
                  <strong style={{ color: "#101828", fontSize: 14 }}>{value}</strong>
                </div>
              ))}
            </div>
            <div style={{ padding: 14, marginBottom: 14, background: "#f9fafb", border: "1px solid #e4e7ec", borderRadius: 12 }}>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 10 }}>
                <select aria-label="筛选年份" value={yearFilter} onChange={(event) => setYearFilter(event.target.value)} style={selectStyle}>
                  <option value="全部">全部年份</option>
                  {filterOptions("year").map((item) => <option key={item}>{item}</option>)}
                </select>
                <select aria-label="筛选材质" value={materialFilter} onChange={(event) => setMaterialFilter(event.target.value)} style={selectStyle}>
                  <option value="全部">全部材质</option>
                  {filterOptions("material").map((item) => <option key={item}>{item}</option>)}
                </select>
                <select aria-label="筛选重量" value={weightFilter} onChange={(event) => setWeightFilter(event.target.value)} style={selectStyle}>
                  <option value="全部">全部重量</option>
                  {filterOptions("weight").map((item) => <option key={item}>{item}</option>)}
                </select>
                <select aria-label="筛选工艺" value={finishFilter} onChange={(event) => setFinishFilter(event.target.value)} style={selectStyle}>
                  <option value="全部">全部工艺</option>
                  {filterOptions("finish").map((item) => <option key={item}>{item}</option>)}
                </select>
                <select aria-label="候选排序" value={candidateSort} onChange={(event) => setCandidateSort(event.target.value)} style={{ ...selectStyle, marginLeft: "auto" }}>
                  <option value="relevance">相关度排序</option>
                  <option value="year">年份从新到旧</option>
                  <option value="sales">成交量最多</option>
                  <option value="price-asc">价格从低到高</option>
                  <option value="price-desc">价格从高到低</option>
                </select>
              </div>
              {priceFilter}
            </div>
            <p style={{ margin: "0 0 10px", color: "#667085", fontSize: 12 }}>当前显示 {visibleCandidates.length} 个结果</p>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 10 }}>
              {visibleCandidates.map((coin) => (
                <button
                  key={coin.slug}
                  type="button"
                  onClick={() => void fetchCoin(coin.coinName)}
                  style={{
                    padding: "14px 16px",
                    textAlign: "left",
                    border: "1px solid #e4e7ec",
                    borderRadius: 12,
                    background: "#fff",
                    color: "#101828",
                    cursor: "pointer",
                  }}
                >
                  <strong style={{ display: "block", marginBottom: 5, lineHeight: 1.45 }}>{coin.coinName}</strong>
                  <span style={{ display: "flex", flexWrap: "wrap", gap: 5, marginBottom: 8 }}>
                    {coinTags(coin.coinName).map((tag) => (
                      <i key={tag} style={{ padding: "2px 7px", borderRadius: 999, background: "#eff4ff", color: "#175cd3", fontSize: 10, fontStyle: "normal", fontWeight: 600 }}>
                        {tag}
                      </i>
                    ))}
                  </span>
                  <span style={{ color: "#667085", fontSize: 12 }}>
                    {coin.latestPrice != null ? `最新成交 ¥${coin.latestPrice.toLocaleString()} · ` : ""}
                    收录 {coin.saleCount} 条成交记录 →
                  </span>
                </button>
              ))}
            </div>
            {visibleCandidates.length === 0 && (
              <div style={{ padding: 28, textAlign: "center", color: "#667085", background: "#f9fafb", borderRadius: 12 }}>
                该价格区间内暂无相关币种
              </div>
            )}
          </section>
        )}

        {data && (
          <>
            {/* Header */}
            <div style={{ marginBottom: 24 }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: "#155eef", textTransform: "uppercase", letterSpacing: 1 }}>
                币种详情
              </span>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap", margin: "6px 0 10px" }}>
                <h1 style={{ fontSize: 28, fontWeight: 800, margin: 0, color: "#101828", letterSpacing: "-1px" }}>
                  {data.coinName}
                </h1>
                <button
                  type="button"
                  onClick={() => toggleSavedCoin(data.coinName)}
                  aria-pressed={savedCoins.includes(data.coinName)}
                  style={{ padding: "8px 14px", border: savedCoins.includes(data.coinName) ? "1px solid #fdb022" : "1px solid #d0d5dd", borderRadius: 9, background: savedCoins.includes(data.coinName) ? "#fffaeb" : "#fff", color: savedCoins.includes(data.coinName) ? "#b54708" : "#344054", fontSize: 12, fontWeight: 600, cursor: "pointer" }}
                >
                  {savedCoins.includes(data.coinName) ? "★ 已收藏" : "☆ 收藏币种"}
                </button>
              </div>
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
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap", marginBottom: 16 }}>
              {priceFilter}
              <select aria-label="成交记录排序" value={recordSort} onChange={(event) => setRecordSort(event.target.value)} style={selectStyle}>
                <option value="latest">最近成交优先</option>
                <option value="price-asc">价格从低到高</option>
                <option value="price-desc">价格从高到低</option>
              </select>
            </div>

            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", padding: "10px 13px", marginBottom: 12, borderRadius: 10, background: "#f8fafc", color: "#667085", fontSize: 11 }}>
              <span>价格口径：成交价与含佣价分开展示</span>
              <span>·</span>
              <span>样本：{data.records.filter((record) => record.price !== null).length} 条有价成交</span>
              <span>·</span>
              <span>核验：可通过原始交易页复核</span>
            </div>

            <section style={{ padding: 16, marginBottom: 16, border: "1px solid #e4e7ec", borderRadius: 12, background: "#fff" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 10, flexWrap: "wrap", marginBottom: 10 }}>
                <h2 style={{ margin: 0, fontSize: 14, color: "#101828" }}>平台覆盖</h2>
                <span style={{ color: "#98a2b3", fontSize: 10 }}>暂无已核验数据不代表该平台没有成交</span>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 8 }}>
                {platformCoverage.map((item) => {
                  const config = PLATFORM_CONFIG[item.platform] ?? { color: "#6b7280", bg: "#f9fafb" };
                  return (
                    <div key={item.platform} style={{ padding: "11px 12px", border: "1px solid #eef0f3", borderRadius: 9, background: config.bg }}>
                      <span style={{ display: "flex", alignItems: "center", gap: 6, color: "#344054", fontSize: 12, fontWeight: 600 }}>
                        <i style={{ width: 7, height: 7, borderRadius: "50%", background: config.color }} />
                        {item.platform}
                      </span>
                      <strong style={{ display: "block", margin: "6px 0 5px", color: item.count > 0 ? "#101828" : "#98a2b3", fontSize: 14 }}>
                        {item.count > 0 ? `${item.count} 条已核验成交` : "暂无已核验数据"}
                      </strong>
                      {item.url && (
                        <a href={item.url} target="_blank" rel="noreferrer" style={{ color: "#155eef", fontSize: 10, textDecoration: "none" }}>
                          去平台继续搜索 ↗
                        </a>
                      )}
                    </div>
                  );
                })}
              </div>
            </section>

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
                    <span>成交记录（{visibleRecords.length} 条）</span>
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
                      {visibleRecords.map((r, i) => {
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
                            {r.price !== null ? (
                              <span>
                                <span style={{ display: "block" }}>¥{r.price.toLocaleString()}</span>
                                {r.priceWithFee !== null && r.priceWithFee !== r.price && (
                                  <small style={{ display: "block", marginTop: 2, color: "#667085", fontFamily: "inherit", fontSize: 10, fontWeight: 400 }}>
                                    含佣 ¥{r.priceWithFee.toLocaleString()}
                                  </small>
                                )}
                              </span>
                            ) : (
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
                            <span style={{ display: "block", marginTop: 5, color: r.verificationStatus === "official_pending" ? "#b54708" : "#027a48", fontSize: 9, whiteSpace: "nowrap" }}>
                              {r.verificationStatus === "verified" ? "评级机构官网已核验" : "原交易页已核对 · 评级机构官网待复核"}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
                {visibleRecords.length === 0 && (
                  <div style={{ textAlign: "center", padding: 36, color: "#98a2b3", fontSize: 13 }}>
                    当前评级或价格区间内暂无记录
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
