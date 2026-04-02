#!/usr/bin/env node

import path from "node:path";
import os from "node:os";
import { createRenderer } from "../lib/renderer.js";

const args = process.argv.slice(2);
const watchFlag = args.indexOf("--watch");
const statePath =
  watchFlag !== -1 && args[watchFlag + 1]
    ? args[watchFlag + 1]
    : path.join(os.homedir(), ".claude", "buddy", "state.json");

const artPacksDir =
  args.indexOf("--art-packs") !== -1
    ? args[args.indexOf("--art-packs") + 1]
    : path.join(os.homedir(), ".claude", "buddy", "art-packs");

console.log(`Oh My Kira v1.0.0`);
console.log(`Watching: ${statePath}`);
console.log(`Art packs: ${artPacksDir}`);
console.log("");

const renderer = createRenderer({ statePath, artPacksDir });
renderer.start();

process.on("SIGINT", () => {
  renderer.stop();
  process.exit(0);
});

process.on("SIGTERM", () => {
  renderer.stop();
  process.exit(0);
});
