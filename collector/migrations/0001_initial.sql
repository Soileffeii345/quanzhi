CREATE TABLE IF NOT EXISTS platform_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  platform TEXT NOT NULL,
  external_id TEXT NOT NULL,
  title TEXT NOT NULL,
  detail_url TEXT,
  price_cny REAL,
  price_with_fee_cny REAL,
  price_label TEXT,
  transacted_at TEXT,
  product_code TEXT,
  status TEXT NOT NULL DEFAULT 'observed',
  first_seen_at TEXT NOT NULL,
  last_seen_at TEXT NOT NULL,
  UNIQUE(platform, external_id)
);

CREATE TABLE IF NOT EXISTS item_images (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  item_id INTEGER NOT NULL REFERENCES platform_items(id) ON DELETE CASCADE,
  image_url TEXT NOT NULL,
  image_hash TEXT,
  ocr_text TEXT,
  ocr_confidence REAL,
  ocr_status TEXT NOT NULL DEFAULT 'pending',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(item_id, image_url)
);

CREATE TABLE IF NOT EXISTS box_records (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  normalized_box_code TEXT NOT NULL,
  display_box_code TEXT NOT NULL,
  grading_company TEXT,
  grade TEXT,
  coin_name TEXT NOT NULL,
  platform TEXT NOT NULL,
  item_id INTEGER REFERENCES platform_items(id) ON DELETE SET NULL,
  detail_url TEXT,
  evidence_image_url TEXT,
  price_cny REAL,
  price_with_fee_cny REAL,
  transacted_at TEXT,
  product_code TEXT,
  verification_status TEXT NOT NULL,
  evidence_note TEXT,
  first_seen_at TEXT NOT NULL,
  last_verified_at TEXT,
  UNIQUE(normalized_box_code, platform, product_code)
);

CREATE TABLE IF NOT EXISTS crawl_runs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  started_at TEXT NOT NULL,
  finished_at TEXT,
  status TEXT NOT NULL,
  platform TEXT NOT NULL,
  pages_checked INTEGER NOT NULL DEFAULT 0,
  items_found INTEGER NOT NULL DEFAULT 0,
  items_updated INTEGER NOT NULL DEFAULT 0,
  error_message TEXT
);

CREATE INDEX IF NOT EXISTS idx_box_records_code ON box_records(normalized_box_code);
CREATE INDEX IF NOT EXISTS idx_box_records_coin ON box_records(coin_name);
CREATE INDEX IF NOT EXISTS idx_platform_items_last_seen ON platform_items(platform, last_seen_at);
CREATE INDEX IF NOT EXISTS idx_item_images_ocr_status ON item_images(ocr_status, updated_at);

INSERT OR IGNORE INTO box_records (
  normalized_box_code, display_box_code, grading_company, grade, coin_name,
  platform, detail_url, evidence_image_url, price_cny, price_with_fee_cny,
  transacted_at, product_code, verification_status, evidence_note,
  first_seen_at, last_verified_at
) VALUES (
  '8760880010', '8760880-010', 'NGC', 'PF69 Ultra Cameo',
  '2026年30克吉祥文化如鱼得水彩银币', '易金在线', NULL, NULL,
  1250, 1312, '2026-06-25 20:55:04', 'AA659912',
  'user_screenshot', '用户提供的易金在线成交页截图；价格、含佣价、时间和产品编号可见，原始详情链接尚待复核。',
  '2026-08-02T00:00:00.000Z', NULL
);
