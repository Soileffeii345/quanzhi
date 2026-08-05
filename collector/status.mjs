import { database } from "./database.mjs";

const pending = database.prepare("SELECT COUNT(1) count FROM product_images WHERE ocr_text='' AND ocr_confidence IS NULL").get().count;
const scanned = database.prepare("SELECT COUNT(1) count FROM product_images WHERE ocr_confidence IS NOT NULL").get().count;
const boxes = database.prepare("SELECT COUNT(1) count FROM box_sales").get().count;
const products = database.prepare("SELECT COUNT(1) count FROM platform_products").get().count;
const images = database.prepare("SELECT COUNT(1) count FROM product_images").get().count;
const verification = database.prepare("SELECT verification_status status, COUNT(1) count FROM box_sales GROUP BY verification_status ORDER BY status").all();
process.stdout.write(`${JSON.stringify({ products, images, scanned, pending, boxes, progress: images ? Math.round(scanned / images * 10000) / 100 : 0, verification }, null, 2)}\n`);
