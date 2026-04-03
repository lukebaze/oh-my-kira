import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { assembleAmbientPrompt, assembleEventPrompt, assembleChatPrompt } from "../lib/context-assembler.js";

const baseContext = () => ({
  buddy: {
    name: "Kira",
    personalitySeed: "cheerful anime girl",
    archetypeScores: { mage: 0, warrior: 0, healer: 5, tinkerer: 0, scholar: 3 },
    stats: { hunger: 80, happiness: 80, energy: 80, hygiene: 80 },
    stage: "baby",
    xp: 25,
  },
  sessionDurationMin: 45,
  recentEvents: [
    { type: "commit", timestamp: "2026-04-03T14:00:00Z", detail: 'commit "add login"' },
    { type: "tests_passed", timestamp: "2026-04-03T14:05:00Z", detail: "12/12 passed" },
  ],
  recentThoughts: ["Nice commit!", "All green!"],
});

describe("assembleAmbientPrompt", () => {
  it("returns system and user messages", () => {
    const { system, user } = assembleAmbientPrompt(baseContext());
    assert.ok(system.includes("Kira"));
    assert.ok(user.includes("ambient thought"));
    assert.ok(user.includes("max 60 chars"));
  });
  it("includes recent events in user message", () => {
    const { user } = assembleAmbientPrompt(baseContext());
    assert.ok(user.includes("commit"));
  });
  it("includes recent thoughts to avoid repetition", () => {
    const { user } = assembleAmbientPrompt(baseContext());
    assert.ok(user.includes("Nice commit!"));
  });
});

describe("assembleEventPrompt", () => {
  it("includes the triggering event detail", () => {
    const ctx = baseContext();
    const { user } = assembleEventPrompt(ctx, { type: "commit", detail: 'commit "refactor auth module"' });
    assert.ok(user.includes("refactor auth module"));
  });
  it("asks for a reactive thought", () => {
    const ctx = baseContext();
    const { user } = assembleEventPrompt(ctx, { type: "tests_passed", detail: "8/8 passed" });
    assert.ok(user.includes("reactive thought"));
  });
});

describe("assembleChatPrompt", () => {
  it("includes the user message", () => {
    const ctx = baseContext();
    ctx.chatHistory = [{ role: "user", message: "How are you?" }];
    ctx.sessionSummaries = ["Worked on auth module for 90 min"];
    ctx.identityMemory = { avgSessionMin: 45, peakHour: 14 };
    const { messages } = assembleChatPrompt(ctx, "What are we working on?");
    const lastMsg = messages[messages.length - 1];
    assert.equal(lastMsg.role, "user");
    assert.ok(lastMsg.content.includes("What are we working on?"));
  });
  it("includes chat history as prior messages", () => {
    const ctx = baseContext();
    ctx.chatHistory = [
      { role: "user", message: "Hello" },
      { role: "buddy", message: "Hi there!" },
    ];
    ctx.sessionSummaries = [];
    ctx.identityMemory = null;
    const { messages } = assembleChatPrompt(ctx, "How's it going?");
    assert.equal(messages.length, 3);
  });
  it("includes session summaries in system prompt", () => {
    const ctx = baseContext();
    ctx.chatHistory = [];
    ctx.sessionSummaries = ["Debugged auth for 2 hours"];
    ctx.identityMemory = null;
    const { system } = assembleChatPrompt(ctx, "Hi");
    assert.ok(system.includes("Debugged auth for 2 hours"));
  });
});
