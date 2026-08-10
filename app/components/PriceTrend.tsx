"use client";

import { useMemo, useState } from "react";

type PricePoint = {
  price: number;
  transactedAt: string;
  platform: string;
  detailUrl?: string;
};

type Props = {
  records: PricePoint[];
  width?: number;
  height?: number;
};

type TimeRange = "all" | "1y" | "6m" | "3m";

const PLATFORM_COLORS: Record<string, string> = {
  易金在线: "#f97316",
  赵涌在线: "#2563eb",
  邮宝: "#16a34a",
};

function parseDate(value: string): number {
  const normalized = value.includes("T") ? value : value.replace(" ", "T");
  return new Date(normalized).getTime();
}

function cutoffFor(range: TimeRange): number {
  const date = new Date();
  const months = range === "1y" ? 12 : range === "6m" ? 6 : 3;
  date.setMonth(date.getMonth() - months);
  return date.getTime();
}

function currency(value: number): string {
  return `¥${Math.round(value).toLocaleString("zh-CN")}`;
}

export default function PriceTrend({ records, width = 720, height = 300 }: Props) {
  const [range, setRange] = useState<TimeRange>("all");

  const allPoints = useMemo(() => records
    .filter((record) => Number.isFinite(record.price) && record.price > 0 && record.transactedAt)
    .map((record) => ({
      ...record,
      date: parseDate(record.transactedAt),
      label: record.transactedAt.slice(0, 10),
    }))
    .filter((point) => Number.isFinite(point.date))
    .sort((a, b) => a.date - b.date), [records]);

  const points = useMemo(() => {
    if (range === "all") return allPoints;
    const cutoff = cutoffFor(range);
    return allPoints.filter((point) => point.date >= cutoff);
  }, [allPoints, range]);

  if (allPoints.length < 2) return null;

  const prices = points.map((point) => point.price);
  const sortedPrices = [...prices].sort((a, b) => a - b);
  const median = sortedPrices.length
    ? sortedPrices.length % 2
      ? sortedPrices[(sortedPrices.length - 1) / 2]
      : (sortedPrices[sortedPrices.length / 2 - 1] + sortedPrices[sortedPrices.length / 2]) / 2
    : 0;
  const latest = points.at(-1);
  const earliest = points[0];
  const change = latest && earliest && earliest.price > 0
    ? ((latest.price - earliest.price) / earliest.price) * 100
    : null;
  const platforms = [...new Set(points.map((point) => point.platform))];
  const rangeOptions: Array<{ key: TimeRange; label: string }> = [
    { key: "all", label: "全部" },
    { key: "1y", label: "近1年" },
    { key: "6m", label: "近6个月" },
    { key: "3m", label: "近3个月" },
  ];

  const padding = { top: 24, right: 18, bottom: 42, left: 66 };
  const plotWidth = width - padding.left - padding.right;
  const plotHeight = height - padding.top - padding.bottom;
  const minPrice = prices.length ? Math.min(...prices) : 0;
  const maxPrice = prices.length ? Math.max(...prices) : 1;
  const priceRange = Math.max(maxPrice - minPrice, 1);
  const lowerPadding = Math.min(Math.max(priceRange * 0.05, 1), minPrice * 0.1);
  const upperPadding = Math.max(priceRange * 0.05, maxPrice * 0.01, 1);
  const yMin = Math.max(0, minPrice - lowerPadding);
  const yMax = maxPrice + upperPadding;
  const minDate = earliest?.date ?? 0;
  const maxDate = latest?.date ?? minDate + 1;
  const x = (date: number) => padding.left + ((date - minDate) / (maxDate - minDate || 1)) * plotWidth;
  const y = (price: number) => padding.top + plotHeight - ((price - yMin) / (yMax - yMin || 1)) * plotHeight;
  const yTicks = Array.from({ length: 5 }, (_, index) => yMin + ((yMax - yMin) * index) / 4);
  const xTickIndexes = [...new Set(Array.from({ length: Math.min(5, points.length) }, (_, index) =>
    Math.round((index * (points.length - 1)) / Math.max(1, Math.min(5, points.length) - 1))))];

  return (
    <div>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center", marginBottom: 14 }}>
        {rangeOptions.map((option) => (
          <button
            key={option.key}
            type="button"
            onClick={() => setRange(option.key)}
            aria-pressed={range === option.key}
            style={{
              padding: "6px 12px",
              fontSize: 12,
              fontWeight: range === option.key ? 700 : 500,
              border: range === option.key ? "1px solid #155eef" : "1px solid #d0d5dd",
              borderRadius: 999,
              background: range === option.key ? "#eff4ff" : "#fff",
              color: range === option.key ? "#155eef" : "#475467",
              cursor: "pointer",
            }}
          >
            {option.label}
          </button>
        ))}
      </div>

      {points.length < 2 ? (
        <div style={{ padding: "28px 12px", textAlign: "center", color: "#667085", fontSize: 13, background: "#f9fafb", borderRadius: 10 }}>
          该时间范围内只有 {points.length} 条有效成交，暂不足以判断趋势。
        </div>
      ) : (
        <>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))", gap: 8, marginBottom: 14 }}>
            {[
              ["最新成交", currency(latest!.price)],
              ["中位成交价", currency(median)],
              ["价格区间", `${currency(minPrice)}—${currency(maxPrice)}`],
              ["区间变化", change === null ? "—" : `${change >= 0 ? "+" : ""}${change.toFixed(1)}%`],
            ].map(([label, value]) => (
              <div key={label} style={{ padding: "10px 12px", background: "#f8fafc", border: "1px solid #eaecf0", borderRadius: 10 }}>
                <div style={{ fontSize: 11, color: "#667085", marginBottom: 4 }}>{label}</div>
                <div style={{ fontSize: 15, fontWeight: 750, color: "#101828" }}>{value}</div>
              </div>
            ))}
          </div>

          <div style={{ overflowX: "auto" }}>
            <svg viewBox={`0 0 ${width} ${height}`} width="100%" style={{ minWidth: 520, maxWidth: width, fontFamily: "system-ui, sans-serif" }} role="img" aria-label={`价格趋势图，共${points.length}条成交记录`}>
              {yTicks.map((value) => (
                <g key={value}>
                  <line x1={padding.left} y1={y(value)} x2={width - padding.right} y2={y(value)} stroke="#eaecf0" strokeDasharray="4 4" />
                  <text x={padding.left - 8} y={y(value) + 4} textAnchor="end" fontSize="10" fill="#667085">{currency(value)}</text>
                </g>
              ))}
              {xTickIndexes.map((index) => {
                const point = points[index];
                return <text key={`${point.date}-${index}`} x={x(point.date)} y={height - 10} textAnchor="middle" fontSize="10" fill="#667085">{point.label}</text>;
              })}
              {platforms.map((platform) => {
                const platformPoints = points.filter((point) => point.platform === platform);
                const color = PLATFORM_COLORS[platform] ?? "#7f56d9";
                const path = platformPoints.map((point, index) => `${index ? "L" : "M"} ${x(point.date).toFixed(1)} ${y(point.price).toFixed(1)}`).join(" ");
                return (
                  <g key={platform}>
                    {platformPoints.length > 1 && <path d={path} fill="none" stroke={color} strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round" />}
                    {platformPoints.map((point, index) => (
                      <a key={`${platform}-${point.date}-${index}`} href={point.detailUrl || undefined} target={point.detailUrl ? "_blank" : undefined} rel={point.detailUrl ? "noopener noreferrer" : undefined}>
                        <circle cx={x(point.date)} cy={y(point.price)} r="4" fill="#fff" stroke={color} strokeWidth="2" style={{ cursor: point.detailUrl ? "pointer" : "default" }}>
                          <title>{`${platform} · ${point.label} · ${currency(point.price)}${point.detailUrl ? " · 点击查看原成交页" : ""}`}</title>
                        </circle>
                      </a>
                    ))}
                  </g>
                );
              })}
            </svg>
          </div>

          <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", marginTop: 8, color: "#667085", fontSize: 11 }}>
            <span>{points.length} 条有效成交 · {platforms.length} 个已收录平台 · {earliest!.label} 至 {latest!.label}</span>
            <span>同一评级筛选下统计；悬停看成交价，点击数据点可核验原页面</span>
          </div>
          <div style={{ display: "flex", gap: 14, flexWrap: "wrap", marginTop: 10 }}>
            {platforms.map((platform) => (
              <span key={platform} style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 11, color: "#475467" }}>
                <span style={{ width: 9, height: 9, borderRadius: 999, background: PLATFORM_COLORS[platform] ?? "#7f56d9" }} />
                {platform}（{points.filter((point) => point.platform === platform).length}）
              </span>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
