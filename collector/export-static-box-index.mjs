import { mkdir, rm, writeFile } from "node:fs/promises";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { database } from "./database.mjs";
import { PUBLISHED_SALE_STATUSES, sqlIn } from "./publication-policy.mjs";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const outputRoot = resolve(projectRoot, "public", "box-data");
await rm(outputRoot, { recursive: true, force: true });
await mkdir(outputRoot, { recursive: true });

const rows = database.prepare(`
  SELECT normalized_box_code, display_box_code, grading_company, grade, coin_name,
         platform, detail_url, official_cert_url, price, price_with_fee,
         transacted_at, product_code, evidence_image_url, ocr_text,
         ocr_confidence, verification_status, COALESCE(keywords,'') as keywords
  FROM box_sales
  WHERE verification_status IN (${sqlIn(PUBLISHED_SALE_STATUSES)})
  ORDER BY normalized_box_code, transacted_at DESC
`).all();

const grouped = Map.groupBy(rows, (row) => row.normalized_box_code);
for (const [boxCode, records] of grouped) {
  const directory = resolve(outputRoot, boxCode.slice(0, 2));
  await mkdir(directory, { recursive: true });
  await writeFile(resolve(directory, `${boxCode}.json`), JSON.stringify({
    ok: true,
    query: boxCode,
    match: "exact",
    records: records.map((row) => ({
      normalizedBoxCode: row.normalized_box_code,
      displayBoxCode: row.display_box_code,
      gradingCompany: row.grading_company,
      grade: row.grade,
      coinName: row.coin_name,
      platform: row.platform,
      detailUrl: row.detail_url,
      officialCertUrl: row.official_cert_url,
      price: row.price,
      priceWithFee: row.price_with_fee,
      transactedAt: row.transacted_at,
      productCode: row.product_code,
      evidenceImageUrl: row.evidence_image_url,
      ocrConfidence: row.ocr_confidence,
      verificationStatus: row.verification_status,
      saleStatus: row.verification_status === 'active_listing' || row.verification_status === 'youbao_active' ? '在售' : '已售',
      keywords: row.keywords || '',
    })),
  }, null, 2));
}

await writeFile(resolve(outputRoot, "manifest.json"), JSON.stringify({
  generatedAt: new Date().toISOString(),
  publishedStatuses: PUBLISHED_SALE_STATUSES,
  verifiedBoxes: grouped.size,
  verifiedSales: rows.length,
  activeListings: database
    .prepare("SELECT COUNT(*) as count FROM box_sales WHERE verification_status IN ('active_listing','youbao_active')")
    .get().count,
}, null, 2));

// ---- Coin-name grouped index (for price history / coin detail pages) ----
const coinOutputRoot = resolve(projectRoot, "public", "coin-data");
await rm(coinOutputRoot, { recursive: true, force: true });
await mkdir(coinOutputRoot, { recursive: true });

// Simple slug: first 8 chars of a djb2-style hash of coin name
function coinSlug(name) {
  let hash = 5381;
  for (let i = 0; i < name.length; i++) hash = ((hash << 5) + hash + name.charCodeAt(i)) | 0;
  return Math.abs(hash).toString(16).padStart(8, "0");
}

// ── Coin name canonicalization ──
// Normalizes platform-specific naming differences so the same physical coin
// from different platforms gets merged into a single entry.
const SERIES_LIST = [
  "熊猫", "生肖", "吉祥文化", "中国龙", "书法", "和字", "京剧",
  "建国", "建党", "改革开放", "抗战", "冬奥", "航天", "贺岁", "福字",
  "泰山", "武夷山", "黄山", "峨眉山", "大运河", "国家公园", "丝绸之路",
  "黄河", "长江", "香港回归", "澳门回归", "世博", "麒麟", "龙凤", "珍稀动物",
  "长城币", "老三花", "新三花", "袁大头", "孙小头", "船洋", "大清银币",
  "光绪元宝", "北洋造", "江南造", "湖北造", "广东造", "四川造",
  "美国鹰洋", "加拿大枫叶", "澳大利亚袋鼠", "英国不列颠",
  "一轮生肖", "二轮生肖", "应县佛宫寺释迦塔", "秦始皇陵及兵马俑坑",
  "奥运会", "中国古代名画", "古代科技", "沈阳造币", "上海造币", "深圳国宝",
  "南昌印钞", "毛泽东", "周恩来", "邓小平", "孙中山",
  "中国纸币", "中国近代机制币", "龙钞",
];

function canonicalizeCoinName(raw) {
  let name = raw.trim();

  // Strip quantity / packaging / lot-size suffixes
  name = name.replace(/[（(][^)）]*[)）]/g, "");
  name = name.replace(/(?:各一枚|共二枚|共三枚|一套|二枚一套|十枚一套).*$/, "");
  name = name.replace(/(?:二枚|三枚|四枚|五枚|六枚|八枚|十枚|廿枚|连号[0-9]*枚)$/, "");
  name = name.replace(/(?:二枚|三枚|四枚)\s*$/, "");

  // Normalize weight units: 1盎司 ≈ 31.104克 for consistency
  name = name.replace(/1盎司/g, "31.104克");
  name = name.replace(/1\/2盎司/g, "15.552克");
  name = name.replace(/1\/4盎司/g, "7.776克");
  name = name.replace(/1\/10盎司/g, "3.11克");

  // Try structured parse: year + series + weight + quality + metal
  const yearMatch = name.match(/^(\d{4})年/);
  if (!yearMatch) return name; // non-standard name, keep as-is
  const year = yearMatch[1];
  let rest = name.slice(yearMatch[0].length);

  // Extract series
  let series = "";
  for (const s of SERIES_LIST) {
    if (rest.includes(s)) { series = s; break; }
  }

  // Extract quality
  const qMatch = rest.match(/(精制|普制|彩色|本色|加厚)/);
  const quality = qMatch ? qMatch[1] : "";

  // Extract metal
  const mMatch = rest.match(/([金银铜铂钯]{1,2})/);
  const metal = mMatch ? mMatch[1] : "";

  // Extract weight (克/盎司/公斤)
  const wMatch = rest.match(/(\d+(?:\.\d+)?)\s*(?:克|盎司|oz|公斤)/);
  const weight = wMatch ? wMatch[0] : "";

  // Rebuild canonical: year + series + weight + quality + metal[币]
  let result = year + "年";
  if (series) result += series;
  if (weight) result += weight;
  if (quality) result += quality;
  if (metal) result += metal + "币";

  // Fallback: if rebuild is too short, keep original (minus suffixes)
  if (result.length < 6) return name;
  return result;
}

// Apply canonicalization: map each row's coin_name to canonical form
const canonicalMap = new Map(); // canonicalName → rows[]
for (const row of rows) {
  const canonical = canonicalizeCoinName(row.coin_name);
  if (!canonicalMap.has(canonical)) canonicalMap.set(canonical, []);
  canonicalMap.get(canonical).push(row);
}

// Group all verified sales by canonical coin name
const coinGroups = new Map();
// Also build a lookup: original_name → canonical_name for keyword merging
const nameToCanonical = new Map();
for (const [canonical, sales] of canonicalMap) {
  coinGroups.set(canonical, sales);
  for (const s of sales) {
    if (!nameToCanonical.has(s.coin_name)) nameToCanonical.set(s.coin_name, canonical);
  }
}
const coinIndex = [];

for (const [coinName, sales] of coinGroups) {
  // Coin detail pages and the index use transaction time as the single
  // definition of "latest". The source rows are ordered by certificate code,
  // so sort each coin group explicitly before calculating price summaries.
  const sortedSales = [...sales].sort((a, b) =>
    String(b.transacted_at ?? "").localeCompare(String(a.transacted_at ?? ""))
  );
  const slug = coinSlug(coinName);
  const prefix = slug.slice(0, 2);
  const directory = resolve(coinOutputRoot, prefix);
  await mkdir(directory, { recursive: true });

  const prices = sortedSales.filter((s) => s.price !== null).map((s) => s.price);

  // Collect unique keywords for this coin
  const coinKeywords = [...new Set(sortedSales.flatMap(s => (s.keywords || '').split(',').filter(Boolean)))];

  const coinData = {
    coinName,
    slug,
    saleCount: sortedSales.length,
    keywords: coinKeywords.join(','),
    priceStats: {
      low: prices.length > 0 ? Math.min(...prices) : null,
      high: prices.length > 0 ? Math.max(...prices) : null,
      avg: prices.length > 0 ? Math.round(prices.reduce((a, b) => a + b, 0) / prices.length) : null,
      latest: sortedSales.find((sale) => sale.price !== null)?.price ?? null,
    },
    records: sortedSales.map((row) => ({
      coinName: row.coin_name,
      normalizedBoxCode: row.normalized_box_code,
      displayBoxCode: row.display_box_code,
      gradingCompany: row.grading_company,
      grade: row.grade,
      platform: row.platform,
      detailUrl: row.detail_url,
      officialCertUrl: row.official_cert_url,
      price: row.price,
      priceWithFee: row.price_with_fee,
      transactedAt: row.transacted_at,
      productCode: row.product_code,
      verificationStatus: row.verification_status,
      saleStatus: row.verification_status === 'active_listing' || row.verification_status === 'youbao_active' ? '在售' : '已售',
      keywords: row.keywords || '',
    })),
  };
  await writeFile(resolve(directory, `${slug}.json`), JSON.stringify(coinData, null, 2));
  coinIndex.push({
    coinName,
    slug,
    saleCount: sortedSales.length,
    keywords: coinKeywords.join(','),
    latestPrice: sortedSales.find((sale) => sale.price !== null)?.price ?? null,
    latestDate: sortedSales.find((sale) => sale.price !== null)?.transacted_at ?? null,
    priceLow: coinData.priceStats.low,
    priceHigh: coinData.priceStats.high,
  });
}

// Sort by sale count desc for the index
coinIndex.sort((a, b) => b.saleCount - a.saleCount);
await writeFile(resolve(coinOutputRoot, "index.json"), JSON.stringify({
  generatedAt: new Date().toISOString(),
  totalCoins: coinIndex.length,
  totalSales: rows.length,
  coins: coinIndex,
}, null, 2));

process.stdout.write(`${JSON.stringify({
  verifiedBoxes: grouped.size,
  verifiedSales: rows.length,
  uniqueCoins: coinIndex.length,
  outputRoot,
  coinOutputRoot,
}, null, 2)}\n`);
