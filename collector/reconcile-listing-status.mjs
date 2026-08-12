import { database } from "./database.mjs";

const current = database.prepare(`SELECT platform_product_id, detail_url, listing_status
  FROM platform_listing_state WHERE platform='易金在线'`).all();
const update = database.prepare(`UPDATE box_sales SET verification_status=?
  WHERE platform='易金在线' AND platform_product_id=? AND detail_url=?
    AND verification_status IN ('active_listing','official_pending','image_exact')`);
let activeRows = 0;
let endedRows = 0;
let unchangedUnknownRows = 0;
database.exec("BEGIN IMMEDIATE");
try {
  for (const row of current) {
    // A missing listing, timeout, or incomplete public snapshot is not proof of sale.
    // Keep its previously published state until the source explicitly confirms an end.
    if (row.listing_status === "unknown") {
      unchangedUnknownRows += 1;
      continue;
    }
    const target = row.listing_status === "active" ? "active_listing" : "official_pending";
    const result = update.run(target, row.platform_product_id, row.detail_url);
    if (target === "active_listing") activeRows += Number(result.changes);
    else endedRows += Number(result.changes);
  }
  database.exec("COMMIT");
} catch (error) {
  database.exec("ROLLBACK");
  throw error;
}
console.log(JSON.stringify({activeRowsReconciled:activeRows,endedRowsReconciled:endedRows,unchangedUnknownRows},null,2));
