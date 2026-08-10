"use client";

import type { PlatformRecord, RealRecord } from "../lib/types";
import { useMemo } from "react";

type Props = {
  platformRecords: PlatformRecord[];
  realRecords: RealRecord[];
  submitted: string;
};

type PlatformPrice = {
  platform: string;
  color: string;
  avgPrice: number | null;
  highPrice: number | null;
  lowPrice: number | null;
  count: number;
  activeCount: number;
};

const PLATFORMS = [
  { key: "赵涌在线", label: "赵涌在线", color: "#2563eb", hasData: true },
  { key: "易金在线", label: "易金在线", color: "#ea580c", hasData: true },
  { key: "邮宝", label: "邮宝", color: "#059669", hasData: true },
];

const EXTERNAL_LINKS = [
  { label: "闲鱼", url: "https://www.goofish.com/search?q=", color: "#ff5000" },
  { label: "爱藏", url: "https://m.airmb.com/search?keyword=", color: "#c0262d" },
  { label: "麦稀奇", url: "https://www.mxiqi.com/search?keyword=", color: "#7c3aed" },
  { label: "金币云集", url: "https://www.chngc.net/search?keyword=", color: "#b45309" },
];

export default function PlatformComparisonTable({ platformRecords, realRecords, submitted }: Props) {
  const stats = useMemo(() => {
    const map = new Map<string, { prices: number[]; activeCount: number }>();

    for (const r of platformRecords) {
      const entry = map.get(r.source) ?? { prices: [], activeCount: 0 };
      if (r.price > 0) entry.prices.push(r.price);
      if (r.status.includes("在售")) entry.activeCount++;
      map.set(r.source, entry);
    }

    for (const r of realRecords) {
      const entry = map.get(r.source) ?? { prices: [], activeCount: 0 };
      if (r.price > 0) entry.prices.push(r.price);
      map.set(r.source, entry);
    }

    const results: PlatformPrice[] = [];
    for (const p of PLATFORMS) {
      const entry = map.get(p.key);
      const prices = entry?.prices ?? [];
      results.push({
        platform: p.label,
        color: p.color,
        avgPrice: prices.length > 0 ? Math.round(prices.reduce((a, b) => a + b, 0) / prices.length) : null,
        highPrice: prices.length > 0 ? Math.max(...prices) : null,
        lowPrice: prices.length > 0 ? Math.min(...prices) : null,
        count: prices.length,
        activeCount: entry?.activeCount ?? 0,
      });
    }

    return results;
  }, [platformRecords, realRecords]);

  const hasAny = stats.some((s) => s.count > 0);
  if (!hasAny && !submitted) return null;

  return (
    <div style={cardStyle}>
      <div style={headerStyle}>
        <span style={{ fontSize: 14, fontWeight: 700, color: "#101828" }}>📊 平台比价</span>
        <span style={{ fontSize: 11, color: "#98a2b3" }}>
          {hasAny ? `${stats.reduce((s, p) => s + p.count, 0)} 条记录` : "无数据库记录"}
        </span>
      </div>

      {/* Data platforms table */}
      {hasAny && (
        <table style={tableStyle}>
          <thead>
            <tr>
              <th style={thStyle}>平台</th>
              <th style={{ ...thStyle, textAlign: "right" }}>均价</th>
              <th style={{ ...thStyle, textAlign: "right" }}>最高</th>
              <th style={{ ...thStyle, textAlign: "right" }}>最低</th>
              <th style={{ ...thStyle, textAlign: "center" }}>成交</th>
              <th style={{ ...thStyle, textAlign: "center" }}>在售</th>
            </tr>
          </thead>
          <tbody>
            {stats.filter((s) => s.count > 0).map((s) => (
              <tr key={s.platform}>
                <td style={{ ...tdStyle, fontWeight: 600 }}>
                  <span style={{ display: "inline-block", width: 8, height: 8, borderRadius: "50%", background: s.color, marginRight: 8 }} />
                  {s.platform}
                </td>
                <td style={{ ...tdStyle, textAlign: "right", fontWeight: 700 }}>
                  {s.avgPrice ? `¥${s.avgPrice.toLocaleString()}` : "—"}
                </td>
                <td style={{ ...tdStyle, textAlign: "right", color: "#067647" }}>
                  {s.highPrice ? `¥${s.highPrice.toLocaleString()}` : "—"}
                </td>
                <td style={{ ...tdStyle, textAlign: "right", color: "#b54708" }}>
                  {s.lowPrice ? `¥${s.lowPrice.toLocaleString()}` : "—"}
                </td>
                <td style={{ ...tdStyle, textAlign: "center" }}>{s.count}笔</td>
                <td style={{ ...tdStyle, textAlign: "center" }}>
                  {s.activeCount > 0 ? (
                    <span style={{ color: "#7a5ce5", fontWeight: 600 }}>{s.activeCount}</span>
                  ) : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {/* External platform quick-search links */}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", paddingTop: hasAny ? 10 : 0, borderTop: hasAny ? "1px solid #e4e7ec" : "none", marginTop: hasAny ? 10 : 0 }}>
        <span style={{ fontSize: 11, color: "#98a2b3", lineHeight: "28px" }}>外部平台搜:</span>
        {EXTERNAL_LINKS.map((p) => (
          <a
            key={p.label}
            href={`${p.url}${encodeURIComponent(submitted)}`}
            target="_blank"
            rel="noreferrer"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 4,
              padding: "4px 12px",
              fontSize: 12,
              fontWeight: 500,
              color: p.color,
              background: "#fff",
              border: `1px solid ${p.color}33`,
              borderRadius: 16,
              textDecoration: "none",
              transition: "all .15s",
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLElement).style.background = p.color + "0d";
              (e.currentTarget as HTMLElement).style.borderColor = p.color;
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLElement).style.background = "#fff";
              (e.currentTarget as HTMLElement).style.borderColor = p.color + "33";
            }}
          >
            {p.label} ↗
          </a>
        ))}
      </div>
    </div>
  );
}

const cardStyle: React.CSSProperties = {
  marginBottom: 16,
  padding: "16px 20px",
  border: "1px solid #d6e4ff",
  borderRadius: 16,
  background: "#fff",
};

const headerStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  marginBottom: 10,
};

const tableStyle: React.CSSProperties = {
  width: "100%",
  borderCollapse: "collapse",
  fontSize: 13,
};

const thStyle: React.CSSProperties = {
  padding: "8px 10px",
  textAlign: "left",
  fontWeight: 600,
  fontSize: 11,
  color: "#6b7280",
  borderBottom: "2px solid #e5e7eb",
};

const tdStyle: React.CSSProperties = {
  padding: "8px 10px",
  borderBottom: "1px solid #f3f4f6",
};
