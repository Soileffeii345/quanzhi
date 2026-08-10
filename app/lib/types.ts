// 共享类型定义 — 用于前端、API routes 和平台 adapter

// ---- 平台适配器 ----

/** 平台 adapter 统一接口：给定搜索词，返回结构化记录 */
export interface PlatformAdapter {
  name: string;
  search(query: string): Promise<PlatformRecord[]>;
  /** 返回候选商品图片，用于 OCR 盒号核验（可选） */
  imageCandidates?(query: string): Promise<PlatformImageCandidate[]>;
}

// ---- 记录类型 ----

/** 邮宝交割成功的真实成交记录 */
export type RealRecord = {
  id: string;
  source: "邮宝";
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

/** 多平台公开记录（成交 + 在售） */
export type PlatformRecord = {
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
  coinName?: string;
};

/** 平台商品图片候选，用于 OCR 盒号核验 */
export type PlatformImageCandidate = {
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

/** 泉知本地数据库中的盒号成交记录 */
export type BoxDatabaseRecord = {
  normalizedBoxCode: string;
  displayBoxCode: string;
  gradingCompany: string;
  grade: string;
  coinName: string;
  platform: string;
  detailUrl: string;
  officialCertUrl?: string;
  price: number | null;
  priceWithFee: number | null;
  transactedAt: string;
  productCode: string;
  verificationStatus: BoxVerificationStatus;
  evidenceNote: string;
  saleStatus?: "在售" | "已售";
};

export type BoxVerificationStatus =
  | "user_screenshot"
  | "page_text_exact"
  | "image_exact"
  | "verified"
  | "official_pending";

// ---- OCR ----

export type OcrResult = {
  code: string;
  company: string;
  grade: string;
  coin: string;
  raw: string;
  confidence: number;
};

// ---- 数据源状态 ----

export type SourceStatus = {
  name: string;
  status: "live" | "unavailable" | "link-only" | "protected-link-only";
  fetchedAt?: string;
};

// ---- NGC/PCGS 认证信息 ----

export type CertInfo = {
  ok: boolean;
  source?: "database" | "live" | "none";
  coinName: string;
  grade: string;
  year: string;
  denomination: string;
  agency: string;
  certUrl: string;
  rawTitle: string;
};

export type CertLookupResponse = {
  ok: boolean;
  query: string;
  cert: CertInfo;
  searchKeywords: string;
  sameModelRecords: RealRecord[];
  methodology: string;
  error?: string;
};
