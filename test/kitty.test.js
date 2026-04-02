import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { buildTransmitSequence, buildDeleteSequence } from "../lib/kitty.js";

describe("buildTransmitSequence", () => {
  it("builds a valid Kitty transmit+display escape sequence", () => {
    const pngBase64 = "iVBORw0KGgo=";
    const seq = buildTransmitSequence(pngBase64, { cols: 20, rows: 15 });
    assert.ok(seq.startsWith("\x1b_G"));
    assert.ok(seq.endsWith("\x1b\\"));
    assert.ok(seq.includes("a=T"));
    assert.ok(seq.includes("f=100"));
    assert.ok(seq.includes("c=20"));
    assert.ok(seq.includes("r=15"));
    assert.ok(seq.includes(";" + pngBase64));
  });
  it("assigns image ID when provided", () => {
    const seq = buildTransmitSequence("data", { cols: 10, rows: 10, imageId: 42 });
    assert.ok(seq.includes("i=42"));
  });
});

describe("buildDeleteSequence", () => {
  it("builds a delete-all sequence when no ID given", () => {
    const seq = buildDeleteSequence();
    assert.ok(seq.startsWith("\x1b_G"));
    assert.ok(seq.includes("a=d"));
    assert.ok(seq.endsWith("\x1b\\"));
  });
  it("builds a delete-by-ID sequence when ID given", () => {
    const seq = buildDeleteSequence(42);
    assert.ok(seq.includes("a=d"));
    assert.ok(seq.includes("i=42"));
  });
});
