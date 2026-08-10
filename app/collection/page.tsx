"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import TopBar from "../components/TopBar";

type BoxInfo = {
  boxCode: string;
  coinName: string;
  gradingCompany: string;
  grade: string;
  latestPrice: number | null;
  platform: string;
  transactedAt: string;
  detailUrl: string;
};

const PLATFORM_CONFIG: Record<string, { color: string }> = {
  "赵涌在线": { color: "#2563eb" },
  "易金在线": { color: "#ea580c" },
  "邮宝": { color: "#059669" },
};

export default function CollectionPage() {
  const [boxes, setBoxes] = useState<BoxInfo[]>([]);
  const [coins, setCoins] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadCollection = useCallback(async function loadCollection() {
    setLoading(true);
    try {
      const raw = window.localStorage.getItem("quanzhi-saved-boxes");
      const savedBoxes: string[] = raw ? JSON.parse(raw) : [];
      const savedCoinsRaw = window.localStorage.getItem("quanzhi-saved-coins");
      setCoins(savedCoinsRaw ? JSON.parse(savedCoinsRaw) : []);
      if (savedBoxes.length === 0) {
        setBoxes([]);
        return;
      }

      const settled = await Promise.allSettled(
        savedBoxes.map(async (code) => {
          const normalized = code.replace(/\D/g, "");
          if (normalized.length < 2) return null;
          try {
            const response = await fetch(
              `/box-data/${normalized.slice(0, 2)}/${normalized}.json`,
              { signal: AbortSignal.timeout(5000) }
            );
            if (!response.ok) {
              return { boxCode: code, coinName: "未收录", gradingCompany: "", grade: "", latestPrice: null, platform: "", transactedAt: "", detailUrl: "" } satisfies BoxInfo;
            }
            const data = (await response.json()) as {
              records?: Array<{ coinName: string; gradingCompany: string; grade: string; price: number | null; platform: string; transactedAt: string; detailUrl: string }>;
            };
            const record = data.records?.[0];
            return {
              boxCode: code,
              coinName: record?.coinName ?? "未收录",
              gradingCompany: record?.gradingCompany ?? "",
              grade: record?.grade ?? "",
              latestPrice: record?.price ?? null,
              platform: record?.platform ?? "",
              transactedAt: record?.transactedAt ?? "",
              detailUrl: record?.detailUrl ?? "",
            } satisfies BoxInfo;
          } catch {
            return { boxCode: code, coinName: "查询失败", gradingCompany: "", grade: "", latestPrice: null, platform: "", transactedAt: "", detailUrl: "" } satisfies BoxInfo;
          }
        })
      );
      const results: BoxInfo[] = settled.flatMap((result) =>
        result.status === "fulfilled" && result.value !== null ? [result.value] : []
      );
      setBoxes(results);
    } catch {
      setError("读取收藏列表失败");
    } finally {
      setLoading(false);
    }
  }, []);

  const mounted = useRef(false);
  useEffect(() => {
    if (mounted.current) return;
    mounted.current = true;
    void loadCollection();
  }, [loadCollection]);

  const removeBox = useCallback(function removeBox(code: string) {
    const raw = window.localStorage.getItem("quanzhi-saved-boxes");
    const saved: string[] = raw ? JSON.parse(raw) : [];
    const next = saved.filter((b) => b !== code);
    window.localStorage.setItem("quanzhi-saved-boxes", JSON.stringify(next));
    setBoxes((prev) => prev.filter((b) => b.boxCode !== code));
  }, []);

  function removeCoin(name: string) {
    const next = coins.filter((coin) => coin !== name);
    setCoins(next);
    window.localStorage.setItem("quanzhi-saved-coins", JSON.stringify(next));
  }

  function clearAll() {
    window.localStorage.removeItem("quanzhi-saved-boxes");
    window.localStorage.removeItem("quanzhi-saved-coins");
    setBoxes([]);
    setCoins([]);
  }

  function exportCsv() {
    const rows = [
      ["盒号", "币种", "评级公司", "评级分", "最新成交价", "平台", "成交时间"],
      ...boxes.map((b) => [
        b.boxCode,
        b.coinName,
        b.gradingCompany,
        b.grade,
        b.latestPrice?.toString() ?? "",
        b.platform,
        b.transactedAt,
      ]),
    ];
    const csv =
      "﻿" +
      rows.map((r) => r.map((v) => `"${String(v).replaceAll('"', '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "泉知-收藏列表.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <main>
      <TopBar activePage="collection" />

      <section style={{
        maxWidth: 960,
        margin: "0 auto",
        padding: "32px 20px",
      }}>
        {/* Header */}
        <div style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          flexWrap: "wrap",
          gap: 16,
          marginBottom: 24,
        }}>
          <div>
            <span style={{
              fontSize: 12,
              fontWeight: 700,
              color: "#155eef",
              textTransform: "uppercase",
              letterSpacing: 1,
            }}>
              我的收藏
            </span>
            <h1 style={{
              fontSize: 28,
              fontWeight: 800,
              margin: "6px 0 4px",
              color: "#101828",
              letterSpacing: "-1px",
            }}>
              {boxes.length + coins.length > 0 ? `已收藏 ${boxes.length + coins.length} 项` : "暂无收藏"}
            </h1>
            <p style={{ margin: 0, color: "#667085", fontSize: 13 }}>
              可收藏具体评级盒号或币种行情，随时回来查看
            </p>
          </div>
          {boxes.length + coins.length > 0 && (
            <div style={{ display: "flex", gap: 8 }}>
              <button
                onClick={exportCsv}
                style={{
                  padding: "8px 15px",
                  fontSize: 12,
                  fontWeight: 600,
                  border: "1px solid #d0d5dd",
                  borderRadius: 8,
                  background: "#fff",
                  color: "#344054",
                  cursor: "pointer",
                  fontFamily: "inherit",
                }}
              >
                导出 CSV
              </button>
              <button
                onClick={clearAll}
                style={{
                  padding: "8px 15px",
                  fontSize: 12,
                  fontWeight: 600,
                  border: "1px solid #fca5a5",
                  borderRadius: 8,
                  background: "#fff",
                  color: "#dc2626",
                  cursor: "pointer",
                  fontFamily: "inherit",
                }}
              >
                清空全部
              </button>
            </div>
          )}
        </div>

        {loading && (
          <div style={{
            textAlign: "center",
            padding: 56,
            background: "#f9fafb",
            borderRadius: 14,
            color: "#98a2b3",
            fontSize: 14,
          }}>
            正在查询收藏盒号的最新数据…
          </div>
        )}

        {error && (
          <div style={{
            textAlign: "center",
            padding: 40,
            background: "#fef2f2",
            borderRadius: 14,
            color: "#dc2626",
            fontSize: 14,
          }}>
            {error}
          </div>
        )}

        {!loading && boxes.length === 0 && coins.length === 0 && (
          <div style={{
            textAlign: "center",
            padding: 64,
            background: "#f9fafb",
            border: "1px solid #e4e7ec",
            borderRadius: 16,
          }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>📦</div>
            <h2 style={{ fontSize: 18, fontWeight: 700, margin: "0 0 8px", color: "#101828" }}>
              还没有收藏任何评级币
            </h2>
            <p style={{ color: "#667085", margin: "0 0 22px", fontSize: 13, lineHeight: 1.7 }}>
              在首页搜索盒号后收藏评级币，或在币种详情页点击「☆ 收藏币种」，
              <br />
              随时跟踪价格变化。
            </p>
            <Link
              href="/"
              style={{
                display: "inline-block",
                padding: "11px 26px",
                background: "#155eef",
                color: "#fff",
                borderRadius: 10,
                textDecoration: "none",
                fontSize: 14,
                fontWeight: 600,
                boxShadow: "0 3px 8px rgba(21,94,239,.22)",
              }}
            >
              去查行情 →
            </Link>
          </div>
        )}

        {!loading && coins.length > 0 && (
          <section style={{ marginBottom: 24 }}>
            <h2 style={{ margin: "0 0 10px", fontSize: 15, color: "#101828" }}>收藏的币种行情</h2>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 10 }}>
              {coins.map((coin) => (
                <div key={coin} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, padding: "14px 16px", border: "1px solid #e4e7ec", borderRadius: 12, background: "#fff" }}>
                  <Link href={`/coin?name=${encodeURIComponent(coin)}`} style={{ color: "#101828", fontSize: 13, fontWeight: 600, textDecoration: "none", lineHeight: 1.5 }}>
                    {coin} →
                  </Link>
                  <button type="button" onClick={() => removeCoin(coin)} title="取消收藏" style={{ border: 0, background: "transparent", color: "#98a2b3", cursor: "pointer", fontSize: 16 }}>×</button>
                </div>
              ))}
            </div>
          </section>
        )}

        {!loading &&
          boxes.map((box) => {
            const platformCfg = PLATFORM_CONFIG[box.platform] ?? { color: "#6b7280" };
            return (
              <div
                key={box.boxCode}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  flexWrap: "wrap",
                  gap: 12,
                  padding: "16px 20px",
                  marginBottom: 10,
                  background: "#fff",
                  border: "1px solid #e4e7ec",
                  borderRadius: 12,
                }}
              >
                {/* Left: box info */}
                <div style={{ flex: 1, minWidth: 200 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 6 }}>
                    <code style={{
                      fontSize: 13,
                      background: "#f3f4f6",
                      padding: "4px 9px",
                      borderRadius: 6,
                      fontWeight: 700,
                      color: "#374151",
                    }}>
                      {box.boxCode}
                    </code>
                    {box.gradingCompany && (
                      <span style={{
                        fontSize: 11,
                        fontWeight: 600,
                        background: box.gradingCompany === "PCGS" ? "#fef3c7" : "#dbeafe",
                        color: box.gradingCompany === "PCGS" ? "#92400e" : "#1e40af",
                        padding: "3px 7px",
                        borderRadius: 5,
                      }}>
                        {box.gradingCompany} {box.grade}
                      </span>
                    )}
                  </div>
                  <div style={{ fontSize: 14, fontWeight: 600, color: "#101828" }}>
                    {box.coinName}
                  </div>
                  {box.platform && (
                    <div style={{ fontSize: 11, color: "#98a2b3", marginTop: 3 }}>
                      <span style={{
                        display: "inline-block",
                        width: 6,
                        height: 6,
                        borderRadius: "50%",
                        background: platformCfg.color,
                        marginRight: 5,
                        verticalAlign: "middle",
                      }} />
                      {box.platform} · {box.transactedAt || "未知时间"}
                    </div>
                  )}
                </div>

                {/* Center: price */}
                <div style={{ textAlign: "right", minWidth: 100 }}>
                  {box.latestPrice !== null ? (
                    <>
                      <div style={{
                        fontSize: 20,
                        fontWeight: 800,
                        color: "#155eef",
                        fontFamily: "Georgia, serif",
                      }}>
                        ¥{box.latestPrice.toLocaleString()}
                      </div>
                      <div style={{ fontSize: 10, color: "#98a2b3" }}>最新成交价</div>
                    </>
                  ) : (
                    <div style={{ fontSize: 13, color: "#98a2b3" }}>暂无成交</div>
                  )}
                </div>

                {/* Right: actions */}
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  {box.coinName !== "未收录" && box.coinName !== "查询失败" && (
                    <Link
                      href={`/coin?name=${encodeURIComponent(box.coinName)}`}
                      style={{
                        padding: "7px 13px",
                        fontSize: 12,
                        fontWeight: 500,
                        border: "1px solid #d0d5dd",
                        borderRadius: 7,
                        textDecoration: "none",
                        color: "#344054",
                        background: "#fff",
                        whiteSpace: "nowrap",
                      }}
                    >
                      同款行情
                    </Link>
                  )}
                  {box.detailUrl && (
                    <a
                      href={box.detailUrl}
                      target="_blank"
                      rel="noreferrer"
                      style={{
                        padding: "7px 13px",
                        fontSize: 12,
                        fontWeight: 500,
                        border: "1px solid #d0d5dd",
                        borderRadius: 7,
                        textDecoration: "none",
                        color: "#344054",
                        background: "#fff",
                        whiteSpace: "nowrap",
                      }}
                    >
                      原始交易 ↗
                    </a>
                  )}
                  <button
                    onClick={() => removeBox(box.boxCode)}
                    style={{
                      padding: "7px 11px",
                      fontSize: 12,
                      border: "1px solid #fca5a5",
                      borderRadius: 7,
                      background: "#fff",
                      color: "#dc2626",
                      cursor: "pointer",
                      fontFamily: "inherit",
                    }}
                    title="取消收藏"
                  >
                    ✕
                  </button>
                </div>
              </div>
            );
          })}
      </section>

      <footer style={{
        maxWidth: 960,
        margin: "0 auto",
        padding: "24px 20px",
        borderTop: "1px solid #e4e7ec",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
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
