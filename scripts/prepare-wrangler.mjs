#!/usr/bin/env node

import { existsSync } from "node:fs";
import { unlink, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const serverDir = resolve(root, "dist", "server");
const clientIndex = resolve(root, "dist", "client", "index.html");

if (!existsSync(resolve(serverDir, "index.js"))) {
  throw new Error("dist/server/index.js 不存在，请先运行 vinext build");
}

// Let the Worker handle route rendering instead of serving a stale static shell.
if (existsSync(clientIndex)) await unlink(clientIndex);

const config = {
  "$schema": "../../node_modules/wrangler/config-schema.json",
  name: "quanzhi",
  main: "index.js",
  compatibility_date: "2026-08-10",
  compatibility_flags: ["nodejs_compat"],
  no_bundle: true,
  assets: {
    directory: "../client",
    binding: "ASSETS",
  },
  observability: {
    enabled: true,
    head_sampling_rate: 1,
  },
  rules: [{ type: "ESModule", globs: ["**/*.js", "**/*.mjs"] }],
};

await writeFile(resolve(serverDir, "wrangler.jsonc"), `${JSON.stringify(config, null, 2)}\n`);
console.log("Prepared dist/server/wrangler.jsonc for Cloudflare Workers");
