import { writeFile } from "node:fs/promises";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { database } from "./database.mjs";
import { PUBLISHED_SALE_STATUSES, sqlIn } from "./publication-policy.mjs";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");

const rows = database.prepare(`
  SELECT display_box_code, grading_company, grade, coin_name,
         platform, detail_url, official_cert_url, evidence_image_url,
         price, price_with_fee, transacted_at,
         verification_status, product_code
  FROM box_sales
  WHERE verification_status IN (${sqlIn(PUBLISHED_SALE_STATUSES)})
  ORDER BY transacted_at DESC
`).all();

const stats = database.prepare(`
  SELECT platform, verification_status, COUNT(*) as cnt
  FROM box_sales
  WHERE verification_status IN (${sqlIn(PUBLISHED_SALE_STATUSES)})
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
  verified: "✅ 已售",
  image_exact: "🖼️ 已售",
  official_pending: "已售",
  active_listing: "🟢 在售",
  ocr_pending_review: "已售",
  ocr_double_match: "已售",
  youbao_trade: "已售",
  youbao_active: "🟢 在售",
  transaction_check_failed: "❌ 已售",
  ocr_mismatch: "⚠️ 已售",
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
  statsHtml += `<div style="background:#f9fafb;border-radius:10px;padding:16px;margin-bottom:12px;">
    <b style="font-size:16px;color:${platformColors[platform] || "#1f2937"}">${esc(platform)}</b>
    <span style="float:right;font-size:20px;font-weight:700">${total}</span>
    <div style="margin-top:4px;font-size:13px;color:#6b7280">
      ${items.map((i) => `${statusMap[i.verification_status] || i.verification_status} ${i.cnt}`).join(" · ")}
    </div>
  </div>`;
}

let tableRows = "";
for (const r of rows) {
  tableRows += `<tr>
    <td><code>${esc(r.display_box_code)}</code></td>
    <td>${esc(r.grading_company)} ${esc(r.grade)}</td>
    <td>${esc(r.coin_name)}</td>
    <td style="color:${platformColors[r.platform] || "#1f2937"};font-weight:500">${esc(r.platform)}</td>
    <td style="text-align:right;font-weight:600">${r.price !== null ? `¥${r.price.toLocaleString()}` : "—"}</td>
    <td style="font-size:12px;color:#6b7280">${esc(r.transacted_at) || "—"}</td>
    <td style="font-size:12px">${statusMap[r.verification_status] || esc(r.verification_status)}</td>
    <td style="font-size:12px">${r.detail_url ? `<a href="${esc(r.detail_url)}" target="_blank">交易页↗</a>` : "—"}</td>
    <td style="font-size:12px">${r.official_cert_url ? `<a href="${esc(r.official_cert_url)}" target="_blank">NGC/PCGS↗</a>` : "—"}</td>
    <td style="font-size:12px">${r.evidence_image_url ? `<a href="${esc(r.evidence_image_url)}" target="_blank">标签图↗</a>` : "—"}</td>
  </tr>`;
}

const earliest = rows.length > 0 ? rows[rows.length - 1].transacted_at : "";
const latest = rows.length > 0 ? rows[0].transacted_at : "";

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
  body { font-family: -apple-system, "Segoe UI", sans-serif; background: #fff; color: #1f2937; }
  .topbar { display: flex; align-items: center; gap: 16px; padding: 12px 20px; border-bottom: 1px solid #e5e7eb; }
  .brand { font-size: 18px; font-weight: 700; text-decoration: none; color: #1f2937; }
  .brand-seal { display: inline-block; width: 24px; height: 24px; background: #1f2937; color: #fff; border-radius: 4px; text-align: center; line-height: 24px; font-size: 14px; margin-right: 6px; }
  .container { max-width: 1200px; margin: 0 auto; padding: 24px 16px; }
  .stats-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 12px; margin-bottom: 20px; }
  .filter-bar { display: flex; flex-wrap: wrap; gap: 10px; align-items: center; margin-bottom: 16px; }
  .filter-bar input[type="text"] { flex: 1; min-width: 200px; padding: 9px 12px; font-size: 14px; border: 1px solid #d1d5db; border-radius: 8px; }
  .filter-bar input[type="text"]:focus { outline: none; border-color: #3b82f6; box-shadow: 0 0 0 3px rgba(59,130,246,0.1); }
  .filter-bar input[type="date"] { padding: 8px 10px; font-size: 13px; border: 1px solid #d1d5db; border-radius: 8px; color: #374151; }
  .filter-bar input[type="date"]:focus { outline: none; border-color: #3b82f6; }
  .filter-bar .sep { color: #d1d5db; font-size: 13px; }
  .status-tabs { display: flex; gap: 0; border: 1px solid #d1d5db; border-radius: 8px; overflow: hidden; }
  .status-tab { padding: 8px 16px; font-size: 13px; cursor: pointer; background: #fff; color: #6b7280; border: none; border-right: 1px solid #d1d5db; transition: all .15s; }
  .status-tab:last-child { border-right: none; }
  .status-tab:hover { background: #f9fafb; }
  .status-tab.active { background: #eff4ff; color: #155eef; font-weight: 600; }
  .info { font-size: 14px; color: #6b7280; margin-bottom: 16px; }
  table { width: 100%; border-collapse: collapse; font-size: 13px; }
  thead th { padding: 10px 12px; text-align: left; font-weight: 600; color: #6b7280; background: #f9fafb; border-bottom: 2px solid #e5e7eb; position: sticky; top: 0; z-index: 1; }
  tbody td { padding: 8px 12px; border-bottom: 1px solid #f3f4f6; }
  tbody tr:hover { background: #f9fafb; }
  code { font-size: 12px; background: #f3f4f6; padding: 2px 6px; border-radius: 4px; }
  a { color: #3b82f6; text-decoration: none; }
  a:hover { text-decoration: underline; }
  .count { font-size: 13px; color: #9ca3af; }
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
  <a href="/" class="brand"><span class="brand-seal">泉</span>泉知</a>
  <nav style="display:flex;gap:16px;font-size:14px">
    <a href="/">查行情</a>
    <a href="/coin">币种详情</a>
    <a href="/collection">我的收藏</a>
    <a href="/database" style="font-weight:600">数据库</a>
  </nav>
</header>
<div class="container">
  <h2 style="font-size:22px;margin-bottom:4px">📦 全部盒号数据</h2>
  <p style="font-size:14px;color:#6b7280;margin-bottom:20px">
    收录 <b>${rows.length}</b> 条记录，覆盖 ${platformSummary.size} 个交易平台。数据时间范围: ${earliest} ~ ${latest}
  </p>
  <div class="stats-grid">${statsHtml}</div>

  <div class="filter-bar">
    <input type="text" id="filter" placeholder="搜索盒号 / 币名 / 平台 / 评级…" autofocus/>
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
          <th style="text-align:right">价格</th>
          <th>时间</th>
          <th>状态</th>
          <th>交易页</th>
          <th>官方认证</th>
          <th>标签图</th>
        </tr>
      </thead>
      <tbody id="tbody">${tableRows}</tbody>
    </table>
  </div>
</div>
<script>
  const statuses = ${JSON.stringify(rowSaleStatuses)};
  let activeStatus = 'all';
  let dateFrom = '';
  let dateTo = '';

  function applyFilters() {
    const q = document.getElementById('filter').value.toLowerCase().trim();
    const rows = document.querySelectorAll('tbody tr');
    let visible = 0;
    rows.forEach(function(tr, i) {
      let show = true;
      // text search
      if (q && !tr.textContent.toLowerCase().includes(q)) show = false;
      // status filter
      if (activeStatus === 'sold' && statuses[i] !== 'sold') show = false;
      if (activeStatus === 'active' && statuses[i] !== 'active') show = false;
      // date range
      const dateCell = tr.querySelectorAll('td')[5];
      if (dateCell && (dateFrom || dateTo)) {
        const rowDate = dateCell.textContent.trim();
        if (dateFrom && rowDate < dateFrom) show = false;
        if (dateTo && rowDate > dateTo) show = false;
      }
      tr.style.display = show ? '' : 'none';
      if (show) visible++;
    });
    document.getElementById('visibleCount').textContent = visible;
    document.getElementById('filterHint').textContent =
      (q || activeStatus !== 'all' || dateFrom || dateTo) ? '（已筛选）' : '（使用上方筛选器过滤）';
  }

  document.getElementById('filter').addEventListener('input', applyFilters);

  document.getElementById('dateFrom').addEventListener('change', function(e) {
    dateFrom = e.target.value;
    applyFilters();
  });
  document.getElementById('dateTo').addEventListener('change', function(e) {
    dateTo = e.target.value;
    applyFilters();
  });
  document.getElementById('dateClear').addEventListener('click', function() {
    document.getElementById('dateFrom').value = '';
    document.getElementById('dateTo').value = '';
    dateFrom = '';
    dateTo = '';
    applyFilters();
  });

  document.getElementById('statusTabs').addEventListener('click', function(e) {
    const tab = e.target.closest('.status-tab');
    if (!tab) return;
    document.querySelectorAll('.status-tab').forEach(function(t) { t.classList.remove('active'); });
    tab.classList.add('active');
    activeStatus = tab.dataset.status;
    applyFilters();
  });
</script>
</body>
</html>`;

const outputPath = resolve(projectRoot, "public", "database.html");
await writeFile(outputPath, html);
process.stdout.write(`Database browser written to ${outputPath} (${rows.length} rows)\n`);
