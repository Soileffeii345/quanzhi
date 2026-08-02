type CandidateItem = {
  platform: "易金在线" | "赵涌在线";
  externalId: string;
  title: string;
  detailUrl: string;
  imageUrls: string[];
  price: number | null;
  transactedAt: string | null;
  productCode: string | null;
  pageText: string;
};

const jsonHeaders = {
  "content-type": "application/json; charset=utf-8",
  "access-control-allow-origin": "https://quanzhi.netlify.app",
  "cache-control": "no-store",
};

function clean(value: string) {
  return value.replace(/<script[\s\S]*?<\/script>/gi, " ").replace(/<style[\s\S]*?<\/style>/gi, " ").replace(/<[^>]+>/g, " ").replace(/&nbsp;|&#160;/g, " ").replace(/&amp;/g, "&").replace(/\s+/g, " ").trim();
}

function extract(pattern: RegExp, value: string) {
  return value.match(pattern)?.[1]?.trim() ?? null;
}

async function boundedText(url: string, init?: RequestInit) {
  const response = await fetch(url, { ...init, signal: AbortSignal.timeout(10000) });
  if (!response.ok) throw new Error(`${new URL(url).hostname} ${response.status}`);
  const length = Number(response.headers.get("content-length") || 0);
  if (length > 2_000_000) throw new Error("页面超过2MB限制");
  return (await response.text()).slice(0, 2_000_000);
}

function absoluteUrls(html: string, pattern: RegExp, base: string, limit: number) {
  const values = Array.from(html.matchAll(pattern), (match) => match[1]).filter(Boolean);
  return Array.from(new Set(values.map((value) => new URL(value, base).toString()))).slice(0, limit);
}

async function collectYijin(): Promise<CandidateItem[]> {
  const listUrl = "https://www.yjzx.com/web2020/material/list.html";
  const list = await boundedText(listUrl, { headers: { "user-agent": "QuanzhiCollector/1.0 (+daily public index)" } });
  const links = absoluteUrls(list, /href=["']([^"']*\/web2020\/sell\/detail\/\d+\.html)["']/gi, listUrl, 12);
  const settled = await Promise.allSettled(links.map(async (detailUrl) => {
    const html = await boundedText(detailUrl, { headers: { "user-agent": "QuanzhiCollector/1.0 (+daily public index)" } });
    const text = clean(html);
    const externalId = detailUrl.match(/\/(\d+)\.html$/)?.[1] ?? detailUrl;
    const title = extract(/<title>([^<]+)/i, html)?.replace(/\s*-\s*易金在线.*$/i, "") || "易金在线商品";
    const images = absoluteUrls(html, /(?:src|data-original)=["']([^"']*AuctionImages[^"']*\.(?:jpg|jpeg|png)[^"']*)["']/gi, detailUrl, 4).filter((url) => !/small_sell|list_sell/.test(url));
    const priceText = extract(/(?:成交价格|成交价|售\s*价|商品价格)[：:]?\s*[￥¥]\s*([0-9,.]+)/, text);
    return { platform: "易金在线", externalId, title, detailUrl, imageUrls: images, price: priceText ? Number(priceText.replaceAll(",", "")) : null, transactedAt: extract(/(?:成交时间|上架时间)[：:]?\s*(20\d{2}-\d{2}-\d{2}(?:\s+\d{2}:\d{2}(?::\d{2})?)?)/, text), productCode: extract(/产品编号[：:]?\s*([A-Z0-9-]+)/i, text), pageText: text } satisfies CandidateItem;
  }));
  return settled.flatMap((result) => result.status === "fulfilled" ? [result.value] : []);
}

async function collectZhao(): Promise<CandidateItem[]> {
  const searchUrl = "https://zhaoonline.com/query.shtml";
  const list = await boundedText(searchUrl, { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded; charset=UTF-8", accept: "text/html", referer: "https://zhaoonline.com/trade/qianbi/" }, body: new URLSearchParams({ keyword: "NGC", "q.types": "1" }) });
  const links = absoluteUrls(list, /href=["']([^"']+\/\d+\.shtml)["']/gi, "https://zhaoonline.com", 8).filter((url) => !/jiteyoupiao|cika/.test(url));
  const settled = await Promise.allSettled(links.map(async (detailUrl) => {
    const html = await boundedText(detailUrl, { headers: { accept: "text/html", referer: "https://zhaoonline.com/trade/qianbi/" } });
    const text = clean(html);
    const externalId = detailUrl.match(/\/(\d+)\.shtml$/)?.[1] ?? detailUrl;
    const title = extract(/<title>([^<]+)/i, html)?.replace(/[-_].*赵涌在线.*$/i, "") || "赵涌在线藏品";
    const images = absoluteUrls(html, /data-original=["'](https:\/\/img3\.zhaoonline\.com\/[^"']+)["']/gi, detailUrl, 4).map((url) => url.replace(/!\d+(?:x\d+)?$/, "!800x800"));
    const priceText = extract(/[￥¥]\s*([0-9,.]+)/, text);
    return { platform: "赵涌在线", externalId, title, detailUrl, imageUrls: images, price: priceText ? Number(priceText.replaceAll(",", "")) : null, transactedAt: extract(/(20\d{2}-\d{2}-\d{2}(?:\s+\d{2}:\d{2}(?::\d{2})?))/, text), productCode: null, pageText: text } satisfies CandidateItem;
  }));
  return settled.flatMap((result) => result.status === "fulfilled" ? [result.value] : []);
}

async function saveItems(env: Env, platform: string, items: CandidateItem[]) {
  const now = new Date().toISOString();
  for (const item of items) {
    await env.DB.prepare(`INSERT INTO platform_items (platform,external_id,title,detail_url,price_cny,price_label,transacted_at,product_code,status,first_seen_at,last_seen_at)
      VALUES (?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(platform,external_id) DO UPDATE SET title=excluded.title,detail_url=excluded.detail_url,price_cny=excluded.price_cny,transacted_at=excluded.transacted_at,product_code=excluded.product_code,last_seen_at=excluded.last_seen_at`)
      .bind(item.platform, item.externalId, item.title, item.detailUrl, item.price, item.platform === "易金在线" ? "成交价/页面价" : "当前价/页面价", item.transactedAt, item.productCode, "observed", now, now).run();
    const row = await env.DB.prepare("SELECT id FROM platform_items WHERE platform=? AND external_id=?").bind(item.platform, item.externalId).first<{ id: number }>();
    if (!row) continue;
    for (const imageUrl of item.imageUrls) {
      await env.DB.prepare("INSERT INTO item_images (item_id,image_url,ocr_status,created_at,updated_at) VALUES (?,?,?,?,?) ON CONFLICT(item_id,image_url) DO UPDATE SET updated_at=excluded.updated_at")
        .bind(row.id, imageUrl, "pending", now, now).run();
    }
    for (const code of Array.from(item.pageText.matchAll(/\b(\d{7}-\d{3})\b/g), (match) => match[1])) {
      await env.DB.prepare(`INSERT INTO box_records (normalized_box_code,display_box_code,grading_company,grade,coin_name,platform,item_id,detail_url,price_cny,transacted_at,product_code,verification_status,evidence_note,first_seen_at,last_verified_at)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(normalized_box_code,platform,product_code) DO UPDATE SET detail_url=excluded.detail_url,price_cny=excluded.price_cny,transacted_at=excluded.transacted_at,last_verified_at=excluded.last_verified_at`)
        .bind(code.replace(/\D/g, ""), code, item.pageText.includes("NGC") ? "NGC" : item.pageText.includes("PCGS") ? "PCGS" : null, null, item.title, item.platform, row.id, item.detailUrl, item.price, item.transactedAt, item.productCode, "page_text_exact", "平台公开页面文字包含完整盒号。", now, now).run();
    }
  }
  console.log(JSON.stringify({ event: "collector_save", platform, items: items.length, at: now }));
}

async function runCollection(env: Env) {
  const sources = [{ name: "易金在线", collect: collectYijin }, { name: "赵涌在线", collect: collectZhao }] as const;
  for (const source of sources) {
    const startedAt = new Date().toISOString();
    const run = await env.DB.prepare("INSERT INTO crawl_runs (started_at,status,platform) VALUES (?,?,?) RETURNING id").bind(startedAt, "running", source.name).first<{ id: number }>();
    try {
      const items = await source.collect();
      await saveItems(env, source.name, items);
      await env.DB.prepare("UPDATE crawl_runs SET finished_at=?,status='success',pages_checked=?,items_found=?,items_updated=? WHERE id=?").bind(new Date().toISOString(), items.length + 1, items.length, items.length, run?.id).run();
    } catch (error) {
      const message = error instanceof Error ? error.message.slice(0, 500) : "unknown";
      await env.DB.prepare("UPDATE crawl_runs SET finished_at=?,status='failed',error_message=? WHERE id=?").bind(new Date().toISOString(), message, run?.id).run();
      console.error(JSON.stringify({ event: "collector_failure", platform: source.name, message }));
    }
  }
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: { ...jsonHeaders, "access-control-allow-methods": "GET,OPTIONS" } });
    if (url.pathname === "/health") return Response.json({ ok: true, service: "quanzhi-coin-collector" }, { headers: jsonHeaders });
    if (url.pathname === "/records") {
      const query = (url.searchParams.get("q") || "").replace(/\D/g, "");
      if (query.length < 7 || query.length > 12) return Response.json({ ok: false, error: "请输入完整或至少7位盒号", records: [] }, { status: 400, headers: jsonHeaders });
      const exact = query.length >= 10;
      const result = exact
        ? await env.DB.prepare("SELECT * FROM box_records WHERE normalized_box_code=? ORDER BY transacted_at DESC LIMIT 50").bind(query).all()
        : await env.DB.prepare("SELECT * FROM box_records WHERE normalized_box_code LIKE ? ORDER BY transacted_at DESC LIMIT 50").bind(`${query}%`).all();
      return Response.json({ ok: true, query, match: exact ? "exact" : "prefix", records: result.results }, { headers: jsonHeaders });
    }
    if (url.pathname === "/stats") {
      const [boxes, items, pending, lastRuns] = await env.DB.batch([
        env.DB.prepare("SELECT COUNT(*) AS count FROM box_records"), env.DB.prepare("SELECT COUNT(*) AS count FROM platform_items"), env.DB.prepare("SELECT COUNT(*) AS count FROM item_images WHERE ocr_status='pending'"), env.DB.prepare("SELECT platform,status,started_at,finished_at,items_found,error_message FROM crawl_runs ORDER BY id DESC LIMIT 10"),
      ]);
      return Response.json({ ok: true, boxes: boxes.results[0], items: items.results[0], pendingImages: pending.results[0], lastRuns: lastRuns.results }, { headers: jsonHeaders });
    }
    return Response.json({ ok: false, error: "Not found" }, { status: 404, headers: jsonHeaders });
  },
  async scheduled(_controller: ScheduledController, env: Env, ctx: ExecutionContext): Promise<void> {
    ctx.waitUntil(runCollection(env));
  },
} satisfies ExportedHandler<Env>;
