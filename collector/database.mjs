import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { DatabaseSync } from "node:sqlite";

const collectorDir = dirname(fileURLToPath(import.meta.url));
const databasePath = process.env.QUANZHI_DB_PATH || resolve(collectorDir, "data", "quanzhi.sqlite");
mkdirSync(dirname(databasePath), { recursive: true });

export const database = new DatabaseSync(databasePath);
database.exec(`
  PRAGMA journal_mode = WAL;
  PRAGMA foreign_keys = ON;

  CREATE TABLE IF NOT EXISTS platform_products (
    platform TEXT NOT NULL,
    platform_product_id TEXT NOT NULL,
    title TEXT NOT NULL,
    detail_url TEXT NOT NULL UNIQUE,
    price REAL,
    price_with_fee REAL,
    transacted_at TEXT,
    product_code TEXT,
    status TEXT NOT NULL DEFAULT 'indexed',
    collected_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    PRIMARY KEY (platform, platform_product_id)
  );

  CREATE TABLE IF NOT EXISTS product_images (
    platform TEXT NOT NULL,
    platform_product_id TEXT NOT NULL,
    image_url TEXT NOT NULL,
    ocr_text TEXT NOT NULL DEFAULT '',
    ocr_confidence REAL,
    normalized_box_code TEXT,
    display_box_code TEXT,
    grading_company TEXT,
    scanned_at TEXT NOT NULL,
    PRIMARY KEY (platform, platform_product_id, image_url),
    FOREIGN KEY (platform, platform_product_id)
      REFERENCES platform_products(platform, platform_product_id)
      ON DELETE CASCADE
  );

  CREATE INDEX IF NOT EXISTS product_images_box_idx
    ON product_images(normalized_box_code)
    WHERE normalized_box_code IS NOT NULL;

  CREATE TABLE IF NOT EXISTS box_sales (
    normalized_box_code TEXT NOT NULL,
    display_box_code TEXT NOT NULL,
    grading_company TEXT NOT NULL,
    grade TEXT NOT NULL,
    coin_name TEXT NOT NULL,
    platform TEXT NOT NULL,
    platform_product_id TEXT NOT NULL,
    detail_url TEXT NOT NULL,
    official_cert_url TEXT NOT NULL,
    price REAL NOT NULL,
    price_with_fee REAL,
    transacted_at TEXT NOT NULL,
    product_code TEXT,
    evidence_image_url TEXT NOT NULL,
    ocr_text TEXT NOT NULL,
    ocr_confidence REAL NOT NULL,
    verification_status TEXT NOT NULL DEFAULT 'ocr_pending_review',
    collected_at TEXT NOT NULL,
    PRIMARY KEY (normalized_box_code, platform, detail_url)
  );

  CREATE INDEX IF NOT EXISTS box_sales_lookup_idx
    ON box_sales(normalized_box_code, transacted_at DESC);

  CREATE INDEX IF NOT EXISTS box_sales_status_date_idx
    ON box_sales(verification_status, transacted_at DESC);

  CREATE INDEX IF NOT EXISTS platform_products_platform_date_idx
    ON platform_products(platform, transacted_at DESC);

  CREATE TABLE IF NOT EXISTS crawl_state (
    platform TEXT PRIMARY KEY,
    cursor TEXT,
    last_success_at TEXT,
    last_error TEXT,
    products_indexed INTEGER NOT NULL DEFAULT 0,
    images_scanned INTEGER NOT NULL DEFAULT 0,
    boxes_found INTEGER NOT NULL DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS platform_listing_state (
    platform TEXT NOT NULL,
    platform_product_id TEXT NOT NULL,
    title TEXT NOT NULL,
    detail_url TEXT NOT NULL,
    price REAL,
    product_code TEXT,
    listing_status TEXT NOT NULL CHECK (listing_status IN ('active','sold_or_ended','unknown')),
    coverage_scope TEXT NOT NULL,
    first_seen_at TEXT NOT NULL,
    last_seen_at TEXT NOT NULL,
    last_checked_at TEXT NOT NULL,
    recognized_box_count INTEGER NOT NULL DEFAULT 0,
    queryable_box_count INTEGER NOT NULL DEFAULT 0,
    source_snapshot_at TEXT NOT NULL,
    PRIMARY KEY (platform, platform_product_id)
  );

  CREATE INDEX IF NOT EXISTS platform_listing_state_status_idx
    ON platform_listing_state(platform, listing_status, last_checked_at DESC);

  CREATE TABLE IF NOT EXISTS listing_observations (
    platform TEXT NOT NULL,
    platform_product_id TEXT NOT NULL,
    observed_at TEXT NOT NULL,
    listing_status TEXT NOT NULL,
    price REAL,
    source_snapshot_at TEXT NOT NULL,
    PRIMARY KEY (platform, platform_product_id, observed_at)
  );
`);

const boxSaleColumns = new Set(database.prepare("PRAGMA table_info(box_sales)").all().map((column) => column.name));
if (!boxSaleColumns.has("evidence_note")) {
  database.exec("ALTER TABLE box_sales ADD COLUMN evidence_note TEXT NOT NULL DEFAULT ''");
}
if (!boxSaleColumns.has("keywords")) {
  database.exec("ALTER TABLE box_sales ADD COLUMN keywords TEXT NOT NULL DEFAULT ''");
}

const upsertProduct = database.prepare(`
  INSERT INTO platform_products (
    platform, platform_product_id, title, detail_url, price, price_with_fee,
    transacted_at, product_code, status, collected_at, updated_at
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'indexed', ?, ?)
  ON CONFLICT(platform, platform_product_id) DO UPDATE SET
    title=excluded.title, detail_url=excluded.detail_url, price=excluded.price,
    price_with_fee=excluded.price_with_fee, transacted_at=excluded.transacted_at,
    product_code=excluded.product_code, updated_at=excluded.updated_at
`);

const upsertImage = database.prepare(`
  INSERT INTO product_images (
    platform, platform_product_id, image_url, ocr_text, ocr_confidence,
    normalized_box_code, display_box_code, grading_company, scanned_at
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  ON CONFLICT(platform, platform_product_id, image_url) DO UPDATE SET
    ocr_text=excluded.ocr_text, ocr_confidence=excluded.ocr_confidence,
    normalized_box_code=excluded.normalized_box_code,
    display_box_code=excluded.display_box_code,
    grading_company=excluded.grading_company, scanned_at=excluded.scanned_at
`);

const upsertSale = database.prepare(`
  INSERT INTO box_sales (
    normalized_box_code, display_box_code, grading_company, grade, coin_name,
    platform, platform_product_id, detail_url, official_cert_url, price,
    price_with_fee, transacted_at, product_code, evidence_image_url, ocr_text,
    ocr_confidence, verification_status, collected_at
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  ON CONFLICT(normalized_box_code, platform, detail_url) DO UPDATE SET
    grade=excluded.grade, price=excluded.price, price_with_fee=excluded.price_with_fee,
    transacted_at=excluded.transacted_at, evidence_image_url=excluded.evidence_image_url,
    ocr_text=excluded.ocr_text, ocr_confidence=excluded.ocr_confidence,
    verification_status=excluded.verification_status, collected_at=excluded.collected_at
`);

export function saveIndexedProduct(page, images, sales) {
  const now = new Date().toISOString();
  database.exec("BEGIN IMMEDIATE");
  try {
    upsertProduct.run(page.platform, String(page.id), page.title, page.detailUrl, page.price, page.priceWithFee, page.transactedAt, page.productCode, now, now);
    for (const image of images) {
      upsertImage.run(page.platform, String(page.id), image.imageUrl, image.ocrText, image.ocrConfidence, image.box?.normalized ?? null, image.box?.display ?? null, image.box?.company ?? null, now);
    }
    for (const sale of sales) {
      upsertSale.run(sale.normalizedBoxCode, sale.displayBoxCode, sale.gradingCompany, sale.grade, sale.coinName, sale.platform, String(page.id), sale.detailUrl, sale.officialCertUrl, sale.price, sale.priceWithFee, sale.transactedAt, sale.productCode, sale.boxEvidenceImageUrl, sale.ocrText, sale.ocrConfidence, sale.verificationStatus ?? "ocr_pending_review", sale.collectedAt);
    }
    database.exec("COMMIT");
  } catch (error) {
    database.exec("ROLLBACK");
    throw error;
  }
}

export function databaseStats() {
  return {
    products: database.prepare("SELECT COUNT(*) count FROM platform_products").get().count,
    images: database.prepare("SELECT COUNT(*) count FROM product_images").get().count,
    boxes: database.prepare("SELECT COUNT(*) count FROM box_sales").get().count,
  };
}

export { databasePath };
