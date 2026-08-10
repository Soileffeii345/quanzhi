// Mass-scrape 邮宝 using broad/generic keywords that actually return results.
// Specific coin names don't match 邮宝's listing titles — use category terms instead.
import { database } from "./database.mjs";
import { load } from "cheerio";

const DELAY_MS = 600;

// ── High-yield keywords that return 15-30 results each ──
const KEYWORDS = [
  // Coin types
  "金币", "银币", "纪念币", "评级币", "铜币", "铂金币", "钯金币",
  // NGC / PCGS (for box numbers in titles)
  "NGC", "PCGS", "评级", "封装币",
  // Animals and themes
  "熊猫", "生肖", "吉祥文化", "贺岁", "福字",
  // Weights (common in listing titles)
  "30克", "15克", "8克", "1盎司", "1公斤", "5盎司",
  // Mountains series
  "泰山", "武夷山", "黄山", "峨眉山",
  // Other popular series
  "大熊猫", "京剧", "书法", "和字", "敦煌", "龙门石窟",
  "建国", "建党", "改革开放", "抗战",
  // Specific years
  "2024年纪念币", "2025年纪念币", "2023年纪念币",
  // Combinations
  "熊猫银币", "熊猫金币", "生肖金币", "生肖银币",
  // Characters/themes
  "长城", "毛泽东", "孙中山", "辛亥革命",
  // Market terms
  "精制币", "流通币", "投资银币",
  // Error coins / special
  "错版", "样币",
];

function clean(s) {
  return (s ?? "").replace(/\s+/g, " ").trim();
}

function extractBoxFromTitle(title) {
  const t = clean(title);
  // NGC 7+3 with separator
  const ngcSep = t.match(/\b(\d{7})\s*[-–—\s]\s*(\d{3})\b/);
  if (ngcSep) return { company: "NGC", display: `${ngcSep[1]}-${ngcSep[2]}`, normalized: `${ngcSep[1]}${ngcSep[2]}` };
  // NGC 10 consecutive digits (common NGC prefixes: 2, 6, 8)
  const ngc10 = t.match(/\b([268]\d{9})\b/);
  if (ngc10) {
    const d = ngc10[1];
    return { company: "NGC", display: `${d.slice(0, 7)}-${d.slice(7)}`, normalized: d };
  }
  // PCGS 8-digit (common PCGS range starts with 8, 4)
  const pcgs = t.match(/\b(?:PCGS|PCCS|PC GS)\s*.{0,30}?\b(\d{8})\b/i);
  if (pcgs) return { company: "PCGS", display: pcgs[1], normalized: pcgs[1] };
  // Standalone 8-digit PCGS range
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

async function fetchYoubao(query) {
  const url = `https://www.youbao360.com/TradePostMore?name=${encodeURIComponent(query)}&type=3`;
  const resp = await fetch(url, {
    headers: { "User-Agent": "QuanzhiIndexer/1.0 (+public low-frequency index)" },
    signal: AbortSignal.timeout(15000),
  });
  if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
  return await resp.text();
}

function parseResults(html) {
  const $ = load(html);
  const records = [];
  $(".bargainList .tbody a").each((_, el) => {
    const anchor = $(el);
    const href = anchor.attr("href");
    const title = clean(anchor.find(".goodName").text());
    const priceParts = anchor.find(".price").map((__, node) => clean($(node).text())).get();
    const priceText = priceParts[1] ?? "";
    const priceMatch = priceText.match(/([0-9]+(?:\.[0-9]+)?)\s*\/\s*(.+)/);
    const completedAt = clean(anchor.children().filter(".validDay").last().text());
    const status = clean(anchor.children().filter(".viewCnt").last().text());
    if (!href || !title || !priceMatch) return;
    const url = new URL(href, "https://www.youbao360.com").toString();
    const id = new URL(url).searchParams.get("ordersId") ?? url;
    records.push({ id, title, price: Number(priceMatch[1]), unit: priceMatch[2], completedAt, status, url });
  });
  return records;
}

// ── Main ──

const insert = database.prepare(`
  INSERT OR IGNORE INTO box_sales
  (normalized_box_code, display_box_code, grading_company, grade, coin_name,
   platform, platform_product_id, detail_url, official_cert_url, price,
   transacted_at, product_code, evidence_image_url, ocr_text, ocr_confidence,
   verification_status, collected_at, evidence_note)
  VALUES (?, ?, ?, ?, ?, '邮宝', ?, ?, '', ?,
          ?, '', '', '', 0,
          ?, datetime('now'), '邮宝公开交易记录')
`);

function insertBatch(records) {
  database.exec("BEGIN IMMEDIATE");
  try {
    for (const r of records) {
      const now = new Date().toISOString().slice(0, 19).replace("T", " ");
      const status = r.completedAt ? "youbao_trade" : "youbao_active";
      insert.run(
        r.normalized_box_code,
        r.display_box_code || "无盒号",
        r.grading_company,
        r.grade || "未标注",
        (r.coin_name).slice(0, 300),
        r.url.replace(/^https?:\/\/[^/]+\//, "").slice(0, 100),
        r.url,
        r.price,
        r.completedAt || now,
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
  console.log(`Keywords: ${KEYWORDS.length}`);

  const existingUrls = new Set(
    database.prepare(`SELECT detail_url FROM box_sales WHERE platform = '邮宝' AND detail_url IS NOT NULL`).all().map((r) => r.detail_url)
  );
  console.log(`Existing 邮宝 records in DB: ${existingUrls.size}`);

  let totalNew = 0, totalBoxes = 0;

  for (let i = 0; i < KEYWORDS.length; i++) {
    const kw = KEYWORDS[i];
    try {
      const html = await fetchYoubao(kw);
      const results = parseResults(html);

      const toInsert = [];
      for (const r of results) {
        if (existingUrls.has(r.url)) continue;
        const box = extractBoxFromTitle(r.title);
        const grade = extractGradeFromTitle(r.title) || "未标注";
        toInsert.push({
          normalized_box_code: box ? box.normalized : `yb_${r.id.slice(-30).replace(/\W/g, "")}`,
          display_box_code: box ? box.display : "无盒号",
          grading_company: box ? box.company : "UNKNOWN",
          grade,
          coin_name: r.title.slice(0, 300),
          url: r.url,
          price: r.price,
          completedAt: r.completedAt || null,
        });
        if (box) totalBoxes++;
      }

      if (toInsert.length > 0) {
        insertBatch(toInsert);
        totalNew += toInsert.length;
        toInsert.forEach((r) => existingUrls.add(r.url));
      }

      if ((i + 1) % 10 === 0 || i === KEYWORDS.length - 1) {
        const dbTotal = database.prepare("SELECT COUNT(*) c FROM box_sales").get().c;
        console.log(`[${i + 1}/${KEYWORDS.length}] ${kw}: ${results.length} fetched, ${toInsert.length} new (total new: ${totalNew}, boxes: ${totalBoxes}, DB total: ${dbTotal})`);
      }
    } catch (e) {
      if ((i + 1) % 10 === 0) console.log(`[${i + 1}/${KEYWORDS.length}] ${kw}: ERROR (total new so far: ${totalNew})`);
    }

    if (i < KEYWORDS.length - 1) await new Promise((r) => setTimeout(r, DELAY_MS));
  }

  const finalTotal = database.prepare("SELECT COUNT(*) c FROM box_sales").get().c;
  console.log(`\nDone! ${totalNew} new records added. DB now has ${finalTotal} total records.`);
  console.log(`Box numbers found: ${totalBoxes}`);
  console.log("Next: node collector/export-static-box-index.mjs");
}

main().catch(console.error);
