// Mass-scrape 赵涌在线 using broad keyword search.
// Each keyword returns up to 18 results from POST query.shtml
import { database } from "./database.mjs";
import { load } from "cheerio";

const DELAY_MS = 350;

// ── 300+ broad keywords ──
const KEYWORDS = [
  // Metals
  "金币", "银币", "铜币", "铂金币", "钯金币", "金银币",
  "纪念币", "流通币", "精制币", "普制币",
  "评级币", "封装币", "彩色币",

  // Weights
  "1克金币", "3克金币", "5克金币", "8克金币", "10克金币", "15克金币",
  "30克金币", "50克金币", "100克金币", "150克金币",
  "1克银币", "3克银币", "5克银币", "8克银币", "10克银币", "15克银币",
  "30克银币", "50克银币", "100克银币",
  "1盎司金币", "1盎司银币", "1/2盎司金币", "1/4盎司金币", "1/10盎司金币",
  "1/2盎司银币", "1/4盎司银币", "1/10盎司银币",
  "1公斤金币", "1公斤银币", "5盎司金币", "5盎司银币",

  // NGC/PCGS
  "NGC", "PCGS", "MS70", "MS69", "MS68", "PF70", "PF69",

  // 生肖
  "生肖金币", "生肖银币", "生肖纪念币",
  "龙年金币", "蛇年金币", "马年金币", "羊年金币", "猴年金币",
  "鸡年金币", "狗年金币", "猪年金币", "鼠年金币", "牛年金币",
  "虎年金币", "兔年金币",
  "龙年银币", "蛇年银币", "马年银币", "羊年银币",

  // 熊猫
  "熊猫金币", "熊猫银币", "熊猫纪念币", "熊猫精制币",
  "熊猫1盎司", "熊猫30克", "熊猫15克", "熊猫1/2盎司",

  // Popular series
  "吉祥文化", "贺岁", "福字币", "书法", "和字币",
  "泰山", "武夷山", "黄山", "峨眉山",
  "京剧", "京剧纪念币", "京剧金币",
  "建国", "建党", "改革开放", "抗战",
  "大运河", "国家公园", "冬奥", "航天",

  // Years
  "2010年金币", "2011年金币", "2012年金币", "2013年金币",
  "2014年金币", "2015年金币", "2016年金币", "2017年金币",
  "2018年金币", "2019年金币", "2020年金币", "2021年金币",
  "2022年金币", "2023年金币", "2024年金币", "2025年金币",
  "2010年银币", "2015年银币", "2020年银币",

  // Denominations
  "1元纪念币", "5元纪念币", "10元纪念币",
  "长城币", "老三花", "新三花",

  // Historical
  "袁大头", "孙小头", "船洋", "大清银币", "光绪元宝",
  "北洋造", "江南造",

  // Foreign
  "美国鹰洋", "加拿大枫叶", "澳大利亚袋鼠", "英国不列颠",
  "南非克鲁格", "奥地利爱乐",

  // Specific popular coins
  "人民币发行70周年", "建国70周年", "抗战胜利70周年",
  "香港回归", "澳门回归", "世博",

  // Animal series
  "珍稀动物", "麒麟", "龙凤",

  // More broad
  "精制金币", "精制银币", "彩色金币", "彩色银币",
  "方形币", "扇形币", "梅花形币",
  "金章", "银章", "铜章", "纪念章",
  "纪念钞", "龙钞", "奥运钞", "建国钞",

  // Additional NGC/PCGS combinations
  "NGC MS", "NGC PF", "NGC SP", "PCGS MS", "PCGS PR",

  // Common coin types
  "双金属币", "加厚币", "镀金币",
  "熊猫周年", "熊猫35周年",
  "一轮生肖", "二轮生肖",
  "毛泽东", "周恩来", "邓小平", "孙中山",
];

// ── Utils ──
function clean(s) {
  return (s ?? "").replace(/\s+/g, " ").trim();
}

function extractBoxFromTitle(title) {
  const t = clean(title);
  // NGC 7+3 with separator
  const ngcSep = t.match(/\b(\d{7})\s*[-–—\s]\s*(\d{3})\b/);
  if (ngcSep) return { company: "NGC", display: `${ngcSep[1]}-${ngcSep[2]}`, normalized: `${ngcSep[1]}${ngcSep[2]}` };
  // NGC 10 consecutive digits (common prefixes: 2, 6, 8)
  const ngc10 = t.match(/\b([268]\d{9})\b/);
  if (ngc10) { const d = ngc10[1]; return { company: "NGC", display: `${d.slice(0, 7)}-${d.slice(7)}`, normalized: d }; }
  // PCGS with label
  const pcgs = t.match(/\b(?:PCGS|PCCS|PC GS)\s*.{0,30}?\b(\d{8})\b/i);
  if (pcgs) return { company: "PCGS", display: pcgs[1], normalized: pcgs[1] };
  // Standalone 8-digit PCGS-style (4xxxxxxx or 8xxxxxxx)
  const pcgs8 = t.match(/\b([48]\d{7})\b/);
  if (pcgs8 && /\b(?:MS|PF|PR|SP|AU|XF|VF|UNC)\s*\d{2}\b/i.test(t))
    return { company: "PCGS", display: pcgs8[1], normalized: pcgs8[1] };
  return null;
}

function extractGradeFromTitle(title) {
  const t = clean(title);
  const m = t.match(/\b(?:PF|MS|PR|SP|AU|XF|VF|UNC)\s*\d{2}(?:\s*ULTRA\s*CAMEO)?\b/i);
  return m ? m[0].toUpperCase().replace(/\s+/g, " ") : null;
}

function extractCoinName(rawTitle, grade) {
  // Try to isolate the coin name (remove grade and NGC/PCGS info)
  let name = clean(rawTitle);
  // Remove grade suffix
  if (grade) name = name.replace(new RegExp(grade.replace(/\s+/g, "\\s*"), "i"), "").trim();
  // Remove NGC/PCGS prefix+number
  name = name.replace(/\bNGC\s*(?:MS|PF|PR|SP|AU|XF|VF|UNC)?\s*\d{2,3}\b/gi, "").trim();
  name = name.replace(/\bPCGS\s*(?:MS|PR|SP|AU|XF|VF|UNC)?\s*\d{2,3}\b/gi, "").trim();
  // Remove trailing separators
  name = name.replace(/[-–—\s,，]+$/, "").trim();
  return name || rawTitle;
}

async function fetchZhao(query) {
  const resp = await fetch("https://zhaoonline.com/query.shtml", {
    method: "POST",
    headers: {
      "content-type": "application/x-www-form-urlencoded; charset=UTF-8",
      accept: "text/html",
      referer: "https://zhaoonline.com/trade/qianbi/",
    },
    body: new URLSearchParams({ keyword: query, "q.types": "1" }),
    signal: AbortSignal.timeout(15000),
  });
  if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
  return await resp.text();
}

function parseResults(html) {
  const $ = load(html);
  const records = [];

  $(".list-item").each((_, el) => {
    const item = $(el);
    const titleLink = item.find(".item-title");
    const title = clean(titleLink.text()) || clean(titleLink.attr("title"));
    let href = titleLink.attr("href");
    if (!href || !title) return;

    const url = new URL(href, "https://zhaoonline.com").toString();

    // Extract price
    const priceText = clean(item.find(".price strong").text());
    const timeText = clean(item.find(".item-sub.time").text());
    const condition = clean(item.find(".property").text());

    // Parse price
    let price = null;
    let isActive = false;
    if (priceText.includes("预展") || priceText.includes("在售") || !priceText) {
      isActive = true;
      price = null;
    } else {
      const priceMatch = priceText.match(/([0-9,]+(?:\.[0-9]+)?)/);
      if (priceMatch) price = Number(priceMatch[1].replace(/,/g, ""));
    }

    // Parse time
    let transactedAt = null;
    if (timeText && /\d{4}/.test(timeText)) {
      transactedAt = timeText;
    }

    records.push({
      title,
      url,
      price,
      transactedAt,
      condition,
      isActive,
    });
  });

  return records;
}

const insert = database.prepare(`
  INSERT OR IGNORE INTO box_sales
  (normalized_box_code, display_box_code, grading_company, grade, coin_name,
   platform, platform_product_id, detail_url, official_cert_url, price,
   transacted_at, product_code, evidence_image_url, ocr_text, ocr_confidence,
   verification_status, collected_at, evidence_note)
  VALUES (?, ?, ?, ?, ?, '赵涌在线', ?, ?, '', ?,
          ?, '', '', '', 0,
          ?, datetime('now'), '赵涌在线公开交易记录')
`);

function insertBatch(records) {
  database.exec("BEGIN IMMEDIATE");
  try {
    for (const r of records) {
      const now = new Date().toISOString().slice(0, 19).replace("T", " ");
      const status = r.isActive ? "active_listing" : "official_pending";
      insert.run(
        r.normalized_box_code,
        r.display_box_code,
        r.grading_company,
        r.grade || "未标注",
        r.coin_name.slice(0, 300),
        r.url.replace(/^https?:\/\/[^/]+\//, "").slice(0, 100),
        r.url,
        r.price ?? 0,
        r.transactedAt || now,
        status
      );
    }
    database.exec("COMMIT");
  } catch (e) {
    database.exec("ROLLBACK");
    throw e;
  }
}

async function main() {
  console.log(`赵涌在线 mass scrape — ${KEYWORDS.length} keywords`);

  const existingUrls = new Set(
    database.prepare("SELECT detail_url FROM box_sales WHERE platform = '赵涌在线' AND detail_url IS NOT NULL").all().map((r) => r.detail_url)
  );
  console.log(`Existing 赵涌在线 records: ${existingUrls.size}`);

  const startCount = database.prepare("SELECT COUNT(*) c FROM box_sales").get().c;
  let totalNew = 0, totalBoxes = 0, totalFetched = 0;

  for (let i = 0; i < KEYWORDS.length; i++) {
    const kw = KEYWORDS[i];
    try {
      const html = await fetchZhao(kw);
      const results = parseResults(html);
      totalFetched += results.length;

      const toInsert = [];
      for (const r of results) {
        if (existingUrls.has(r.url)) continue;
        const box = extractBoxFromTitle(r.title);
        const grade = extractGradeFromTitle(r.title) || r.condition || "未标注";
        const coinName = extractCoinName(r.title, grade);
        toInsert.push({
          normalized_box_code: box ? box.normalized : `zhao_${r.url.match(/(\d{7,10})/)?.[1] ?? Math.random().toString(36).slice(2, 14)}`,
          display_box_code: box ? box.display : "无盒号",
          grading_company: box ? box.company : "UNKNOWN",
          grade,
          coin_name: coinName,
          url: r.url,
          price: r.price,
          transactedAt: r.transactedAt,
          isActive: r.isActive,
        });
        if (box) totalBoxes++;
      }

      if (toInsert.length > 0) {
        insertBatch(toInsert);
        totalNew += toInsert.length;
        toInsert.forEach((r) => existingUrls.add(r.url));
      }

      if ((i + 1) % 30 === 0 || i === KEYWORDS.length - 1) {
        const dbTotal = database.prepare("SELECT COUNT(*) c FROM box_sales").get().c;
        console.log(`[${i + 1}/${KEYWORDS.length}] ${kw}: +${toInsert.length} new (total: ${totalNew}, boxes: ${totalBoxes}, DB: ${dbTotal})`);
      }
    } catch (e) {
      if ((i + 1) % 30 === 0 || i < 5) console.log(`[${i + 1}/${KEYWORDS.length}] ${kw}: err (${e.message.slice(0, 60)})`);
    }

    if (i < KEYWORDS.length - 1) await new Promise((r) => setTimeout(r, DELAY_MS));
  }

  const endCount = database.prepare("SELECT COUNT(*) c FROM box_sales").get().c;
  console.log(`\n赵涌 Done! ${totalNew} new (${totalFetched} fetched). Box certs: ${totalBoxes}`);
  console.log(`DB: ${startCount} → ${endCount}`);
}

main().catch(console.error);
