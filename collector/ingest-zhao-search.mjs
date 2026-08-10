// Mass ingestion: 赵涌搜索 → 详情页 → 提取auction JSON → 保存图片给OCR
// This feeds the OCR pipeline with real slab images to extract NGC/PCGS cert numbers.
import { database, saveIndexedProduct } from "./database.mjs";

const DELAY_MS = 300; // between detail page fetches
const SEARCH_DELAY_MS = 400; // between searches

// 300+ broad keywords for 赵涌 search
const KEYWORDS = [
  "金币","银币","铜币","铂金币","钯金币","纪念币","流通币","精制币","普制币",
  "评级币","封装币","彩色币","金银币","双金属币",
  "1克金币","3克金币","5克金币","8克金币","10克金币","15克金币","30克金币","50克金币","100克金币",
  "1盎司金币","1/2盎司金币","1/4盎司金币","1/10盎司金币","1公斤金币","5盎司金币",
  "1克银币","3克银币","5克银币","8克银币","10克银币","15克银币","30克银币","50克银币","100克银币",
  "1盎司银币","1公斤银币","5盎司银币",
  "NGC","PCGS","MS70","MS69","MS68","PF70","PF69","PR70","PR69",
  "熊猫金币","熊猫银币","大熊猫","熊猫精制币","熊猫普制币",
  "生肖金币","生肖银币","生肖纪念币",
  "龙年金币","蛇年金币","马年金币","羊年金币","猴年金币","鸡年金币",
  "狗年金币","猪年金币","鼠年金币","牛年金币","虎年金币","兔年金币",
  "龙年银币","蛇年银币","马年银币","羊年银币",
  "吉祥文化","贺岁币","福字币","书法币","和字币",
  "泰山币","武夷山","黄山币","峨眉山",
  "京剧纪念币","京剧金币","京剧银币",
  "建国币","建党币","改革开放","抗战币",
  "大运河","国家公园","冬奥币","航天币",
  ...Array.from({length: 16}, (_, i) => (2010+i)+"年金币"),
  ...Array.from({length: 16}, (_, i) => (2010+i)+"年银币"),
  "2010年纪念币","2015年纪念币","2020年纪念币","2023年纪念币","2024年纪念币",
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
  "错版","试铸","惜售",
  "沈阳造币","上海造币","深圳国宝",
  "生肖龙","生肖蛇","生肖马","生肖羊","生肖猴",
];

function clean(s) { return (s ?? "").replace(/\s+/g, " ").trim(); }

// ── Fetch 赵涌 search results ──
async function searchZhao(query) {
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
  const html = await resp.text();

  // Extract detail URLs from search results — only category/ID.shtml pattern
  const urls = new Set();
  const hrefRegex = /href="\/([a-z-]+\/\d{6,}\.shtml)"/g;
  let m;
  while ((m = hrefRegex.exec(html)) !== null) {
    const url = new URL("/" + m[1], "https://zhaoonline.com").toString();
    // Exclude 书画展售 (shuhuazhanshou) which isn't coin trading
    if (!url.includes("shuhuazhanshou")) urls.add(url);
  }
  return [...urls];
}

// ── Parse 赵涌 detail page (reuses logic from ingest-discovered-metadata.mjs) ──
async function parseZhaoDetail(url) {
  const resp = await fetch(url, {
    headers: {
      "user-agent": "QuanzhiIndexer/1.0",
      referer: "https://zhaoonline.com/trade/qianbi/",
    },
    redirect: "follow",
    signal: AbortSignal.timeout(15000),
  });
  if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
  const html = await resp.text();

  const jsonMatch = html.match(/var\s+auction\s*=\s*(\{.+?\});\s*$/m);
  if (!jsonMatch) throw new Error("missing auction JSON");

  const auction = JSON.parse(jsonMatch[1]);
  if (!auction.id || !auction.auctionName) throw new Error("incomplete auction data");

  // Accept ALL statuses — we just need the images for OCR. Status doesn't matter for cert extraction.

  const sourceImageUrls = Array.from(new Set(
    (auction.pictures ?? []).map(p => p.src).filter(src => /^https:\/\/img3\.zhaoonline\.com\//.test(src))
  ));

  if (sourceImageUrls.length === 0) throw new Error("no valid images");

  return {
    id: auction.id,
    platform: "赵涌在线",
    title: clean(auction.auctionName),
    detailUrl: new URL(auction.detailLink, "https://zhaoonline.com").toString(),
    price: Number(auction.currentPrice) || null,
    priceWithFee: auction.currentPrice && auction.buyChargeFee
      ? Math.round(Number(auction.currentPrice) * (1 + Number(auction.buyChargeFee) / 100) * 100) / 100
      : null,
    transactedAt: auction.endAt ?? "",
    productCode: String(auction.auctionNo ?? auction.id),
    sourceImageUrls,
  };
}

// ── Main ──
async function main() {
  const uniqueKw = [...new Set(KEYWORDS)];
  console.log(`赵涌搜索关键词: ${uniqueKw.length}`);

  // Track existing URLs to skip
  const existingUrls = new Set(
    database.prepare("SELECT detail_url FROM platform_products WHERE platform = '赵涌在线'").all().map(r => r.detail_url)
  );
  console.log(`已有赵涌 platform_products: ${existingUrls.size}`);

  let totalIngested = 0;
  let totalImages = 0;
  let totalSkipped = 0;
  let totalFailed = 0;

  // Phase 1: Collect all unique detail URLs from search
  const allDetailUrls = new Set();
  for (let i = 0; i < uniqueKw.length; i++) {
    const kw = uniqueKw[i];
    try {
      const urls = await searchZhao(kw);
      for (const url of urls) {
        if (!existingUrls.has(url) && !allDetailUrls.has(url)) {
          allDetailUrls.add(url);
        }
      }
      if ((i + 1) % 50 === 0 || i === uniqueKw.length - 1) {
        console.log(`[搜索 ${i + 1}/${uniqueKw.length}] ${kw}: ${urls.length}条 (新URL累计: ${allDetailUrls.size})`);
      }
    } catch {
      if ((i + 1) % 50 === 0) console.log(`[搜索 ${i + 1}/${uniqueKw.length}] ${kw}: 错误`);
    }
    if (i < uniqueKw.length - 1) await new Promise(r => setTimeout(r, SEARCH_DELAY_MS));
  }

  console.log(`\n搜索完成: 发现 ${allDetailUrls.size} 个新 detail URL`);

  // Phase 2: Fetch each detail page and save metadata + images
  const urls = [...allDetailUrls];
  for (let i = 0; i < urls.length; i++) {
    const url = urls[i];
    try {
      const page = await parseZhaoDetail(url);
      const images = page.sourceImageUrls.map(imageUrl => ({
        imageUrl,
        ocrText: "",
        ocrConfidence: null,
        box: null,
      }));

      // saveIndexedProduct writes to platform_products + product_images
      // It does NOT create box_sales entries (no box number yet)
      saveIndexedProduct(page, images, []);
      totalIngested++;
      totalImages += images.length;
      existingUrls.add(url);

      if ((i + 1) % 50 === 0 || i === urls.length - 1) {
        console.log(`[详情 ${i + 1}/${urls.length}] 已入库: ${totalIngested} 个商品, ${totalImages} 张图片 (跳过: ${totalSkipped}, 失败: ${totalFailed})`);
      }
    } catch (e) {
      totalFailed++;
      if (totalFailed <= 5 || totalFailed % 20 === 0) {
        console.log(`[详情 ${i + 1}/${urls.length}] 失败: ${e.message.slice(0, 60)}`);
      }
    }
    if (i < urls.length - 1) await new Promise(r => setTimeout(r, DELAY_MS));
  }

  // Show final stats
  const productCount = database.prepare("SELECT COUNT(*) c FROM platform_products WHERE platform = '赵涌在线'").get().c;
  const imageCount = database.prepare("SELECT COUNT(*) c FROM product_images WHERE platform = '赵涌在线'").get().c;
  const pendingOcr = database.prepare("SELECT COUNT(*) c FROM product_images WHERE platform = '赵涌在线' AND ocr_text = '' AND ocr_confidence IS NULL").get().c;

  console.log(`\n════════════════════════════════`);
  console.log(`赵涌采集完成!`);
  console.log(`  新入库商品: ${totalIngested}`);
  console.log(`  新入库图片: ${totalImages}`);
  console.log(`  跳过(已存在): ${totalSkipped}`);
  console.log(`  失败: ${totalFailed}`);
  console.log(`  赵涌 platform_products 总计: ${productCount}`);
  console.log(`  赵涌 product_images 总计: ${imageCount}`);
  console.log(`  待OCR图片: ${pendingOcr}`);
  console.log(`════════════════════════════════`);
  console.log(`\nNext: node collector/ocr-pending-images.mjs platform=赵涌在线 limit=5000 concurrency=2`);
}

main().catch(console.error);
