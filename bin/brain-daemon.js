#!/usr/bin/env node

import path from "node:path";
import os from "node:os";
import Anthropic from "@anthropic-ai/sdk";
import { createBrain } from "../lib/brain.js";
import { createLLMRouter } from "../lib/llm-router.js";
import { createWatcher } from "../lib/watcher.js";

const DEFAULT_STATE_PATH = path.join(os.homedir(), ".claude", "buddy", "state.json");
const DEFAULT_DB_PATH = path.join(os.homedir(), ".claude", "buddy", "memory.db");

const AMBIENT_MIN_MS = 30000;
const AMBIENT_MAX_MS = 90000;
const DEBOUNCE_MS = 10000;

const statePath = process.argv[2] || DEFAULT_STATE_PATH;
const dbPath = process.argv[3] || DEFAULT_DB_PATH;

const client = new Anthropic();
const router = createLLMRouter(client);
const brain = createBrain({ statePath, dbPath, router });

let lastEventTimestamp = null;
let debounceTimer = null;
let ambientTimer = null;
let lastState = null;

function scheduleAmbientThought() {
  if (ambientTimer) clearTimeout(ambientTimer);
  const delay = AMBIENT_MIN_MS + Math.random() * (AMBIENT_MAX_MS - AMBIENT_MIN_MS);
  ambientTimer = setTimeout(async () => {
    if (lastState) {
      console.log("[brain] Generating ambient thought...");
      await brain.generateAmbientThought(lastState);
    }
    scheduleAmbientThought();
  }, delay);
}

async function onStateChange(state) {
  lastState = state;

  if (state.chat && state.chat.pending && state.chat.message) {
    console.log("[brain] Processing chat message...");
    await brain.processChat(state);
    scheduleAmbientThought();
    return;
  }

  if (state.event && state.event.timestamp) {
    if (state.event.timestamp === lastEventTimestamp) return;
    lastEventTimestamp = state.event.timestamp;

    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(async () => {
      console.log(`[brain] Processing event: ${state.event.type}`);
      await brain.processEvent(state);
      scheduleAmbientThought();
    }, state.event.type === "working" ? DEBOUNCE_MS : 500);
  }
}

const watcher = createWatcher(statePath, onStateChange);
scheduleAmbientThought();

console.log(`[brain] Started. Watching ${statePath}`);
console.log(`[brain] Memory: ${dbPath}`);

process.on("SIGTERM", () => {
  console.log("[brain] Stopping...");
  if (debounceTimer) clearTimeout(debounceTimer);
  if (ambientTimer) clearTimeout(ambientTimer);
  watcher.close();
  brain.close();
  process.exit(0);
});

process.on("SIGINT", () => {
  process.emit("SIGTERM");
});
