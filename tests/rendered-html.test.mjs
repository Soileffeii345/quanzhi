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
