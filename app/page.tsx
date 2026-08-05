"use client";

import { ChangeEvent, FormEvent, useMemo, useState } from "react";

type Coin = {
  id: string;
  name: string;
  subtitle: string;
  aliases: string[];
  category: string;
  year: string;
  metal: string;
  weight: string;
  latest: number;
  low: number;
  high: number;
  records: number;
  tone: "gold" | "silver" | "bronze";
};

const coins: Coin[] = [
  {
    id: "panda-2020-30g",
    name: "2020年熊猫银币 30克",
    subtitle: "中华人民共和国 · 普制银质纪念币",
    aliases: ["熊猫", "熊猫银币", "熊猫币", "猫币", "2020", "30克", "30g", "panda", "china panda"],
    category: "现代金银币",
    year: "2020",
    metal: "银",
    weight: "30克",
    latest: 218,
    low: 198,
    high: 236,
    records: 28,
    tone: "silver",
  },
  {
    id: "panda-2024-30g",
    name: "2024年熊猫银币 30克",
    subtitle: "中华人民共和国 · 普制银质纪念币",
    aliases: ["熊猫", "熊猫银币", "熊猫币", "猫币", "2024", "30克", "30g", "panda", "china panda"],
    category: "现代金银币",
    year: "2024",
    metal: "银",
    weight: "30克",
    latest: 246,
    low: 228,
    high: 268,
    records: 41,
    tone: "silver",
  },
  {
    id: "yuandatou-1914",
    name: "民国三年袁世凯像壹圆",
    subtitle: "俗称“袁大头” · 常见银元品种",
    aliases: ["袁大头", "袁大頭", "大头", "大頭", "三年", "民国三年", "民國三年", "袁世凯", "袁世凱", "壹圆", "壹圓", "银元", "銀元"],
    category: "银元",
    year: "1914",
    metal: "银",
    weight: "约26.8克",
    latest: 1120,
    low: 860,
    high: 1480,
    records: 67,
    tone: "silver",
  },
  {
    id: "morgan-1921",
    name: "1921年美国摩根银元",
    subtitle: "Morgan Dollar · 美国费城版",
    aliases: ["摩根", "摩根银元", "摩根銀元", "morgan", "morgan dollar", "美国", "美國", "美洋", "1921", "外国币", "外國幣"],
    category: "外国币",
    year: "1921",
    metal: "银",
    weight: "26.73克",
    latest: 438,
    low: 380,
    high: 520,
    records: 19,
    tone: "silver",
  },
];

const sales = [
  { platform: "赵涌在线", price: 218, date: "2026-07-30", daysAgo: 3, grade: "裸币", gradeType: "raw", title: "2020年30克熊猫银币", match: "confirmed", priceNote: "落槌价，佣金口径未知" },
  { platform: "易金在线", price: 226, date: "2026-07-27", daysAgo: 6, grade: "NGC MS69", gradeType: "graded", title: "2020熊猫银币30g评级币", match: "confirmed", priceNote: "成交价，是否含手续费未知" },
  { platform: "金币云集", price: 205, date: "2026-07-21", daysAgo: 12, grade: "原封", gradeType: "original", title: "2020版熊猫银质纪念币", match: "confirmed", priceNote: "商品成交价，不含运费" },
  { platform: "爱藏", price: 236, date: "2026-07-18", daysAgo: 15, grade: "NGC MS70", gradeType: "graded", title: "2020年熊猫银币满分评级", match: "confirmed", priceNote: "拍卖成交价，佣金口径未知" },
  { platform: "麦稀奇", price: 198, date: "2026-06-11", daysAgo: 52, grade: "品相未标", gradeType: "unknown", title: "熊猫银币30克纪念币一枚", match: "possible", priceNote: "年份未确认，不计入行情" },
];

const listings = [
  { platform: "麦稀奇", price: 228, note: "一口价", time: "在售", title: "2020熊猫银币30克" },
  { platform: "易金在线", price: 199, note: "当前价", time: "剩余 1天 6小时", title: "熊猫银币2020年" },
  { platform: "赵涌在线", price: 210, note: "当前价", time: "剩余 2天 4小时", title: "2020版30g熊猫币" },
];

const platformUrls: Record<string, string> = {
  "易金在线": "https://www.yjzx.com/",
  "赵涌在线": "https://www.zhaoonline.com/",
  "金币云集": "https://www.chngc.net/common/homep",
  "爱藏": "https://m.airmb.com/",
  "麦稀奇": "https://blog.mxiqi.com/",
  "邮宝": "https://www.youbao360.com/TradePost?type=2",
  "闲鱼": "https://www.goofish.com/",
  "邮币卡一尘": "https://apps.apple.com/cn/app/id1538149062",
};

const platforms = [
  { name: "邮宝", kind: "data", status: "可查成交", scope: "买卖盘 · 价格 · 时间 · 编号搜索", href: platformUrls["邮宝"], action: "打开公开买卖盘" },
  { name: "赵涌在线", kind: "limited", status: "前往平台", scope: "在拍 · 近期成交 · 钱币分类", href: platformUrls["赵涌在线"], action: "前往赵涌在线" },
  { name: "易金在线", kind: "limited", status: "需要登录", scope: "金银币 · 机制币 · 古币 · 外国币", href: platformUrls["易金在线"], action: "前往易金在线" },
  { name: "金币云集", kind: "limited", status: "官方平台", scope: "中国金币官方二级流转平台", href: "https://www.ecgci.com/", action: "打开官方平台" },
  { name: "爱藏", kind: "link", status: "前往平台", scope: "拍卖 · 一口价 · 评级 · 交易帖", href: platformUrls["爱藏"], action: "查看爱藏入口" },
  { name: "闲鱼", kind: "link", status: "前往平台", scope: "二手在售 · 个人卖家", href: platformUrls["闲鱼"], action: "前往闲鱼搜索" },
  { name: "邮币卡一尘", kind: "link", status: "打开APP", scope: "邮币卡社区 · 交易信息", href: platformUrls["邮币卡一尘"], action: "查看APP入口" },
  { name: "麦稀奇", kind: "link", status: "前往平台", scope: "外国币 · 世界币 · 在线拍卖", href: "https://www.mxiqi.com/", action: "前往麦稀奇" },
  { name: "币查查", kind: "mini", status: "微信小程序", scope: "历史成交 · 盒号查询", href: "", action: "微信搜索“币查查”" },
  { name: "币盘盘", kind: "mini", status: "微信小程序", scope: "历史成交 · 直播成交", href: "", action: "微信搜索“币盘盘”" },
];

function platformSearchUrl(platform: string, term: string) {
  const encoded = encodeURIComponent(term || "钱币");
  if (platform === "邮宝") return `https://www.youbao360.com/TradePostMore?name=${encoded}&type=3`;
  if (platform === "赵涌在线") return term.includes("熊猫") ? "https://zhaoonline.com/trade/xiongmaoxilie/" : "https://zhaoonline.com/trade/qianbi/";
  if (platform === "易金在线") return term.includes("熊猫") ? "https://www.yjzx.com/web2020/sell/list.html?classify_id=34" : "https://www.yjzx.com/web2020/material/list.html";
  if (platform === "闲鱼") return `https://www.goofish.com/search?q=${encoded}`;
  if (platform === "麦稀奇") return "https://www.mxiqi.com/?c=1";
  return platformUrls[platform] ?? "";
}

type OcrResult = {
  code: string;
  company: string;
  grade: string;
  coin: string;
  raw: string;
  confidence: number;
};

type RealRecord = {
  id: string;
  source: string;
  title: string;
  condition: string;
  price: number;
  unit: string;
  quantity: string;
  completedAt: string;
  status: string;
  url: string;
  fetchedAt: string;
};

type PlatformRecord = {
  id: string;
  source: string;
  title: string;
  price: number;
  priceLabel: string;
  time: string;
  timeLabel: string;
  status: string;
  url: string;
  match: "exact-box" | "keyword";
};

type PlatformImageCandidate = {
  id: string;
  source: "易金在线" | "赵涌在线";
  title: string;
  url: string;
  imageUrl: string;
  price: number | null;
  priceLabel: string;
  time: string;
  timeLabel: string;
};

type BoxDatabaseRecord = {
  normalizedBoxCode: string;
  displayBoxCode: string;
  gradingCompany: string;
  grade: string;
  coinName: string;
  platform: string;
  detailUrl: string;
  price: number | null;
  priceWithFee: number | null;
  transactedAt: string;
  productCode: string;
  verificationStatus: "user_screenshot" | "page_text_exact" | "image_exact" | "verified" | "official_pending";
  evidenceNote: string;
};

function readStoredList(key: string) {
  if (typeof window === "undefined") return [];
  try {
    const value = JSON.parse(window.localStorage.getItem(key) ?? "[]");
    return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string").slice(0, 8) : [];
  } catch {
    return [];
  }
}

const synonymMap: Record<string, string> = {
  "g": "克",
  "大頭": "袁大头",
  "大头": "袁大头",
  "袁大頭": "袁大头",
  "銀元": "银元",
  "摩根銀元": "摩根银元",
  "貓幣": "熊猫币",
  "猫币": "熊猫币",
};

function normalizeText(value: string) {
  return value
    .toLowerCase()
    .replace(/[，,。.!！?？、_/\\]+/g, " ")
    .replace(/(\d+)\s*g\b/g, "$1克")
    .replace(/\s+/g, " ")
    .trim();
}

function queryTerms(value: string) {
  return normalizeText(value)
    .split(" ")
    .filter(Boolean)
    .map((term) => synonymMap[term] ?? term);
}

function normalizeBoxCode(value: string) {
  return value.toUpperCase().replace(/[^A-Z0-9]/g, "");
}

function CoinMark({ tone, small = false }: { tone: Coin["tone"]; small?: boolean }) {
  return <span className={`coin-mark ${tone} ${small ? "small" : ""}`} aria-hidden="true"><i>¥</i></span>;
}

export default function Home() {
  const [query, setQuery] = useState("");
  const [submitted, setSubmitted] = useState("");
  const [selectedId, setSelectedId] = useState("panda-2020-30g");
  const [tab, setTab] = useState<"sales" | "market">("sales");
  const [imagePreview, setImagePreview] = useState("");
  const [ocrStatus, setOcrStatus] = useState("");
  const [ocrResult, setOcrResult] = useState<OcrResult | null>(null);
  const [platformFilter, setPlatformFilter] = useState("all");
  const [periodFilter, setPeriodFilter] = useState("all");
  const [gradeFilter, setGradeFilter] = useState("all");
  const [priceFilter, setPriceFilter] = useState("all");
  const [realRecords, setRealRecords] = useState<RealRecord[]>([]);
  const [realLoading, setRealLoading] = useState(false);
  const [realError, setRealError] = useState("");
  const [realSearched, setRealSearched] = useState(false);
  const [realFetchedAt, setRealFetchedAt] = useState("");
  const [boxDatabaseRecords, setBoxDatabaseRecords] = useState<BoxDatabaseRecord[]>([]);
  const [platformRecords, setPlatformRecords] = useState<PlatformRecord[]>([]);
  const [platformRecordsLoading, setPlatformRecordsLoading] = useState(false);
  const [platformImageStatus, setPlatformImageStatus] = useState("");
  const [searchHistory, setSearchHistory] = useState<string[]>(() => readStoredList("quanzhi-search-history"));
  const [savedBoxes, setSavedBoxes] = useState<string[]>(() => readStoredList("quanzhi-saved-boxes"));

  const normalizedBoxQuery = normalizeBoxCode(submitted);
  const isBoxQuery = /^(NGC|PCGS)?\d{7,12}$/.test(normalizedBoxQuery);
  const submittedUpper = submitted.trim().toUpperCase();
  const boxAgency = submittedUpper.startsWith("PCGS") ? "PCGS" : submittedUpper.startsWith("NGC") || /\d{7}-\d{3}/.test(submittedUpper) ? "NGC" : "待确认";
  const boxCode = submittedUpper.replace(/^(NGC|PCGS)\s*/i, "").trim();
  const databaseNumericGrade = boxDatabaseRecords[0]?.grade.match(/\b\d{1,2}\b/)?.[0] ?? "";
  const officialCertUrl = boxAgency === "PCGS"
    ? `https://cn.pcgs.com/cert/${boxCode.replace(/\D/g, "")}`
    : boxAgency === "NGC"
      ? databaseNumericGrade
        ? `https://www.ngccoin.cn/certlookup/${boxCode}/${databaseNumericGrade}/`
        : "https://www.ngccoin.cn/certlookup/"
      : "";
  const results = useMemo(() => {
    if (!submitted || isBoxQuery) return coins;
    const terms = queryTerms(submitted);
    return coins
      .map((coin) => {
        const normalizedName = normalizeText(coin.name);
        const aliases = coin.aliases.map(normalizeText);
        const haystack = normalizeText([coin.name, coin.subtitle, coin.category, coin.year, coin.metal, coin.weight, ...coin.aliases].join(" "));
        let score = 0;
        terms.forEach((term) => {
          if (normalizedName === term) score += 8;
          else if (normalizedName.includes(term)) score += 4;
          else if (aliases.includes(term)) score += 3;
          else if (haystack.includes(term)) score += 1;
        });
        if (terms.every((term) => haystack.includes(term))) score += 3;
        return { coin, score };
      })
      .filter((item) => item.score > 0)
      .sort((a, b) => b.score - a.score)
      .map((item) => item.coin);
  }, [submitted, isBoxQuery]);

  const selected = coins.find((coin) => coin.id === selectedId) ?? results[0] ?? coins[0];
  const filteredSales = useMemo(() => sales.filter((row) => {
    if (platformFilter !== "all" && row.platform !== platformFilter) return false;
    if (periodFilter === "30" && row.daysAgo > 30) return false;
    if (periodFilter === "7" && row.daysAgo > 7) return false;
    if (gradeFilter !== "all" && row.gradeType !== gradeFilter) return false;
    if (priceFilter === "under220" && row.price >= 220) return false;
    if (priceFilter === "over220" && row.price < 220) return false;
    return true;
  }), [platformFilter, periodFilter, gradeFilter, priceFilter]);
  const confirmedSales = sales.filter((row) => row.match === "confirmed");
  const confirmedPrices = confirmedSales.map((row) => row.price);
  const confirmedLow = Math.min(...confirmedPrices);
  const confirmedHigh = Math.max(...confirmedPrices);
  const activeSearchTerm = submitted || query || "";
  const realUnitGroups = useMemo(() => {
    const groups = new Map<string, RealRecord[]>();
    realRecords.forEach((record) => {
      const key = `${record.title}|||${record.unit}`;
      groups.set(key, [...(groups.get(key) ?? []), record]);
    });
    return Array.from(groups.entries()).map(([key, records]) => ({
      title: key.split("|||")[0],
      unit: key.split("|||")[1],
      count: records.length,
      low: Math.min(...records.map((record) => record.price)),
      high: Math.max(...records.map((record) => record.price)),
      latest: records[0]?.price ?? 0,
    }));
  }, [realRecords]);

  function resetFilters() {
    setPlatformFilter("all");
    setPeriodFilter("all");
    setGradeFilter("all");
    setPriceFilter("all");
  }

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
      const next = current.includes(boxCode) ? current.filter((item) => item !== boxCode) : [boxCode, ...current].slice(0, 20);
      window.localStorage.setItem("quanzhi-saved-boxes", JSON.stringify(next));
      return next;
    });
  }

  function exportRecords() {
    if (realRecords.length === 0) return;
    const quote = (value: string | number) => `"${String(value).replaceAll('"', '""')}"`;
    const rows = [
      ["平台", "商品标题", "品相", "成交时间", "数量", "成交单价", "单位", "原始链接"],
      ...realRecords.map((record) => [record.source, record.title, record.condition, record.completedAt, record.quantity, record.price, record.unit, record.url]),
    ];
    const csv = `\uFEFF${rows.map((row) => row.map(quote).join(",")).join("\r\n")}`;
    const href = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const anchor = document.createElement("a");
    anchor.href = href;
    anchor.download = `泉知-${boxCode || submitted}-成交记录.csv`;
    anchor.click();
    URL.revokeObjectURL(href);
  }

  async function loadRealData(value: string) {
    const boxLike = /^(NGC|PCGS)?\s*[0-9-]{7,16}$/i.test(value);
    const requestValue = boxLike ? value.replace(/^(NGC|PCGS)\s*/i, "").trim() : value;
    setRealLoading(true);
    setRealSearched(true);
    setRealError("");
    setRealRecords([]);
    setBoxDatabaseRecords([]);
    setPlatformRecords([]);
    setPlatformRecordsLoading(true);
    setPlatformImageStatus("");
    try {
      const searchRequest = fetch(`/api/search?q=${encodeURIComponent(requestValue)}`, { signal: AbortSignal.timeout(12000) });
      const platformRequest = fetch(`/api/platform-records?q=${encodeURIComponent(requestValue)}`, { signal: AbortSignal.timeout(12000) });
      let databaseData: { match?: "exact" | "prefix"; records?: BoxDatabaseRecord[] } = { match: "exact", records: [] };
      if (boxLike) {
        try {
          const normalizedRequest = requestValue.replace(/\D/g, "");
          const databaseResponse = await fetch(`/box-data/${normalizedRequest.slice(0, 2)}/${normalizedRequest}.json`, { signal: AbortSignal.timeout(3000) });
          if (databaseResponse.ok) databaseData = await databaseResponse.json() as typeof databaseData;
        } catch {
          // The fast local database lookup must not block the remaining public-platform search.
        }
      }
      const databaseBoxRecords = databaseData.records ?? [];
      setBoxDatabaseRecords(databaseBoxRecords);
      const databasePlatformRecords: PlatformRecord[] = databaseBoxRecords
        .filter((record): record is BoxDatabaseRecord & { price: number } => record.price !== null)
        .map((record) => ({ id: `database-${record.platform}-${record.productCode}`, source: record.platform, title: `${record.coinName} · ${record.gradingCompany} ${record.grade} · 产品编号 ${record.productCode}`, price: record.price, priceLabel: record.priceWithFee === null ? "成交价" : `成交价（含佣¥${record.priceWithFee.toLocaleString()}）`, time: record.transactedAt, timeLabel: "成交时间", status: record.verificationStatus === "user_screenshot" ? "截图证据·原链接待复核" : record.verificationStatus === "official_pending" ? "平台详情已核验" : "已核验", url: record.detailUrl, match: databaseData.match === "exact" ? "exact-box" : "keyword" }));
      setPlatformRecords(databasePlatformRecords);
      if (databaseBoxRecords.length > 0) setPlatformImageStatus("泉知数据库已命中，其他平台正在后台补充");

      const [response, platformResponse] = await Promise.all([searchRequest, platformRequest]);
      const data = await response.json() as { ok: boolean; error?: string; records?: RealRecord[]; sources?: { fetchedAt: string }[] };
      const platformData = await platformResponse.json() as { ok: boolean; records?: PlatformRecord[] };
      const textRecords = [...databasePlatformRecords, ...(platformResponse.ok && platformData.ok ? platformData.records ?? [] : [])];
      setPlatformRecords(textRecords);
      if (!response.ok || !data.ok) throw new Error(data.error || "查询失败");
      setRealRecords(data.records ?? []);
      setRealFetchedAt(data.sources?.[0]?.fetchedAt ?? "");
      setRealLoading(false);
      setPlatformRecordsLoading(false);
      if (boxLike && databaseBoxRecords.length === 0) {
        setPlatformImageStatus("正在读取易金在线、赵涌在线的公开候选图片…");
        void fetch(`/api/platform-images?q=${encodeURIComponent(value)}`, { signal: AbortSignal.timeout(12000) })
          .then(async (imageResponse) => imageResponse.ok ? await imageResponse.json() as { candidates?: PlatformImageCandidate[] } : { candidates: [] })
          .then(async (imageData) => await scanPlatformImages(value, imageData.candidates ?? []))
          .then((imageMatches) => {
            if (imageMatches.length > 0) setPlatformRecords((current) => [...imageMatches, ...current.filter((record) => !imageMatches.some((match) => match.url === record.url))]);
          })
          .catch(() => setPlatformImageStatus("平台图片读取超时，本次已停止，不影响普通查询"));
      }
    } catch (error) {
      setRealError(error instanceof DOMException && error.name === "TimeoutError" ? "平台响应超过12秒，本次查询已停止，请稍后重试" : error instanceof Error ? error.message : "暂时无法查询，请稍后重试");
    } finally {
      setRealLoading(false);
      setPlatformRecordsLoading(false);
    }
  }

  async function scanPlatformImages(value: string, candidates: PlatformImageCandidate[]) {
    const expected = value.replace(/^(NGC|PCGS)\s*/i, "").replace(/\D/g, "");
    const scannable = candidates.filter((candidate) => candidate.price !== null && candidate.price > 0).slice(0, 3);
    if (!expected || scannable.length === 0) {
      setPlatformImageStatus("两站本次公开搜索没有返回可扫描的候选图片");
      return [];
    }
    const timeout = <T,>(promise: Promise<T>, milliseconds: number) => Promise.race<T>([
      promise,
      new Promise<T>((_, reject) => window.setTimeout(() => reject(new Error("timeout")), milliseconds)),
    ]);
    const { createWorker } = await import("tesseract.js");
    let worker;
    try {
      worker = await timeout(createWorker("eng"), 15000);
    } catch {
      setPlatformImageStatus("图片识别服务加载超时，本次已停止，不影响普通查询");
      return [];
    }
    const matches: PlatformRecord[] = [];
    try {
      for (let index = 0; index < scannable.length; index += 1) {
        const candidate = scannable[index];
        setPlatformImageStatus(`正在核对平台图片 ${index + 1}/${scannable.length}…`);
        try {
          const proxyUrl = `/api/platform-images?image=${encodeURIComponent(candidate.imageUrl)}`;
          const result = await timeout(worker.recognize(proxyUrl), 10000);
          const recognizedDigits = result.data.text.replace(/\D/g, "");
          if (!recognizedDigits.includes(expected) || candidate.price === null || candidate.price <= 0) continue;
          matches.push({ id: `image-${candidate.id}`, source: candidate.source, title: candidate.title, price: candidate.price, priceLabel: candidate.priceLabel, time: candidate.time, timeLabel: candidate.timeLabel, status: "图片盒号已核对", url: candidate.url, match: "exact-box" });
        } catch {
          // A single unreadable image must not turn into a false match or stop the remaining checks.
        }
      }
    } finally {
      await worker.terminate();
    }
    setPlatformImageStatus(matches.length > 0 ? `平台图片命中 ${matches.length} 个完整盒号` : `已核对 ${scannable.length} 张候选图片，未发现完整盒号一致的商品`);
    return matches;
  }

  function search(event: FormEvent) {
    event.preventDefault();
    const clean = query.trim();
    if (!clean) return;
    setSubmitted(clean);
    rememberSearch(clean);
    setTab("sales");
    void loadRealData(clean);
  }

  function runExample(value: string) {
    setQuery(value);
    setSubmitted(value);
    rememberSearch(value);
    setTab("sales");
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
          if (message.status === "recognizing text") setOcrStatus(`正在识别文字 ${Math.round((message.progress ?? 0) * 100)}%`);
        },
      });
      const raw = output.data.text.replace(/[—–﹣]/g, "-").replace(/\s+/g, " ").trim();
      const ngcMatch = raw.match(/\b\d{7}\s*[- ]\s*\d{3}\b/);
      const pcgsMatch = raw.match(/\b\d{8}\b/);
      const code = ngcMatch
        ? ngcMatch[0].replace(/\s/g, "").replace(/^(\d{7})(\d{3})$/, "$1-$2")
        : pcgsMatch?.[0] ?? "";
      const grade = raw.match(/\b(?:PF|MS|AU|XF|VF)\s*\d{2}(?:\s+ULTRA\s+CAMEO)?\b/i)?.[0] ?? "待人工确认";
      const yearAndCoin = raw.match(/\b20\d{2}\s+China[^\n]{0,60}/i)?.[0] ?? "待人工确认";
      const company = /\bNGC\b/i.test(raw) || ngcMatch ? "NGC" : /\bPCGS\b/i.test(raw) ? "PCGS" : "待人工确认";
      setOcrResult({ code, company, grade, coin: yearAndCoin, raw, confidence: Math.round(output.data.confidence) });
      setOcrStatus(code ? "识别完成，请核对结果" : "未稳定识别出盒号，请换一张更清晰的正面照片");
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
    const value = `${ocrResult.company === "待人工确认" ? "" : ocrResult.company} ${ocrResult.code}`.trim();
    setQuery(value);
    setSubmitted(value);
    rememberSearch(value);
    void loadRealData(value);
    document.getElementById("search")?.scrollIntoView({ behavior: "smooth" });
  }

  return (
    <main>
      <header className="topbar">
        <a className="brand" href="#top" aria-label="泉知首页"><span className="brand-seal">泉</span><span>泉知</span></a>
        <nav aria-label="主导航"><a className="active" href="#search">查行情</a><a href="#market">市场记录</a><a href="#platforms">平台入口</a></nav>
        <span className="login">查盒号</span>
      </header>

      <section className="hero" id="top">
        <div className="eyebrow"><span /> 泉知</div>
        <h1>查盒号，找成交。</h1>
        <p className="hero-copy">输入 NGC、PCGS 盒号，或钱币关键词。</p>

        <form className="searchbox" id="search" onSubmit={search}>
          <span className="search-icon" aria-hidden="true" />
          <input value={query} onChange={(e) => setQuery(e.target.value)} aria-label="搜索评级盒号或钱币" placeholder="盒号 / 币名 / 关键词" />
          <button type="submit">查询</button>
        </form>
        <div className="examples"><span>查询示例：</span>{["NGC 8616098-030", "PCGS 47171501", "大熊猫国家公园纪念币"].map((item) => <button key={item} type="button" onClick={() => runExample(item)}>{item}</button>)}</div>
        {searchHistory.length > 0 && <div className="recent-searches"><span>最近搜索</span>{searchHistory.map((item) => <button key={item} type="button" onClick={() => runExample(item)}>{item}</button>)}<button className="clear-history" type="button" onClick={clearSearchHistory}>清除</button></div>}
        <div className="image-search">
          <div className="image-search-copy"><span className="camera" aria-hidden="true">▣</span><div><b>拍照识别盒号</b></div></div>
          <div className="image-actions"><button type="button" className="sample-button" onClick={useSampleImage}>示例</button><label className="upload-button">上传图片<input type="file" accept="image/*" onChange={chooseImage} /></label></div>
        </div>
        {(imagePreview || ocrStatus) && <div className="ocr-panel">
          {/* Uploaded images use local blob URLs, so a native image element is required here. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {imagePreview && <img src={imagePreview} alt="待识别的评级盒照片预览" />}
          <div className="ocr-content"><span className="kicker">识别结果</span><h3>{ocrStatus}</h3>{ocrResult && <><div className="ocr-confidence"><span>文字识别可信度</span><b>{ocrResult.confidence}%</b><i style={{ width: `${ocrResult.confidence}%` }} /></div><div className="ocr-fields"><label><span>评级机构</span><select value={ocrResult.company} onChange={(event) => setOcrResult({ ...ocrResult, company: event.target.value })}><option>NGC</option><option>PCGS</option><option>待人工确认</option></select></label><label><span>盒号（请逐位核对）</span><input value={ocrResult.code} placeholder="例如 8616098-030" inputMode="numeric" onChange={(event) => setOcrResult({ ...ocrResult, code: event.target.value.toUpperCase().replace(/[^A-Z0-9-]/g, "") })} /></label><p><span>评级</span><b>{ocrResult.grade}</b></p><p><span>币种标签</span><b>{ocrResult.coin}</b></p></div></>}{ocrResult?.code && <button type="button" onClick={searchRecognizedCode}>已核对，查询这个盒号</button>}<small className="ocr-warning">图片识别可能看错数字；只有你确认后的盒号才会用于查询。</small></div>
        </div>}
        <div className="data-note"><span>源</span> 价格均附原始记录</div>
      </section>

      {submitted && (
        <section className="workspace" id="market" aria-live="polite">
          {isBoxQuery ? (
            <div className="box-result">
              <div className="section-heading"><div><span className="kicker">盒号查询结果</span><h2>{boxAgency === "待确认" ? `盒号 ${boxCode}` : `${boxAgency} ${boxCode}`}</h2><p>先核对官方评级信息，再查看这枚币的历史成交。</p></div><div className="result-actions"><button type="button" onClick={toggleSavedBox}>{savedBoxes.includes(boxCode) ? "★ 已收藏" : "☆ 收藏盒号"}</button>{realRecords.length > 0 && <button type="button" onClick={exportRecords}>导出记录</button>}<span className="result-count">精确查询</span></div></div>
              <div className="box-card official-cert-card">
                <div className="cert-seal">{boxAgency === "待确认" ? "?" : boxAgency}</div>
                <div className="box-main"><span className="status">官方认证</span><h3>{boxCode}</h3><p>查看币种、年份、版别、评级与官方图片。</p></div>
                <div className="box-sale"><span>第一步</span><strong>核对评级信息</strong><p>确认标签与实物一致</p></div>
                {officialCertUrl ? <a className="outline-link" href={officialCertUrl} target="_blank" rel="noreferrer">打开 {boxAgency} 官方详情 ↗</a> : <div className="official-options"><a href="https://www.ngccoin.com/certlookup/" target="_blank" rel="noreferrer">NGC核验 ↗</a><a href="https://cn.pcgs.com/cert" target="_blank" rel="noreferrer">PCGS核验 ↗</a></div>}
              </div>
              {boxDatabaseRecords.length > 0 && <div className="box-card"><div className="cert-seal">✓</div><div className="box-main"><span className="status">盒号已收录</span><h3>{boxDatabaseRecords[0].coinName}</h3><p>{boxDatabaseRecords[0].gradingCompany} {boxDatabaseRecords[0].grade} · {boxDatabaseRecords[0].displayBoxCode}</p></div><div className="box-sale"><span>数据状态</span><strong>{boxDatabaseRecords[0].price === null ? "身份已确认" : "成交已收录"}</strong><p>{boxDatabaseRecords[0].price === null ? "暂无可核验成交详情，不展示猜测价格" : boxDatabaseRecords[0].platform}</p></div></div>}
              <div className="box-trace-head"><div><span className="kicker">历史成交</span><h3>这枚评级币的成交记录</h3></div><span>{boxDatabaseRecords.some((record) => record.price !== null) ? `${boxDatabaseRecords.filter((record) => record.price !== null).length + realRecords.length} 条` : realLoading ? "查询中" : `${realRecords.length} 条`}</span></div>
              {boxDatabaseRecords.some((record) => record.price !== null) ? <>
                <div className="real-source-bar"><span><i /> 泉知数据库已命中完整盒号</span><span>其他平台在后台补充，不影响本条展示</span></div>
                <div className="table-wrap real-table"><table><thead><tr><th>平台与商品</th><th>评级</th><th>成交时间</th><th>成交价</th><th>核验</th></tr></thead><tbody>{boxDatabaseRecords.filter((record) => record.price !== null && record.priceWithFee !== null).map((record) => <tr key={`${record.platform}-${record.productCode}`}><td><span className="platform">易</span><div><b>{record.coinName}</b><small>{record.platform} · 产品编号 {record.productCode}</small></div></td><td><span className="grade">{record.gradingCompany} {record.grade}</span></td><td>{record.transactedAt}</td><td className="price-cell"><b>¥{record.price!.toLocaleString()}</b><small>含佣价 ¥{record.priceWithFee!.toLocaleString()}</small></td><td>{record.detailUrl ? <a href={record.detailUrl} target="_blank" rel="noreferrer">原始交易 ↗</a> : <span className="record-pending">截图证据 · 原链接待复核</span>}</td></tr>)}</tbody></table></div>
                {realLoading && <div className="background-search-note">其他公开平台仍在后台查询，你可以先查看上面的已收录成交。</div>}
                {realRecords.length > 0 && <div className="table-wrap real-table secondary-records"><table><thead><tr><th>补充平台记录</th><th>品相</th><th>成交时间</th><th>成交价</th><th>核验</th></tr></thead><tbody>{realRecords.map((record) => <tr key={record.id}><td><span className="platform">邮</span><div><b>{record.title}</b><small>邮宝 · 完整盒号匹配</small></div></td><td>{record.condition}</td><td>{record.completedAt}</td><td className="price-cell"><b>¥{record.price.toLocaleString()}/{record.unit}</b></td><td><a href={record.url} target="_blank" rel="noreferrer">原始交易 ↗</a></td></tr>)}</tbody></table></div>}
              </> : realLoading ? <div className="real-loading"><span /><b>正在查询这枚币的成交记录</b><p>请稍候。</p></div> : realError ? <div className="real-empty"><b>暂时无法完成查询</b><p>{realError}</p><button type="button" onClick={() => void loadRealData(submitted)}>重新查询</button></div> : realRecords.length > 0 ? <>
                <div className="real-source-bar"><span><i /> 精确匹配：标题包含完整盒号</span><span>抓取时间：{realFetchedAt ? new Date(realFetchedAt).toLocaleString("zh-CN") : "刚刚"}</span></div>
                <div className="table-wrap real-table"><table><thead><tr><th>平台与原始标题</th><th>品相</th><th>成交时间</th><th>成交价</th><th>核验</th></tr></thead><tbody>{realRecords.map((record) => <tr key={record.id}><td><span className="platform">邮</span><div><b>{record.title}</b><small>邮宝 · 完整盒号匹配</small></div></td><td>{record.condition}</td><td>{record.completedAt}</td><td className="price-cell"><b>¥{record.price.toLocaleString()}/{record.unit}</b></td><td><a href={record.url} target="_blank" rel="noreferrer">原始交易 ↗</a></td></tr>)}</tbody></table></div>
              </> : <div className="real-empty box-no-sale"><b>暂未找到这枚评级币的公开成交</b><p>你可以继续使用完整盒号到常用平台查找。</p><div className="box-search-links"><a href={platformSearchUrl("邮宝", boxCode)} target="_blank" rel="noreferrer">去邮宝查找 ↗</a><a href={platformSearchUrl("闲鱼", boxCode)} target="_blank" rel="noreferrer">去闲鱼查找 ↗</a></div></div>}
              <div className="method-note"><b>如何确认是同一枚？</b> 成交页面中的盒号需要与查询号码逐位一致。同款币但盒号不同，不计入这枚币的成交记录。</div>
            </div>
          ) : realSearched ? (
            <div className="real-results">
              <div className="section-heading"><div><span className="kicker">历史成交 · 邮宝</span><h2>“{submitted}”的成交记录</h2><p>点击“原始交易”可以查看对应成交详情。</p></div><div className="result-actions">{realRecords.length > 0 && <button type="button" onClick={exportRecords}>导出记录</button>}<span className="result-count">{realLoading ? "查询中" : `${realRecords.length} 条`}</span></div></div>
              {realLoading ? <div className="real-loading"><span /><b>正在查询成交记录</b><p>请稍候。</p></div> : realError ? <div className="real-empty"><b>暂时无法查询</b><p>{realError}</p><button type="button" onClick={() => void loadRealData(submitted)}>重新查询</button></div> : realRecords.length === 0 ? <div className="real-empty"><b>暂未找到相关成交</b><p>试试减少关键词，或前往平台继续查找。</p><a href={platformSearchUrl("邮宝", submitted)} target="_blank" rel="noreferrer">去邮宝查找 ↗</a></div> : <>
                <div className="real-source-bar"><span><i /> 来源状态：实时公开页面</span><span>抓取时间：{realFetchedAt ? new Date(realFetchedAt).toLocaleString("zh-CN") : "刚刚"}</span><span>已排除交割失败记录</span></div>
                <div className="unit-metrics">{realUnitGroups.map((group) => <article key={`${group.title}-${group.unit}`}><span>{group.title} · 按“{group.unit}”计价</span><strong>¥{group.latest.toLocaleString()}<i>/{group.unit}</i></strong><p>区间 ¥{group.low.toLocaleString()}—{group.high.toLocaleString()} · {group.count}条</p></article>)}</div>
                <div className="table-wrap real-table"><table><thead><tr><th>平台与钱币</th><th>品相</th><th>成交时间</th><th>数量</th><th>成交单价</th><th>核验</th></tr></thead><tbody>{realRecords.map((record) => <tr key={record.id}><td><span className="platform">邮</span><div><b>{record.title}</b><small>邮宝 · <em>交割成功</em></small></div></td><td><span className="grade">{record.condition}</span></td><td>{record.completedAt}</td><td>{record.quantity}</td><td className="price-cell"><b>¥{record.price.toLocaleString()}/{record.unit}</b><small>平台公开成交单价</small></td><td><a href={record.url} target="_blank" rel="noreferrer">原始交易 ↗</a></td></tr>)}</tbody></table></div>
                <div className="method-note"><b>价格说明：</b>不同商品和不同计价单位（枚、卷、套、盒）分别展示，避免把不一样的商品价格混在一起。</div>
              </>}
            </div>
          ) : results.length === 0 ? (
            <div className="empty"><span>未</span><h2>暂时没有找到“{submitted}”</h2><p>试试减少关键词，或使用币种俗称、年份和材质重新搜索。</p><button onClick={() => runExample("熊猫")}>查看示例结果</button></div>
          ) : (
            <>
              <div className="section-heading"><div><span className="kicker">搜索“{submitted}”</span><h2>先选择你要查询的钱币</h2><p>已按关键词匹配程度排序。不同年份、材质和版别的价格不会混在一起。</p></div><span className="result-count">找到 {results.length} 个候选</span></div>
              <div className="coin-grid">
                {results.map((coin) => (
                  <button className={`coin-card ${selected.id === coin.id ? "selected" : ""}`} key={coin.id} onClick={() => setSelectedId(coin.id)}>
                    <CoinMark tone={coin.tone} />
                    <span className="coin-info"><b>{coin.name}</b><small>{coin.subtitle}</small><span className="tags"><i>{coin.year}</i><i>{coin.metal}</i><i>{coin.weight}</i></span></span>
                    <span className="coin-price"><small>最近成交</small><b>¥{coin.latest.toLocaleString()}</b><em>{coin.records} 条记录</em></span>
                  </button>
                ))}
              </div>

              <div className="detail" id="market">
                <div className="detail-top">
                  <div><span className="kicker">{selected.category}</span><h2>{selected.name}</h2><p>{selected.subtitle} · 数据更新于 2026-08-02</p></div>
                  <button className="follow" type="button">☆ 收藏钱币</button>
                </div>
                <div className="metrics">
                  <div className="primary"><span>最近确认成交</span><strong>¥{selected.latest.toLocaleString()}</strong><small>演示数据 · 成交口径见记录</small></div>
                  <div><span>样品价格区间</span><strong>¥{confirmedLow}—{confirmedHigh}</strong><small>仅统计确认匹配</small></div>
                  <div><span>确认成交记录</span><strong>{confirmedSales.length}<i> 条</i></strong><small>另有 1 条可能相关</small></div>
                  <div><span>覆盖平台</span><strong>4<i> 个</i></strong><small>本次演示范围</small></div>
                </div>
                <div className="records">
                  <div className="record-tabs"><button className={tab === "sales" ? "active" : ""} onClick={() => setTab("sales")}>历史成交 <span>{sales.length}</span></button><button className={tab === "market" ? "active" : ""} onClick={() => setTab("market")}>在售与拍卖 <span>{listings.length}</span></button></div>
                  {tab === "sales" ? (
                    <>
                      <div className="filters">
                        <label>平台<select value={platformFilter} onChange={(e) => setPlatformFilter(e.target.value)}><option value="all">全部平台</option>{sales.map((row) => row.platform).filter((value, index, list) => list.indexOf(value) === index).map((platform) => <option key={platform}>{platform}</option>)}</select></label>
                        <label>时间<select value={periodFilter} onChange={(e) => setPeriodFilter(e.target.value)}><option value="all">全部时间</option><option value="7">近 7 天</option><option value="30">近 30 天</option></select></label>
                        <label>品相<select value={gradeFilter} onChange={(e) => setGradeFilter(e.target.value)}><option value="all">全部品相</option><option value="raw">裸币</option><option value="graded">评级币</option><option value="original">原封</option><option value="unknown">未标注</option></select></label>
                        <label>价格<select value={priceFilter} onChange={(e) => setPriceFilter(e.target.value)}><option value="all">全部价格</option><option value="under220">¥220 以下</option><option value="over220">¥220 及以上</option></select></label>
                        <div className="filter-summary">显示 <b>{filteredSales.length}</b> / {sales.length} 条 <button type="button" onClick={resetFilters}>重置</button></div>
                      </div>
                      {filteredSales.length > 0 ? <div className="table-wrap"><table><thead><tr><th>平台与商品</th><th>匹配状态</th><th>评级/品相</th><th>成交时间</th><th>成交价与口径</th><th /></tr></thead><tbody>{filteredSales.map((row) => <tr key={row.platform}><td><span className="platform">{row.platform.slice(0, 1)}</span><div><b>{row.title}</b><small>{row.platform} · <em>演示数据，无具体商品链接</em></small></div></td><td><span className={`match ${row.match}`}>{row.match === "confirmed" ? "确认匹配" : "可能相关"}</span></td><td><span className="grade">{row.grade}</span></td><td>{row.date}</td><td className="price-cell"><b>¥{row.price}</b><small>{row.priceNote}</small></td><td><a href={platformSearchUrl(row.platform, row.title)} target="_blank" rel="noreferrer">去平台继续搜索 ↗</a></td></tr>)}</tbody></table></div> : <div className="filter-empty">当前筛选条件下没有记录。<button type="button" onClick={resetFilters}>清除筛选</button></div>}
                      <div className="method-note"><b>统计规则：</b>“可能相关”记录可能存在年份、版别或品相不明确的问题，只供人工参考，不计入最近成交价和价格区间。</div>
                    </>
                  ) : (
                    <div className="listing-grid">{listings.map((row) => <article key={row.platform}><div className="listing-image pending-image"><CoinMark tone="silver" small /><b>原平台图片待接入</b><span>当前记录为演示数据</span></div><span className="platform-name">{row.platform}</span><h3>{row.title}</h3><div><strong>¥{row.price}</strong><small>{row.note}</small></div><p>{row.time}</p><a href={platformSearchUrl(row.platform, row.title)} target="_blank" rel="noreferrer">去平台继续搜索 ↗</a><small className="link-caveat">关键词/分类入口，不是具体商品页</small></article>)}</div>
                  )}
                </div>
              </div>
            </>
          )}
          <div className="priority-platforms">
            <div><span className="kicker">更多平台</span><h3>用“{submitted}”继续查询</h3></div>
            {platformImageStatus && <div className="image-scan-status"><span />{platformImageStatus}</div>}
            {platformRecordsLoading ? <div className="platform-records-empty">正在核验公开商品页和商品图片…</div> : platformRecords.length > 0 ? <div className="platform-records">
              {platformRecords.map((record) => <article key={record.id}>
                <div><span className={`record-match ${record.match}`}>{record.match === "exact-box" ? "同一盒号" : "关键词相关"}</span><b>{record.source}</b></div>
                <h4>{record.title}</h4>
                <dl><div><dt>{record.priceLabel}</dt><dd>¥{record.price.toLocaleString()}</dd></div><div><dt>{record.timeLabel}</dt><dd>{record.time}</dd></div></dl>
                {record.url ? <a href={record.url} target="_blank" rel="noreferrer">查看商品详情 ↗</a> : <span className="record-pending">{record.status}</span>}
              </article>)}
            </div> : <div className="platform-records-empty">暂未找到同时包含价格、时间和详情链接的公开记录。</div>}
            <div className="priority-platform-links">
              <a href={`/api/platform?name=zhao&q=${encodeURIComponent(submitted)}`} target="_blank" rel="noreferrer"><b>赵涌在线</b><small>关键词搜索</small><span>↗</span></a>
              <a href={`/api/platform?name=yijin&q=${encodeURIComponent(submitted)}`} target="_blank" rel="noreferrer"><b>易金在线</b><small>关键词搜索</small><span>↗</span></a>
              <a href={`/api/platform?name=jinbiyunji&q=${encodeURIComponent(submitted)}`} target="_blank" rel="noreferrer"><b>金币云集</b><small>平台入口</small><span>↗</span></a>
              <a href={`/api/platform?name=maixiqi&q=${encodeURIComponent(submitted)}`} target="_blank" rel="noreferrer"><b>麦稀奇</b><small>拍品入口</small><span>↗</span></a>
            </div>
            <p>“关键词搜索”会携带当前内容；“平台入口”需在平台内再次搜索。只有完整盒号一致，才能确认是同一枚币。</p>
          </div>
        </section>
      )}

      <section className="platform-section" id="platforms">
        <div className="platform-heading compact"><div><span className="kicker">平台入口</span><h2>更多渠道</h2></div></div>
        <div className="platform-pills">{platforms.map((platform) => platform.href ? <a key={platform.name} href={platformSearchUrl(platform.name, activeSearchTerm) || platform.href} target="_blank" rel="noreferrer">{platform.name}<span>↗</span></a> : <span key={platform.name} title={platform.action}>{platform.name}</span>)}</div>
      </section>

      <footer><a className="brand muted" href="#top"><span className="brand-seal">泉</span><span>泉知</span></a><p>数据以原始交易页为准</p></footer>
    </main>
  );
}
