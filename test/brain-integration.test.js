import { describe, it, mock, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { createBrain } from "../lib/brain.js";
import { createLLMRouter } from "../lib/llm-router.js";

describe("Brain integration", () => {
  let tmpDir;
  let statePath;
  let dbPath;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "brain-integ-"));
    statePath = path.join(tmpDir, "state.json");
    dbPath = path.join(tmpDir, "memory.db");
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  function makeState(overrides = {}) {
    return {
      version: 2,
      timestamp: new Date().toISOString(),
      buddy: {
        name: "IntegBuddy",
        stage: "child",
        xp: 500,
        personality_seed: "cheerful and supportive",
        stats: { hunger: 75, happiness: 80, energy: 90, hygiene: 70 },
        archetype_scores: { mage: 3, warrior: 0, healer: 8, tinkerer: 0, scholar: 5 },
        last_session: new Date().toISOString(),
        streak_days: 3,
        mood: "content",
      },
      event: overrides.event || null,
      thought: overrides.thought || null,
      chat: overrides.chat || null,
      brain: { active: true, model: "haiku", last_thought_at: null, thinking: false },
      art_pack: "kira",
      project: null,
    };
  }

  it("full event flow: commit → brain processes → thought appears in state.json", async () => {
    const fakeClient = {
      messages: {
        create: mock.fn(async ({ system, messages }) => {
          assert.ok(system.includes("IntegBuddy"), "System prompt should include buddy name");
          assert.ok(system.includes("cheerful and supportive"), "System prompt should include personality");
          assert.ok(system.includes("healer"), "System prompt should include archetype");
          return { content: [{ type: "text", text: "Great commit on the auth module!" }] };
        }),
      },
    };

    const router = createLLMRouter(fakeClient);
    const state = makeState({
      event: { type: "commit", timestamp: new Date().toISOString(), detail: 'commit "refactor auth module"' },
    });
    fs.writeFileSync(statePath, JSON.stringify(state, null, 2));

    const brain = createBrain({ statePath, dbPath, router });
    await brain.processEvent(state);

    const updated = JSON.parse(fs.readFileSync(statePath, "utf-8"));
    assert.equal(updated.thought.text, "Great commit on the auth module!");
    assert.ok(updated.thought.timestamp);
    assert.equal(fakeClient.messages.create.mock.callCount(), 1);

    brain.close();
  });

  it("full chat flow: user message → brain responds → reply in state.json + saved to DB", async () => {
    const fakeClient = {
      messages: {
        create: mock.fn(async () => ({
          content: [{ type: "text", text: "We've been working on auth and tests are looking good!" }],
        })),
      },
    };

    const router = createLLMRouter(fakeClient);
    const state = makeState({
      chat: {
        message: "What have we been working on?",
        reply: null,
        timestamp: new Date().toISOString(),
        pending: true,
      },
    });
    fs.writeFileSync(statePath, JSON.stringify(state, null, 2));

    const brain = createBrain({ statePath, dbPath, router });
    await brain.processChat(state);

    const updated = JSON.parse(fs.readFileSync(statePath, "utf-8"));
    assert.equal(updated.chat.reply, "We've been working on auth and tests are looking good!");
    assert.equal(updated.chat.pending, false);

    const conversations = brain.store.getRecentConversations(10);
    assert.equal(conversations.length, 2);
    assert.equal(conversations[0].role, "user");
    assert.equal(conversations[0].message, "What have we been working on?");
    assert.equal(conversations[1].role, "buddy");

    brain.close();
  });

  it("ambient thought flow: generates thought and writes to state.json", async () => {
    const fakeClient = {
      messages: {
        create: mock.fn(async () => ({
          content: [{ type: "text", text: "The code flows nicely today~" }],
        })),
      },
    };

    const router = createLLMRouter(fakeClient);
    const state = makeState();
    fs.writeFileSync(statePath, JSON.stringify(state, null, 2));

    const brain = createBrain({ statePath, dbPath, router });
    await brain.generateAmbientThought(state);

    const updated = JSON.parse(fs.readFileSync(statePath, "utf-8"));
    assert.equal(updated.thought.text, "The code flows nicely today~");

    const callArgs = fakeClient.messages.create.mock.calls[0].arguments[0];
    assert.ok(callArgs.model.includes("haiku"));

    brain.close();
  });
});
