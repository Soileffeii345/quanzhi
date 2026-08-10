import { readFile, writeFile } from "node:fs/promises";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { database } from "./database.mjs";
import { ACTIVE_LISTING_STATUSES, PUBLISHED_SALE_STATUSES, sqlIn } from "./publication-policy.mjs";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const generatedAt = new Intl.DateTimeFormat("zh-CN", {
  timeZone: "Asia/Shanghai",
  year: "numeric", month: "2-digit", day: "2-digit",
  hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false,
}).format(new Date()).replaceAll("/", "-");
let updateState = null;
try {
  updateState = JSON.parse(await readFile(resolve(projectRoot, "collector", "data", "last-update.json"), "utf8"));
} catch {}
const databaseStatuses = [...PUBLISHED_SALE_STATUSES, ...ACTIVE_LISTING_STATUSES];

const rows = database.prepare(`
  SELECT display_box_code, grading_company, grade, coin_name,
         platform, detail_url, official_cert_url, evidence_image_url,
         price, price_with_fee, transacted_at, collected_at,
         verification_status, product_code
  FROM box_sales
  WHERE verification_status IN (${sqlIn(databaseStatuses)})
  ORDER BY CASE
    WHEN verification_status IN (${sqlIn(ACTIVE_LISTING_STATUSES)}) THEN collected_at
    ELSE transacted_at
  END DESC
`).all();

const stats = database.prepare(`
  SELECT platform, verification_status, COUNT(*) as cnt
  FROM box_sales
  WHERE verification_status IN (${sqlIn(databaseStatuses)})
  GROUP BY platform, verification_status
  ORDER BY platform, cnt DESC
`).all();

function esc(str) {
  return String(str ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

const statusMap = {
  verified: "双重核验成交",
  image_exact: "成交页核验通过",
  official_pending: "成交页已核验 · 官方待复核",
  active_listing: "🟣 原页面在售",
  ocr_pending_review: "待人工复核",
  ocr_double_match: "盒号双重识别",
  youbao_trade: "成交页核验通过",
  youbao_active: "🟣 原页面在售",
  transaction_check_failed: "原页面复核失败",
  ocr_mismatch: "盒号识别不一致",
};

const platformColors = {
  "赵涌在线": "#3b82f6",
  "易金在线": "#f59e0b",
  "邮宝": "#10b981",
};

const platformSummary = Map.groupBy(stats, (s) => s.platform);
let statsHtml = "";
for (const [platform, items] of platformSummary) {
  const total = items.reduce((s, i) => s + i.cnt, 0);
  const soldCount = items
    .filter((item) => PUBLISHED_SALE_STATUSES.includes(item.verification_status))
    .reduce((sum, item) => sum + item.cnt, 0);
  const activeCount = items
    .filter((item) => ACTIVE_LISTING_STATUSES.includes(item.verification_status))
    .reduce((sum, item) => sum + item.cnt, 0);
  const activeLabel = platform === "易金在线" && activeCount === 0
    ? '<span style="color:#b54708">●</span> 在售数据待接入'
    : `<span style="color:#7a5ce5">●</span> 在售 ${activeCount}`;
  statsHtml += `<div style="background:#f9fafb;border-radius:10px;padding:16px;margin-bottom:12px;">
    <b style="font-size:16px;color:${platformColors[platform] || "#1f2937"}">${esc(platform)}</b>
    <span style="float:right;font-size:20px;font-weight:700">${total}</span>
    <div style="margin-top:4px;font-size:13px;color:#6b7280">
      <span style="color:#067647">●</span> 已成交 ${soldCount} · ${activeLabel}
    </div>
  </div>`;
}

let tableRows = "";
for (const r of rows) {
  const isActive = ACTIVE_LISTING_STATUSES.includes(r.verification_status);
  const displayTime = isActive ? r.collected_at : r.transacted_at;
  tableRows += `<tr>
    <td><code>${esc(r.display_box_code)}</code></td>
    <td>${esc(r.grading_company)} ${esc(r.grade)}</td>
    <td>${esc(r.coin_name)}</td>
    <td style="color:${platformColors[r.platform] || "#1f2937"};font-weight:500">${esc(r.platform)}</td>
    <td style="text-align:right;font-weight:600">${r.price !== null ? `${isActive ? "报价 " : "成交 "}¥${r.price.toLocaleString()}` : "—"}</td>
    <td style="font-size:12px;color:#6b7280">${esc(displayTime) || "—"}<br/><span style="font-size:10px;color:#98a2b3">${isActive ? "采集时间" : "成交时间"}</span></td>
    <td style="font-size:12px">${statusMap[r.verification_status] || esc(r.verification_status)}</td>
    <td style="font-size:12px">${r.detail_url ? `<a href="${esc(r.detail_url)}" target="_blank">交易页↗</a>` : "—"}</td>
    <td style="font-size:12px">${r.official_cert_url ? `<a href="${esc(r.official_cert_url)}" target="_blank">NGC/PCGS↗</a>` : "—"}</td>
    <td style="font-size:12px">${r.evidence_image_url ? `<a href="${esc(r.evidence_image_url)}" target="_blank">标签图↗</a>` : "—"}</td>
  </tr>`;
}

const publishedRows = rows.filter((row) => PUBLISHED_SALE_STATUSES.includes(row.verification_status));
const activeRows = rows.filter((row) => ACTIVE_LISTING_STATUSES.includes(row.verification_status));
const earliest = publishedRows.length > 0 ? publishedRows[publishedRows.length - 1].transacted_at : "";
const latest = publishedRows.length > 0 ? publishedRows[0].transacted_at : "";

// Precompute sale status for each row
const rowSaleStatuses = rows.map((r) => {
  const s = r.verification_status;
  if (s === "active_listing" || s === "youbao_active") return "active";
  return "sold";
});

const html = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>泉知 · 数据库全览</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: Inter,"PingFang SC","Microsoft YaHei",system-ui,sans-serif; background: #f7f9fc; color: #101828; }
  .topbar { position:sticky;top:0;z-index:20;height:68px;max-width:1200px;margin:auto;padding:0 28px;display:flex;align-items:center;justify-content:space-between;background:rgba(255,255,255,.92);backdrop-filter:blur(16px);border-bottom:1px solid #eaecf0; }
  .brand { color:#101828;text-decoration:none;display:flex;align-items:center;gap:11px;font-size:19px;font-weight:700; }
  .brand-seal { display:grid;place-items:center;width:34px;height:34px;border-radius:10px;background:#155eef;color:#fff;font-weight:700;font-size:16px;box-shadow:0 5px 14px rgba(21,94,239,.22); }
  .topbar nav { display:flex;gap:32px;height:100%; }
  .topbar nav a { display:flex;align-items:center;color:#667085;text-decoration:none;font-size:13px;position:relative; }
  .topbar nav a.active { color:#155eef;font-weight:700; }
  .topbar nav a.active:after { content:"";position:absolute;left:0;right:0;bottom:0;height:3px;background:#155eef;border-radius:3px 3px 0 0; }
  .container { max-width: 1200px; margin: 0 auto; padding: 24px 16px; }
  .stats-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 12px; margin-bottom: 20px; }
  .filter-bar { display: flex; flex-wrap: wrap; gap: 10px; align-items: center; margin-bottom: 16px; }
  .filter-bar input[type="text"] { flex: 1; min-width: 200px; padding: 9px 12px; font-size: 14px; border: 1px solid #d1d5db; border-radius: 8px; }
  .filter-bar input[type="text"]:focus { outline: none; border-color: #3b82f6; box-shadow: 0 0 0 3px rgba(59,130,246,0.1); }
  .filter-bar input[type="date"] { padding: 8px 10px; font-size: 13px; border: 1px solid #d1d5db; border-radius: 8px; color: #374151; }
  .filter-bar select { padding: 8px 30px 8px 10px; font-size: 13px; border: 1px solid #d1d5db; border-radius: 8px; color: #374151; background:#fff; }
  .filter-bar input[type="date"]:focus { outline: none; border-color: #3b82f6; }
  .filter-bar .sep { color: #d1d5db; font-size: 13px; }
  .status-tabs { display: flex; gap: 0; border: 1px solid #d1d5db; border-radius: 8px; overflow: hidden; }
  .status-tab { padding: 8px 16px; font-size: 13px; cursor: pointer; background: #fff; color: #6b7280; border: none; border-right: 1px solid #d1d5db; transition: all .15s; }
  .status-tab:last-child { border-right: none; }
  .status-tab:hover { background: #f9fafb; }
  .status-tab.active { background: #eff4ff; color: #155eef; font-weight: 600; }
  .info { font-size: 14px; color: #6b7280; margin-bottom: 16px; }
  .freshness { margin:-8px 0 18px; padding:10px 12px; border:1px solid #d1fadf; border-radius:8px; background:#f6fef9; color:#067647; font-size:13px; }
  table { width: 100%; border-collapse: collapse; font-size: 13px; }
  thead th { padding: 10px 12px; text-align: left; font-weight: 600; color: #6b7280; background: #f9fafb; border-bottom: 2px solid #e5e7eb; position: sticky; top: 0; z-index: 1; }
  tbody td { padding: 8px 12px; border-bottom: 1px solid #f3f4f6; }
  tbody tr:hover { background: #f9fafb; }
  code { font-size: 12px; background: #f3f4f6; padding: 2px 6px; border-radius: 4px; }
  a { color: #3b82f6; text-decoration: none; }
  a:hover { text-decoration: underline; }
  .count { font-size: 13px; color: #9ca3af; }
  .pagination { display:flex;align-items:center;justify-content:flex-end;gap:10px;margin:10px 0 0;font-size:13px;color:#667085; }
  .pagination button { padding:6px 12px;border:1px solid #d0d5dd;border-radius:7px;background:#fff;color:#344054;cursor:pointer; }
  .pagination button:disabled { opacity:.4;cursor:not-allowed; }
  .sold-badge { display: inline-block; padding: 2px 6px; border-radius: 4px; background: #ecfdf3; color: #067647; font-size: 11px; font-weight: 600; }
  .active-badge { display: inline-block; padding: 2px 6px; border-radius: 4px; background: #f4f0ff; color: #7a5ce5; font-size: 11px; font-weight: 600; }
  @media (max-width: 768px) {
    .stats-grid { grid-template-columns: 1fr 1fr; }
    .filter-bar { flex-direction: column; align-items: stretch; }
    .filter-bar input[type="text"] { min-width: auto; }
    .status-tabs { align-self: flex-start; }
    th:nth-child(6), td:nth-child(6),
    th:nth-child(8), td:nth-child(8) { display: none; }
  }
</style>
</head>
<body>
<header class="topbar">
  <a href="/" class="brand"><span class="brand-seal">泉</span><span>泉知</span></a>
  <nav aria-label="主导航">
    <a href="/">查行情</a>
    <a href="/coin">币种详情</a>
    <a href="/collection">我的收藏</a>
    <a href="/database.html" class="active">数据库</a>
  </nav>
</header>
<div class="container">
  <h2 style="font-size:22px;margin-bottom:4px">📦 全部盒号数据</h2>
  <p style="font-size:14px;color:#6b7280;margin-bottom:20px">
    收录 <b>${publishedRows.length}</b> 条原成交页核验记录与 <b>${activeRows.length}</b> 条当前在售，覆盖 ${platformSummary.size} 个交易平台。成交时间范围: ${earliest} ~ ${latest}
  </p>
  <div class="freshness">● 数据页面生成于 ${generatedAt}（北京时间） · ${updateState ? `最近一次更新 ${updateState.passed}/${updateState.total} 步通过` : "本地全量审计已通过"} · 更新失败时继续保留上一版已验证数据</div>
  <div class="stats-grid">${statsHtml}</div>

  <div class="filter-bar">
    <input type="text" id="filter" placeholder="搜索盒号 / 币名 / 平台 / 评级…" autofocus/>
    <select id="platformFilter" aria-label="筛选交易平台">
      <option value="all">全部平台</option>
      ${[...platformSummary.keys()].map((platform) => `<option value="${esc(platform)}">${esc(platform)}</option>`).join("")}
    </select>
    <input type="date" id="dateFrom" title="起始日期"/>
    <span class="sep">~</span>
    <input type="date" id="dateTo" title="结束日期"/>
    <span id="dateClear" style="font-size:12px;color:#6b7280;cursor:pointer;user-select:none" title="清除日期">✕ 清除</span>
    <div class="status-tabs" id="statusTabs">
      <button class="status-tab active" data-status="all">全部</button>
      <button class="status-tab" data-status="sold">🟢 已成交</button>
      <button class="status-tab" data-status="active">🟣 在售</button>
    </div>
  </div>

  <p class="info">共 <b id="visibleCount">${rows.length}</b> 条记录 <span class="count" id="filterHint">（使用上方筛选器过滤）</span></p>
  <div style="overflow-x:auto;max-height:70vh;overflow-y:auto;border:1px solid #e5e7eb;border-radius:8px">
    <table>
      <thead>
        <tr>
          <th>盒号</th>
          <th>评级</th>
          <th>币名</th>
          <th>平台</th>
          <th style="text-align:right">成交价 / 当前报价</th>
          <th>成交时间 / 采集时间</th>
          <th>状态</th>
          <th>交易页</th>
          <th>官方认证</th>
          <th>标签图</th>
        </tr>
      </thead>
      <tbody id="tbody">${tableRows}</tbody>
    </table>
  </div>
  <div class="pagination">
    <button id="prevPage" type="button">上一页</button>
    <span id="pageInfo">第 1 页</span>
    <button id="nextPage" type="button">下一页</button>
  </div>
</div>
<script>
  const statuses = ${JSON.stringify(rowSaleStatuses)};
  let activeStatus = 'all';
  let activePlatform = 'all';
  let dateFrom = '';
  let dateTo = '';
  const pageSize = 100;
  let currentPage = 1;

  function applyFilters() {
    const q = document.getElementById('filter').value.toLowerCase().trim();
    const rows = document.querySelectorAll('tbody tr');
    const matched = [];
    rows.forEach(function(tr, i) {
      let show = true;
      // text search
      if (q && !tr.textContent.toLowerCase().includes(q)) show = false;
      // status filter
      if (activeStatus === 'sold' && statuses[i] !== 'sold') show = false;
      if (activeStatus === 'active' && statuses[i] !== 'active') show = false;
      const platformCell = tr.querySelectorAll('td')[3];
      if (activePlatform !== 'all' && platformCell?.textContent.trim() !== activePlatform) show = false;
      // date range
      const dateCell = tr.querySelectorAll('td')[5];
      if (dateCell && (dateFrom || dateTo)) {
        const rowDate = dateCell.textContent.trim();
        if (dateFrom && rowDate < dateFrom) show = false;
        if (dateTo && rowDate > dateTo) show = false;
      }
      tr.style.display = 'none';
      if (show) matched.push(i);
    });
    const pageCount = Math.max(1, Math.ceil(matched.length / pageSize));
    currentPage = Math.min(currentPage, pageCount);
    const start = (currentPage - 1) * pageSize;
    matched.slice(start, start + pageSize).forEach(function(index) { rows[index].style.display = ''; });
    document.getElementById('visibleCount').textContent = matched.length;
    document.getElementById('pageInfo').textContent = '第 ' + currentPage + ' / ' + pageCount + ' 页 · 每页 ' + pageSize + ' 条';
    document.getElementById('prevPage').disabled = currentPage <= 1;
    document.getElementById('nextPage').disabled = currentPage >= pageCount;
    document.getElementById('filterHint').textContent =
      (q || activeStatus !== 'all' || activePlatform !== 'all' || dateFrom || dateTo) ? '（已筛选）' : '（使用上方筛选器过滤）';
  }

  function resetAndFilter() { currentPage = 1; applyFilters(); }
  document.getElementById('filter').addEventListener('input', resetAndFilter);
  document.getElementById('platformFilter').addEventListener('change', function(e) {
    activePlatform = e.target.value;
    resetAndFilter();
  });

  document.getElementById('dateFrom').addEventListener('change', function(e) {
    dateFrom = e.target.value;
    resetAndFilter();
  });
  document.getElementById('dateTo').addEventListener('change', function(e) {
    dateTo = e.target.value;
    resetAndFilter();
  });
  document.getElementById('dateClear').addEventListener('click', function() {
    document.getElementById('dateFrom').value = '';
    document.getElementById('dateTo').value = '';
    dateFrom = '';
    dateTo = '';
    resetAndFilter();
  });

  document.getElementById('statusTabs').addEventListener('click', function(e) {
    const tab = e.target.closest('.status-tab');
    if (!tab) return;
    document.querySelectorAll('.status-tab').forEach(function(t) { t.classList.remove('active'); });
    tab.classList.add('active');
    activeStatus = tab.dataset.status;
    resetAndFilter();
  });
  document.getElementById('prevPage').addEventListener('click', function() {
    if (currentPage > 1) { currentPage--; applyFilters(); }
  });
  document.getElementById('nextPage').addEventListener('click', function() {
    currentPage++; applyFilters();
  });
  applyFilters();
</script>
</body>
</html>`;

const outputPath = resolve(projectRoot, "public", "database.html");
await writeFile(outputPath, html);
process.stdout.write(`Database browser written to ${outputPath} (${rows.length} rows)\n`);
