import { describe, it, before } from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { loadArtPack, sliceSpritesheet, sliceSpritesheetGrid } from "../lib/sprite-loader.js";

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

const KIRA_DIR = path.join(import.meta.dirname, "..", "assets", "kira");

describe("sliceSpritesheetGrid", () => {
  it("slices dance_idle.png into 29 frames from 4-column grid", async () => {
    const sheetPath = path.join(KIRA_DIR, "spritesheets", "dance_idle.png");
    const frames = await sliceSpritesheetGrid(sheetPath, 768, 448, 4, 29);
    assert.equal(frames.length, 29);
    for (const frame of frames) {
      assert.ok(Buffer.isBuffer(frame));
      assert.ok(frame.length > 0);
    }
  });
  it("slices typing.png into 17 frames from 4-column grid", async () => {
    const sheetPath = path.join(KIRA_DIR, "spritesheets", "typing.png");
    const frames = await sliceSpritesheetGrid(sheetPath, 768, 448, 4, 17);
    assert.equal(frames.length, 17);
  });
  it("slices stomach_hit.png into 29 frames from 4-column grid", async () => {
    const sheetPath = path.join(KIRA_DIR, "spritesheets", "stomach_hit.png");
    const frames = await sliceSpritesheetGrid(sheetPath, 768, 448, 4, 29);
    assert.equal(frames.length, 29);
  });
  it("applies downscaling when scale < 1", async () => {
    const sheetPath = path.join(KIRA_DIR, "spritesheets", "dance_idle.png");
    const frames = await sliceSpritesheetGrid(sheetPath, 768, 448, 4, 1, 0.25);
    assert.equal(frames.length, 1);
    const originalFrames = await sliceSpritesheetGrid(sheetPath, 768, 448, 4, 1);
    assert.ok(frames[0].length < originalFrames[0].length);
  });
});

describe("loadArtPack with kira", () => {
  it("loads the kira pack with grid-based spritesheets", async () => {
    const pack = await loadArtPack(KIRA_DIR);
    assert.equal(pack.name, "Kira");
    assert.ok(pack.animations.idle);
    assert.equal(pack.animations.idle.frames.length, 29);
    assert.equal(pack.animations.working.frames.length, 17);
    assert.equal(pack.animations.error.frames.length, 29);
    assert.ok(pack.animations.idle.interval_ms === 100);
  });
});
