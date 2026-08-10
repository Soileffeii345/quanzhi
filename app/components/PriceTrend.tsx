"use client";

import { useMemo, useState } from "react";

type PricePoint = {
  price: number;
  transactedAt: string;
  platform: string;
};

type Props = {
  records: PricePoint[];
  width?: number;
  height?: number;
};

type TimeRange = "all" | "1y" | "6m" | "3m";

const PLATFORM_COLORS: Record<string, string> = {
  易金在线: "#f97316",
  赵涌在线: "#3b82f6",
  邮宝: "#22c55e",
};

function parseDate(dateStr: string): number {
  // Handle "YYYY-MM-DD" or "YYYY-MM-DD HH:mm:ss"
  return new Date(dateStr).getTime();
}

function monthsAgo(months: number): number {
  const d = new Date();
  d.setMonth(d.getMonth() - months);
  return d.getTime();
}

export default function PriceTrend({ records, width = 640, height = 260 }: Props) {
  const [range, setRange] = useState<TimeRange>("all");

  // Parse and sort by date
  const allPoints = useMemo(() => {
    return records
      .filter((r) => r.price > 0 && r.transactedAt)
      .map((r) => ({
        price: r.price,
        date: parseDate(r.transactedAt),
        platform: r.platform,
        label: r.transactedAt.slice(0, 10),
      }))
      .filter((p) => !Number.isNaN(p.date))
      .sort((a, b) => a.date - b.date);
  }, [records]);

  // Filter by time range
  const points = useMemo(() => {
    if (range === "all") return allPoints;
    const cutoff = monthsAgo(range === "1y" ? 12 : range === "6m" ? 6 : 3);
    return allPoints.filter((p) => p.date >= cutoff);
  }, [allPoints, range]);

  if (allPoints.length < 2) return null;
  if (points.length < 2) return (
    <div style={{ padding: "16px 0", textAlign: "center", color: "#98a2b3", fontSize: 13 }}>
      该时间范围内数据不足，无法绘图
    </div>
  );

  const padding = { top: 20, right: 16, bottom: 36, left: 56 };
  const plotW = width - padding.left - padding.right;
  const plotH = height - padding.top - padding.bottom;

  const prices = points.map((p) => p.price);
  const minPrice = Math.min(...prices);
  const maxPrice = Math.max(...prices);
  const priceRange = maxPrice - minPrice || 1;
  const minDate = points[0].date;
  const maxDate = points[points.length - 1].date;
  const dateRange = maxDate - minDate || 1;

  const x = (d: number) => padding.left + ((d - minDate) / dateRange) * plotW;
  const y = (p: number) => padding.top + plotH - ((p - minPrice) / priceRange) * plotH;

  // Build polylines per platform
  const platformPoints = new Map<string, { x: number; y: number; label: string; price: number }[]>();
  for (const pt of points) {
    const list = platformPoints.get(pt.platform) ?? [];
    list.push({ x: x(pt.date), y: y(pt.price), label: pt.label, price: pt.price });
    platformPoints.set(pt.platform, list);
  }

  // Y-axis ticks
  const yTicks = 4;
  const yTickValues = Array.from({ length: yTicks }, (_, i) =>
    Math.round(minPrice + (priceRange * i) / (yTicks - 1))
  );

  // X-axis ticks
  const xTickCount = Math.min(points.length, 6);
  const xTickStep = Math.max(1, Math.floor(points.length / xTickCount));
  const xTicks = points.filter((_, i) => i % xTickStep === 0 || i === points.length - 1);

  const rangeOptions: { key: TimeRange; label: string }[] = [
    { key: "all", label: "全部" },
    { key: "1y", label: "1年" },
    { key: "6m", label: "6个月" },
    { key: "3m", label: "3个月" },
  ];

  return (
    <div>
      {/* Time range selector */}
      <div style={{ display: "flex", gap: 4, marginBottom: 12 }}>
        {rangeOptions.map((opt) => (
          <button
            key={opt.key}
            onClick={() => setRange(opt.key)}
            style={{
              padding: "4px 10px",
              fontSize: 11,
              fontWeight: range === opt.key ? 600 : 400,
              border: range === opt.key ? "1px solid #155eef" : "1px solid #e4e7ec",
              borderRadius: 6,
              background: range === opt.key ? "#eff4ff" : "#fff",
              color: range === opt.key ? "#155eef" : "#667085",
              cursor: "pointer",
              fontFamily: "inherit",
            }}
          >
            {opt.label}
          </button>
        ))}
        <span style={{ fontSize: 10, color: "#98a2b3", marginLeft: "auto", alignSelf: "center" }}>
          {points.length} 个数据点
        </span>
      </div>

      <svg
        viewBox={`0 0 ${width} ${height}`}
        width="100%"
        style={{ maxWidth: width, fontFamily: "system-ui, sans-serif" }}
        role="img"
        aria-label="价格趋势图"
      >
        {/* Grid lines */}
        {yTickValues.map((val) => (
          <g key={`grid-${val}`}>
            <line
              x1={padding.left}
              y1={y(val)}
              x2={width - padding.right}
              y2={y(val)}
              stroke="#e5e7eb"
              strokeWidth={1}
              strokeDasharray="4 3"
            />
            <text
              x={padding.left - 6}
              y={y(val) + 4}
              textAnchor="end"
              fontSize={10}
              fill="#9ca3af"
            >
              ¥{val.toLocaleString()}
            </text>
          </g>
        ))}

        {/* Bottom border */}
        <line
          x1={padding.left}
          y1={y(minPrice)}
          x2={width - padding.right}
          y2={y(minPrice)}
          stroke="#d1d5db"
          strokeWidth={1}
        />

        {/* X-axis labels */}
        {xTicks.map((pt) => (
          <text
            key={`x-${pt.label}`}
            x={x(pt.date)}
            y={height - 8}
            textAnchor="middle"
            fontSize={9}
            fill="#9ca3af"
          >
            {pt.label}
          </text>
        ))}

        {/* Data lines per platform */}
        {Array.from(platformPoints.entries()).map(([platform, pts]) => {
          if (pts.length < 2) return null;
          const d = pts
            .map((p, i) => `${i === 0 ? "M" : "L"} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`)
            .join(" ");
          const color = PLATFORM_COLORS[platform] ?? "#6b7280";
          return (
            <g key={platform}>
              <path d={d} fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
              {pts.map((p, i) => (
                <g key={`${platform}-${i}`}>
                  <circle cx={p.x} cy={p.y} r={3.5} fill="#fff" stroke={color} strokeWidth={1.5} />
                  <title>
                    {platform} · {p.label} · ¥{p.price.toLocaleString()}
                  </title>
                </g>
              ))}
            </g>
          );
        })}

        {/* Legend */}
        <g transform={`translate(${padding.left}, ${padding.top - 2})`}>
          {Array.from(platformPoints.keys()).map((platform, i) => {
            const color = PLATFORM_COLORS[platform] ?? "#6b7280";
            return (
              <g key={platform} transform={`translate(${i * 80}, 0)`}>
                <line x1={0} y1={0} x2={12} y2={0} stroke={color} strokeWidth={2} />
                <text x={16} y={3} fontSize={10} fill="#6b7280">
                  {platform}
                </text>
              </g>
            );
          })}
        </g>
      </svg>
    </div>
  );
}
