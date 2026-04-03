import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { composeMood, composeArchetypeBlend, composePersonalityPrompt } from "../lib/personality.js";

describe("composeMood", () => {
  it("returns 'thriving' when all stats > 80", () => {
    assert.equal(composeMood({ hunger: 90, happiness: 85, energy: 95, hygiene: 81 }), "thriving");
  });
  it("returns 'content' when all stats > 50 but not all > 80", () => {
    assert.equal(composeMood({ hunger: 60, happiness: 70, energy: 55, hygiene: 65 }), "content");
  });
  it("returns 'struggling' when any stat < 30", () => {
    assert.equal(composeMood({ hunger: 25, happiness: 70, energy: 55, hygiene: 65 }), "struggling");
  });
  it("returns 'critical' when 2+ stats < 20", () => {
    assert.equal(composeMood({ hunger: 15, happiness: 10, energy: 55, hygiene: 65 }), "critical");
  });
});

describe("composeArchetypeBlend", () => {
  it("returns top 2 archetypes with percentages", () => {
    const scores = { mage: 5, warrior: 2, healer: 10, tinkerer: 0, scholar: 8 };
    const blend = composeArchetypeBlend(scores);
    assert.equal(blend.length, 2);
    assert.equal(blend[0].archetype, "healer");
    assert.equal(blend[1].archetype, "scholar");
    assert.ok(blend[0].percentage > blend[1].percentage);
  });
  it("returns empty array when all scores are 0", () => {
    const scores = { mage: 0, warrior: 0, healer: 0, tinkerer: 0, scholar: 0 };
    assert.equal(composeArchetypeBlend(scores).length, 0);
  });
  it("returns single archetype when only one has score", () => {
    const scores = { mage: 10, warrior: 0, healer: 0, tinkerer: 0, scholar: 0 };
    const blend = composeArchetypeBlend(scores);
    assert.equal(blend.length, 1);
    assert.equal(blend[0].archetype, "mage");
    assert.equal(blend[0].percentage, 100);
  });
});

describe("composePersonalityPrompt", () => {
  it("includes buddy name", () => {
    const prompt = composePersonalityPrompt({
      name: "Mỹ Linh", personalitySeed: "cheerful",
      archetypeScores: { mage: 0, warrior: 0, healer: 0, tinkerer: 0, scholar: 0 },
      stats: { hunger: 80, happiness: 80, energy: 80, hygiene: 80 }, stage: "baby", xp: 25,
    });
    assert.ok(prompt.includes("Mỹ Linh"));
  });
  it("includes personality seed", () => {
    const prompt = composePersonalityPrompt({
      name: "Kira", personalitySeed: "sarcastic mentor",
      archetypeScores: { mage: 0, warrior: 0, healer: 0, tinkerer: 0, scholar: 0 },
      stats: { hunger: 80, happiness: 80, energy: 80, hygiene: 80 }, stage: "baby", xp: 25,
    });
    assert.ok(prompt.includes("sarcastic mentor"));
  });
  it("includes archetype blend when scores exist", () => {
    const prompt = composePersonalityPrompt({
      name: "Kira", personalitySeed: "cheerful",
      archetypeScores: { mage: 0, warrior: 0, healer: 10, tinkerer: 0, scholar: 5 },
      stats: { hunger: 80, happiness: 80, energy: 80, hygiene: 80 }, stage: "child", xp: 500,
    });
    assert.ok(prompt.includes("healer"));
    assert.ok(prompt.includes("scholar"));
  });
  it("includes mood", () => {
    const prompt = composePersonalityPrompt({
      name: "Kira", personalitySeed: "cheerful",
      archetypeScores: { mage: 0, warrior: 0, healer: 0, tinkerer: 0, scholar: 0 },
      stats: { hunger: 90, happiness: 90, energy: 90, hygiene: 90 }, stage: "baby", xp: 50,
    });
    assert.ok(prompt.includes("thriving"));
  });
});
