import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { scoreCoinSearch } from "../app/lib/search-ranking.ts";

type Coin = { coinName: string; slug: string; saleCount: number; keywords?: string };
const index = JSON.parse(await readFile(new URL("../public/coin-data/index.json", import.meta.url), "utf8")) as { coins: Coin[] };

function topNames(query: string) {
  return index.coins
    .map((coin) => ({ ...coin, score: scoreCoinSearch(query, coin) }))
    .filter((coin) => coin.score > 0)
    .sort((a, b) => b.score - a.score || b.saleCount - a.saleCount)
    .slice(0, 5)
    .map((coin) => coin.coinName);
}

test("real keyword benchmarks return the intended series", () => {
  const cases = [
    ["熊猫", /熊猫/],
    ["袁大头", /袁像/],
    ["吉祥文化", /吉祥文化/],
    ["长城币", /长城币/],
    ["2025中国龙", /^2025年中国龙/],
    ["2024 熊猫 金", /^2024年熊猫.*(?:金|铂)/],
  ] as const;
  for (const [query, expected] of cases) {
    const names = topNames(query);
    assert.ok(names.length > 0, `${query} should have results`);
    assert.match(names[0], expected, `${query} returned an unrelated top result`);
  }
});

test("published box samples resolve to exact records and source pages", async () => {
  for (const code of ["8181356116", "8759006005", "8659989116"]) {
    const payload = JSON.parse(await readFile(new URL(`../public/box-data/${code.slice(0, 2)}/${code}.json`, import.meta.url), "utf8"));
    assert.equal(payload.ok, true);
    assert.equal(payload.match, "exact");
    assert.ok(payload.records.length > 0);
    assert.ok(payload.records.every((record: { normalizedBoxCode: string }) => record.normalizedBoxCode === code));
    assert.ok(payload.records.every((record: { detailUrl: string }) => /^https:\/\/(?:zhaoonline\.com|www\.yjzx\.com)\//.test(record.detailUrl)));
  }
});
