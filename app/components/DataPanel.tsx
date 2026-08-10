"use client";

import { useEffect, useState } from "react";

type PanelData = {
  totalBoxes: number;
  totalSales: number;
  totalCoins: number;
  activeListings: number;
  latestUpdate: string;
};

export default function DataPanel() {
  const [data, setData] = useState<PanelData | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const [manifestRes, coinRes] = await Promise.all([
          fetch("/box-data/manifest.json", { signal: AbortSignal.timeout(3000) }),
          fetch("/coin-data/index.json", { signal: AbortSignal.timeout(3000) }),
        ]);
        const manifest = manifestRes.ok
          ? (await manifestRes.json() as { verifiedBoxes?: number; verifiedSales?: number; activeListings?: number; generatedAt?: string })
          : null;
        const coinIndex = coinRes.ok
          ? (await coinRes.json() as { totalCoins?: number })
          : null;

        setData({
          totalBoxes: manifest?.verifiedBoxes ?? 0,
          totalSales: manifest?.verifiedSales ?? 0,
          totalCoins: coinIndex?.totalCoins ?? 0,
          activeListings: manifest?.activeListings ?? 0,
          latestUpdate: manifest?.generatedAt ?? "",
        });
      } catch { /* non-critical */ }
    }
    void load();
  }, []);

  if (!data) return null;

  const items = [
    { label: "收录盒号", value: data.totalBoxes.toLocaleString() },
    { label: "交易记录", value: data.totalSales.toLocaleString() },
    { label: "覆盖币种", value: data.totalCoins.toLocaleString() },
    { label: "在售商品", value: data.activeListings.toLocaleString() },
  ];

  return (
    <section className="data-panel" aria-label="泉知数据概览">
      <div className="data-panel-grid">
        {items.map((item) => (
          <div className="data-metric" key={item.label}>
            <div className="data-metric-value">
              {item.value}
            </div>
            <div className="data-metric-label">{item.label}</div>
          </div>
        ))}
      </div>
      {data.latestUpdate && (
        <div className="data-freshness">
          <span aria-hidden="true" /> 数据更新于 {data.latestUpdate.slice(0, 10)} · 每条成交保留原始证据
        </div>
      )}
    </section>
  );
}
