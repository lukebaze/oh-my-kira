import { describe, it, before } from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { loadArtPack } from "../lib/sprite-loader.js";
import { resolveVisualState } from "../lib/state-resolver.js";
import { buildTransmitSequence, buildDeleteSequence } from "../lib/kitty.js";
import { renderSpeechBubble } from "../lib/speech-bubble.js";
import { getRandomIdleThought, IDLE_THOUGHTS } from "../lib/idle-thoughts.js";

const PACK_DIR = path.join(import.meta.dirname, "..", "assets", "wpenguin");
const KIRA_DIR = path.join(import.meta.dirname, "..", "assets", "kira");

describe("end-to-end: state -> visual state -> animation -> kitty output", () => {
  let pack;

  before(async () => {
    pack = await loadArtPack(PACK_DIR);
  });

  it("resolves idle state and produces valid kitty output", () => {
    const state = {
      buddy: {
        name: "Test", stage: "egg", xp: 0, streak_days: 0,
        stats: { hunger: 50, happiness: 50, energy: 50, hygiene: 50 },
      },
      event: null,
    };
    const visualState = resolveVisualState(state);
    assert.equal(visualState, "idle");
    const anim = pack.animations[visualState];
    assert.ok(anim);
    assert.ok(anim.frames.length > 0);
    const base64 = anim.frames[0].toString("base64");
    const seq = buildTransmitSequence(base64, { cols: 20, rows: 15, imageId: 1 });
    assert.ok(seq.startsWith("\x1b_G"));
    assert.ok(seq.length > 100);
  });

  it("resolves error state from tests_failed event", () => {
    const state = {
      buddy: { stats: { hunger: 80, happiness: 80, energy: 80, hygiene: 80 }, stage: "child" },
      event: { type: "tests_failed", timestamp: new Date().toISOString() },
    };
    const visualState = resolveVisualState(state);
    assert.equal(visualState, "error");
    const anim = pack.animations[visualState];
    assert.ok(anim);
    assert.equal(anim.frames.length, 4);
  });

  it("resolves critical state when multiple stats low", () => {
    const state = {
      buddy: { stats: { hunger: 5, happiness: 5, energy: 50, hygiene: 50 }, stage: "baby" },
      event: null,
    };
    const visualState = resolveVisualState(state);
    assert.equal(visualState, "critical");
    const anim = pack.animations[visualState];
    assert.ok(anim);
    assert.equal(anim.frames.length, 1);
  });

  it("all defined visual states have matching animations in wpenguin pack", () => {
    const requiredStates = [
      "idle", "happy", "very_happy", "working", "energy_low",
      "hunger_low", "error", "critical", "session_start",
      "session_end", "hygiene_low", "turn",
    ];
    for (const state of requiredStates) {
      assert.ok(pack.animations[state], `Missing animation for state: ${state}`);
      assert.ok(pack.animations[state].frames.length > 0, `No frames for state: ${state}`);
    }
  });
});

describe("end-to-end: kira pack", () => {
  let kiraPack;

  before(async () => {
    kiraPack = await loadArtPack(KIRA_DIR);
  });

  it("loads all 12 visual states from kira pack", () => {
    const requiredStates = [
      "idle", "happy", "very_happy", "working", "energy_low",
      "hunger_low", "error", "critical", "session_start",
      "session_end", "hygiene_low", "turn",
    ];
    for (const state of requiredStates) {
      assert.ok(kiraPack.animations[state], `Missing animation for state: ${state}`);
      assert.ok(kiraPack.animations[state].frames.length > 0, `No frames for state: ${state}`);
    }
  });

  it("kira frames are downscaled from 768x448", () => {
    assert.equal(kiraPack.frameSize.width, 192);
    assert.equal(kiraPack.frameSize.height, 112);
  });

  it("kira idle has 29 frames", () => {
    assert.equal(kiraPack.animations.idle.frames.length, 29);
  });

  it("kira working has 17 frames", () => {
    assert.equal(kiraPack.animations.working.frames.length, 17);
  });
});

describe("end-to-end: speech bubble + idle thoughts", () => {
  it("speech bubble renders for a reactive thought", () => {
    const bubble = renderSpeechBubble("All green! \u2728", 30);
    assert.ok(bubble.length >= 3);
    assert.ok(bubble[1].includes("All green!"));
  });

  it("idle thoughts are available", () => {
    const thought = getRandomIdleThought();
    assert.ok(IDLE_THOUGHTS.includes(thought));
  });
});
