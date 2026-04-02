import { describe, it, before } from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { loadArtPack, sliceSpritesheet } from "../lib/sprite-loader.js";

const PACK_DIR = path.join(import.meta.dirname, "..", "assets", "wpenguin");

describe("sliceSpritesheet", () => {
  it("slices Idle.png into 2 frames of 64x64", async () => {
    const sheetPath = path.join(PACK_DIR, "spritesheets", "Idle.png");
    const frames = await sliceSpritesheet(sheetPath, 64, 64, 2);
    assert.equal(frames.length, 2);
    for (const frame of frames) {
      assert.ok(Buffer.isBuffer(frame));
      assert.ok(frame.length > 0);
    }
  });

  it("slices Walk.png into 6 frames", async () => {
    const sheetPath = path.join(PACK_DIR, "spritesheets", "Walk.png");
    const frames = await sliceSpritesheet(sheetPath, 64, 64, 6);
    assert.equal(frames.length, 6);
  });

  it("slices Spin Attack.png into 7 frames", async () => {
    const sheetPath = path.join(PACK_DIR, "spritesheets", "Spin Attack.png");
    const frames = await sliceSpritesheet(sheetPath, 64, 64, 7);
    assert.equal(frames.length, 7);
  });
});

describe("loadArtPack", () => {
  it("loads the wpenguin pack and returns all state animations", async () => {
    const pack = await loadArtPack(PACK_DIR);
    assert.equal(pack.name, "W-Penguin");
    assert.ok(pack.animations.idle);
    assert.ok(pack.animations.happy);
    assert.ok(pack.animations.working);
    assert.ok(pack.animations.error);
    assert.ok(pack.animations.critical);
    assert.equal(pack.animations.idle.frames.length, 2);
    assert.equal(pack.animations.idle.interval_ms, 500);
    assert.equal(pack.animations.working.frames.length, 6);
    assert.equal(pack.animations.very_happy.frames.length, 7);
  });
});
