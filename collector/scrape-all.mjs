// ALL-IN-ONE: scrape all 3 platforms with maximum keywords. One run to rule them all.
import { database } from "./database.mjs";
import { load } from "cheerio";

const DELAY = 350; // ms between requests

// ═══════════════════════════════════════════
// Generate 邮宝 keywords: systematic combination of all useful terms
// ═══════════════════════════════════════════
function generateYoubaoKeywords() {
  const metals = ["金币","银币","铜币","铂金币","钯金币","纪念币","流通币","精制币","普制币",
    "投资币","评级币","封装币","彩色币","本色币","方孔","镀金币","镶嵌币","双金属","彩银币",
    "金银币","金银纪念币","彩金币"];
  const weights = ["1克","3克","5克","8克","10克","15克","30克","50克","100克","150克",
    "500克","1盎司","1/2盎司","1/4盎司","1/10盎司","1/20盎司","1公斤","2公斤","5盎司","2盎司"];
  const types = ["纪念币","金币","银币"];
  const years = Array.from({length: 17}, (_, i) => (2010 + i).toString() + "年");
  const animals = ["龙","蛇","马","羊","猴","鸡","狗","猪","鼠","牛","虎","兔"];
  const series = [
    // Mountains
    "泰山","武夷山","黄山","峨眉山","乐山大佛","长城","敦煌","龙门石窟","云冈石窟","大足石刻","三孔",
    // Culture
    "京剧","书法","和字","篆书","隶书","楷书","行书","草书","吉祥文化","贺岁","福字",
    // Politics
    "建国","建党","改革开放","抗战","辛亥革命","毛泽东","周恩来","邓小平","孙中山",
    // Money
    "人民币","央行","长城币","老三花","新三花","硬分币",
    // More
    "大运河","北京中轴线","国家公园","三江源","冬奥","航天","航空","军舰","航母","高铁",
    "宪法","民法典",
    // Historical coins
    "袁大头","孙小头","船洋","大清银币","光绪元宝","宣统元宝",
    "北洋造","江南造","湖北省造","广东省造","四川省造",
    // Olympics
    "奥运","亚运","全运会",
    // Artists
    "罗永辉","朱熙华","余敏","黄坚",
    // Foreign
    "美国鹰洋","加拿大枫叶","澳大利亚袋鼠","英国不列颠","南非克鲁格","奥地利爱乐","墨西哥自由",
    // Culture/history
    "丝绸之路","黄河","长江","清明上河图","富春山居图","红楼梦","西游记","水浒传","三国演义",
    "青铜器","古代科技","古代名画","古代书法",
    // Military
    "建军","海军","空军","阅兵",
    // Space
    "嫦娥","天宫","神舟","北斗","卫星",
    // Flora
    "牡丹","梅花","菊花","兰花","荷花",
    // Events
    "世博","进博会","G20","APEC","香港回归","澳门回归",
    // More
    "珍稀动物","国宝","文物","陶瓷","景泰蓝","节气","二十四节气",
    "大铜章","纪念章","金章","银章","铜章",
    "纪念钞","龙钞","奥运钞","建国钞",
    "金银锭","金条","银条","金砖","银砖",
    // Specific NGC/PCGS
    "NGC","PCGS","评级币","评级盒","评级钞",
    "MS70","MS69","MS68","MS67","MS66","MS65","MS64",
    "PF70","PF69","PR70","PR69","AU58","SP69","SP70",
    // Denominations
    "1元","5角","1角","5元","10元","20元","50元","100元",
    // Market terms
    "老精稀","老银元","机制币","花钱","铜钱","银元宝","元宝","银锭",
    "错版","样币","试铸","少见","裸币","原盒","原封","整版","整卷","整盒",
    // More formats
    "精制金币","精制银币","彩色金币","彩色银币",
    "加厚币","加厚金币","加厚银币",
    "异形币","方形币","扇形币","梅花形币","多边形币",
    "大全套","套装","卡册","封装",
    "双金属币","镀金币","镶金币",
    // Zodiac combos
    "一轮生肖","二轮生肖","生肖币","生肖金币","生肖银币","生肖纪念币","生肖金银币",
    // Panda variants
    "熊猫","熊猫金币","熊猫银币","大熊猫","熊猫精制币","熊猫普制币","熊猫套装",
    "熊猫精制金币","熊猫精制银币","熊猫加字币","熊猫周年","熊猫35周年","熊猫40周年",
    // Special combos
    "30克银币","30克金币","15克银币","15克金币","1公斤银币","1公斤金币",
    "金银套装","金银币套装","双色铜合金",
    "1盎司金币","1盎司银币","1/2盎司金币","1/4盎司金币","1/10盎司金币",
    "1/2盎司银币","1/4盎司银币","1/10盎司银币","5盎司金币","5盎司银币",
  ];

  const combos = [];
  // Year × type
  for (const y of years) for (const t of types) combos.push(y + t);
  // Animal × type
  for (const a of animals) { combos.push(a+"年纪念币"); combos.push(a+"年金币"); combos.push(a+"年银币"); }
  // Weight × metal (key ones)
  for (const w of ["30克","15克","8克","1盎司","1公斤","5盎司"]) {
    for (const m of ["金币","银币"]) combos.push(w + m);
  }
  // Year + weight + metal (key combos)
  for (const y of years.slice(-5)) {
    for (const w of ["30克","15克","8克","1盎司"]) {
      for (const m of ["金币","银币"]) combos.push(y + w + m);
    }
  }

  const all = [...new Set([...metals, ...weights, ...series, ...combos, "熊猫1盎司金币","熊猫1盎司银币","熊猫30克金币","熊猫30克银币","熊猫15克金币","熊猫15克银币","熊猫1/2盎司金币","熊猫1/4盎司金币","熊猫1/10盎司金币","熊猫1/2盎司银币","生肖龙金币","生肖蛇金币","生肖马金币","生肖羊金币","生肖猴金币","生肖鸡金币","生肖狗金币","生肖猪金币","生肖鼠金币","生肖牛金币","生肖虎金币","生肖兔金币","生肖龙银币","生肖蛇银币","生肖马银币","生肖羊银币","生肖猴银币","生肖鸡银币","生肖狗银币","生肖猪银币","生肖鼠银币","生肖牛银币","生肖虎银币","生肖兔银币","京剧生角","京剧旦角","京剧净角","京剧末角","京剧丑角","吉祥文化金银币","贺岁纪念币","福字金币","福字银币","泰山纪念币","武夷山纪念币","黄山纪念币","峨眉山纪念币","建国纪念币","建党纪念币","建国金币","建党金币","抗战纪念币","改革开放纪念币","辛亥革命纪念币","大运河纪念币","国家公园纪念币","冬奥纪念币","冬奥钞","冬奥金币","冬奥银币","航天纪念币","航母纪念币","袁大头银元","孙小头银元","船洋银元","大清银币宣统","光绪元宝银币","北洋造光绪","江南造光绪","湖北省造光绪","广东省造光绪","四川省造光绪","云南造光绪","奉天造光绪","吉林造光绪"])];
  return all;
}

function generateZhaoKeywords() {
  return [
    "金币","银币","铜币","铂金币","钯金币","纪念币","流通币","精制币","普制币",
    "评级币","封装币","彩色币","金银币","双金属币",
    "1克金币","3克金币","5克金币","8克金币","10克金币","15克金币","30克金币","50克金币","100克金币",
    "1盎司金币","1/2盎司金币","1/4盎司金币","1/10盎司金币","1公斤金币","5盎司金币",
    "1克银币","3克银币","5克银币","8克银币","10克银币","15克银币","30克银币","50克银币","100克银币",
    "1盎司银币","1公斤银币","5盎司银币",
    "NGC","PCGS","MS70","MS69","MS68","PF70","PF69","PR70","PR69",
    "熊猫金币","熊猫银币","大熊猫","熊猫精制币",
    "生肖金币","生肖银币","生肖纪念币",
    "龙年金币","蛇年金币","马年金币","羊年金币","猴年金币","鸡年金币",
    "狗年金币","猪年金币","鼠年金币","牛年金币","虎年金币","兔年金币",
    "吉祥文化","贺岁币","福字币","书法币","和字币",
    "泰山币","武夷山","黄山币","峨眉山",
    "京剧纪念币","京剧金币","京剧银币",
    "建国币","建党币","改革开放","抗战币",
    "大运河","国家公园","冬奥币","航天币",
    "2010年金币","2011年金币","2012年金币","2013年金币","2014年金币","2015年金币",
    "2016年金币","2017年金币","2018年金币","2019年金币","2020年金币","2021年金币",
    "2022年金币","2023年金币","2024年金币","2025年金币",
    "2010年银币","2015年银币","2020年银币",
    "1元纪念币","5元纪念币","10元纪念币","50元纪念币","100元纪念币",
    "长城币","老三花","新三花",
    "袁大头","孙小头","船洋","大清银币","光绪元宝",
    "北洋造","江南造","湖北省造","广东省造","四川省造",
    "美国鹰洋","加拿大枫叶","澳大利亚袋鼠","英国不列颠",
    "精制金币","精制银币","彩色金币","彩色银币",
    "方形币","扇形币","梅花形币","加厚币",
    "金章","银章","铜章","纪念章","大铜章",
    "纪念钞","龙钞","奥运钞","建国钞",
    "熊猫35周年","熊猫40周年","一轮生肖","二轮生肖",
    "毛泽东","周恩来","邓小平","孙中山",
    "香港回归","澳门回归","世博",
    "老精稀","老银元","机制币","花钱","样币",
    "丝绸之路","古代科技","古代名画",
    "建军","海军","空军",
    "麒麟","龙凤","珍稀动物",
    "沈阳造币","上海造币","深圳国宝",
    "错版","试铸",
    // Year + coin combos
    ...Array.from({length: 16}, (_, i) => (2010+i)+"年熊猫金币"),
    ...Array.from({length: 16}, (_, i) => (2010+i)+"年熊猫银币"),
  ];
}

function generateYijinKeywords() {
  return [
    "金币","银币","铜币","铂金币","钯金币","纪念币",
    "评级币","封装币","NGC","PCGS","MS70","MS69","PF70",
    "1盎司金币","1盎司银币","1/2盎司金币","1/4盎司金币","1/10盎司金币",
    "30克金币","15克金币","8克金币","50克金币","100克金币",
    "30克银币","15克银币","1公斤银币","1公斤金币","5盎司金币","5盎司银币",
    "熊猫金币","熊猫银币","大熊猫","熊猫精制币",
    "生肖金币","生肖银币","生肖纪念币",
    "龙年金币","蛇年金币","马年金币","羊年金币","猴年金币",
    "鸡年金币","狗年金币","猪年金币","鼠年金币","牛年金币","虎年金币","兔年金币",
    "龙年银币","蛇年银币","马年银币","羊年银币",
    "吉祥文化","贺岁币","福字币","书法币","和字币",
    "泰山币","武夷山","黄山币","峨眉山",
    "京剧纪念币","京剧金币",
    "建国币","建党币","改革开放","抗战",
    "2010年","2011年","2012年","2013年","2014年","2015年","2016年",
    "2017年","2018年","2019年","2020年","2021年","2022年","2023年","2024年","2025年","2026年",
    "袁大头","孙小头","船洋","大清银币","光绪元宝","北洋造","江南造",
    "美国鹰洋","加拿大枫叶","澳大利亚袋鼠","英国不列颠",
    "1元纪念币","5元纪念币","10元纪念币","50元纪念币",
    "长城币","老三花","新三花",
    "冬奥币","冬奥钞","航天币","航母","高铁",
    "金章","银章","纪念章","纪念钞","龙钞","奥运钞","建国钞",
    "一轮生肖","二轮生肖","毛泽东","周恩来","孙中山",
    "双金属币","加厚币","彩色金币","彩色银币",
    "精制金币","精制银币",
    "香港回归","澳门回归","世博",
    "大运河","国家公园","三江源",
    "方形币","扇形币","梅花形币",
    "丝绸之路","黄河","长江",
    "麒麟","龙凤","珍稀动物","国宝",
    "建军","海军","空军","嫦娥","神舟",
    "牡丹","梅花","兰花","荷花","菊花",
    "青铜器","古代科技","古代名画","古代书法","清明上河图",
    "红楼梦","西游记","水浒传","三国演义",
    "老精稀","老银元","机制币","花钱","样币","错版",
    "沈阳造币","上海造币","深圳国宝",
    "奥运","亚运",
    "金条","银条","金银锭",
    // Year combinations
    ...Array.from({length: 17}, (_, i) => (2010+i)+"年金币"),
    ...Array.from({length: 17}, (_, i) => (2010+i)+"年银币"),
    ...Array.from({length: 17}, (_, i) => (2010+i)+"年纪念币"),
    ...Array.from({length: 17}, (_, i) => (2010+i)+"年熊猫"),
    ...Array.from({length: 17}, (_, i) => (2010+i)+"年熊猫金币"),
    ...Array.from({length: 17}, (_, i) => (2010+i)+"年熊猫银币"),
  ];
}

// ═══════════════════════════════════════════
// Shared utils
// ═══════════════════════════════════════════
function clean(s) { return (s ?? "").replace(/\s+/g, " ").trim(); }

function extractBox(title) {
  const t = clean(title);
  const sep = t.match(/\b(\d{7})\s*[-–—\s]\s*(\d{3})\b/);
  if (sep) return { company: "NGC", display: `${sep[1]}-${sep[2]}`, normalized: `${sep[1]}${sep[2]}` };
  const n10 = t.match(/\b([268]\d{9})\b/);
  if (n10) { const d = n10[1]; return { company: "NGC", display: `${d.slice(0,7)}-${d.slice(7)}`, normalized: d }; }
  const pc = t.match(/\b(?:PCGS|PCCS|PC GS)\s*.{0,30}?\b(\d{8})\b/i);
  if (pc) return { company: "PCGS", display: pc[1], normalized: pc[1] };
  const p8 = t.match(/\b([48]\d{7})\b/);
  if (p8 && /\b(?:MS|PF|PR|SP|AU|XF|VF|UNC)\s*\d{2}\b/i.test(t))
    return { company: "PCGS", display: p8[1], normalized: p8[1] };
  return null;
}

function extractGrade(title) {
  const m = clean(title).match(/\b(?:PF|MS|PR|SP|AU|XF|VF|UNC)\s*\d{2}(?:\s*ULTRA\s*CAMEO)?\b/i);
  return m ? m[0].toUpperCase().replace(/\s+/g, " ") : null;
}

// ═══════════════════════════════════════════
// 邮宝 scraper
// ═══════════════════════════════════════════
async function scrapeYoubao(keywords) {
  console.log(`\n=== 邮宝: ${keywords.length} keywords ===`);
  const existing = new Set(
    database.prepare("SELECT detail_url FROM box_sales WHERE platform = '邮宝' AND detail_url IS NOT NULL").all().map(r => r.detail_url)
  );
  console.log(`Existing: ${existing.size}`);

  const stmt = database.prepare(
    "INSERT OR IGNORE INTO box_sales (normalized_box_code, display_box_code, grading_company, grade, coin_name, platform, platform_product_id, detail_url, official_cert_url, price, transacted_at, product_code, evidence_image_url, ocr_text, ocr_confidence, verification_status, collected_at, evidence_note) VALUES (?,?,?,?,?,'邮宝',?,?,'',?,?,'','','',0,?,datetime('now'),'邮宝公开交易记录')"
  );

  const start = database.prepare("SELECT COUNT(*) c FROM box_sales").get().c;
  let added = 0, boxes = 0;

  for (let i = 0; i < keywords.length; i++) {
    const kw = keywords[i];
    try {
      const resp = await fetch(`https://www.youbao360.com/TradePostMore?name=${encodeURIComponent(kw)}&type=3`, {
        headers: { "User-Agent": "QuanzhiIndexer/1.0" },
        signal: AbortSignal.timeout(15000),
      });
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const $ = load(await resp.text());
      const batch = [];

      $(".bargainList .tbody a").each((_, el) => {
        const a = $(el);
        const href = a.attr("href");
        const title = clean(a.find(".goodName").text());
        const prices = a.find(".price").map((__, n) => clean($(n).text())).get();
        const priceM = (prices[1] ?? "").match(/([0-9]+(?:\.[0-9]+)?)\s*\/\s*(.+)/);
        const date = clean(a.children().filter(".validDay").last().text());
        if (!href || !title || !priceM) return;
        const url = new URL(href, "https://www.youbao360.com").toString();
        if (existing.has(url)) return;
        const id = new URL(url).searchParams.get("ordersId") ?? url;
        const box = extractBox(title);
        const grade = extractGrade(title) || "未标注";
        batch.push({
          nbc: box ? box.normalized : `yb_${id.slice(-30).replace(/\W/g,"")}`,
          dbc: box ? box.display : "无盒号",
          gc: box ? box.company : "UNKNOWN",
          grade, cn: title.slice(0,300),
          pid: url.replace(/^https?:\/\/[^/]+\//,"").slice(0,100),
          url, price: Number(priceM[1]), date: date || null
        });
        if (box) boxes++;
      });

      if (batch.length > 0) {
        database.exec("BEGIN IMMEDIATE");
        try {
          for (const r of batch) {
            const now = new Date().toISOString().slice(0,19).replace("T"," ");
            stmt.run(r.nbc, r.dbc, r.gc, r.grade, r.cn, r.pid, r.url, r.price, r.date || now, r.date ? "youbao_trade" : "youbao_active");
            existing.add(r.url);
          }
          database.exec("COMMIT"); added += batch.length;
        } catch (e) { database.exec("ROLLBACK"); throw e; }
      }
      if ((i+1) % 50 === 0 || i === keywords.length-1) {
        const t = database.prepare("SELECT COUNT(*) c FROM box_sales").get().c;
        console.log(`[${i+1}/${keywords.length}] ${kw}: +${batch.length} (total:${added}, boxes:${boxes}, DB:${t})`);
      }
    } catch(e) {
      if ((i+1) % 50 === 0 || i < 3) console.log(`[${i+1}/${keywords.length}] ${kw}: skip (${e.message.slice(0,50)})`);
    }
    if (i < keywords.length-1) await new Promise(r => setTimeout(r, DELAY));
  }
  const end = database.prepare("SELECT COUNT(*) c FROM box_sales").get().c;
  console.log(`邮宝 done: +${added} (boxes:${boxes}) DB:${start}→${end}`);
  return added;
}

// ═══════════════════════════════════════════
// 赵涌 scraper
// ═══════════════════════════════════════════
async function scrapeZhao(keywords) {
  console.log(`\n=== 赵涌: ${keywords.length} keywords ===`);
  const existing = new Set(
    database.prepare("SELECT detail_url FROM box_sales WHERE platform = '赵涌在线' AND detail_url IS NOT NULL").all().map(r => r.detail_url)
  );
  console.log(`Existing: ${existing.size}`);

  const stmt = database.prepare(
    "INSERT OR IGNORE INTO box_sales (normalized_box_code, display_box_code, grading_company, grade, coin_name, platform, platform_product_id, detail_url, official_cert_url, price, transacted_at, product_code, evidence_image_url, ocr_text, ocr_confidence, verification_status, collected_at, evidence_note) VALUES (?,?,?,?,?,'赵涌在线',?,?,'',?,?,'','','',0,?,datetime('now'),'赵涌在线公开交易记录')"
  );

  const start = database.prepare("SELECT COUNT(*) c FROM box_sales").get().c;
  let added = 0, boxes = 0;

  for (let i = 0; i < keywords.length; i++) {
    const kw = keywords[i];
    try {
      const resp = await fetch("https://zhaoonline.com/query.shtml", {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded; charset=UTF-8", accept: "text/html", referer: "https://zhaoonline.com/trade/qianbi/" },
        body: new URLSearchParams({ keyword: kw, "q.types": "1" }),
        signal: AbortSignal.timeout(15000),
      });
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const $ = load(await resp.text());
      const batch = [];

      $(".list-item").each((_, el) => {
        const item = $(el);
        const titleLink = item.find(".item-title");
        const title = clean(titleLink.text()) || clean(titleLink.attr("title"));
        const href = titleLink.attr("href");
        if (!href || !title) return;
        const url = new URL(href, "https://zhaoonline.com").toString();
        if (existing.has(url)) return;

        const priceText = clean(item.find(".price strong").text());
        const timeText = clean(item.find(".item-sub.time").text());
        const condition = clean(item.find(".property").text());
        let price = null, isActive = false;
        if (priceText.includes("预展") || priceText.includes("在售") || !priceText) {
          isActive = true;
        } else {
          const pm = priceText.match(/([0-9,]+(?:\.[0-9]+)?)/);
          if (pm) price = Number(pm[1].replace(/,/g,""));
        }
        const box = extractBox(title);
        const grade = extractGrade(title) || condition || "未标注";
        batch.push({
          nbc: box ? box.normalized : `zhao_${url.match(/(\d{7,10})/)?.[1] ?? Math.random().toString(36).slice(2,14)}`,
          dbc: box ? box.display : "无盒号",
          gc: box ? box.company : "UNKNOWN",
          grade, cn: title.slice(0,300),
          pid: url.replace(/^https?:\/\/[^/]+\//,"").slice(0,100),
          url, price: price ?? 0,
          date: (timeText && /\d{4}/.test(timeText)) ? timeText : null,
          isActive
        });
        if (box) boxes++;
      });

      if (batch.length > 0) {
        database.exec("BEGIN IMMEDIATE");
        try {
          for (const r of batch) {
            const now = new Date().toISOString().slice(0,19).replace("T"," ");
            stmt.run(r.nbc, r.dbc, r.gc, r.grade, r.cn, r.pid, r.url, r.price, r.date || now, r.isActive ? "active_listing" : "official_pending");
            existing.add(r.url);
          }
          database.exec("COMMIT"); added += batch.length;
        } catch (e) { database.exec("ROLLBACK"); throw e; }
      }
      if ((i+1) % 50 === 0 || i === keywords.length-1) {
        const t = database.prepare("SELECT COUNT(*) c FROM box_sales").get().c;
        console.log(`[${i+1}/${keywords.length}] ${kw}: +${batch.length} (total:${added}, boxes:${boxes}, DB:${t})`);
      }
    } catch(e) {
      if ((i+1) % 50 === 0 || i < 3) console.log(`[${i+1}/${keywords.length}] ${kw}: skip (${e.message.slice(0,50)})`);
    }
    if (i < keywords.length-1) await new Promise(r => setTimeout(r, DELAY));
  }
  const end = database.prepare("SELECT COUNT(*) c FROM box_sales").get().c;
  console.log(`赵涌 done: +${added} (boxes:${boxes}) DB:${start}→${end}`);
  return added;
}

// ═══════════════════════════════════════════
// 易金 scraper
// ═══════════════════════════════════════════
async function scrapeYijin(keywords) {
  console.log(`\n=== 易金: ${keywords.length} keywords ===`);

  // Phase 1: list pagination
  console.log("Phase 1: List pages...");
  const existing = new Set(
    database.prepare("SELECT detail_url FROM box_sales WHERE platform = '易金在线' AND detail_url IS NOT NULL").all().map(r => r.detail_url)
  );
  console.log(`Existing: ${existing.size}`);

  const stmt = database.prepare(
    "INSERT OR IGNORE INTO box_sales (normalized_box_code, display_box_code, grading_company, grade, coin_name, platform, platform_product_id, detail_url, official_cert_url, price, transacted_at, product_code, evidence_image_url, ocr_text, ocr_confidence, verification_status, collected_at, evidence_note) VALUES (?,?,?,?,?,'易金在线',?,?,'',?,?,'','','',0,?,datetime('now'),'易金在线商品')"
  );

  const start = database.prepare("SELECT COUNT(*) c FROM box_sales").get().c;
  let added = 0;

  for (let page = 1; page <= 50; page++) {
    try {
      const resp = await fetch(`https://www.yjzx.com/web2020/material/list.html?page=${page}`, {
        headers: { "user-agent": "Quanzhi/0.5" },
        signal: AbortSignal.timeout(15000),
      });
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const $ = load(await resp.text());
      const batch = [];

      $("a[href*='detail/']").each((_, el) => {
        const a = $(el);
        const title = clean(a.attr("title") || a.text());
        const href = a.attr("href");
        if (!href || !title || title === "大卖场" || title === "料价币" || title === "求购") return;
        const detailUrl = new URL(href, "https://www.yjzx.com").toString();
        if (existing.has(detailUrl)) return;

        const parentText = clean(a.closest("li, .item, .list-item, tr, div").text());
        const priceM = parentText.match(/[￥¥]\s*([0-9,]+(?:\.\d+)?)/);
        const timeM = parentText.match(/(20\d{2}[-/]\d{2}[-/]\d{2})/);
        const box = extractBox(title);
        const id = href.match(/detail\/(\d+)\.html/)?.[1] ?? href;

        batch.push({
          nbc: box ? box.normalized : `yj_${id}`,
          dbc: box ? box.display : "无盒号",
          gc: box ? box.company : "UNKNOWN",
          grade: "未标注", cn: title.slice(0,300),
          pid: href.replace(/^.*detail\//,"").replace(/\.html$/,"").slice(0,100),
          url: detailUrl,
          price: priceM ? Number(priceM[1].replace(/,/g,"")) : 0,
          date: timeM ? timeM[1] : null
        });
      });

      if (batch.length === 0) { console.log(`  Page ${page}: 0 items, done.`); break; }

      database.exec("BEGIN IMMEDIATE");
      try {
        for (const r of batch) {
          const now = new Date().toISOString().slice(0,19).replace("T"," ");
          stmt.run(r.nbc, r.dbc, r.gc, r.grade, r.cn, r.pid, r.url, r.price, r.date || now, "active_listing");
          existing.add(r.url);
        }
        database.exec("COMMIT"); added += batch.length;
        console.log(`  Page ${page}: ${batch.length} new (total:${added})`);
      } catch (e) { database.exec("ROLLBACK"); throw e; }
    } catch (e) {
      console.log(`  Page ${page}: error (${e.message.slice(0,50)})`); break;
    }
    await new Promise(r => setTimeout(r, DELAY));
  }
  console.log(`List done: ${added} new`);

  // Phase 2: keyword search for coin refs
  console.log(`\nPhase 2: Search (${keywords.length} keywords)...`);
  let searchAdded = 0;
  const seenCoins = new Set();

  for (let i = 0; i < keywords.length; i++) {
    const kw = keywords[i];
    try {
      const resp = await fetch(`https://www.yjzx.com/web2020/search/speed/history?status=3&searchFlag=2&query=${encodeURIComponent(kw)}`, {
        headers: { "user-agent": "Quanzhi/0.5" },
        signal: AbortSignal.timeout(15000),
      });
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const html = await resp.text();

      const coinNames = [...new Set(
        (html.match(/[\d]{4}年[^<]{2,40}币/g) || [])
          .map(s => clean(s.replace(/<[^>]+>/g,"")))
          .filter(s => s.length > 5 && s.length < 100)
      )];

      const batch = [];
      for (const cn of coinNames) {
        if (seenCoins.has(cn)) continue;
        seenCoins.add(cn);
        const priceIdx = html.indexOf(cn);
        const ctx = html.slice(priceIdx, priceIdx + 500);
        const prices = ctx.match(/[￥¥]\s*([0-9,]+)/g) || [];
        const price = prices.length > 0 ? Number(prices[0].replace(/[￥¥,\s]/g,"")) : 0;
        const slug = `yjref_${cn.slice(0,8)}_${i}_${batch.length}`;
        batch.push({
          nbc: slug, dbc: "无盒号", gc: "UNKNOWN", grade: "未标注", cn,
          pid: slug.slice(0,100), url: resp.url, price, date: null
        });
      }

      if (batch.length > 0) {
        database.exec("BEGIN IMMEDIATE");
        try {
          for (const r of batch) {
            const now = new Date().toISOString().slice(0,19).replace("T"," ");
            stmt.run(r.nbc, r.dbc, r.gc, r.grade, r.cn, r.pid, r.url, r.price, r.date || now, "yijin_price_ref");
          }
          database.exec("COMMIT"); searchAdded += batch.length;
        } catch (e) { database.exec("ROLLBACK"); throw e; }
      }
      if ((i+1) % 50 === 0 || i === keywords.length-1) {
        const t = database.prepare("SELECT COUNT(*) c FROM box_sales").get().c;
        console.log(`[${i+1}/${keywords.length}] ${kw}: ${coinNames.length} coins, +${batch.length} (total:${searchAdded}, DB:${t})`);
      }
    } catch(e) {
      if ((i+1) % 50 === 0 || i < 3) console.log(`[${i+1}/${keywords.length}] ${kw}: skip (${e.message.slice(0,40)})`);
    }
    if (i < keywords.length-1) await new Promise(r => setTimeout(r, DELAY));
  }
  console.log(`Search done: ${searchAdded} new`);

  const end = database.prepare("SELECT COUNT(*) c FROM box_sales").get().c;
  console.log(`易金 done: list ${added} + search ${searchAdded} = ${added+searchAdded}. DB:${start}→${end}`);
  return added + searchAdded;
}

// ═══════════════════════════════════════════
// MAIN
// ═══════════════════════════════════════════
async function main() {
  const totalStart = database.prepare("SELECT COUNT(*) c FROM box_sales").get().c;
  console.log(`ALL-IN-ONE SCRAPE — DB start: ${totalStart}\n`);

  const ybKw = generateYoubaoKeywords();
  const zhaoKw = generateZhaoKeywords();
  const yjKw = generateYijinKeywords();

  console.log(`Keywords: 邮宝=${ybKw.length}, 赵涌=${zhaoKw.length}, 易金=${yjKw.length}`);

  // Run sequentially to avoid SQLite write conflicts
  const yb = await scrapeYoubao(ybKw);
  const zhao = await scrapeZhao(zhaoKw);
  const yj = await scrapeYijin(yjKw);

  const totalEnd = database.prepare("SELECT COUNT(*) c FROM box_sales").get().c;

  // Show platform breakdown
  const breakdown = database.prepare("SELECT platform, COUNT(*) c FROM box_sales GROUP BY platform ORDER BY c DESC").all();

  console.log(`\n═══════════════════════════════════════`);
  console.log(`ALL DONE!`);
  console.log(`  邮宝: +${yb}`);
  console.log(`  赵涌: +${zhao}`);
  console.log(`  易金: +${yj}`);
  console.log(`  Total new: ${yb+zhao+yj}`);
  console.log(`  DB: ${totalStart} → ${totalEnd}`);
  console.log(`Platform breakdown:`);
  breakdown.forEach(p => console.log(`  ${p.platform}: ${p.c}`));
  console.log(`═══════════════════════════════════════`);
  console.log(`\nNext: node collector/export-static-box-index.mjs`);
}

main().catch(console.error);
