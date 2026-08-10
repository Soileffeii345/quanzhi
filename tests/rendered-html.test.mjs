import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function render(pathname = "/") {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}-${pathname}`);
  const { default: worker } = await import(workerUrl.href);

  return worker.fetch(
    new Request(`http://localhost${pathname}`, {
      headers: { accept: "text/html" },
    }),
    {
      ASSETS: {
        fetch: async () => new Response("Not found", { status: 404 }),
      },
    },
    {
      waitUntil() {},
      passThroughOnException() {},
    },
  );
}

test("server-renders the Quanzhi search experience", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(html, /<title>泉知｜评级盒号与钱币成交查询<\/title>/);
  assert.match(html, /NGC · PCGS 评级币交易查询/);
  assert.match(html, /搜索钱币名称或评级盒号/);
  assert.match(html, /拍照识别盒号/);
  assert.match(html, /可验证成交记录/);
  assert.doesNotMatch(html, /10,226 条真实成交/);
  assert.doesNotMatch(html, /Your site is taking shape|Building your site/i);
});

test("ships the generated data manifests used by the homepage", async () => {
  const [boxManifest, coinIndex] = await Promise.all([
    readFile(new URL("../dist/box-data/manifest.json", import.meta.url), "utf8"),
    readFile(new URL("../dist/coin-data/index.json", import.meta.url), "utf8"),
  ]);

  const boxes = JSON.parse(boxManifest);
  const coins = JSON.parse(coinIndex);
  assert.ok(Number.isInteger(boxes.verifiedBoxes) && boxes.verifiedBoxes > 0);
  assert.ok(Number.isInteger(boxes.verifiedSales) && boxes.verifiedSales > 0);
  assert.ok(Number.isInteger(coins.totalCoins) && coins.totalCoins > 0);
  assert.equal(coins.totalSales, boxes.verifiedSales);
});
