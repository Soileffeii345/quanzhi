import { mkdir, rm, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { database } from "./database.mjs";

const outputRoot = resolve("public", "box-data");
await rm(outputRoot, { recursive: true, force: true });
await mkdir(outputRoot, { recursive: true });

const rows = database.prepare(`
  SELECT normalized_box_code, display_box_code, grading_company, grade, coin_name,
         platform, detail_url, official_cert_url, price, price_with_fee,
         transacted_at, product_code, evidence_image_url, ocr_text,
         ocr_confidence, verification_status
  FROM box_sales
  WHERE verification_status IN ('verified', 'image_exact', 'official_pending')
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
    })),
  }, null, 2));
}

await writeFile(resolve(outputRoot, "manifest.json"), JSON.stringify({
  generatedAt: new Date().toISOString(),
  verifiedBoxes: grouped.size,
  verifiedSales: rows.length,
}, null, 2));
process.stdout.write(`${JSON.stringify({ verifiedBoxes: grouped.size, verifiedSales: rows.length, outputRoot }, null, 2)}\n`);
