import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { getRandomIdleThought, IDLE_THOUGHTS } from "../lib/idle-thoughts.js";

describe("IDLE_THOUGHTS", () => {
  it("has at least 20 entries", () => {
    assert.ok(IDLE_THOUGHTS.length >= 20);
  });
  it("all entries are non-empty strings", () => {
    for (const thought of IDLE_THOUGHTS) {
      assert.equal(typeof thought, "string");
      assert.ok(thought.length > 0);
    }
  });
});

describe("getRandomIdleThought", () => {
  it("returns a string from the pool", () => {
    const thought = getRandomIdleThought();
    assert.equal(typeof thought, "string");
    assert.ok(IDLE_THOUGHTS.includes(thought));
  });
  it("returns different thoughts over many calls", () => {
    const results = new Set();
    for (let i = 0; i < 50; i++) results.add(getRandomIdleThought());
    assert.ok(results.size > 1);
  });
});
