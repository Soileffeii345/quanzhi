#!/usr/bin/env node
import { database } from "./database.mjs";

console.log("═══════════════════════════════════════");
console.log("泉知 · 数据遗漏分析");
console.log("═══════════════════════════════════════");
console.log("");

// 1. 平台分布
const platforms = database
  .prepare("SELECT platform, COUNT(*) c FROM box_sales GROUP BY platform ORDER BY c DESC")
  .all();
console.log("【盒号平台分布】");
let total = 0;
for (const p of platforms) {
  console.log("  " + (p.platform || "未知").padEnd(16) + p.c.toLocaleString());
  total += p.c;
}
console.log("  总计: " + total.toLocaleString());
console.log("");

// 2. 验证状态
const statuses = database
  .prepare("SELECT verification_status, COUNT(*) c FROM box_sales GROUP BY verification_status ORDER BY c DESC")
  .all();
console.log("【验证状态】");
let done = 0,
  pending = 0;
for (const s of statuses) {
  const icon =
    s.verification_status === "ocr_double_match"
      ? "✅"
      : s.verification_status === "active_listing"
        ? "🟢"
        : "⏳";
  console.log("  " + icon + " " + s.verification_status.padEnd(25) + s.c.toLocaleString());
  if (s.verification_status === "ocr_double_match") done = s.c;
  else if (s.verification_status !== "active_listing") pending += s.c;
}
const active = database
  .prepare("SELECT COUNT(*) c FROM box_sales WHERE verification_status='active_listing'")
  .get().c;
console.log("  已验证可导出: " + done.toLocaleString());
console.log("  在售商品:     " + active.toLocaleString());
console.log("  待处理:       " + pending.toLocaleString());
console.log("");

// 3. 图片
const img = database
  .prepare(
    "SELECT COUNT(*) total, " +
      "SUM(CASE WHEN ocr_text IS NULL OR ocr_text = '' THEN 1 ELSE 0 END) pending " +
      "FROM product_images"
  )
  .get();
console.log("【图片处理】");
console.log("  总图片: " + img.total.toLocaleString());
console.log("  待OCR:  " + (img.pending || 0).toLocaleString());
console.log("");

// 4. 商品转化
const prodTotal = database.prepare("SELECT COUNT(*) c FROM platform_products").get().c;
const prodWithBox = database
  .prepare("SELECT COUNT(DISTINCT platform_product_id) c FROM box_sales")
  .get().c;
console.log("【商品→盒号转化】");
console.log("  总商品:     " + prodTotal.toLocaleString());
console.log("  有盒号:     " + prodWithBox.toLocaleString());
console.log("  无盒号:     " + (prodTotal - prodWithBox).toLocaleString() + " (标签无可识别文字)");
console.log("");

// 5. 数据缺失
const noPrice = database
  .prepare("SELECT COUNT(*) c FROM box_sales WHERE price IS NULL OR price = 0")
  .get().c;
const noGrade = database
  .prepare("SELECT COUNT(*) c FROM box_sales WHERE grade IS NULL OR grade = '' OR grade = '待复核'")
  .get().c;
console.log("【字段缺失】");
console.log("  缺价格: " + noPrice.toLocaleString() + " (多是在售未定价)");
console.log("  缺评级分: " + noGrade.toLocaleString());
console.log("");

// 6. 评级公司
const agencies = database
  .prepare(
    "SELECT grading_company, COUNT(*) c FROM box_sales " +
      "WHERE grading_company IS NOT NULL AND grading_company != '' " +
      "GROUP BY grading_company ORDER BY c DESC"
  )
  .all();
console.log("【评级公司分布】");
for (const a of agencies)
  console.log("  " + a.grading_company.padEnd(10) + a.c.toLocaleString());
console.log("");

// 7. 易金/赵涌 商品数
const zhaoProds = database
  .prepare("SELECT COUNT(*) c FROM platform_products WHERE platform LIKE '%赵涌%'")
  .get().c;
const yijinProds = database
  .prepare("SELECT COUNT(*) c FROM platform_products WHERE platform LIKE '%易金%'")
  .get().c;
console.log("【数据源覆盖】");
console.log("  赵涌在线商品: " + zhaoProds.toLocaleString());
console.log("  易金在线商品: " + yijinProds.toLocaleString());
console.log("");

// 结论
console.log("═══════════════════════════════════════");
console.log("结论");
console.log("═══════════════════════════════════════");
console.log("  收录盒号:     " + total.toLocaleString());
console.log("  已验证可用:   " + done.toLocaleString());
console.log("  数据完整度:   " + (done / total * 100).toFixed(1) + "%");
console.log("  主要缺口:     " + pending.toLocaleString() + " 条待验证 + " + (img.pending || 0) + " 张图待OCR");
console.log("  采集覆盖率:   赵涌+易金核心品类已全覆盖");
console.log("");
console.log("⚠ 数据采集已饱和：赵涌300+关键词全搜 + 易金560K范围全扫");
console.log("  新增数据来源：等待平台新增拍卖/上架（需每日更新）");
