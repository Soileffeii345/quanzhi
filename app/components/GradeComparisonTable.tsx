"use client";

import type { PlatformRecord, RealRecord } from "../lib/types";
import { useMemo } from "react";

type GradeStat = {
  grade: string;
  count: number;
  avg: number;
  high: number;
  low: number;
};

type Props = {
  platformRecords: PlatformRecord[];
  realRecords: RealRecord[];
  isBoxQuery: boolean;
};

// Extract grade-like tokens from title or coin info
function extractGrade(title: string): string {
  // Common NGC/PCGS grade patterns
  const m = title.match(/\b(MS|PF|PR|SP|AU|XF|VF|UNC)\s*\d{2}(?:\s*(?:ULTRA\s*CAMEO|UC|DCAM|PL|DPL|FB|FH|RB|RD|BN|CAM))?\b/i);
  if (m) return m[0].replace(/\s+/g, " ").toUpperCase();
  // Simple number grade like "70", "69"
  const nm = title.match(/\b(?:评级|分数|grade)?\s*(\d{2})\s*(?:分)?\b/);
  if (nm) return `MS ${nm[1]}`;
  return "其他";
}

function parseNumericGrade(grade: string): number {
  const m = grade.match(/\d{2}/);
  return m ? parseInt(m[0]) : 0;
}

export default function GradeComparisonTable({ platformRecords, realRecords, isBoxQuery }: Props) {
  const stats = useMemo(() => {
    if (isBoxQuery) return null; // Grade comparison only makes sense for keyword searches

    // Collect all records with prices and grades
    const records: { grade: string; price: number }[] = [];

    for (const r of platformRecords) {
      if (r.price > 0) {
        const g = extractGrade(r.title);
        if (g !== "其他") records.push({ grade: g, price: r.price });
      }
    }
    for (const r of realRecords) {
      if (r.price > 0) {
        const g = extractGrade(r.title);
        if (g !== "其他") records.push({ grade: g, price: r.price });
      }
    }

    if (records.length < 3) return null;

    // Group by grade
    const groups = new Map<string, number[]>();
    for (const r of records) {
      const existing = groups.get(r.grade) ?? [];
      existing.push(r.price);
      groups.set(r.grade, existing);
    }

    // Only show if at least 2 distinct grades
    if (groups.size < 2) return null;

    const result: GradeStat[] = [];
    for (const [grade, prices] of groups) {
      prices.sort((a, b) => a - b);
      result.push({
        grade,
        count: prices.length,
        avg: Math.round(prices.reduce((s, p) => s + p, 0) / prices.length),
        high: prices[prices.length - 1],
        low: prices[0],
      });
    }

    // Sort by numeric grade descending (MS70 before MS69)
    result.sort((a, b) => parseNumericGrade(b.grade) - parseNumericGrade(a.grade));

    return result;
  }, [platformRecords, realRecords, isBoxQuery]);

  if (!stats) return null;

  return (
    <div style={{
      marginBottom: 16,
      border: "1px solid #d6e4ff",
      borderRadius: 16,
      overflow: "hidden",
      background: "#fff",
    }}>
      <div style={{
        padding: "14px 20px",
        background: "#f5f8ff",
        borderBottom: "1px solid #d6e4ff",
        display: "flex",
        alignItems: "center",
        gap: 8,
      }}>
        <span style={{ fontSize: 14, fontWeight: 700, color: "#101828" }}>📊 评级价格对照</span>
        <span style={{ fontSize: 11, color: "#98a2b3" }}>同币种不同评级的成交价对比</span>
      </div>
      <div style={{ overflowX: "auto" }}>
        <table style={{
          width: "100%",
          borderCollapse: "collapse",
          fontSize: 13,
        }}>
          <thead>
            <tr style={{ background: "#fafbfc" }}>
              <th style={thStyle}>评级</th>
              <th style={{ ...thStyle, textAlign: "right" }}>成交均价</th>
              <th style={{ ...thStyle, textAlign: "right" }}>最高价</th>
              <th style={{ ...thStyle, textAlign: "right" }}>最低价</th>
              <th style={{ ...thStyle, textAlign: "right" }}>成交笔数</th>
            </tr>
          </thead>
          <tbody>
            {stats.map((s, i) => (
              <tr key={s.grade} style={{ background: i % 2 === 0 ? "#fff" : "#fafbfc" }}>
                <td style={{ ...tdStyle, fontWeight: 600, color: "#155eef" }}>{s.grade}</td>
                <td style={{ ...tdStyle, textAlign: "right", fontWeight: 700 }}>
                  ¥{s.avg.toLocaleString()}
                </td>
                <td style={{ ...tdStyle, textAlign: "right", color: "#067647" }}>
                  ¥{s.high.toLocaleString()}
                </td>
                <td style={{ ...tdStyle, textAlign: "right", color: "#b54708" }}>
                  ¥{s.low.toLocaleString()}
                </td>
                <td style={{ ...tdStyle, textAlign: "right", color: "#6b7280" }}>
                  {s.count}笔
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

const thStyle: React.CSSProperties = {
  padding: "10px 14px",
  textAlign: "left",
  fontWeight: 600,
  fontSize: 12,
  color: "#6b7280",
  borderBottom: "2px solid #e5e7eb",
};

const tdStyle: React.CSSProperties = {
  padding: "10px 14px",
  borderBottom: "1px solid #f3f4f6",
};
