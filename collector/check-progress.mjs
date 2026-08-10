import { database } from "./database.mjs";

const pending = database.prepare(`
  SELECT COUNT(*) c FROM product_images
  WHERE platform='赵涌在线' AND ocr_text='' AND ocr_confidence IS NULL
`).get().c;

const total = database.prepare(`
  SELECT COUNT(*) c FROM product_images WHERE platform='赵涌在线'
`).get().c;

const boxes = database.prepare(`
  SELECT COUNT(DISTINCT normalized_box_code) c FROM box_sales
`).get().c;

const fake = database.prepare(`
  SELECT COUNT(*) c FROM box_sales
  WHERE normalized_box_code LIKE 'yb_%' OR normalized_box_code LIKE 'zhao_%' OR normalized_box_code LIKE 'yj_%'
`).get().c;

const byStatus = database.prepare(`
  SELECT verification_status, COUNT(*) c FROM box_sales
  GROUP BY verification_status ORDER BY c DESC
`).all();

console.log(`OCR: ${total-pending}/${total} (${((total-pending)/total*100).toFixed(1)}%) | Pending: ${pending}`);
console.log(`Unique boxes: ${boxes} | Fake: ${fake}`);
byStatus.forEach(r => console.log(`  ${r.verification_status}: ${r.c}`));
