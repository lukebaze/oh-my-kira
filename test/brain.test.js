import { describe, it, mock, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { createBrain } from "../lib/brain.js";

describe("createBrain", () => {
  let tmpDir;
  let statePath;
  let dbPath;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "brain-test-"));
    statePath = path.join(tmpDir, "state.json");
    dbPath = path.join(tmpDir, "memory.db");
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  function writeState(state) {
    fs.writeFileSync(statePath, JSON.stringify(state, null, 2));
  }

  function readState() {
    return JSON.parse(fs.readFileSync(statePath, "utf-8"));
  }

  function makeState(overrides = {}) {
    return {
      version: 2,
      timestamp: new Date().toISOString(),
      buddy: {
        name: "TestBuddy",
        stage: "baby",
        xp: 25,
        personality_seed: "cheerful",
        stats: { hunger: 80, happiness: 80, energy: 80, hygiene: 80 },
        archetype_scores: { mage: 0, warrior: 0, healer: 0, tinkerer: 0, scholar: 0 },
        last_session: new Date().toISOString(),
        streak_days: 0,
        ...overrides.buddy,
      },
      event: overrides.event || null,
      thought: overrides.thought || null,
      chat: overrides.chat || null,
      brain: { active: true, model: "haiku", last_thought_at: null, thinking: false },
      art_pack: "kira",
      project: null,
    };
  }

  it("processes an event and writes a thought to state.json", async () => {
    const fakeRouter = {
      generate: mock.fn(async () => "Nice work on that commit!"),
      generateChat: mock.fn(async () => ""),
    };

    const state = makeState({
      event: { type: "commit", timestamp: new Date().toISOString() },
    });
    writeState(state);

    const brain = createBrain({ statePath, dbPath, router: fakeRouter });
    await brain.processEvent(state);

    const updated = readState();
    assert.equal(updated.thought.text, "Nice work on that commit!");
    assert.equal(fakeRouter.generate.mock.callCount(), 1);
    brain.close();
  });

  it("processes a chat message and writes a reply", async () => {
    const fakeRouter = {
      generate: mock.fn(async () => ""),
      generateChat: mock.fn(async () => "We're doing great!"),
    };

    const state = makeState({
      chat: { message: "How are we doing?", reply: null, timestamp: new Date().toISOString(), pending: true },
    });
    writeState(state);

    const brain = createBrain({ statePath, dbPath, router: fakeRouter });
    await brain.processChat(state);

    const updated = readState();
    assert.equal(updated.chat.reply, "We're doing great!");
    assert.equal(updated.chat.pending, false);
    assert.equal(fakeRouter.generateChat.mock.callCount(), 1);
    brain.close();
  });

  it("tracks events in working memory", () => {
    const fakeRouter = { generate: mock.fn(async () => ""), generateChat: mock.fn(async () => "") };
    const brain = createBrain({ statePath, dbPath, router: fakeRouter });

    brain.recordEvent({ type: "commit", timestamp: "2026-04-03T14:00:00Z", detail: "commit msg" });
    brain.recordEvent({ type: "tests_passed", timestamp: "2026-04-03T14:01:00Z", detail: "5/5" });

    const events = brain.getRecentEvents();
    assert.equal(events.length, 2);
    assert.equal(events[0].type, "commit");
    brain.close();
  });

  it("limits working memory to 20 events", () => {
    const fakeRouter = { generate: mock.fn(async () => ""), generateChat: mock.fn(async () => "") };
    const brain = createBrain({ statePath, dbPath, router: fakeRouter });

    for (let i = 0; i < 25; i++) {
      brain.recordEvent({ type: "working", timestamp: new Date().toISOString(), detail: `event ${i}` });
    }

    const events = brain.getRecentEvents();
    assert.equal(events.length, 20);
    assert.equal(events[0].detail, "event 5");
    brain.close();
  });

  it("tracks recent thoughts to avoid repetition", async () => {
    const fakeRouter = {
      generate: mock.fn(async () => "A unique thought"),
      generateChat: mock.fn(async () => ""),
    };

    const state = makeState({
      event: { type: "commit", timestamp: new Date().toISOString() },
    });
    writeState(state);

    const brain = createBrain({ statePath, dbPath, router: fakeRouter });
    await brain.processEvent(state);

    const thoughts = brain.getRecentThoughts();
    assert.ok(thoughts.includes("A unique thought"));
    brain.close();
  });
});
