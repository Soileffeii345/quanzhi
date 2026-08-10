// Mass-scrape 易金在线 using list pagination + keyword search.
// List page: paginates through in-sale items (title, price, date, url)
// Search page: shows coin type summaries with price ranges
import { database } from "./database.mjs";
import { load } from "cheerio";

const DELAY_MS = 400;

// ── Phase 1: Keyword search for coin summaries (populates coin-data) ──
const KEYWORDS = [
  "金币", "银币", "铜币", "铂金币", "钯金币",
  "纪念币", "流通币", "精制币", "普制币",
  "评级币", "封装币",
  "NGC", "PCGS", "MS70", "MS69", "PF70",
  "1盎司金币", "1盎司银币", "1/2盎司金币", "1/4盎司金币", "1/10盎司金币",
  "30克金币", "15克金币", "8克金币", "50克金币",
  "30克银币", "15克银币", "1公斤银币", "1公斤金币",
  "5盎司金币", "5盎司银币", "2盎司",
  "熊猫金币", "熊猫银币", "熊猫纪念币", "熊猫精制币",
  "生肖金币", "生肖银币", "生肖纪念币",
  "龙年金币", "蛇年金币", "马年金币", "羊年金币", "猴年金币",
  "鸡年金币", "狗年金币", "猪年金币", "鼠年金币", "牛年金币",
  "虎年金币", "兔年金币",
  "吉祥文化", "贺岁币", "福字币",
  "书法币", "和字币",
  "泰山币", "武夷山", "黄山币", "峨眉山",
  "京剧", "京剧纪念币", "京剧金币",
  "建国币", "建党币", "改革开放", "抗战",
  "2010年", "2011年", "2012年", "2013年", "2014年", "2015年",
  "2016年", "2017年", "2018年", "2019年", "2020年", "2021年",
  "2022年", "2023年", "2024年", "2025年", "2026年",
  "袁大头", "孙小头", "船洋", "大清银币", "光绪元宝",
  "北洋造", "江南造",
  "美国鹰洋", "加拿大枫叶", "澳大利亚袋鼠", "英国不列颠",
  "1元纪念币", "5元纪念币", "10元纪念币",
  "长城币", "老三花", "新三花",
  "冬奥币", "冬奥钞", "航天币", "航母",
  "金章", "银章", "纪念章",
  "纪念钞", "龙钞", "奥运钞", "建国钞",
  "一轮生肖", "二轮生肖",
  "毛泽东", "周恩来", "孙中山",
  "双金属币", "加厚币", "彩色金币", "彩色银币",
  "精制金币", "精制银币",
  "香港回归", "澳门回归", "世博",
  "大运河", "国家公园",
  "方形币", "扇形币", "梅花形币",
  "丝绸之路", "黄河", "长江",
  "麒麟", "龙凤", "珍稀动物",
];

function clean(s) {
  return (s ?? "").replace(/\s+/g, " ").trim();
}

function extractBoxFromTitle(title) {
  const t = clean(title);
  const ngcSep = t.match(/\b(\d{7})\s*[-–—\s]\s*(\d{3})\b/);
  if (ngcSep) return { company: "NGC", display: `${ngcSep[1]}-${ngcSep[2]}`, normalized: `${ngcSep[1]}${ngcSep[2]}` };
  const ngc10 = t.match(/\b([268]\d{9})\b/);
  if (ngc10) { const d = ngc10[1]; return { company: "NGC", display: `${d.slice(0, 7)}-${d.slice(7)}`, normalized: d }; }
  const pcgs = t.match(/\b(?:PCGS|PCCS|PC GS)\s*.{0,30}?\b(\d{8})\b/i);
  if (pcgs) return { company: "PCGS", display: pcgs[1], normalized: pcgs[1] };
  const pcgs8 = t.match(/\b([48]\d{7})\b/);
  if (pcgs8 && /\b(?:MS|PF|PR|SP|AU|XF|VF|UNC)\s*\d{2}\b/i.test(t))
    return { company: "PCGS", display: pcgs8[1], normalized: pcgs8[1] };
  return null;
}

// ── Phase 1: Scrape list pages (in-sale items with full data) ──
async function scrapeListPages() {
  console.log("--- Phase 1: List pages ---");
  const existingUrls = new Set(
    database.prepare("SELECT detail_url FROM box_sales WHERE platform = '易金在线' AND detail_url IS NOT NULL").all().map((r) => r.detail_url)
  );
  console.log(`Existing 易金 online records: ${existingUrls.size}`);

  const insert = database.prepare(`
    INSERT OR IGNORE INTO box_sales
    (normalized_box_code, display_box_code, grading_company, grade, coin_name,
     platform, platform_product_id, detail_url, official_cert_url, price,
     transacted_at, product_code, evidence_image_url, ocr_text, ocr_confidence,
     verification_status, collected_at, evidence_note)
    VALUES (?, ?, ?, ?, ?, '易金在线', ?, ?, '', ?,
            ?, '', '', '', 0,
            ?, datetime('now'), '易金在线在售商品')
  `);

  let totalNew = 0;

  for (let page = 1; page <= 50; page++) {
    try {
      const url = `https://www.yjzx.com/web2020/material/list.html?page=${page}`;
      const resp = await fetch(url, {
        headers: { "user-agent": "Quanzhi/0.5" },
        signal: AbortSignal.timeout(15000),
      });
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const html = await resp.text();
      const $ = load(html);

      const toInsert = [];
      $("a[href*='detail/']").each((_, el) => {
        const a = $(el);
        const title = clean(a.attr("title") || a.text());
        const href = a.attr("href");
        if (!href || !title || title === "大卖场" || title === "料价币" || title === "求购") return;
        const detailUrl = new URL(href, "https://www.yjzx.com").toString();
        if (existingUrls.has(detailUrl)) return;

        // Find price and time in surrounding text
        const parentText = clean(a.closest("li, .item, .list-item, tr, div").text());
        const priceMatch = parentText.match(/[￥¥]\s*([0-9,]+(?:\.\d+)?)/);
        const timeMatch = parentText.match(/(20\d{2}[-/]\d{2}[-/]\d{2})/);

        const box = extractBoxFromTitle(title);
        const id = href.match(/detail\/(\d+)\.html/)?.[1] ?? href;

        toInsert.push({
          normalized_box_code: box ? box.normalized : `yj_${id}`,
          display_box_code: box ? box.display : "无盒号",
          grading_company: box ? box.company : "UNKNOWN",
          grade: "未标注",
          coin_name: title.slice(0, 300),
          url: detailUrl,
          platform_id: href.replace(/^.*detail\//, "").replace(/\.html$/, "").slice(0, 100),
          price: priceMatch ? Number(priceMatch[1].replace(/,/g, "")) : 0,
          transactedAt: timeMatch ? timeMatch[1] : null,
        });
      });

      if (toInsert.length === 0) {
        console.log(`  Page ${page}: 0 items, stopping pagination`);
        break;
      }

      database.exec("BEGIN IMMEDIATE");
      try {
        for (const r of toInsert) {
          const now = new Date().toISOString().slice(0, 19).replace("T", " ");
          insert.run(
            r.normalized_box_code, r.display_box_code, r.grading_company,
            r.grade, r.coin_name, r.platform_id, r.url, r.price,
            r.transactedAt || now, "active_listing"
          );
          existingUrls.add(r.url);
        }
        database.exec("COMMIT");
        totalNew += toInsert.length;
        console.log(`  Page ${page}: ${toInsert.length} new (total: ${totalNew})`);
      } catch (e) {
        database.exec("ROLLBACK");
        throw e;
      }
    } catch (e) {
      console.log(`  Page ${page}: error (${e.message.slice(0, 60)})`);
      break;
    }
    await new Promise((r) => setTimeout(r, DELAY_MS));
  }
  console.log(`List phase done: ${totalNew} new records`);
  return totalNew;
}

// ── Phase 2: Keyword search for coin summaries ──
// Search results contain coin names with NGC/PCGS price references
// We insert these as price reference records
async function scrapeSearchResults() {
  console.log("\n--- Phase 2: Search results ---");
  const existingUrls = new Set(
    database.prepare("SELECT detail_url FROM box_sales WHERE platform = '易金在线' AND detail_url IS NOT NULL").all().map((r) => r.detail_url)
  );

  const insert = database.prepare(`
    INSERT OR IGNORE INTO box_sales
    (normalized_box_code, display_box_code, grading_company, grade, coin_name,
     platform, platform_product_id, detail_url, official_cert_url, price,
     transacted_at, product_code, evidence_image_url, ocr_text, ocr_confidence,
     verification_status, collected_at, evidence_note)
    VALUES (?, ?, ?, ?, ?, '易金在线', ?, ?, '', ?,
            ?, '', '', '', 0,
            'yijin_price_ref', datetime('now'), '易金在线价格参考')
  `);

  let totalNew = 0;
  const seenCoins = new Set();

  for (let i = 0; i < KEYWORDS.length; i++) {
    const kw = KEYWORDS[i];
    try {
      const url = `https://www.yjzx.com/web2020/search/speed/history?status=3&searchFlag=2&query=${encodeURIComponent(kw)}`;
      const resp = await fetch(url, {
        headers: { "user-agent": "Quanzhi/0.5" },
        signal: AbortSignal.timeout(15000),
      });
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const html = await resp.text();

      // Extract coin names from search results
      const coinNames = [...new Set(
        (html.match(/[\d]{4}年[^<]{2,40}币/g) || [])
          .map(s => clean(s.replace(/<[^>]+>/g, "")))
          .filter(s => s.length > 5 && s.length < 100)
      )];

      const toInsert = [];
      for (const coinName of coinNames) {
        if (seenCoins.has(coinName)) continue;
        seenCoins.add(coinName);

        // Find associated prices for this coin
        const priceIdx = html.indexOf(coinName);
        const context = html.slice(priceIdx, priceIdx + 500);
        const prices = context.match(/[￥¥]\s*([0-9,]+)/g) || [];
        const price = prices.length > 0
          ? Number(prices[0].replace(/[￥¥,\s]/g, ""))
          : 0;

        const slug = `yjcoin_${coinName.slice(0, 10)}_${Math.random().toString(36).slice(2, 8)}`;
        toInsert.push({
          normalized_box_code: slug,
          display_box_code: "无盒号",
          grading_company: "UNKNOWN",
          grade: "未标注",
          coin_name: coinName,
          url: url,
          platform_id: slug.slice(0, 100),
          price,
          transactedAt: null,
        });
      }

      if (toInsert.length > 0) {
        database.exec("BEGIN IMMEDIATE");
        try {
          for (const r of toInsert) {
            const now = new Date().toISOString().slice(0, 19).replace("T", " ");
            insert.run(
              r.normalized_box_code, r.display_box_code, r.grading_company,
              r.grade, r.coin_name, r.platform_id, r.url, r.price,
              r.transactedAt || now
            );
          }
          database.exec("COMMIT");
          totalNew += toInsert.length;
        } catch (e) {
          database.exec("ROLLBACK");
          throw e;
        }
      }

      if ((i + 1) % 30 === 0 || i === KEYWORDS.length - 1) {
        const dbTotal = database.prepare("SELECT COUNT(*) c FROM box_sales").get().c;
        console.log(`  [${i + 1}/${KEYWORDS.length}] ${kw}: ${coinNames.length} coins, +${toInsert.length} new (DB: ${dbTotal})`);
      }
    } catch (e) {
      if ((i + 1) % 30 === 0 || i < 3) console.log(`  [${i + 1}/${KEYWORDS.length}] ${kw}: err (${e.message.slice(0, 50)})`);
    }
    if (i < KEYWORDS.length - 1) await new Promise((r) => setTimeout(r, DELAY_MS));
  }
  console.log(`Search phase done: ${totalNew} new coin refs`);
  return totalNew;
}

async function main() {
  const startCount = database.prepare("SELECT COUNT(*) c FROM box_sales").get().c;
  console.log(`易金在线 mass scrape — DB start: ${startCount}\n`);

  const listNew = await scrapeListPages();
  const searchNew = await scrapeSearchResults();

  const endCount = database.prepare("SELECT COUNT(*) c FROM box_sales").get().c;
  console.log(`\n易金 Done! List: ${listNew}, Search: ${searchNew}, Total new: ${listNew + searchNew}`);
  console.log(`DB: ${startCount} → ${endCount}`);
}

main().catch(console.error);
