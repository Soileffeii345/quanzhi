import { database } from "./database.mjs";
import { PUBLISHED_SALE_STATUSES, sqlIn } from "./publication-policy.mjs";

const sampleSize = Math.max(1, Math.min(20, Number(process.argv.find((arg) => arg.startsWith("--sample="))?.split("=")[1] ?? 5)));
const platforms = database.prepare(`SELECT DISTINCT platform FROM box_sales WHERE verification_status IN (${sqlIn(PUBLISHED_SALE_STATUSES)})`).all();
const sampleStatement = database.prepare(`
  SELECT platform, platform_product_id, normalized_box_code, detail_url, evidence_image_url
  FROM box_sales
  WHERE verification_status IN (${sqlIn(PUBLISHED_SALE_STATUSES)}) AND platform = ?
  ORDER BY RANDOM() LIMIT ?
`);
const samples = platforms.flatMap(({ platform }) => sampleStatement.all(platform, sampleSize));

async function check(record) {
  try {
    const [page, image] = await Promise.all([
      fetch(record.detail_url, {
        redirect: "follow",
        signal: AbortSignal.timeout(15000),
        headers: { "user-agent": "Mozilla/5.0 QuanzhiLinkAudit/1.0" },
      }),
      fetch(record.evidence_image_url, {
        redirect: "follow",
        signal: AbortSignal.timeout(15000),
        headers: { "user-agent": "Mozilla/5.0 QuanzhiLinkAudit/1.0" },
      }),
    ]);
    const html = await page.text();
    const pageMatchesProduct = html.includes(String(record.platform_product_id)) || page.url.includes(String(record.platform_product_id));
    const imageType = image.headers.get("content-type") ?? "";
    return {
      platform: record.platform,
      detailUrl: record.detail_url,
      pageStatus: page.status,
      imageStatus: image.status,
      pageMatchesProduct,
      imageIsImage: imageType.startsWith("image/"),
      ok: page.ok && image.ok && pageMatchesProduct && imageType.startsWith("image/"),
    };
  } catch (error) {
    return { platform: record.platform, detailUrl: record.detail_url, ok: false, error: error instanceof Error ? error.message : String(error) };
  }
}

const results = [];
for (let i = 0; i < samples.length; i += 3) results.push(...await Promise.all(samples.slice(i, i + 3).map(check)));
const failures = results.filter((result) => !result.ok);
console.log(JSON.stringify({ checked: results.length, passed: results.length - failures.length, failed: failures.length, results }, null, 2));
if (failures.length > 0) process.exitCode = 1;
