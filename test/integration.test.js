import { describe, it, before } from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { loadArtPack } from "../lib/sprite-loader.js";
import { resolveVisualState } from "../lib/state-resolver.js";
import { buildTransmitSequence, buildDeleteSequence } from "../lib/kitty.js";

const PACK_DIR = path.join(import.meta.dirname, "..", "assets", "wpenguin");

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
