#!/usr/bin/env node

import { createReadStream, createWriteStream, existsSync } from "node:fs";
import { open, rename, stat, unlink } from "node:fs/promises";
import { resolve } from "node:path";
import { pipeline } from "node:stream/promises";
import { createGunzip, createGzip } from "node:zlib";

const root = resolve(import.meta.dirname, "..");
const databasePath = resolve(root, "collector", "data", "quanzhi.sqlite");
const archivePath = resolve(root, "collector", "data", "quanzhi.sqlite.gz");
const command = process.argv[2];

async function verifySqlite(path) {
  const handle = await open(path, "r");
  try {
    const header = Buffer.alloc(16);
    await handle.read(header, 0, 16, 0);
    if (header.toString("utf8") !== "SQLite format 3\0") {
      throw new Error("备份内容不是有效的 SQLite 数据库");
    }
  } finally {
    await handle.close();
  }
  const info = await stat(path);
  if (info.size < 1024) throw new Error("SQLite 数据库大小异常");
  return info.size;
}

async function pack() {
  if (!existsSync(databasePath)) throw new Error(`数据库不存在: ${databasePath}`);
  const sourceSize = await verifySqlite(databasePath);
  const temporary = `${archivePath}.tmp`;
  await pipeline(createReadStream(databasePath), createGzip({ level: 9 }), createWriteStream(temporary));
  await unlink(archivePath).catch(() => undefined);
  await rename(temporary, archivePath);
  const archiveSize = (await stat(archivePath)).size;
  console.log(JSON.stringify({ command: "pack", databasePath, archivePath, sourceSize, archiveSize }));
}

async function unpack() {
  if (!existsSync(archivePath)) throw new Error(`压缩备份不存在: ${archivePath}`);
  const temporary = `${databasePath}.restore.tmp`;
  await pipeline(createReadStream(archivePath), createGunzip(), createWriteStream(temporary));
  const restoredSize = await verifySqlite(temporary);
  await unlink(databasePath).catch(() => undefined);
  await rename(temporary, databasePath);
  console.log(JSON.stringify({ command: "unpack", databasePath, archivePath, restoredSize }));
}

if (command === "pack") await pack();
else if (command === "unpack") await unpack();
else throw new Error("用法: node scripts/database-backup.mjs <pack|unpack>");
