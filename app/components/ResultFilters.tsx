"use client";

import { useState, type CSSProperties } from "react";

export type SaleFilter = "all" | "sold" | "active";

type Props = {
  dateFrom: string;
  dateTo: string;
  saleFilter: SaleFilter;
  priceMin: string;
  priceMax: string;
  resultCount: number;
  filteredCount: number;
  onDateFromChange: (v: string) => void;
  onDateToChange: (v: string) => void;
  onSaleFilterChange: (v: SaleFilter) => void;
  onPriceMinChange: (v: string) => void;
  onPriceMaxChange: (v: string) => void;
  onClear: () => void;
};

export default function ResultFilters({
  dateFrom,
  dateTo,
  saleFilter,
  priceMin,
  priceMax,
  resultCount,
  filteredCount,
  onDateFromChange,
  onDateToChange,
  onSaleFilterChange,
  onPriceMinChange,
  onPriceMaxChange,
  onClear,
}: Props) {
  const [expanded, setExpanded] = useState(false);
  const hasFilter = dateFrom || dateTo || saleFilter !== "all" || priceMin || priceMax;
  const showing = hasFilter ? filteredCount : resultCount;

  return (
    <div style={barStyle}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
        <b style={{ fontSize: 13, color: "#101828" }}>{showing} 条记录</b>
        {hasFilter && (
          <span style={{ fontSize: 11, color: "#155eef", background: "#eff4ff", padding: "2px 6px", borderRadius: 4 }}>
            已筛选
          </span>
        )}

        <span style={{ flex: 1 }} />

        <button
          onClick={() => setExpanded(!expanded)}
          style={{
            ...toggleBtnStyle,
            background: expanded ? "#eff4ff" : "#fff",
            color: expanded ? "#155eef" : "#6b7280",
          }}
        >
          {expanded ? "收起筛选 ▴" : "筛选 ▾"}
        </button>

        {hasFilter && (
          <button onClick={onClear} style={clearBtnStyle}>
            ✕ 清除
          </button>
        )}
      </div>

      {expanded && (
        <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap", paddingTop: 10, borderTop: "1px solid #e4e7ec", marginTop: 8 }}>
          <span style={{ fontSize: 10, color: "#98a2b3", marginRight: 4 }}>时间</span>
          <input type="date" value={dateFrom} onChange={(e) => onDateFromChange(e.target.value)} style={inputSm} title="起始日期" />
          <span style={{ color: "#d1d5db", fontSize: 11 }}>~</span>
          <input type="date" value={dateTo} onChange={(e) => onDateToChange(e.target.value)} style={inputSm} title="结束日期" />

          <span style={sepStyle} />

          <span style={{ fontSize: 10, color: "#98a2b3" }}>金额</span>
          <input type="number" value={priceMin} onChange={(e) => onPriceMinChange(e.target.value)} style={{ ...inputSm, width: "100%", maxWidth: 80 }} placeholder="最低¥" min="0" />
          <span style={{ color: "#d1d5db", fontSize: 11 }}>~</span>
          <input type="number" value={priceMax} onChange={(e) => onPriceMaxChange(e.target.value)} style={{ ...inputSm, width: "100%", maxWidth: 80 }} placeholder="最高¥" min="0" />

          <span style={sepStyle} />

          <div style={tabsStyle}>
            {(["all", "sold", "active"] as const).map((key) => (
              <button
                key={key}
                onClick={() => onSaleFilterChange(key)}
                style={{ ...tabBaseStyle, ...(saleFilter === key ? tabActiveStyle : {}) }}
              >
                {key === "all" ? "全部" : key === "sold" ? "已成交" : "在售"}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

const barStyle: CSSProperties = {
  padding: "10px 14px",
  background: "#f9fafb",
  border: "1px solid #e4e7ec",
  borderRadius: 12,
  marginBottom: 12,
};

const inputSm: CSSProperties = {
  padding: "5px 7px",
  fontSize: 11,
  border: "1px solid #d1d5db",
  borderRadius: 5,
  color: "#374151",
  background: "#fff",
  outline: "none",
  width: "100%",
  maxWidth: 140,
  minWidth: 90,
};

const sepStyle: CSSProperties = {
  width: 1,
  height: 16,
  background: "#e4e7ec",
  margin: "0 4px",
};

const tabsStyle: CSSProperties = {
  display: "flex",
  border: "1px solid #d1d5db",
  borderRadius: 5,
  overflow: "hidden",
};

const tabBaseStyle: CSSProperties = {
  padding: "4px 9px",
  fontSize: 11,
  cursor: "pointer",
  background: "#fff",
  color: "#6b7280",
  border: "none",
  borderRight: "1px solid #d1d5db",
  outline: "none",
  fontFamily: "inherit",
};

const tabActiveStyle: CSSProperties = {
  background: "#eff4ff",
  color: "#155eef",
  fontWeight: 600,
};

const toggleBtnStyle: CSSProperties = {
  padding: "5px 12px",
  fontSize: 12,
  border: "1px solid #d1d5db",
  borderRadius: 6,
  cursor: "pointer",
  fontFamily: "inherit",
  outline: "none",
};

const clearBtnStyle: CSSProperties = {
  fontSize: 11,
  color: "#6b7280",
  background: "none",
  border: "none",
  cursor: "pointer",
  padding: "2px 4px",
  fontFamily: "inherit",
};
