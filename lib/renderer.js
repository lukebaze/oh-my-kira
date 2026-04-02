import path from "node:path";
import fs from "node:fs";
import { createWatcher } from "./watcher.js";
import { loadArtPack } from "./sprite-loader.js";
import { resolveVisualState } from "./state-resolver.js";
import {
  buildTransmitSequence,
  buildDeleteSequence,
  moveCursorTo,
  clearScreen,
  hideCursor,
  showCursor,
} from "./kitty.js";

const IMAGE_ID = 1;

export function createRenderer({ statePath, artPacksDir }) {
  let watcher = null;
  let animationTimer = null;
  let currentFrameIndex = 0;
  let pack = null;
  let currentVisualState = null;
  let lastState = null;
  let currentAnimation = null;

  function write(data) {
    process.stdout.write(data);
  }

  function getTermSize() {
    return {
      cols: process.stdout.columns || 40,
      rows: process.stdout.rows || 24,
    };
  }

  function renderFrame(frameBuffer) {
    const { cols, rows } = getTermSize();
    const charRows = Math.floor(rows * 0.7);
    const base64 = frameBuffer.toString("base64");
    write(moveCursorTo(1, 1));
    write(buildDeleteSequence(IMAGE_ID));
    write(buildTransmitSequence(base64, { cols, rows: charRows, imageId: IMAGE_ID }));
  }

  function renderStats(state) {
    const { rows } = getTermSize();
    const statsStartRow = Math.floor(rows * 0.7) + 2;
    const { buddy } = state;

    const bar = (value) => {
      const filled = Math.round((value / 100) * 16);
      return "\u2588".repeat(filled) + "\u2591".repeat(16 - filled);
    };

    const stageNames = ["egg", "baby", "child", "teen", "adult", "legendary"];
    const stages = [0, 100, 500, 2000, 10000, 50000];
    const idx = stageNames.indexOf(buddy.stage);
    const nextStageText = idx >= stageNames.length - 1 ? " (MAX)" : ` \u2192 ${stageNames[idx + 1]}`;

    const xpProgress = (() => {
      if (idx === -1 || idx >= stages.length - 1) return 100;
      const current = buddy.xp - stages[idx];
      const needed = stages[idx + 1] - stages[idx];
      return Math.min(100, (current / needed) * 100);
    })();

    const lines = [
      `\u2500\u2500\u2500\u2500 ${buddy.name || "Buddy"} \u2500\u2500\u2500\u2500`,
      `${buddy.stage}${nextStageText}`,
      `XP ${bar(xpProgress)} ${buddy.xp}`,
      "",
      `Hunger  ${bar(buddy.stats.hunger)}`,
      `Happy   ${bar(buddy.stats.happiness)}`,
      `Energy  ${bar(buddy.stats.energy)}`,
      `Hygiene ${bar(buddy.stats.hygiene)}`,
      "",
      `Streak: ${buddy.streak_days || 0} days`,
    ];

    for (let i = 0; i < lines.length; i++) {
      write(moveCursorTo(statsStartRow + i, 1));
      write(`\x1b[2K${lines[i]}`);
    }
  }

  function startAnimation(visualState) {
    if (animationTimer) clearInterval(animationTimer);
    const anim = pack.animations[visualState] || pack.animations.idle;
    if (!anim) return;
    currentAnimation = anim;
    currentFrameIndex = 0;
    renderFrame(anim.frames[0]);
    if (anim.frames.length > 1) {
      animationTimer = setInterval(() => {
        currentFrameIndex = (currentFrameIndex + 1) % anim.frames.length;
        renderFrame(anim.frames[currentFrameIndex]);
      }, anim.interval_ms);
    }
  }

  function onStateChange(state) {
    lastState = state;
    const visualState = resolveVisualState(state);
    if (visualState !== currentVisualState) {
      currentVisualState = visualState;
      startAnimation(visualState);
    }
    renderStats(state);
  }

  async function start() {
    // Ensure default art pack exists
    const wpDir = path.join(artPacksDir, "wpenguin");
    if (!fs.existsSync(path.join(wpDir, "pack.json"))) {
      const bundledDir = path.join(import.meta.dirname, "..", "assets", "wpenguin");
      if (fs.existsSync(bundledDir)) {
        fs.mkdirSync(path.join(wpDir, "spritesheets"), { recursive: true });
        fs.cpSync(bundledDir, wpDir, { recursive: true });
        console.log(`Installed default art pack to ${wpDir}`);
      }
    }

    // Resolve art pack
    let artPackDir = path.join(artPacksDir, "wpenguin");
    if (!fs.existsSync(artPackDir)) {
      artPackDir = path.join(import.meta.dirname, "..", "assets", "wpenguin");
    }

    console.log(`Loading art pack from: ${artPackDir}`);
    pack = await loadArtPack(artPackDir);
    console.log(`Loaded ${Object.keys(pack.animations).length} animations`);

    // Put stdin in raw mode to consume any Kitty protocol responses
    if (process.stdin.isTTY) {
      process.stdin.setRawMode(true);
      process.stdin.resume();
      process.stdin.on("data", () => {}); // discard all input
    }

    write(clearScreen());
    write(hideCursor());
    startAnimation("idle");
    watcher = createWatcher(statePath, onStateChange);
  }

  function stop() {
    if (animationTimer) clearInterval(animationTimer);
    if (watcher) watcher.close();
    write(buildDeleteSequence(IMAGE_ID));
    write(showCursor());
    write(clearScreen());
    if (process.stdin.isTTY) {
      process.stdin.setRawMode(false);
    }
  }

  return { start, stop };
}
