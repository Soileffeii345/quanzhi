import type { PlatformRecord } from "../types";

/** 清理空白字符 */
export function clean(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

/** 把查询词拆成关键词数组 */
export function termsFor(query: string) {
  return clean(query).toLowerCase().split(" ").filter(Boolean);
}

/** 标题是否包含所有查询关键词 */
export function matches(title: string, query: string) {
  const normalized = title.toLowerCase();
  return termsFor(query).every((term) => normalized.includes(term));
}

/** 判断是精确盒号匹配还是关键词匹配 */
export function matchType(title: string, query: string): PlatformRecord["match"] {
  const compactQuery = query.toUpperCase().replace(/[^A-Z0-9]/g, "");
  const compactTitle = title.toUpperCase().replace(/[^A-Z0-9]/g, "");
  return /^\d{7,12}$/.test(compactQuery) && compactTitle.includes(compactQuery)
    ? "exact-box"
    : "keyword";
}

/** 从文本中提取人民币金额 */
export function money(value: string) {
  const match = value.match(/[￥¥]\s*([0-9,]+(?:\.\d+)?)/);
  return match ? Number(match[1].replaceAll(",", "")) : null;
}
