"use client";

import { ChangeEvent, FormEvent, useMemo, useRef, useState } from "react";
import Hero from "./components/Hero";
import Link from "next/link";
import TopBar from "./components/TopBar";
import BoxResult from "./components/BoxResult";
import KeywordResults from "./components/KeywordResults";
import PlatformRecordsPanel from "./components/PlatformRecords";
import DataPanel from "./components/DataPanel";
import ResultFilters from "./components/ResultFilters";
import type { SaleFilter } from "./components/ResultFilters";
import GradeComparisonTable from "./components/GradeComparisonTable";
import PlatformComparisonTable from "./components/PlatformComparisonTable";
import { platformSearchUrl } from "./lib/platform-urls";
import { normalizeCertificateQuery, scoreCoinSearch } from "./lib/search-ranking";
import type { BoxDatabaseRecord, CertInfo, OcrResult, PlatformImageCandidate, PlatformRecord, RealRecord } from "./lib/types";

/* ------------------------------------------------------------------ */
/*  normalization helpers                                              */
/* ------------------------------------------------------------------ */

function normalizeBoxCode(value: string) {
  return value.toUpperCase().replace(/[^A-Z0-9]/g, "");
}

function readStoredList(key: string) {
  if (typeof window === "undefined") return [];
  try {
    const value = JSON.parse(window.localStorage.getItem(key) ?? "[]");
    return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string").slice(0, 8) : [];
  } catch {
    return [];
  }
}

/* ------------------------------------------------------------------ */
/*  page component                                                     */
/* ------------------------------------------------------------------ */

export default function Home() {
  const [query, setQuery] = useState("");
  const [submitted, setSubmitted] = useState("");

  /* OCR state */
  const [imagePreview, setImagePreview] = useState("");
  const [ocrStatus, setOcrStatus] = useState("");
  const [ocrResult, setOcrResult] = useState<OcrResult | null>(null);

  /* real-data state */
  const [realRecords, setRealRecords] = useState<RealRecord[]>([]);
  const [realLoading, setRealLoading] = useState(false);
  const [realError, setRealError] = useState("");
  const [realFetchedAt, setRealFetchedAt] = useState("");

  /* box-number database state */
  const [boxDatabaseRecords, setBoxDatabaseRecords] = useState<BoxDatabaseRecord[]>([]);

  /* multi-platform records */
  const [platformRecords, setPlatformRecords] = useState<PlatformRecord[]>([]);
  const [platformRecordsLoading, setPlatformRecordsLoading] = useState(false);
  const [platformImageStatus, setPlatformImageStatus] = useState("");

  /* cert lookup for box queries */
  const [certInfo, setCertInfo] = useState<CertInfo | null>(null);
  const [sameModelRecords, setSameModelRecords] = useState<RealRecord[]>([]);
  const [certMethodology, setCertMethodology] = useState("");

  /* local-storage state */
  const [searchHistory, setSearchHistory] = useState<string[]>(() =>
    readStoredList("quanzhi-search-history")
  );
  const [savedBoxes, setSavedBoxes] = useState<string[]>(() =>
    readStoredList("quanzhi-saved-boxes")
  );

  /* filter state */
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [saleFilter, setSaleFilter] = useState<SaleFilter>("all");
  const [priceMin, setPriceMin] = useState("");
  const [priceMax, setPriceMax] = useState("");

  /* AbortController for canceling in-flight fetches on re-search */
  const searchAbort = useRef<AbortController | null>(null);

  /* ---- derived values ---- */

  const normalizedBoxQuery = normalizeBoxCode(submitted);
  const isBoxQuery = /^(NGC|PCGS)?\d{7,12}$/.test(normalizedBoxQuery);
  const submittedUpper = submitted.trim().toUpperCase();
  const boxAgency = submittedUpper.startsWith("PCGS")
    ? "PCGS"
    : submittedUpper.startsWith("NGC") || /\d{7}-\d{3}/.test(submittedUpper)
      ? "NGC"
      : "待确认";
  const boxCode = submittedUpper.replace(/^(NGC|PCGS)\s*/i, "").trim();
  const databaseNumericGrade = boxDatabaseRecords[0]?.grade.match(/\b\d{1,2}\b/)?.[0] ?? "";
  const officialCertUrl =
    boxAgency === "PCGS"
      ? `https://cn.pcgs.com/cert/${boxCode.replace(/\D/g, "")}`
      : boxAgency === "NGC"
        ? databaseNumericGrade
          ? `https://www.ngccoin.cn/certlookup/${boxCode}/${databaseNumericGrade}/`
          : "https://www.ngccoin.cn/certlookup/"
        : "";

  /* ---- filter helpers ---- */

  function isActiveStatus(status: string) {
    return status.includes("在售");
  }

  const filteredPlatformRecords = useMemo(() => {
    let recs = platformRecords;
    if (saleFilter === "sold") {
      recs = recs.filter((r) => !isActiveStatus(r.status));
    } else if (saleFilter === "active") {
      recs = recs.filter((r) => isActiveStatus(r.status));
    }
    if (dateFrom) {
      recs = recs.filter((r) => (r.time || "").slice(0, 10) >= dateFrom);
    }
    if (dateTo) {
      recs = recs.filter((r) => (r.time || "").slice(0, 10) <= dateTo);
    }
    if (priceMin) {
      const min = Number(priceMin);
      if (!Number.isNaN(min)) recs = recs.filter((r) => r.price >= min);
    }
    if (priceMax) {
      const max = Number(priceMax);
      if (!Number.isNaN(max)) recs = recs.filter((r) => r.price <= max);
    }
    return recs;
  }, [platformRecords, dateFrom, dateTo, saleFilter, priceMin, priceMax]);

  const filteredRealRecords = useMemo(() => {
    let recs = realRecords;
    if (saleFilter === "sold") {
      recs = recs.filter((r) => !isActiveStatus(r.status));
    } else if (saleFilter === "active") {
      recs = recs.filter((r) => isActiveStatus(r.status));
    }
    if (dateFrom) {
      recs = recs.filter((r) => (r.completedAt || "").slice(0, 10) >= dateFrom);
    }
    if (dateTo) {
      recs = recs.filter((r) => (r.completedAt || "").slice(0, 10) <= dateTo);
    }
    if (priceMin) {
      const min = Number(priceMin);
      if (!Number.isNaN(min)) recs = recs.filter((r) => r.price >= min);
    }
    if (priceMax) {
      const max = Number(priceMax);
      if (!Number.isNaN(max)) recs = recs.filter((r) => r.price <= max);
    }
    return recs;
  }, [realRecords, dateFrom, dateTo, saleFilter, priceMin, priceMax]);

  function clearFilters() {
    setDateFrom("");
    setDateTo("");
    setSaleFilter("all");
    setPriceMin("");
    setPriceMax("");
  }

  const filteredRealUnitGroups = useMemo(() => {
    const groups = new Map<string, RealRecord[]>();
    filteredRealRecords.forEach((record) => {
      const key = `${record.title}|||${record.unit}`;
      groups.set(key, [...(groups.get(key) ?? []), record]);
    });
    return Array.from(groups.entries()).map(([key, records]) => ({
      title: key.split("|||")[0],
      unit: key.split("|||")[1],
      count: records.length,
      low: Math.min(...records.map((r) => r.price)),
      high: Math.max(...records.map((r) => r.price)),
      latest: records[0]?.price ?? 0,
    }));
  }, [filteredRealRecords]);

  /* ---- localStorage helpers ---- */

  function rememberSearch(value: string) {
    setSearchHistory((current) => {
      const next = [value, ...current.filter((item) => item !== value)].slice(0, 6);
      window.localStorage.setItem("quanzhi-search-history", JSON.stringify(next));
      return next;
    });
  }

  function clearSearchHistory() {
    window.localStorage.removeItem("quanzhi-search-history");
    setSearchHistory([]);
  }

  function toggleSavedBox() {
    if (!boxCode) return;
    setSavedBoxes((current) => {
      const next = current.includes(boxCode)
        ? current.filter((item) => item !== boxCode)
        : [boxCode, ...current].slice(0, 20);
      window.localStorage.setItem("quanzhi-saved-boxes", JSON.stringify(next));
      return next;
    });
  }

  function exportRecords() {
    if (realRecords.length === 0) return;
    const quote = (value: string | number) =>
      `"${String(value).replaceAll('"', '""')}"`;
    const rows = [
      ["平台", "商品标题", "品相", "成交时间", "数量", "成交单价", "单位", "原始链接"],
      ...realRecords.map((r) => [
        r.source, r.title, r.condition, r.completedAt,
        r.quantity, r.price, r.unit, r.url,
      ]),
    ];
    const csv = `﻿${rows.map((row) => row.map(quote).join(",")).join("\r\n")}`;
    const href = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const anchor = document.createElement("a");
    anchor.href = href;
    anchor.download = `泉知-${boxCode || submitted}-成交记录.csv`;
    anchor.click();
    URL.revokeObjectURL(href);
  }

  /* ---- data fetching ---- */

  async function loadRealData(value: string) {
    // Cancel any in-flight fetches from a previous search
    searchAbort.current?.abort();
    const controller = new AbortController();
    searchAbort.current = controller;
    const signal = controller.signal;

    const boxLike = /^(NGC|PCGS)?\s*[0-9-]{7,16}$/i.test(value);
    const requestValue = boxLike
      ? value.replace(/^(NGC|PCGS)\s*/i, "").trim()
      : value;
    setRealLoading(true);
    setRealError("");
    setRealRecords([]);
    setBoxDatabaseRecords([]);
    setPlatformRecords([]);
    setPlatformRecordsLoading(false);
    setPlatformImageStatus("");
    setCertInfo(null);
    setSameModelRecords([]);
    setCertMethodology("");

    /* ── Phase 1: local database lookup (fast, <1s) ── */
    let databaseBoxRecords: BoxDatabaseRecord[] = [];
    let databaseData: { match?: "exact" | "prefix" | "keyword"; records?: BoxDatabaseRecord[] } = { match: "exact", records: [] };

    if (boxLike) {
      try {
        const normalizedRequest = normalizeCertificateQuery(requestValue).digits;
        const databaseResponse = await fetch(
          `/box-data/${normalizedRequest.slice(0, 2)}/${normalizedRequest}.json`,
          { signal: AbortSignal.any([signal, AbortSignal.timeout(3000)]) }
        );
        if (databaseResponse.ok)
          databaseData = (await databaseResponse.json()) as typeof databaseData;
      } catch { /* silent fallback */ }
    } else {
      // Keyword search: look up ALL matching coins in coin-data index
      try {
        const indexResponse = await fetch("/coin-data/index.json", { signal: AbortSignal.any([signal, AbortSignal.timeout(5000)]) });
        if (indexResponse.ok) {
          const index = await indexResponse.json() as { coins?: Array<{ coinName: string; slug: string; saleCount: number; latestPrice: number | null; keywords?: string }> };
          const matches = (index.coins ?? [])
            .map((c) => ({ ...c, _score: scoreCoinSearch(requestValue, c) }))
            .filter((c: Record<string, unknown>) => (c._score as number) > 0)
            .sort((a: Record<string, unknown>, b: Record<string, unknown>) => (b._score as number) - (a._score as number) || (b.saleCount as number) - (a.saleCount as number))
            .slice(0, 30);
          if (matches.length > 0) {
            setPlatformImageStatus(`数据库匹配到 ${matches.length} 个币种，正在加载详情…`);
            // Load ALL matching coins' data in parallel
            const allRecords: BoxDatabaseRecord[] = [];
            const coinResults = await Promise.allSettled(
              matches.map(async (m) => {
                try {
                  const resp = await fetch(
                    `/coin-data/${m.slug.slice(0, 2)}/${m.slug}.json`,
                    { signal: AbortSignal.any([signal, AbortSignal.timeout(5000)]) }
                  );
                  if (signal.aborted) return [];
                  if (resp.ok) {
                    const data = await resp.json() as { records?: BoxDatabaseRecord[] };
                    return (data.records ?? []).map((r) => ({
                      ...r,
                      verificationStatus: r.verificationStatus || "youbao_trade",
                    }));
                  }
                } catch { /* skip failed coin */ }
                return [];
              })
            );
            for (const result of coinResults) {
              if (result.status === "fulfilled") allRecords.push(...result.value);
            }
            if (allRecords.length > 0) {
              databaseData = { match: "keyword", records: allRecords };
              setPlatformImageStatus(`数据库已加载 ${matches.length} 个币种共 ${allRecords.length} 条记录`);
            }
          }
        }
      } catch { /* fall through to API */ }
    }

    databaseBoxRecords = databaseData.records ?? [];
    setBoxDatabaseRecords(databaseBoxRecords);

    const databasePlatformRecords: PlatformRecord[] = databaseBoxRecords
      .filter((r): r is BoxDatabaseRecord & { price: number } => r.price !== null)
      .map((r) => ({
        id: `database-${r.platform}-${r.productCode}`,
        source: r.platform,
        title: `${r.coinName} · ${r.gradingCompany} ${r.grade} · 产品编号 ${r.productCode}`,
        price: r.price!,
        priceLabel: r.priceWithFee === null ? "成交价" : `成交价（含佣¥${r.priceWithFee.toLocaleString()}）`,
        time: r.transactedAt,
        timeLabel: "成交时间",
        status: r.verificationStatus === "user_screenshot" ? "待复核"
          : r.saleStatus === "在售" ? "在售 · 原交易页状态已核对"
          : r.verificationStatus === "verified" ? "已成交 / 已结束 · 评级机构官网已核验"
          : "已成交 / 已结束 · 原交易页已核对 · 评级机构官网待复核",
        url: r.detailUrl,
        match: databaseData.match === "exact" ? "exact-box" : "keyword",
        coinName: r.coinName,
      }));

    setPlatformRecords(databasePlatformRecords);

    if (databaseBoxRecords.length > 0) {
      setPlatformImageStatus(`泉知数据库已收录 · ${databaseBoxRecords.length} 条记录`);
      setRealLoading(false);
    }

    /* ── Phase 2: API enrichment (fire-and-forget, updates UI as results arrive) ── */
    const enrichWithApis = async () => {
      // 2a. Search + platform records (parallel)
      try {
        const [searchResponse, platformResponse] = await Promise.all([
          fetch(`/api/search?q=${encodeURIComponent(requestValue)}`, { signal: AbortSignal.any([signal, AbortSignal.timeout(8000)]) }),
          fetch(`/api/platform-records?q=${encodeURIComponent(requestValue)}`, { signal: AbortSignal.any([signal, AbortSignal.timeout(8000)]) }),
        ]);

        if (signal.aborted) return;

        if (platformResponse.ok) {
          const pd = await platformResponse.json() as { ok: boolean; records?: PlatformRecord[] };
          if (pd.ok && pd.records?.length) {
            setPlatformRecords((prev) => {
              const urls = new Set(prev.map((p) => p.url));
              return [...prev, ...pd.records!.filter((r) => !urls.has(r.url))];
            });
          }
        }

        if (searchResponse.ok) {
          const sd = await searchResponse.json() as { ok: boolean; records?: RealRecord[]; sources?: { fetchedAt: string }[] };
          if (sd.ok && sd.records?.length) {
            setRealRecords(sd.records);
            setRealFetchedAt(sd.sources?.[0]?.fetchedAt ?? "");
          }
        }
      } catch { /* API unavailable — database results already shown */ }

      // 2b. Cert lookup for box queries
      if (boxLike && !signal.aborted) {
        try {
          const certResponse = await fetch(
            `/api/cert-lookup?code=${encodeURIComponent(value)}`,
            { signal: AbortSignal.any([signal, AbortSignal.timeout(8000)]) }
          );
          if (signal.aborted) return;
          if (certResponse.ok) {
            const certData = await certResponse.json() as {
              ok: boolean; cert?: CertInfo; searchKeywords?: string;
              sameModelRecords?: RealRecord[]; methodology?: string;
            };
            if (certData.ok && certData.cert?.ok) {
              setCertInfo(certData.cert);
              setCertMethodology(certData.methodology ?? "");
              const smRecords = certData.sameModelRecords ?? [];
              setSameModelRecords(smRecords);
              if (smRecords.length > 0) {
                const smPlatformRecords: PlatformRecord[] = smRecords.map((r) => ({
                  id: `cert-${r.id}`, source: "邮宝", title: r.title, price: r.price,
                  priceLabel: `成交价/${r.unit}`, time: r.completedAt, timeLabel: "成交时间",
                  status: "同款币成交", url: r.url, match: "keyword" as const,
                }));
                setPlatformRecords((prev) => [...prev.filter((p) => !smPlatformRecords.some((m) => m.url === p.url)), ...smPlatformRecords]);
              }
            }
          }
        } catch { /* non-blocking */ }
      }

      // 2c. Image OCR for box queries without database hits
      if (boxLike && databaseBoxRecords.length === 0 && !signal.aborted) {
        setPlatformImageStatus("正在读取易金在线、赵涌在线的公开候选图片…");
        try {
          const imgResponse = await fetch(
            `/api/platform-images?q=${encodeURIComponent(value)}`,
            { signal: AbortSignal.any([signal, AbortSignal.timeout(12000)]) }
          );
          if (signal.aborted) return;
          if (imgResponse.ok) {
            const imgData = await imgResponse.json() as { candidates?: PlatformImageCandidate[] };
            const matches = await scanPlatformImages(value, imgData.candidates ?? []);
            if (matches.length > 0) {
              setPlatformRecords((prev) => [...matches, ...prev.filter((r) => !matches.some((m) => m.url === r.url))]);
            }
          }
        } catch {
          setPlatformImageStatus("平台图片读取超时，本次已停止，不影响普通查询");
        }
      }

      // Final: mark loading complete if it wasn't already
      if (!signal.aborted) {
        setRealLoading(false);
        setPlatformRecordsLoading(false);
      }
    };

    // Fire API enrichment without blocking — database results are already visible
    enrichWithApis().catch(() => {
      setRealLoading(false);
      setPlatformRecordsLoading(false);
    });
  }

  async function scanPlatformImages(
    value: string,
    candidates: PlatformImageCandidate[]
  ) {
    const expected = value
      .replace(/^(NGC|PCGS)\s*/i, "")
      .replace(/\D/g, "");
    const scannable = candidates
      .filter((c) => c.price !== null && c.price > 0)
      .slice(0, 3);

    if (!expected || scannable.length === 0) {
      setPlatformImageStatus(
        "两站本次公开搜索没有返回可扫描的候选图片"
      );
      return [];
    }

    const timeout = <T,>(
      promise: Promise<T>,
      milliseconds: number
    ): Promise<T> =>
      Promise.race([
        promise,
        new Promise<T>((_, reject) =>
          window.setTimeout(() => reject(new Error("timeout")), milliseconds)
        ),
      ]);

    const { createWorker } = await import("tesseract.js");
    let worker;
    try {
      worker = await timeout(createWorker("eng"), 15000);
    } catch {
      setPlatformImageStatus(
        "图片识别服务加载超时，本次已停止，不影响普通查询"
      );
      return [];
    }

    const matches: PlatformRecord[] = [];
    try {
      for (let i = 0; i < scannable.length; i++) {
        const candidate = scannable[i];
        setPlatformImageStatus(
          `正在核对平台图片 ${i + 1}/${scannable.length}…`
        );
        try {
          const proxyUrl = `/api/platform-images?image=${encodeURIComponent(candidate.imageUrl)}`;
          const result = await timeout(worker.recognize(proxyUrl), 10000);
          const recognizedDigits = result.data.text.replace(/\D/g, "");
          if (
            !recognizedDigits.includes(expected) ||
            candidate.price === null ||
            candidate.price <= 0
          )
            continue;
          matches.push({
            id: `image-${candidate.id}`,
            source: candidate.source,
            title: candidate.title,
            price: candidate.price,
            priceLabel: candidate.priceLabel,
            time: candidate.time,
            timeLabel: candidate.timeLabel,
            status: "图片盒号已核对",
            url: candidate.url,
            match: "exact-box",
          });
        } catch {
          /* single-image failure is non-fatal */
        }
      }
    } finally {
      await worker.terminate();
    }

    setPlatformImageStatus(
      matches.length > 0
        ? `平台图片命中 ${matches.length} 个完整盒号`
        : `已核对 ${scannable.length} 张候选图片，未发现完整盒号一致的商品`
    );
    return matches;
  }

  /* ---- event handlers ---- */

  function search(event: FormEvent) {
    event.preventDefault();
    const clean = query.trim();
    if (!clean) return;
    setDateFrom("");
    setDateTo("");
    setSaleFilter("all");
    setSubmitted(clean);
    rememberSearch(clean);
    void loadRealData(clean);
  }

  function runExample(value: string) {
    setDateFrom("");
    setDateTo("");
    setSaleFilter("all");
    setQuery(value);
    setSubmitted(value);
    rememberSearch(value);
    void loadRealData(value);
  }

  async function recognizeImage(file: File) {
    if (!file.type.startsWith("image/")) {
      setOcrStatus("请选择 JPG、PNG 等图片文件");
      return;
    }
    if (file.size > 12 * 1024 * 1024) {
      setOcrStatus("图片超过 12MB，请压缩后重新上传");
      return;
    }
    setImagePreview((current) => {
      if (current.startsWith("blob:")) URL.revokeObjectURL(current);
      return URL.createObjectURL(file);
    });
    setOcrResult(null);
    setOcrStatus("正在准备识别…");
    try {
      const { recognize } = await import("tesseract.js");
      const output = await recognize(file, "eng", {
        logger: (message) => {
          if (message.status === "recognizing text")
            setOcrStatus(
              `正在识别文字 ${Math.round((message.progress ?? 0) * 100)}%`
            );
        },
      });
      const raw = output.data.text
        .replace(/[—–﹣]/g, "-")
        .replace(/\s+/g, " ")
        .trim();
      const ngcMatch = raw.match(/\b\d{7}\s*[- ]\s*\d{3}\b/);
      const pcgsMatch = raw.match(/\b\d{8}\b/);
      const code = ngcMatch
        ? ngcMatch[0].replace(/\s/g, "").replace(/^(\d{7})(\d{3})$/, "$1-$2")
        : pcgsMatch?.[0] ?? "";
      const grade =
        raw.match(
          /\b(?:PF|MS|AU|XF|VF)\s*\d{2}(?:\s+ULTRA\s+CAMEO)?\b/i
        )?.[0] ?? "待人工确认";
      const yearAndCoin =
        raw.match(/\b20\d{2}\s+China[^\n]{0,60}/i)?.[0] ?? "待人工确认";
      const company = /\bNGC\b/i.test(raw) || ngcMatch
        ? "NGC"
        : /\bPCGS\b/i.test(raw)
          ? "PCGS"
          : "待人工确认";
      setOcrResult({
        code,
        company,
        grade,
        coin: yearAndCoin,
        raw,
        confidence: Math.round(output.data.confidence),
      });
      setOcrStatus(
        code
          ? "识别完成，请核对结果"
          : "未稳定识别出盒号，请换一张更清晰的正面照片"
      );
    } catch {
      setOcrStatus("识别没有完成，请稍后重试或手动输入盒号");
    }
  }

  function chooseImage(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (file) void recognizeImage(file);
  }

  async function useSampleImage() {
    setImagePreview("/demo/ngc-slab-example.jpg");
    setOcrStatus("示例图识别完成，请核对结果");
    setOcrResult({
      code: "8616098-030",
      company: "NGC",
      grade: "PF 70 ULTRA CAMEO",
      coin: "2026 China 30g S10Y Fortune · First Day of Issue",
      raw: "Auspicious Culture 2026 China 30g S10Y Fortune First Day of Issue PF 70 ULTRA CAMEO 8616098-030 NGC",
      confidence: 98,
    });
  }

  function searchRecognizedCode() {
    if (!ocrResult?.code) return;
    setDateFrom("");
    setDateTo("");
    setSaleFilter("all");
    const value = `${
      ocrResult.company === "待人工确认" ? "" : ocrResult.company
    } ${ocrResult.code}`.trim();
    setQuery(value);
    setSubmitted(value);
    rememberSearch(value);
    void loadRealData(value);
    document.getElementById("search")?.scrollIntoView({ behavior: "smooth" });
  }

  /* ---- render ---- */

  return (
    <main>
      <TopBar activePage="search" />

      <Hero
        query={query}
        onQueryChange={setQuery}
        onSearch={search}
        onRunExample={runExample}
        searchHistory={searchHistory}
        onClearHistory={clearSearchHistory}
        imagePreview={imagePreview}
        ocrStatus={ocrStatus}
        ocrResult={ocrResult}
        onChooseImage={chooseImage}
        onUseSampleImage={useSampleImage}
        onOcrCompanyChange={(company) =>
          setOcrResult((prev) => (prev ? { ...prev, company } : prev))
        }
        onOcrCodeChange={(code) =>
          setOcrResult((prev) =>
            prev
              ? { ...prev, code: code.toUpperCase().replace(/[^A-Z0-9-]/g, "") }
              : prev
          )
        }
        onSearchRecognized={searchRecognizedCode}
      />

      {!submitted && (
        <>
          <DataPanel />
          <section className="home-features">
            <Link href="/coin" className="home-feature-card">
              <div className="hf-icon hf-icon-coin" />
              <h3>币种详情</h3>
              <p>搜币名，看价格走势与评级对比</p>
            </Link>
            <button className="home-feature-card" type="button" onClick={() => { document.getElementById("search")?.querySelector("input")?.focus(); }}>
              <div className="hf-icon hf-icon-search" />
              <h3>盒号追踪</h3>
              <p>输 NGC/PCGS 盒号，查当前已收录的交易历史</p>
            </button>
            <button className="home-feature-card" type="button" onClick={() => { document.querySelector<HTMLDetailsElement>(".image-search")?.setAttribute("open", ""); document.querySelector<HTMLElement>(".image-search")?.scrollIntoView({ behavior: "smooth", block: "center" }); }}>
              <div className="hf-icon hf-icon-ocr" />
              <h3>拍照识号</h3>
              <p>上传评级盒标签，自动识别盒号</p>
            </button>
          </section>
          <section className="trust-section" aria-labelledby="trust-title">
            <div className="trust-copy">
              <span className="section-kicker">数据可信机制</span>
              <h2 id="trust-title">不只告诉你价格，也告诉你价格从哪里来</h2>
              <p>泉知以评级盒号为索引，保留成交时间、平台和原始证据。没有通过核验的记录不会进入公开成交统计。</p>
            </div>
            <ol className="trust-steps">
              <li><b>01</b><span><strong>聚合公开记录</strong>统一不同平台的币名、评级和成交字段</span></li>
              <li><b>02</b><span><strong>核对盒号与证据</strong>检查完整盒号、成交时间和原始页面</span></li>
              <li><b>03</b><span><strong>再用于行情比较</strong>在结果中展示样本，而不是给出无依据估值</span></li>
            </ol>
          </section>
        </>
      )}

      {submitted && (
        <section className="workspace" id="market" aria-live="polite">
          {(platformRecords.length > 0 || realRecords.length > 0) && (
            <>
              <ResultFilters
                dateFrom={dateFrom}
                dateTo={dateTo}
                saleFilter={saleFilter}
                priceMin={priceMin}
                priceMax={priceMax}
                resultCount={platformRecords.length + realRecords.length}
                filteredCount={filteredPlatformRecords.length + filteredRealRecords.length}
                onDateFromChange={(v) => { setDateFrom(v); }}
                onDateToChange={(v) => { setDateTo(v); }}
                onSaleFilterChange={(v) => { setSaleFilter(v); }}
                onPriceMinChange={(v) => { setPriceMin(v); }}
                onPriceMaxChange={(v) => { setPriceMax(v); }}
                onClear={clearFilters}
              />
              <GradeComparisonTable
                platformRecords={filteredPlatformRecords}
                realRecords={filteredRealRecords}
                isBoxQuery={isBoxQuery}
              />
              <PlatformComparisonTable
                platformRecords={filteredPlatformRecords}
                realRecords={filteredRealRecords}
                submitted={submitted}
              />
            </>
          )}
          {isBoxQuery ? (
            <BoxResult
              boxAgency={boxAgency}
              boxCode={boxCode}
              databaseNumericGrade={databaseNumericGrade}
              officialCertUrl={officialCertUrl}
              boxDatabaseRecords={boxDatabaseRecords}
              realRecords={filteredRealRecords}
              realFetchedAt={realFetchedAt}
              realLoading={realLoading}
              realError={realError}
              savedBoxes={savedBoxes}
              submitted={submitted}
              certInfo={certInfo}
              sameModelRecords={sameModelRecords}
              certMethodology={certMethodology}
              onToggleSaved={toggleSavedBox}
              onExport={exportRecords}
              onRetry={() => void loadRealData(submitted)}
              platformSearchUrl={platformSearchUrl}
            />
          ) : (
            <KeywordResults
              submitted={submitted}
              realRecords={filteredRealRecords}
              realUnitGroups={filteredRealUnitGroups}
              realFetchedAt={realFetchedAt}
              realLoading={realLoading}
              realError={realError}
              onExport={exportRecords}
              onRetry={() => void loadRealData(submitted)}
              platformSearchUrl={platformSearchUrl}
            />
          )}

          <PlatformRecordsPanel
            submitted={submitted}
            platformRecords={filteredPlatformRecords}
            platformRecordsLoading={platformRecordsLoading}
            platformImageStatus={platformImageStatus}
          />
        </section>
      )}

      <footer>
        <Link className="brand muted" href="/">
          <span className="brand-seal">泉</span>
          <span>泉知</span>
        </Link>
        <p>辅助查询，不构成投资建议 · 数据以原始交易页为准</p>
      </footer>
    </main>
  );
}
