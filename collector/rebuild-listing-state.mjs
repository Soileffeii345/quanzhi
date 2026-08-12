import { readFile, readdir } from "node:fs/promises";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { database } from "./database.mjs";

const root = dirname(fileURLToPath(import.meta.url));
const readJson = async (path) => JSON.parse((await readFile(path, "utf8")).replace(/^\uFEFF/, ""));
const manifest = await readJson(resolve(root, "data", "yijin-product-ids.json"));
const pageDir = resolve(root, "output", "pages");
const names = new Set(await readdir(pageDir));
const now = new Date().toISOString();

const upsert = database.prepare(`
  INSERT INTO platform_listing_state (
    platform, platform_product_id, title, detail_url, price, product_code,
    listing_status, coverage_scope, first_seen_at, last_seen_at, last_checked_at,
    recognized_box_count, queryable_box_count, source_snapshot_at
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  ON CONFLICT(platform, platform_product_id) DO UPDATE SET
    title=excluded.title, detail_url=excluded.detail_url, price=excluded.price,
    product_code=excluded.product_code, listing_status=excluded.listing_status,
    coverage_scope=excluded.coverage_scope, last_seen_at=excluded.last_seen_at,
    last_checked_at=excluded.last_checked_at,
    recognized_box_count=excluded.recognized_box_count,
    queryable_box_count=excluded.queryable_box_count,
    source_snapshot_at=excluded.source_snapshot_at
`);
const observe = database.prepare(`INSERT OR REPLACE INTO listing_observations
  (platform,platform_product_id,observed_at,listing_status,price,source_snapshot_at)
  VALUES (?,?,?,?,?,?)`);
const queryableCount = database.prepare(`SELECT COUNT(DISTINCT normalized_box_code) count
  FROM box_sales WHERE platform_product_id=? AND detail_url=? AND verification_status IN ('active_listing','youbao_active')`);

let yijinActive = 0;
let yijinEnded = 0;
let yijinMissing = 0;
database.exec("BEGIN IMMEDIATE");
try {
  for (const rawId of manifest.ids) {
    const id = String(rawId);
    const name = `yijin-${id}.json`;
    if (!names.has(name)) { yijinMissing += 1; continue; }
    const page = await readJson(resolve(pageDir, name));
    const status = page.active ? "active" : "sold_or_ended";
    if (page.active) yijinActive += 1; else yijinEnded += 1;
    const recognized = new Set((page.images ?? []).map((image) => image.box?.normalized).filter(Boolean)).size;
    const queryable = queryableCount.get(id, page.detailUrl).count;
    const firstSeen = database.prepare(`SELECT collected_at FROM platform_products WHERE detail_url=?`).get(page.detailUrl)?.collected_at ?? now;
    upsert.run("易金在线", id, page.title, page.detailUrl, page.price, page.productCode ?? "", status,
      "full_current_sell_list", firstSeen, now, now, recognized, queryable, manifest.discoveredAt);
    observe.run("易金在线", id, now, status, page.price, manifest.discoveredAt);
  }

  const zhaoRows = database.prepare(`SELECT platform_product_id, MAX(coin_name) title, detail_url,
    MAX(price) price, MAX(product_code) product_code, MIN(collected_at) first_seen,
    MAX(collected_at) last_seen, COUNT(DISTINCT normalized_box_code) boxes
    FROM box_sales WHERE platform='赵涌在线' AND verification_status='active_listing'
    GROUP BY platform_product_id, detail_url`).all();
  const currentZhaoSnapshot = new Set(database.prepare(`SELECT platform_product_id
    FROM platform_listing_state
    WHERE platform='赵涌在线' AND coverage_scope='public_current_money_categories'`).all()
    .map((row) => String(row.platform_product_id)));
  for (const row of zhaoRows) {
    if (currentZhaoSnapshot.has(String(row.platform_product_id))) continue;
    upsert.run("赵涌在线", row.platform_product_id, row.title, row.detail_url, row.price, row.product_code ?? "",
      "unknown", "queryable_box_records_only", row.first_seen, row.last_seen, row.last_seen,
      row.boxes, row.boxes, row.last_seen);
  }
  database.exec("COMMIT");
  console.log(JSON.stringify({yijin:{discovered:manifest.ids.length,active:yijinActive,ended:yijinEnded,missing:yijinMissing},zhao:{publicSnapshotProducts:currentZhaoSnapshot.size,legacyQueryableProducts:zhaoRows.length}},null,2));
} catch (error) {
  database.exec("ROLLBACK");
  throw error;
}
