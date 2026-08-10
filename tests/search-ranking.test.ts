import assert from "node:assert/strict";
import test from "node:test";
import { normalizeCertificateQuery, scoreCoinSearch } from "../app/lib/search-ranking.ts";

const coin = (coinName: string, keywords = "", saleCount = 1) => ({ coinName, keywords, saleCount });

test("prefix suggestions rank partial Latin and Chinese queries", () => {
  assert.ok(scoreCoinSearch("ab", coin("abbb")) > 0);
  assert.ok(scoreCoinSearch("ab", coin("abbc")) > 0);
  assert.ok(scoreCoinSearch("熊猫", coin("2024年熊猫金币", "熊猫,金币")) > 0);
});

test("numeric terms must match exactly", () => {
  assert.ok(scoreCoinSearch("2024 熊猫 金", coin("2024年熊猫金币", "2024年,熊猫,金")) > 0);
  assert.equal(scoreCoinSearch("2024 熊猫 金", coin("2012年熊猫金币", "2012年,熊猫,金")), 0);
});

test("Chinese fuzzy matching does not cross product series", () => {
  assert.equal(scoreCoinSearch("2025中国龙", coin("2025年中国人民纪念币", "2025年,中国人民")), 0);
  assert.ok(scoreCoinSearch("2025中国龙", coin("2025年中国龙银币", "2025年,中国龙")) > 0);
});

test("certificate normalization accepts common formats without confusing coin years", () => {
  assert.deepEqual(normalizeCertificateQuery("NGC 8181356-116"), { company: "NGC", digits: "8181356116", isLikelyCertificate: true });
  assert.equal(normalizeCertificateQuery("2024年30克熊猫金币").isLikelyCertificate, false);
});
