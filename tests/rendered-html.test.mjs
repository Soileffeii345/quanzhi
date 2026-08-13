import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);

async function readJson(path) {
  return JSON.parse(await readFile(new URL(path, root), "utf8"));
}

test("ships the current Next.js search experience", async () => {
  const [layout, homepage, hero, coinPage] = await Promise.all([
    readFile(new URL("app/layout.tsx", root), "utf8"),
    readFile(new URL("app/page.tsx", root), "utf8"),
    readFile(new URL("app/components/Hero.tsx", root), "utf8"),
    readFile(new URL("app/coin/page.tsx", root), "utf8"),
  ]);

  assert.match(layout, /泉知｜评级盒号与钱币成交查询/);
  assert.match(`${homepage}${hero}`, /搜索钱币名称或评级盒号/);
  assert.match(hero, /api\/suggest/);
  assert.match(hero, /coin-data\/index\.json/);
  assert.match(coinPage, /PriceTrend/);
  assert.match(coinPage, /最低价格/);
  assert.match(coinPage, /我的收藏|收藏币种/);
  assert.doesNotMatch(`${layout}${homepage}${hero}${coinPage}`, /Your site is taking shape|Building your site/i);
});

test("ships the generated data manifests used by the homepage", async () => {
  const [boxes, coins] = await Promise.all([
    readJson("public/box-data/manifest.json"),
    readJson("public/coin-data/index.json"),
  ]);

  assert.ok(Number.isInteger(boxes.verifiedBoxes) && boxes.verifiedBoxes > 0);
  assert.ok(Number.isInteger(boxes.verifiedSales) && boxes.verifiedSales > 0);
  assert.ok(Number.isInteger(coins.totalCoins) && coins.totalCoins > 0);
  assert.equal(coins.totalSales, boxes.verifiedSales);
});

test("database page exposes truthful freshness and combinable filters", async () => {
  const [databasePage, boxes, coins] = await Promise.all([
    readFile(new URL("public/database.html", root), "utf8"),
    readJson("public/box-data/manifest.json"),
    readJson("public/coin-data/index.json"),
  ]);
  assert.match(databasePage, /数据页面生成于/);
  assert.match(databasePage, /更新失败时继续保留上一版已验证数据/);
  assert.match(databasePage, /全部平台/);
  assert.match(databasePage, /商品状态/);
  assert.match(databasePage, /核验状态/);
  assert.match(databasePage, /原交易页已核对 · 评级机构官网待复核/);
  assert.doesNotMatch(databasePage, /成交页已核验/);
  assert.match(databasePage, /原交易页在售状态已核对/);
  assert.match(databasePage, /activePlatform !== 'all'/);
  assert.match(databasePage, /const pageSize = 100/);
  assert.match(databasePage, /上一页/);
  assert.match(databasePage, /下一页/);
  assert.doesNotMatch(databasePage, new RegExp(`<b>${boxes.verifiedSales}</b> 条原成交页核验记录`));
  assert.match(databasePage, /统计数量不在页面公开展示/);
  assert.doesNotMatch(databasePage, /当前发现 <b>\d+<\/b> 个在售商品/);
  assert.doesNotMatch(databasePage, /class="stats-grid">/);
  assert.doesNotMatch(databasePage, /已确认在售 \d+/);
  assert.doesNotMatch(databasePage, /旧记录 \d+/);
  assert.equal(coins.totalSales, boxes.verifiedSales);
});

test("daily update blocks publication until audits and tests pass", async () => {
  const [workflow, updater, platformPanel, transactionVerifier, reconciler] = await Promise.all([
    readFile(new URL(".github/workflows/daily-update.yml", root), "utf8"),
    readFile(new URL("collector/daily-lightweight.mjs", root), "utf8"),
    readFile(new URL("app/components/PlatformRecords.tsx", root), "utf8"),
    readFile(new URL("collector/verify-official-and-transaction.mjs", root), "utf8"),
    readFile(new URL("collector/reconcile-listing-status.mjs", root), "utf8"),
  ]);
  assert.match(workflow, /schedule:/);
  assert.match(workflow, /data:update -- --quick/);
  assert.match(updater, /daily-quick/);
  assert.match(updater, /weekly-deep/);
  assert.match(workflow, /npm run data:audit/);
  assert.match(workflow, /npm test/);
  assert.match(workflow, /git push origin HEAD:main/);
  assert.match(updater, /audit-data\.mjs/);
  assert.match(transactionVerifier, /transaction\.inconclusive\s*\?\s*record\.verification_status/);
  assert.match(transactionVerifier, /sourceStatus === "3"/);
  assert.match(reconciler, /row\.listing_status === "unknown"/);
  assert.match(updater, /保留上一版网站数据/);
  assert.match(platformPanel, /已检索泉知接入平台：赵涌在线、易金在线/);
});

test("all coin summaries use the latest priced transaction by transaction time", async () => {
  const index = await readJson("public/coin-data/index.json");
  assert.equal(index.coins.length, index.totalCoins);

  for (const summary of index.coins) {
    const detail = await readJson(`public/coin-data/${summary.slug.slice(0, 2)}/${summary.slug}.json`);
    assert.equal(detail.coinName, summary.coinName);
    assert.equal(detail.records.length, summary.saleCount);

    const datedRecords = detail.records.filter((record) => record.transactedAt);
    for (let i = 1; i < datedRecords.length; i += 1) {
      assert.ok(
        datedRecords[i - 1].transactedAt >= datedRecords[i].transactedAt,
        `${summary.coinName} records are not newest-first`,
      );
    }

    const latestPriced = detail.records.find((record) => record.price !== null);
    assert.equal(detail.priceStats.latest, latestPriced?.price ?? null, `${summary.coinName} detail latest price`);
    assert.equal(summary.latestPrice, latestPriced?.price ?? null, `${summary.coinName} index latest price`);
    assert.equal(summary.latestDate, latestPriced?.transactedAt ?? null, `${summary.coinName} index latest date`);
  }
});
