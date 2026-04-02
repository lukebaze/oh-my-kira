import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { resolveVisualState } from "../lib/state-resolver.js";

describe("resolveVisualState", () => {
  const baseState = () => ({
    buddy: { stats: { hunger: 80, happiness: 80, energy: 80, hygiene: 80 }, stage: "child" },
    event: null,
  });

  it("returns 'idle' for normal stats and no event", () => {
    assert.equal(resolveVisualState(baseState()), "idle");
  });
  it("returns 'happy' when all stats > 80", () => {
    const state = baseState();
    state.buddy.stats = { hunger: 85, happiness: 85, energy: 85, hygiene: 85 };
    assert.equal(resolveVisualState(state), "happy");
  });
  it("returns event type for transient events", () => {
    const state = baseState();
    state.event = { type: "tests_passed", timestamp: new Date().toISOString() };
    assert.equal(resolveVisualState(state), "very_happy");
  });
  it("maps commit event to very_happy", () => {
    const state = baseState();
    state.event = { type: "commit", timestamp: new Date().toISOString() };
    assert.equal(resolveVisualState(state), "very_happy");
  });
  it("maps tests_failed to error", () => {
    const state = baseState();
    state.event = { type: "tests_failed", timestamp: new Date().toISOString() };
    assert.equal(resolveVisualState(state), "error");
  });
  it("maps session_start event to session_start", () => {
    const state = baseState();
    state.event = { type: "session_start", timestamp: new Date().toISOString() };
    assert.equal(resolveVisualState(state), "session_start");
  });
  it("maps session_end event to session_end", () => {
    const state = baseState();
    state.event = { type: "session_end", timestamp: new Date().toISOString() };
    assert.equal(resolveVisualState(state), "session_end");
  });
  it("returns 'energy_low' when energy < 20", () => {
    const state = baseState();
    state.buddy.stats.energy = 15;
    assert.equal(resolveVisualState(state), "energy_low");
  });
  it("returns 'hunger_low' when hunger < 20", () => {
    const state = baseState();
    state.buddy.stats.hunger = 10;
    assert.equal(resolveVisualState(state), "hunger_low");
  });
  it("returns 'hygiene_low' when hygiene < 20", () => {
    const state = baseState();
    state.buddy.stats.hygiene = 5;
    assert.equal(resolveVisualState(state), "hygiene_low");
  });
  it("returns 'critical' when multiple stats < 20", () => {
    const state = baseState();
    state.buddy.stats = { hunger: 10, happiness: 10, energy: 50, hygiene: 50 };
    assert.equal(resolveVisualState(state), "critical");
  });
  it("events take priority over low stats", () => {
    const state = baseState();
    state.buddy.stats.energy = 5;
    state.event = { type: "tests_passed", timestamp: new Date().toISOString() };
    assert.equal(resolveVisualState(state), "very_happy");
  });
  it("ignores stale events older than 3 seconds", () => {
    const state = baseState();
    const staleTime = new Date(Date.now() - 5000).toISOString();
    state.event = { type: "tests_passed", timestamp: staleTime };
    state.buddy.stats = { hunger: 85, happiness: 85, energy: 85, hygiene: 85 };
    assert.equal(resolveVisualState(state), "happy");
  });
});
