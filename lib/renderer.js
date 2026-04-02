import path from "node:path";
import fs from "node:fs";
import { createWatcher } from "./watcher.js";
import { loadArtPack } from "./sprite-loader.js";
import { resolveVisualState } from "./state-resolver.js";
import { renderSpeechBubble, clearSpeechBubble } from "./speech-bubble.js";
import { getRandomIdleThought } from "./idle-thoughts.js";
import {
  buildTransmitSequence,
  buildDeleteSequence,
  moveCursorTo,
  clearScreen,
  hideCursor,
  showCursor,
} from "./kitty.js";
import { calculateLayout } from "./layout.js";

const IMAGE_ID = 1;
const THOUGHT_DISPLAY_MS = 5000;
const IDLE_THOUGHT_MIN_MS = 15000;
const IDLE_THOUGHT_MAX_MS = 30000;

const RED = "\x1b[31m";
const YELLOW = "\x1b[33m";
const BLUE = "\x1b[34m";
const GREEN = "\x1b[32m";
const BOLD = "\x1b[1m";
const RESET = "\x1b[0m";

export function createRenderer({ statePath, artPacksDir }) {
  let watcher = null;
  let animationTimer = null;
  let currentFrameIndex = 0;
  let pack = null;
  let currentVisualState = null;
  let lastState = null;
  let currentAnimation = null;
  let thoughtTimer = null;
  let idleThoughtTimer = null;
  let currentBubbleLines = 0;

  function write(data) {
    process.stdout.write(data);
  }

  function getTermSize() {
    return {
      cols: process.stdout.columns || 40,
      rows: process.stdout.rows || 24,
    };
  }

  function renderPanelFrame() {
    const { cols, rows } = getTermSize();
    const w = cols;
    write(moveCursorTo(1, 1));
    write(BOLD + "\u2554" + "\u2550".repeat(w - 2) + "\u2557" + RESET);
    for (let r = 2; r < rows; r++) {
      write(moveCursorTo(r, 1));
      write(BOLD + "\u2551" + RESET);
      write(moveCursorTo(r, w));
      write(BOLD + "\u2551" + RESET);
    }
    write(moveCursorTo(rows, 1));
    write(BOLD + "\u255a" + "\u2550".repeat(w - 2) + "\u255d" + RESET);
  }

  function renderDivider(row, name) {
    const { cols } = getTermSize();
    const w = cols;
    const label = ` ${name} `;
    const labelLen = label.length;
    const leftPad = 2;
    const rightPad = w - 2 - leftPad - labelLen;
    write(moveCursorTo(row, 1));
    write(BOLD + "\u2560" + "\u2550".repeat(leftPad) + label + "\u2550".repeat(Math.max(0, rightPad)) + "\u2563" + RESET);
  }

  function showThought(text) {
    if (thoughtTimer) clearTimeout(thoughtTimer);
    const { cols } = getTermSize();
    const maxW = cols - 4;
    const bubbleLines = renderSpeechBubble(text, maxW);
    currentBubbleLines = bubbleLines.length;
    for (let i = 0; i < bubbleLines.length; i++) {
      write(moveCursorTo(2 + i, 3));
      write(bubbleLines[i]);
    }
    thoughtTimer = setTimeout(() => {
      const cleared = clearSpeechBubble(currentBubbleLines, maxW);
      for (let i = 0; i < cleared.length; i++) {
        write(moveCursorTo(2 + i, 3));
        write(cleared[i]);
      }
      currentBubbleLines = 0;
    }, THOUGHT_DISPLAY_MS);
  }

  function scheduleIdleThought() {
    if (idleThoughtTimer) clearTimeout(idleThoughtTimer);
    const delay = IDLE_THOUGHT_MIN_MS + Math.random() * (IDLE_THOUGHT_MAX_MS - IDLE_THOUGHT_MIN_MS);
    idleThoughtTimer = setTimeout(() => {
      const thought = getRandomIdleThought();
      showThought(thought);
      scheduleIdleThought();
    }, delay);
  }

  function getLayout() {
    const { cols, rows } = getTermSize();
    return calculateLayout(cols, rows, currentBubbleLines);
  }

  function renderFrame(frameBuffer) {
    const layout = getLayout();
    const base64 = frameBuffer.toString("base64");
    write(moveCursorTo(layout.spriteStartRow, 2));
    write(buildDeleteSequence(IMAGE_ID));
    write(buildTransmitSequence(base64, {
      cols: layout.spriteCols,
      rows: Math.max(layout.spriteRows, 3),
      imageId: IMAGE_ID,
    }));
  }

  function renderStats(state) {
    const layout = getLayout();
    const { buddy } = state;

    // Scale bar width to available inner width
    const barWidth = Math.max(8, Math.min(20, layout.innerWidth - 12));
    const bar = (value, color) => {
      const filled = Math.round((value / 100) * barWidth);
      return color + "\u2588".repeat(filled) + RESET + "\u2591".repeat(barWidth - filled);
    };

    const stageNames = ["egg", "baby", "child", "teen", "adult", "legendary"];
    const stagesXP = [0, 100, 500, 2000, 10000, 50000];
    const idx = stageNames.indexOf(buddy.stage);
    const nextStageText = idx >= stageNames.length - 1 ? " (MAX)" : ` \u2192 ${stageNames[idx + 1]}`;

    const xpProgress = (() => {
      if (idx === -1 || idx >= stagesXP.length - 1) return 100;
      const current = buddy.xp - stagesXP[idx];
      const needed = stagesXP[idx + 1] - stagesXP[idx];
      return Math.min(100, (current / needed) * 100);
    })();

    renderDivider(layout.dividerRow, buddy.name || "Buddy");

    const lines = [
      `${buddy.stage}${nextStageText}`,
      `XP ${bar(xpProgress, BOLD)} ${buddy.xp}`,
      "",
      `Hunger  ${bar(buddy.stats.hunger, RED)}`,
      `Happy   ${bar(buddy.stats.happiness, YELLOW)}`,
      `Energy  ${bar(buddy.stats.energy, BLUE)}`,
      `Hygiene ${bar(buddy.stats.hygiene, GREEN)}`,
      "",
      `\uD83D\uDD25 ${buddy.streak_days || 0}-day streak`,
    ];

    for (let i = 0; i < lines.length; i++) {
      write(moveCursorTo(layout.statsStartRow + i, 3));
      write("\x1b[2K" + BOLD + "\u2551" + RESET + " " + lines[i]);
      write(moveCursorTo(layout.statsStartRow + i, layout.cols));
      write(BOLD + "\u2551" + RESET);
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
    if (state.thought && state.thought.timestamp) {
      const age = Date.now() - new Date(state.thought.timestamp).getTime();
      if (age < THOUGHT_DISPLAY_MS) {
        showThought(state.thought.text);
        scheduleIdleThought();
      }
    }
  }

  async function start() {
    for (const packName of ["kira", "wpenguin"]) {
      const targetDir = path.join(artPacksDir, packName);
      if (!fs.existsSync(path.join(targetDir, "pack.json"))) {
        const bundledDir = path.join(import.meta.dirname, "..", "assets", packName);
        if (fs.existsSync(bundledDir)) {
          fs.cpSync(bundledDir, targetDir, { recursive: true });
          console.log(`Installed art pack: ${packName}`);
        }
      }
    }

    let artPackName = "kira";
    try {
      const stateData = fs.readFileSync(statePath, "utf-8");
      const state = JSON.parse(stateData);
      if (state.art_pack) artPackName = state.art_pack;
    } catch {}

    let artPackDir = path.join(artPacksDir, artPackName);
    if (!fs.existsSync(artPackDir)) {
      artPackDir = path.join(import.meta.dirname, "..", "assets", artPackName);
    }
    if (!fs.existsSync(artPackDir)) {
      artPackDir = path.join(import.meta.dirname, "..", "assets", "kira");
    }

    console.log(`Loading art pack: ${artPackName} from ${artPackDir}`);
    pack = await loadArtPack(artPackDir);
    console.log(`Loaded ${Object.keys(pack.animations).length} animations`);

    if (process.stdin.isTTY) {
      process.stdin.setRawMode(true);
      process.stdin.resume();
      process.stdin.on("data", () => {});
    }

    write(clearScreen());
    write(hideCursor());
    renderPanelFrame();
    startAnimation("idle");
    scheduleIdleThought();
    watcher = createWatcher(statePath, onStateChange);

    process.stdout.on("resize", () => {
      write(clearScreen());
      renderPanelFrame();
      if (lastState) renderStats(lastState);
      if (currentAnimation) renderFrame(currentAnimation.frames[currentFrameIndex]);
    });
  }

  function stop() {
    if (animationTimer) clearInterval(animationTimer);
    if (thoughtTimer) clearTimeout(thoughtTimer);
    if (idleThoughtTimer) clearTimeout(idleThoughtTimer);
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
