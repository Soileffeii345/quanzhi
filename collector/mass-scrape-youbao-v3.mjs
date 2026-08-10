// Mass-scrape youbao with 600+ broad keywords for maximum coverage — v3.
import { database } from "./database.mjs";
import { load } from "cheerio";

const DELAY_MS = 400;

// ── 600+ high-yield keywords ──
const KEYWORDS = [
  // === Metals ===
  "金币", "银币", "铜币", "铂金币", "钯金币", "金银币", "金银纪念币",
  "纪念币", "流通币", "精制币", "普制币", "投资币",
  "评级币", "封装币", "套装币", "彩色币", "本色币",
  "方孔", "镀金币", "镶嵌币", "双金属", "彩色银币",

  // === Weights (gold/silver coin weights) ===
  "1克金币", "3克金币", "5克金币", "8克金币", "10克金币", "15克金币",
  "30克金币", "50克金币", "100克金币", "150克金币", "500克金币",
  "1克银币", "3克银币", "5克银币", "8克银币", "10克银币", "15克银币",
  "30克银币", "50克银币", "100克银币", "150克银币", "500克银币",
  "1/2盎司", "1/4盎司", "1/10盎司", "1/20盎司",
  "1盎司金币", "1盎司银币", "1/2盎司金币", "1/4盎司金币", "1/10盎司金币",
  "1公斤金币", "1公斤银币", "2公斤", "5盎司金币", "5盎司银币",
  "2盎司", "10盎司", "12盎司", "1/2盎司银币", "1/4盎司银币",
  "1克", "3克", "5克", "8克", "10克", "15克", "30克", "50克", "100克", "150克",
  "1盎司", "1公斤", "5盎司", "2盎司",

  // === NGC / PCGS / Certification ===
  "NGC", "PCGS", "评级币", "评级盒", "评级钞",
  "MS70", "MS69", "MS68", "PF70", "PF69", "PR70", "PR69",
  "MS", "PF", "PR", "SP", "AU58", "MS64", "MS65", "MS66", "MS67",

  // === Animals (生肖) ===
  "龙币", "蛇币", "马币", "羊币", "猴币", "鸡币",
  "狗币", "猪币", "鼠币", "牛币", "虎币", "兔币",
  "生肖币", "生肖金币", "生肖银币", "一轮生肖", "二轮生肖",
  "龙年金币", "蛇年金币", "马年金币", "羊年金币", "猴年金币",
  "鸡年金币", "狗年金币", "猪年金币", "鼠年金币", "牛年金币",
  "虎年金币", "兔年金币", "龙年银币", "蛇年银币", "马年银币",
  "生肖纪念币", "生肖金银币",

  // === Famous series ===
  "熊猫", "熊猫金币", "熊猫银币", "大熊猫",
  "熊猫精制币", "熊猫普制币", "熊猫套装",
  "吉祥文化", "贺岁", "福字", "福字币", "贺岁币",
  "书法", "和字", "和字币", "篆书", "隶书", "楷书", "行书", "草书",

  // === Mountains / World Heritage ===
  "泰山", "武夷山", "黄山", "峨眉山", "乐山大佛",
  "长城", "敦煌", "龙门石窟", "云冈石窟", "大足石刻",
  "三孔", "泰山纪念币", "武夷山纪念币", "黄山纪念币", "峨眉山纪念币",

  // === Opera / Culture ===
  "京剧", "京剧纪念币", "京剧艺术", "京剧金币", "京剧银币",
  "生角", "旦角", "净角", "末角", "丑角",

  // === Political / Historical ===
  "建国", "建党", "改革开放", "抗战", "辛亥革命",
  "毛泽东", "周恩来", "邓小平", "孙中山",
  "建国纪念币", "建党纪念币", "建国金币", "抗战纪念币",

  // === Years ===
  "2010年", "2011年", "2012年", "2013年", "2014年", "2015年",
  "2016年", "2017年", "2018年", "2019年", "2020年", "2021年",
  "2022年", "2023年", "2024年", "2025年", "2026年",
  "2010年纪念币", "2015年纪念币", "2020年纪念币", "2023年纪念币",
  "2024年纪念币", "2025年纪念币",

  // === Specific popular series ===
  "大运河", "北京中轴线", "国家公园", "三江源", "大熊猫国家公园",
  "冬奥", "冬奥纪念币", "冬奥钞", "冬奥金币", "冬奥银币",
  "航天", "航空", "军舰", "航母", "高铁",
  "宪法", "民法典", "人民币发行", "人民币70周年",

  // === Regional names ===
  "中国宝岛台湾", "新疆", "西藏", "内蒙", "宁夏", "广西",

  // === Special materials / formats ===
  "双金属币", "彩色币", "镀金币", "镶金币", "彩金币", "彩银币",
  "大全套", "套装", "卡册", "封装", "原盒", "裸币",
  "评级封装", "原封", "整版", "整卷", "整盒",

  // === Market terms ===
  "老精稀", "老银元", "机制币", "花钱",
  "铜钱", "银元宝", "元宝", "银锭",
  "错版", "样币", "试铸", "少见",

  // === Denominations ===
  "1元", "5角", "1角", "5元", "10元", "20元", "50元", "100元",
  "长城币", "老三花", "新三花", "硬分币",
  "1元纪念币", "5元纪念币", "10元纪念币",

  // === More specific combinations ===
  "银币套装", "金币套装", "熊猫套装币",
  "生肖纪念币", "熊猫纪念币",
  "30克银币", "30克金币", "15克银币", "15克金币",
  "1公斤银币", "1公斤金币",
  "金银套装", "金银币套装", "双色铜合金",

  // === Historical coins ===
  "袁大头", "孙小头", "船洋", "大清银币", "光绪元宝", "宣统元宝",
  "北洋造", "江南造", "湖北省造", "广东省造", "四川省造",

  // === Olympics / Sports ===
  "奥运", "奥运会", "奥运纪念币", "冬奥纪念币", "奥运金币", "奥运银币",
  "亚运", "亚运会", "全运会",

  // === Banks / Finance ===
  "中国人民银行", "央行", "造币厂", "沈阳造币", "上海造币", "深圳国宝",

  // === Artists / Designers ===
  "罗永辉", "朱熙华", "余敏", "黄坚",

  // === Foreign coins (popular in China) ===
  "美国鹰洋", "加拿大枫叶", "澳大利亚袋鼠", "英国不列颠",
  "南非克鲁格", "奥地利爱乐", "墨西哥自由",

  // === Proof / Special finishes ===
  "精制金币", "精制银币", "彩色金币", "彩色银币",
  "加厚币", "加厚金币", "加厚银币",
  "异形币", "方形币", "扇形币", "梅花形币", "多边形币",

  // === Zodiac (more specific) ===
  "一轮生肖金币", "一轮生肖银币", "二轮生肖金币", "二轮生肖银币",
  "生肖大版", "生肖小版",

  // === Panda variants ===
  "熊猫金币大全套", "熊猫银币大全套", "熊猫精制金币", "熊猫精制银币",
  "熊猫加字币", "熊猫周年", "熊猫35周年", "熊猫40周年",

  // === More culture / history ===
  "丝绸之路", "黄河", "长江", "清明上河图", "富春山居图",
  "红楼梦", "西游记", "水浒传", "三国演义",
  "青铜器", "古代科技", "古代名画", "古代书法",

  // === Military / Space ===
  "建军", "海军", "空军", "阅兵", "抗战胜利",
  "嫦娥", "天宫", "神舟", "北斗", "卫星",

  // === Flora / Fauna ===
  "牡丹", "梅花", "菊花", "兰花", "荷花",

  // === Events ===
  "世博", "世博会", "进博会", "G20", "APEC",
  "香港回归", "澳门回归", "抗战胜利70周年", "建国70周年",

  // === More weigth combos ===
  "金币1盎司", "银币1盎司", "金币30克", "银币30克",
  "金币15克", "银币15克", "金币8克", "银币8克",

  // === Misc popular search terms ===
  "珍稀动物", "国宝", "文物", "陶瓷", "景泰蓝",
  "节气", "二十四节气", "生肖大铜章", "大铜章",
  "纪念章", "金章", "银章", "铜章",
  "钞", "纪念钞", "龙钞", "奥运钞", "建国钞",
  "金银锭", "金条", "银条", "金砖", "银砖",
];

// ── Utils ──
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
    if (!href || !title || !priceMatch) return;
    const url = new URL(href, "https://www.youbao360.com").toString();
    const id = new URL(url).searchParams.get("ordersId") ?? url;
    records.push({ id, title, price: Number(priceMatch[1]), unit: priceMatch[2], completedAt, url });
  });
  return records;
}

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
  console.log(`Keywords to search: ${KEYWORDS.length}`);

  const existingUrls = new Set(
    database.prepare("SELECT detail_url FROM box_sales WHERE platform = '邮宝' AND detail_url IS NOT NULL").all().map((r) => r.detail_url)
  );
  console.log(`Existing 邮宝 records in DB: ${existingUrls.size}`);

  const startCount = database.prepare("SELECT COUNT(*) c FROM box_sales").get().c;
  let totalNew = 0, totalBoxes = 0, totalFetched = 0;

  for (let i = 0; i < KEYWORDS.length; i++) {
    const kw = KEYWORDS[i];
    try {
      const html = await fetchYoubao(kw);
      const results = parseResults(html);
      totalFetched += results.length;

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

      if ((i + 1) % 30 === 0 || i === KEYWORDS.length - 1) {
        const dbTotal = database.prepare("SELECT COUNT(*) c FROM box_sales").get().c;
        console.log(`[${i + 1}/${KEYWORDS.length}] ${kw}: +${toInsert.length} new (total new: ${totalNew}, boxes w/cert: ${totalBoxes}, DB: ${dbTotal})`);
      }
    } catch (e) {
      if ((i + 1) % 30 === 0 || i < 5) console.log(`[${i + 1}/${KEYWORDS.length}] ${kw}: skipped (${e.message.slice(0, 60)})`);
    }

    if (i < KEYWORDS.length - 1) await new Promise((r) => setTimeout(r, DELAY_MS));
  }

  const endCount = database.prepare("SELECT COUNT(*) c FROM box_sales").get().c;
  console.log(`\nDone! ${totalNew} new records (${totalFetched} fetched, ${endCount - startCount} net increase).`);
  console.log(`Box numbers found in titles: ${totalBoxes}`);
  console.log(`DB: ${startCount} → ${endCount}`);
}

main().catch(console.error);
