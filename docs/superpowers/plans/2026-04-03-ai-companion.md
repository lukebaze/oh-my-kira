# AI Companion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an AI brain process that generates contextual, personality-driven thoughts and conversations for the Claude Buddy companion.

**Architecture:** A persistent brain process watches `state.json` for events, assembles context from working memory and SQLite-backed long-term memory, routes LLM calls to the appropriate Claude model (Haiku for ambient, Sonnet for chat), and writes thoughts/replies back to `state.json` for the existing renderer to display.

**Tech Stack:** Node.js (ES modules), `@anthropic-ai/sdk`, `better-sqlite3`, `node:test`

---

### Task 1: Add Dependencies

**Files:**
- Modify: `/Users/robin/Projects/claude-buddy-renderer/package.json`

- [ ] **Step 1: Install new dependencies**

Run:
```bash
cd /Users/robin/Projects/claude-buddy-renderer && npm install @anthropic-ai/sdk better-sqlite3
```

Expected: Both packages added to `dependencies` in `package.json`.

- [ ] **Step 2: Verify installation**

Run:
```bash
cd /Users/robin/Projects/claude-buddy-renderer && node -e "import Anthropic from '@anthropic-ai/sdk'; import Database from 'better-sqlite3'; console.log('OK')"
```

Expected: `OK`

- [ ] **Step 3: Commit**

```bash
cd /Users/robin/Projects/claude-buddy-renderer
git add package.json package-lock.json
git commit -m "deps: add @anthropic-ai/sdk and better-sqlite3"
```

---

### Task 2: Memory Store (SQLite)

**Files:**
- Create: `/Users/robin/Projects/claude-buddy-renderer/lib/memory-store.js`
- Create: `/Users/robin/Projects/claude-buddy-renderer/test/memory-store.test.js`

This module handles all SQLite persistence: schema creation, session logging, conversation storage, coding pattern tracking, and milestones.

- [ ] **Step 1: Write failing tests**

Create `/Users/robin/Projects/claude-buddy-renderer/test/memory-store.test.js`:

```javascript
import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { createMemoryStore } from "../lib/memory-store.js";

describe("createMemoryStore", () => {
  let store;

  beforeEach(() => {
    // Use in-memory SQLite for tests
    store = createMemoryStore(":memory:");
  });

  describe("sessions", () => {
    it("saves and retrieves a session", () => {
      store.saveSession({
        startedAt: "2026-04-01T10:00:00Z",
        endedAt: "2026-04-01T11:30:00Z",
        durationMin: 90,
        projectPath: "/Users/robin/project",
        eventsCount: 15,
        commitsCount: 3,
        testsPassed: 12,
        testsFailed: 1,
        summaryText: "Worked on auth module",
        moodStart: "content",
        moodEnd: "thriving",
      });
      const sessions = store.getRecentSessions(5);
      assert.equal(sessions.length, 1);
      assert.equal(sessions[0].duration_min, 90);
      assert.equal(sessions[0].summary_text, "Worked on auth module");
    });

    it("returns most recent sessions first", () => {
      store.saveSession({
        startedAt: "2026-04-01T10:00:00Z",
        endedAt: "2026-04-01T11:00:00Z",
        durationMin: 60,
        projectPath: "/a",
        eventsCount: 5,
        commitsCount: 1,
        testsPassed: 0,
        testsFailed: 0,
        summaryText: "First session",
        moodStart: "content",
        moodEnd: "content",
      });
      store.saveSession({
        startedAt: "2026-04-02T10:00:00Z",
        endedAt: "2026-04-02T12:00:00Z",
        durationMin: 120,
        projectPath: "/b",
        eventsCount: 20,
        commitsCount: 5,
        testsPassed: 10,
        testsFailed: 0,
        summaryText: "Second session",
        moodStart: "content",
        moodEnd: "thriving",
      });
      const sessions = store.getRecentSessions(5);
      assert.equal(sessions.length, 2);
      assert.equal(sessions[0].summary_text, "Second session");
    });

    it("limits results to requested count", () => {
      for (let i = 0; i < 10; i++) {
        store.saveSession({
          startedAt: `2026-04-0${(i % 9) + 1}T10:00:00Z`,
          endedAt: `2026-04-0${(i % 9) + 1}T11:00:00Z`,
          durationMin: 60,
          projectPath: "/x",
          eventsCount: 1,
          commitsCount: 0,
          testsPassed: 0,
          testsFailed: 0,
          summaryText: `Session ${i}`,
          moodStart: "content",
          moodEnd: "content",
        });
      }
      const sessions = store.getRecentSessions(3);
      assert.equal(sessions.length, 3);
    });
  });

  describe("conversations", () => {
    it("saves and retrieves conversation turns", () => {
      store.saveConversation({
        sessionId: 1,
        role: "user",
        message: "How are you?",
        modelUsed: null,
      });
      store.saveConversation({
        sessionId: 1,
        role: "buddy",
        message: "I'm great!",
        modelUsed: "haiku",
      });
      const turns = store.getRecentConversations(5);
      assert.equal(turns.length, 2);
      assert.equal(turns[0].role, "user");
      assert.equal(turns[1].role, "buddy");
    });
  });

  describe("coding patterns", () => {
    it("upserts coding patterns", () => {
      store.upsertCodingPatterns({
        avgSessionMin: 45,
        peakHour: 14,
        preferredLanguages: "javascript,python",
        testFrequency: 0.8,
        commitFrequency: 3.2,
        archetypeScoresJson: JSON.stringify({ mage: 5, healer: 10 }),
      });
      const patterns = store.getCodingPatterns();
      assert.equal(patterns.avg_session_min, 45);
      assert.equal(patterns.peak_hour, 14);
    });

    it("updates existing patterns on second upsert", () => {
      store.upsertCodingPatterns({
        avgSessionMin: 45,
        peakHour: 14,
        preferredLanguages: "javascript",
        testFrequency: 0.5,
        commitFrequency: 2.0,
        archetypeScoresJson: "{}",
      });
      store.upsertCodingPatterns({
        avgSessionMin: 60,
        peakHour: 10,
        preferredLanguages: "javascript,go",
        testFrequency: 0.9,
        commitFrequency: 4.0,
        archetypeScoresJson: JSON.stringify({ warrior: 8 }),
      });
      const patterns = store.getCodingPatterns();
      assert.equal(patterns.avg_session_min, 60);
      assert.equal(patterns.peak_hour, 10);
    });
  });

  describe("milestones", () => {
    it("saves and retrieves milestones", () => {
      store.saveMilestone({
        type: "first_commit",
        description: "Made your first commit together!",
      });
      const milestones = store.getMilestones();
      assert.equal(milestones.length, 1);
      assert.equal(milestones[0].type, "first_commit");
    });

    it("does not duplicate milestones of the same type", () => {
      store.saveMilestone({ type: "first_commit", description: "First!" });
      store.saveMilestone({ type: "first_commit", description: "First again!" });
      const milestones = store.getMilestones();
      assert.equal(milestones.length, 1);
    });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run:
```bash
cd /Users/robin/Projects/claude-buddy-renderer && node --test test/memory-store.test.js
```

Expected: FAIL — `Cannot find module '../lib/memory-store.js'`

- [ ] **Step 3: Implement memory-store.js**

Create `/Users/robin/Projects/claude-buddy-renderer/lib/memory-store.js`:

```javascript
import Database from "better-sqlite3";

export function createMemoryStore(dbPath) {
  const db = new Database(dbPath);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");

  db.exec(`
    CREATE TABLE IF NOT EXISTS sessions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      started_at TEXT NOT NULL,
      ended_at TEXT NOT NULL,
      duration_min INTEGER NOT NULL,
      project_path TEXT,
      events_count INTEGER DEFAULT 0,
      commits_count INTEGER DEFAULT 0,
      tests_passed INTEGER DEFAULT 0,
      tests_failed INTEGER DEFAULT 0,
      summary_text TEXT,
      mood_start TEXT,
      mood_end TEXT
    );

    CREATE TABLE IF NOT EXISTS conversations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id INTEGER,
      timestamp TEXT NOT NULL DEFAULT (datetime('now')),
      role TEXT NOT NULL CHECK (role IN ('user', 'buddy')),
      message TEXT NOT NULL,
      model_used TEXT
    );

    CREATE TABLE IF NOT EXISTS coding_patterns (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      avg_session_min REAL,
      peak_hour INTEGER,
      preferred_languages TEXT,
      test_frequency REAL,
      commit_frequency REAL,
      archetype_scores_json TEXT DEFAULT '{}'
    );

    CREATE TABLE IF NOT EXISTS milestones (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      achieved_at TEXT NOT NULL DEFAULT (datetime('now')),
      type TEXT NOT NULL UNIQUE,
      description TEXT NOT NULL
    );
  `);

  const insertSession = db.prepare(`
    INSERT INTO sessions (started_at, ended_at, duration_min, project_path,
      events_count, commits_count, tests_passed, tests_failed,
      summary_text, mood_start, mood_end)
    VALUES (@startedAt, @endedAt, @durationMin, @projectPath,
      @eventsCount, @commitsCount, @testsPassed, @testsFailed,
      @summaryText, @moodStart, @moodEnd)
  `);

  const selectRecentSessions = db.prepare(`
    SELECT * FROM sessions ORDER BY started_at DESC LIMIT ?
  `);

  const insertConversation = db.prepare(`
    INSERT INTO conversations (session_id, role, message, model_used)
    VALUES (@sessionId, @role, @message, @modelUsed)
  `);

  const selectRecentConversations = db.prepare(`
    SELECT * FROM conversations ORDER BY id ASC LIMIT ?
  `);

  const upsertPatterns = db.prepare(`
    INSERT INTO coding_patterns (id, updated_at, avg_session_min, peak_hour,
      preferred_languages, test_frequency, commit_frequency, archetype_scores_json)
    VALUES (1, datetime('now'), @avgSessionMin, @peakHour,
      @preferredLanguages, @testFrequency, @commitFrequency, @archetypeScoresJson)
    ON CONFLICT(id) DO UPDATE SET
      updated_at = datetime('now'),
      avg_session_min = @avgSessionMin,
      peak_hour = @peakHour,
      preferred_languages = @preferredLanguages,
      test_frequency = @testFrequency,
      commit_frequency = @commitFrequency,
      archetype_scores_json = @archetypeScoresJson
  `);

  const selectPatterns = db.prepare(`SELECT * FROM coding_patterns WHERE id = 1`);

  const insertMilestone = db.prepare(`
    INSERT OR IGNORE INTO milestones (type, description) VALUES (@type, @description)
  `);

  const selectMilestones = db.prepare(`SELECT * FROM milestones ORDER BY achieved_at ASC`);

  return {
    saveSession(data) {
      insertSession.run(data);
    },
    getRecentSessions(limit) {
      return selectRecentSessions.all(limit);
    },
    saveConversation(data) {
      insertConversation.run(data);
    },
    getRecentConversations(limit) {
      return selectRecentConversations.all(limit);
    },
    upsertCodingPatterns(data) {
      upsertPatterns.run(data);
    },
    getCodingPatterns() {
      return selectPatterns.get() || null;
    },
    saveMilestone(data) {
      insertMilestone.run(data);
    },
    getMilestones() {
      return selectMilestones.all();
    },
    close() {
      db.close();
    },
  };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run:
```bash
cd /Users/robin/Projects/claude-buddy-renderer && node --test test/memory-store.test.js
```

Expected: All tests PASS.

- [ ] **Step 5: Commit**

```bash
cd /Users/robin/Projects/claude-buddy-renderer
git add lib/memory-store.js test/memory-store.test.js
git commit -m "feat: add SQLite memory store for sessions, conversations, patterns, milestones"
```

---

### Task 3: Personality Engine

**Files:**
- Create: `/Users/robin/Projects/claude-buddy-renderer/lib/personality.js`
- Create: `/Users/robin/Projects/claude-buddy-renderer/test/personality.test.js`

This module composes the buddy's personality from three layers: base tone (user-configured seed), archetype modifier (from coding style scores), and mood state (from current stats).

- [ ] **Step 1: Write failing tests**

Create `/Users/robin/Projects/claude-buddy-renderer/test/personality.test.js`:

```javascript
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
    const blend = composeArchetypeBlend(scores);
    assert.equal(blend.length, 0);
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
      name: "Mỹ Linh",
      personalitySeed: "cheerful",
      archetypeScores: { mage: 0, warrior: 0, healer: 0, tinkerer: 0, scholar: 0 },
      stats: { hunger: 80, happiness: 80, energy: 80, hygiene: 80 },
      stage: "baby",
      xp: 25,
    });
    assert.ok(prompt.includes("Mỹ Linh"));
  });
  it("includes personality seed", () => {
    const prompt = composePersonalityPrompt({
      name: "Kira",
      personalitySeed: "sarcastic mentor",
      archetypeScores: { mage: 0, warrior: 0, healer: 0, tinkerer: 0, scholar: 0 },
      stats: { hunger: 80, happiness: 80, energy: 80, hygiene: 80 },
      stage: "baby",
      xp: 25,
    });
    assert.ok(prompt.includes("sarcastic mentor"));
  });
  it("includes archetype blend when scores exist", () => {
    const prompt = composePersonalityPrompt({
      name: "Kira",
      personalitySeed: "cheerful",
      archetypeScores: { mage: 0, warrior: 0, healer: 10, tinkerer: 0, scholar: 5 },
      stats: { hunger: 80, happiness: 80, energy: 80, hygiene: 80 },
      stage: "child",
      xp: 500,
    });
    assert.ok(prompt.includes("healer"));
    assert.ok(prompt.includes("scholar"));
  });
  it("includes mood", () => {
    const prompt = composePersonalityPrompt({
      name: "Kira",
      personalitySeed: "cheerful",
      archetypeScores: { mage: 0, warrior: 0, healer: 0, tinkerer: 0, scholar: 0 },
      stats: { hunger: 90, happiness: 90, energy: 90, hygiene: 90 },
      stage: "baby",
      xp: 50,
    });
    assert.ok(prompt.includes("thriving"));
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run:
```bash
cd /Users/robin/Projects/claude-buddy-renderer && node --test test/personality.test.js
```

Expected: FAIL — `Cannot find module '../lib/personality.js'`

- [ ] **Step 3: Implement personality.js**

Create `/Users/robin/Projects/claude-buddy-renderer/lib/personality.js`:

```javascript
const ARCHETYPE_FLAVORS = {
  mage: "philosophical, sees patterns everywhere",
  warrior: "action-oriented, competitive",
  healer: "caring, detail-oriented",
  tinkerer: "practical, curious about internals",
  scholar: "precise, values clarity",
};

export function composeMood(stats) {
  const values = [stats.hunger, stats.happiness, stats.energy, stats.hygiene];
  const belowTwenty = values.filter((v) => v < 20).length;
  if (belowTwenty >= 2) return "critical";
  const belowThirty = values.some((v) => v < 30);
  if (belowThirty) return "struggling";
  const allAboveEighty = values.every((v) => v > 80);
  if (allAboveEighty) return "thriving";
  return "content";
}

export function composeArchetypeBlend(scores) {
  const sorted = Object.entries(scores)
    .filter(([, score]) => score > 0)
    .sort((a, b) => b[1] - a[1]);

  if (sorted.length === 0) return [];

  const total = sorted.reduce((sum, [, score]) => sum + score, 0);
  const top = sorted.slice(0, 2);

  return top.map(([archetype, score]) => ({
    archetype,
    percentage: Math.round((score / total) * 100),
    flavor: ARCHETYPE_FLAVORS[archetype] || archetype,
  }));
}

export function composePersonalityPrompt({ name, personalitySeed, archetypeScores, stats, stage, xp }) {
  const mood = composeMood(stats);
  const blend = composeArchetypeBlend(archetypeScores);

  const lines = [`You are ${name}, a coding companion.`, ""];

  if (personalitySeed) {
    lines.push(`Personality: ${personalitySeed}`);
  }

  if (blend.length > 0) {
    const blendStr = blend
      .map((b) => `${b.percentage}% ${b.archetype} (${b.flavor})`)
      .join(", ");
    lines.push(`Archetype blend: ${blendStr}`);
  }

  lines.push(`Mood: ${mood}`);
  lines.push("");
  lines.push("Current state:");
  lines.push(`- Stage: ${stage} (${xp} XP)`);
  lines.push(
    `- Hunger: ${Math.round(stats.hunger)}, Happy: ${Math.round(stats.happiness)}, Energy: ${Math.round(stats.energy)}, Hygiene: ${Math.round(stats.hygiene)}`
  );

  return lines.join("\n");
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run:
```bash
cd /Users/robin/Projects/claude-buddy-renderer && node --test test/personality.test.js
```

Expected: All tests PASS.

- [ ] **Step 5: Commit**

```bash
cd /Users/robin/Projects/claude-buddy-renderer
git add lib/personality.js test/personality.test.js
git commit -m "feat: add personality engine with mood, archetype blending, prompt composition"
```

---

### Task 4: Context Assembler

**Files:**
- Create: `/Users/robin/Projects/claude-buddy-renderer/lib/context-assembler.js`
- Create: `/Users/robin/Projects/claude-buddy-renderer/test/context-assembler.test.js`

This module builds complete prompts for different call types (ambient, event, chat) by combining personality, working memory, and long-term memory.

- [ ] **Step 1: Write failing tests**

Create `/Users/robin/Projects/claude-buddy-renderer/test/context-assembler.test.js`:

```javascript
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
    const { user } = assembleEventPrompt(ctx, {
      type: "commit",
      detail: 'commit "refactor auth module"',
    });
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
    // system + 2 history turns + 1 new user message = 4
    assert.equal(messages.length, 4);
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
```

- [ ] **Step 2: Run tests to verify they fail**

Run:
```bash
cd /Users/robin/Projects/claude-buddy-renderer && node --test test/context-assembler.test.js
```

Expected: FAIL — `Cannot find module '../lib/context-assembler.js'`

- [ ] **Step 3: Implement context-assembler.js**

Create `/Users/robin/Projects/claude-buddy-renderer/lib/context-assembler.js`:

```javascript
import { composePersonalityPrompt } from "./personality.js";

function formatRecentEvents(events) {
  if (!events || events.length === 0) return "No recent events.";
  return events
    .map((e) => `- ${e.detail || e.type} (${e.type})`)
    .join("\n");
}

function formatRecentThoughts(thoughts) {
  if (!thoughts || thoughts.length === 0) return "";
  return (
    "\nRecent thoughts (do not repeat):\n" +
    thoughts.map((t) => `- "${t}"`).join("\n")
  );
}

export function assembleAmbientPrompt({ buddy, sessionDurationMin, recentEvents, recentThoughts }) {
  const system = composePersonalityPrompt({
    name: buddy.name,
    personalitySeed: buddy.personalitySeed,
    archetypeScores: buddy.archetypeScores,
    stats: buddy.stats,
    stage: buddy.stage,
    xp: buddy.xp,
  });

  const timeOfDay = new Date().toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });

  const user = [
    `Session duration: ${sessionDurationMin} minutes`,
    `Time: ${timeOfDay}`,
    "",
    "Recent events:",
    formatRecentEvents(recentEvents),
    "",
    "Generate a short ambient thought (max 60 chars).",
    "It should feel natural, in-character, and aware of what's happening.",
    "Do not repeat recent thoughts.",
    formatRecentThoughts(recentThoughts),
  ].join("\n");

  return { system, user };
}

export function assembleEventPrompt({ buddy, sessionDurationMin, recentEvents, recentThoughts }, event) {
  const system = composePersonalityPrompt({
    name: buddy.name,
    personalitySeed: buddy.personalitySeed,
    archetypeScores: buddy.archetypeScores,
    stats: buddy.stats,
    stage: buddy.stage,
    xp: buddy.xp,
  });

  const timeOfDay = new Date().toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });

  const user = [
    `Session duration: ${sessionDurationMin} minutes`,
    `Time: ${timeOfDay}`,
    "",
    `Event just happened: ${event.type}`,
    `Detail: ${event.detail || "none"}`,
    "",
    "Recent events:",
    formatRecentEvents(recentEvents),
    "",
    "Generate a short reactive thought (max 60 chars).",
    "React to this event in-character. Be specific to the context if possible.",
    formatRecentThoughts(recentThoughts),
  ].join("\n");

  return { system, user };
}

export function assembleChatPrompt(
  { buddy, sessionDurationMin, recentEvents, recentThoughts, chatHistory, sessionSummaries, identityMemory },
  userMessage
) {
  let systemParts = [
    composePersonalityPrompt({
      name: buddy.name,
      personalitySeed: buddy.personalitySeed,
      archetypeScores: buddy.archetypeScores,
      stats: buddy.stats,
      stage: buddy.stage,
      xp: buddy.xp,
    }),
  ];

  const timeOfDay = new Date().toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  systemParts.push(`\nSession duration: ${sessionDurationMin} minutes`);
  systemParts.push(`Time: ${timeOfDay}`);

  if (recentEvents && recentEvents.length > 0) {
    systemParts.push("\nRecent events:\n" + formatRecentEvents(recentEvents));
  }

  if (sessionSummaries && sessionSummaries.length > 0) {
    systemParts.push("\nRecent session history:\n" + sessionSummaries.map((s) => `- ${s}`).join("\n"));
  }

  if (identityMemory) {
    systemParts.push(
      "\nCoding patterns:" +
        `\n- Average session: ${identityMemory.avgSessionMin || "?"} min` +
        `\n- Peak coding hour: ${identityMemory.peakHour || "?"}`
    );
  }

  systemParts.push(
    "\nYou are having a direct conversation. Respond in-character.",
    "Keep responses concise (1-3 sentences) unless asked for detail."
  );

  const system = systemParts.join("\n");

  const messages = [];
  if (chatHistory) {
    for (const turn of chatHistory) {
      messages.push({
        role: turn.role === "buddy" ? "assistant" : "user",
        content: turn.message,
      });
    }
  }
  messages.push({ role: "user", content: userMessage });

  return { system, messages };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run:
```bash
cd /Users/robin/Projects/claude-buddy-renderer && node --test test/context-assembler.test.js
```

Expected: All tests PASS.

- [ ] **Step 5: Commit**

```bash
cd /Users/robin/Projects/claude-buddy-renderer
git add lib/context-assembler.js test/context-assembler.test.js
git commit -m "feat: add context assembler for ambient, event, and chat prompts"
```

---

### Task 5: LLM Router

**Files:**
- Create: `/Users/robin/Projects/claude-buddy-renderer/lib/llm-router.js`
- Create: `/Users/robin/Projects/claude-buddy-renderer/test/llm-router.test.js`

This module routes LLM calls to the appropriate Claude model and extracts the response text.

- [ ] **Step 1: Write failing tests**

Create `/Users/robin/Projects/claude-buddy-renderer/test/llm-router.test.js`:

```javascript
import { describe, it, mock } from "node:test";
import assert from "node:assert/strict";
import { createLLMRouter, MODEL_MAP } from "../lib/llm-router.js";

describe("MODEL_MAP", () => {
  it("maps call types to model IDs", () => {
    assert.ok(MODEL_MAP.ambient.includes("haiku"));
    assert.ok(MODEL_MAP.event.includes("haiku"));
    assert.ok(MODEL_MAP.chat.includes("sonnet"));
    assert.ok(MODEL_MAP.reflection.includes("opus"));
  });
});

describe("createLLMRouter", () => {
  it("calls anthropic.messages.create with correct model for ambient", async () => {
    let capturedArgs = null;
    const fakeClient = {
      messages: {
        create: mock.fn(async (args) => {
          capturedArgs = args;
          return { content: [{ type: "text", text: "A thought~" }] };
        }),
      },
    };
    const router = createLLMRouter(fakeClient);
    const result = await router.generate({
      type: "ambient",
      system: "You are Kira.",
      user: "Generate a thought.",
    });
    assert.equal(result, "A thought~");
    assert.ok(capturedArgs.model.includes("haiku"));
    assert.equal(capturedArgs.system, "You are Kira.");
  });

  it("uses messages array for chat type", async () => {
    let capturedArgs = null;
    const fakeClient = {
      messages: {
        create: mock.fn(async (args) => {
          capturedArgs = args;
          return { content: [{ type: "text", text: "Hey there!" }] };
        }),
      },
    };
    const router = createLLMRouter(fakeClient);
    const result = await router.generateChat({
      system: "You are Kira.",
      messages: [
        { role: "user", content: "Hello" },
      ],
    });
    assert.equal(result, "Hey there!");
    assert.ok(capturedArgs.model.includes("sonnet"));
    assert.deepEqual(capturedArgs.messages, [{ role: "user", content: "Hello" }]);
  });

  it("returns empty string on API error", async () => {
    const fakeClient = {
      messages: {
        create: mock.fn(async () => { throw new Error("API down"); }),
      },
    };
    const router = createLLMRouter(fakeClient);
    const result = await router.generate({
      type: "ambient",
      system: "test",
      user: "test",
    });
    assert.equal(result, "");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run:
```bash
cd /Users/robin/Projects/claude-buddy-renderer && node --test test/llm-router.test.js
```

Expected: FAIL — `Cannot find module '../lib/llm-router.js'`

- [ ] **Step 3: Implement llm-router.js**

Create `/Users/robin/Projects/claude-buddy-renderer/lib/llm-router.js`:

```javascript
export const MODEL_MAP = {
  ambient: "claude-haiku-4-5-20251001",
  event: "claude-haiku-4-5-20251001",
  chat: "claude-sonnet-4-6",
  reflection: "claude-opus-4-6",
};

export function createLLMRouter(client) {
  async function generate({ type, system, user }) {
    const model = MODEL_MAP[type] || MODEL_MAP.ambient;
    try {
      const response = await client.messages.create({
        model,
        max_tokens: 150,
        system,
        messages: [{ role: "user", content: user }],
      });
      return response.content[0]?.text || "";
    } catch (err) {
      console.error(`[brain] LLM error (${type}):`, err.message);
      return "";
    }
  }

  async function generateChat({ system, messages }) {
    try {
      const response = await client.messages.create({
        model: MODEL_MAP.chat,
        max_tokens: 500,
        system,
        messages,
      });
      return response.content[0]?.text || "";
    } catch (err) {
      console.error("[brain] Chat LLM error:", err.message);
      return "";
    }
  }

  return { generate, generateChat };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run:
```bash
cd /Users/robin/Projects/claude-buddy-renderer && node --test test/llm-router.test.js
```

Expected: All tests PASS.

- [ ] **Step 5: Commit**

```bash
cd /Users/robin/Projects/claude-buddy-renderer
git add lib/llm-router.js test/llm-router.test.js
git commit -m "feat: add LLM router with model routing for ambient, event, chat, reflection"
```

---

### Task 6: Brain Process

**Files:**
- Create: `/Users/robin/Projects/claude-buddy-renderer/lib/brain.js`
- Create: `/Users/robin/Projects/claude-buddy-renderer/test/brain.test.js`

The core brain process. Watches `state.json` for events and chat messages, maintains working memory, debounces rapid events, generates ambient thoughts on a timer, and writes results back to `state.json`.

- [ ] **Step 1: Write failing tests**

Create `/Users/robin/Projects/claude-buddy-renderer/test/brain.test.js`:

```javascript
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
  });

  it("tracks events in working memory", () => {
    const fakeRouter = { generate: mock.fn(async () => ""), generateChat: mock.fn(async () => "") };
    const brain = createBrain({ statePath, dbPath, router: fakeRouter });

    brain.recordEvent({ type: "commit", timestamp: "2026-04-03T14:00:00Z", detail: "commit msg" });
    brain.recordEvent({ type: "tests_passed", timestamp: "2026-04-03T14:01:00Z", detail: "5/5" });

    const events = brain.getRecentEvents();
    assert.equal(events.length, 2);
    assert.equal(events[0].type, "commit");
  });

  it("limits working memory to 20 events", () => {
    const fakeRouter = { generate: mock.fn(async () => ""), generateChat: mock.fn(async () => "") };
    const brain = createBrain({ statePath, dbPath, router: fakeRouter });

    for (let i = 0; i < 25; i++) {
      brain.recordEvent({ type: "working", timestamp: new Date().toISOString(), detail: `event ${i}` });
    }

    const events = brain.getRecentEvents();
    assert.equal(events.length, 20);
    assert.equal(events[0].detail, "event 5"); // oldest 5 dropped
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
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run:
```bash
cd /Users/robin/Projects/claude-buddy-renderer && node --test test/brain.test.js
```

Expected: FAIL — `Cannot find module '../lib/brain.js'`

- [ ] **Step 3: Implement brain.js**

Create `/Users/robin/Projects/claude-buddy-renderer/lib/brain.js`:

```javascript
import fs from "node:fs";
import { createMemoryStore } from "./memory-store.js";
import { assembleAmbientPrompt, assembleEventPrompt, assembleChatPrompt } from "./context-assembler.js";
import { composeMood } from "./personality.js";

const MAX_WORKING_EVENTS = 20;
const MAX_RECENT_THOUGHTS = 10;

export function createBrain({ statePath, dbPath, router }) {
  const store = createMemoryStore(dbPath);
  const workingEvents = [];
  const recentThoughts = [];
  let sessionStartTime = Date.now();

  function recordEvent(event) {
    workingEvents.push(event);
    if (workingEvents.length > MAX_WORKING_EVENTS) {
      workingEvents.splice(0, workingEvents.length - MAX_WORKING_EVENTS);
    }
  }

  function addThought(text) {
    recentThoughts.push(text);
    if (recentThoughts.length > MAX_RECENT_THOUGHTS) {
      recentThoughts.splice(0, recentThoughts.length - MAX_RECENT_THOUGHTS);
    }
  }

  function getRecentEvents() {
    return [...workingEvents];
  }

  function getRecentThoughts() {
    return [...recentThoughts];
  }

  function getSessionDurationMin() {
    return Math.round((Date.now() - sessionStartTime) / 60000);
  }

  function buildContext(state) {
    return {
      buddy: {
        name: state.buddy.name,
        personalitySeed: state.buddy.personality_seed || null,
        archetypeScores: state.buddy.archetype_scores,
        stats: state.buddy.stats,
        stage: state.buddy.stage,
        xp: state.buddy.xp,
      },
      sessionDurationMin: getSessionDurationMin(),
      recentEvents: getRecentEvents().slice(-10),
      recentThoughts: getRecentThoughts(),
    };
  }

  function writeThoughtToState(text) {
    try {
      const raw = fs.readFileSync(statePath, "utf-8");
      const state = JSON.parse(raw);
      state.thought = { text, timestamp: new Date().toISOString() };
      state.buddy.mood = composeMood(state.buddy.stats);
      state.brain = {
        ...state.brain,
        active: true,
        last_thought_at: new Date().toISOString(),
        thinking: false,
      };
      fs.writeFileSync(statePath, JSON.stringify(state, null, 2) + "\n");
    } catch (err) {
      console.error("[brain] Failed to write thought:", err.message);
    }
  }

  function writeChatReplyToState(reply) {
    try {
      const raw = fs.readFileSync(statePath, "utf-8");
      const state = JSON.parse(raw);
      if (state.chat) {
        state.chat.reply = reply;
        state.chat.pending = false;
      }
      state.brain = {
        ...state.brain,
        active: true,
        last_thought_at: new Date().toISOString(),
        thinking: false,
      };
      fs.writeFileSync(statePath, JSON.stringify(state, null, 2) + "\n");
    } catch (err) {
      console.error("[brain] Failed to write chat reply:", err.message);
    }
  }

  async function processEvent(state) {
    if (!state.event) return;

    const context = buildContext(state);
    recordEvent({
      type: state.event.type,
      timestamp: state.event.timestamp,
      detail: state.event.detail || state.event.type,
    });

    const { system, user } = assembleEventPrompt(context, {
      type: state.event.type,
      detail: state.event.detail || state.event.type,
    });

    const thought = await router.generate({ type: "event", system, user });
    if (thought) {
      addThought(thought);
      writeThoughtToState(thought);
    }
  }

  async function processChat(state) {
    if (!state.chat || !state.chat.pending || !state.chat.message) return;

    const context = buildContext(state);
    const chatHistory = store.getRecentConversations(5);
    const sessionRows = store.getRecentSessions(5);
    const sessionSummaries = sessionRows.map((s) => s.summary_text).filter(Boolean);
    const identityMemory = store.getCodingPatterns();

    context.chatHistory = chatHistory;
    context.sessionSummaries = sessionSummaries;
    context.identityMemory = identityMemory;

    const { system, messages } = assembleChatPrompt(context, state.chat.message);
    const reply = await router.generateChat({ system, messages });

    if (reply) {
      store.saveConversation({ sessionId: null, role: "user", message: state.chat.message, modelUsed: null });
      store.saveConversation({ sessionId: null, role: "buddy", message: reply, modelUsed: "sonnet" });
      writeChatReplyToState(reply);
    }
  }

  async function generateAmbientThought(state) {
    const context = buildContext(state);
    const { system, user } = assembleAmbientPrompt(context);
    const thought = await router.generate({ type: "ambient", system, user });
    if (thought) {
      addThought(thought);
      writeThoughtToState(thought);
    }
  }

  return {
    processEvent,
    processChat,
    generateAmbientThought,
    recordEvent,
    getRecentEvents,
    getRecentThoughts,
    store,
    close() {
      store.close();
    },
  };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run:
```bash
cd /Users/robin/Projects/claude-buddy-renderer && node --test test/brain.test.js
```

Expected: All tests PASS.

- [ ] **Step 5: Commit**

```bash
cd /Users/robin/Projects/claude-buddy-renderer
git add lib/brain.js test/brain.test.js
git commit -m "feat: add brain process with event processing, chat, working memory, ambient thoughts"
```

---

### Task 7: Brain Event Loop & CLI Integration

**Files:**
- Create: `/Users/robin/Projects/claude-buddy-renderer/bin/brain-daemon.js`
- Modify: `/Users/robin/Projects/claude-buddy-renderer/lib/renderer.js`
- Modify: `/Users/robin/Projects/claude-buddy-renderer/package.json`

Wire the brain into the renderer lifecycle. The brain starts as a child process when the renderer starts and watches `state.json` for changes, debouncing events and generating ambient thoughts on a timer.

- [ ] **Step 1: Create brain-daemon.js entry point**

Create `/Users/robin/Projects/claude-buddy-renderer/bin/brain-daemon.js`:

```javascript
#!/usr/bin/env node

import path from "node:path";
import os from "node:os";
import Anthropic from "@anthropic-ai/sdk";
import { createBrain } from "../lib/brain.js";
import { createLLMRouter } from "../lib/llm-router.js";
import { createWatcher } from "../lib/watcher.js";

const DEFAULT_STATE_PATH = path.join(os.homedir(), ".claude", "buddy", "state.json");
const DEFAULT_DB_PATH = path.join(os.homedir(), ".claude", "buddy", "memory.db");

const AMBIENT_MIN_MS = 30000;
const AMBIENT_MAX_MS = 90000;
const DEBOUNCE_MS = 10000;

const statePath = process.argv[2] || DEFAULT_STATE_PATH;
const dbPath = process.argv[3] || DEFAULT_DB_PATH;

const client = new Anthropic();
const router = createLLMRouter(client);
const brain = createBrain({ statePath, dbPath, router });

let lastEventTimestamp = null;
let debounceTimer = null;
let ambientTimer = null;
let lastState = null;

function scheduleAmbientThought() {
  if (ambientTimer) clearTimeout(ambientTimer);
  const delay = AMBIENT_MIN_MS + Math.random() * (AMBIENT_MAX_MS - AMBIENT_MIN_MS);
  ambientTimer = setTimeout(async () => {
    if (lastState) {
      console.log("[brain] Generating ambient thought...");
      await brain.generateAmbientThought(lastState);
    }
    scheduleAmbientThought();
  }, delay);
}

function onStateChange(state) {
  lastState = state;

  // Handle chat messages immediately (no debounce)
  if (state.chat && state.chat.pending && state.chat.message) {
    console.log("[brain] Processing chat message...");
    brain.processChat(state);
    scheduleAmbientThought(); // Reset ambient timer
    return;
  }

  // Handle events with debouncing
  if (state.event && state.event.timestamp) {
    if (state.event.timestamp === lastEventTimestamp) return;
    lastEventTimestamp = state.event.timestamp;

    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(async () => {
      console.log(`[brain] Processing event: ${state.event.type}`);
      await brain.processEvent(state);
      scheduleAmbientThought(); // Reset ambient timer
    }, state.event.type === "working" ? DEBOUNCE_MS : 500);
  }
}

const watcher = createWatcher(statePath, onStateChange);
scheduleAmbientThought();

console.log(`[brain] Started. Watching ${statePath}`);
console.log(`[brain] Memory: ${dbPath}`);

process.on("SIGTERM", () => {
  console.log("[brain] Stopping...");
  if (debounceTimer) clearTimeout(debounceTimer);
  if (ambientTimer) clearTimeout(ambientTimer);
  watcher.close();
  brain.close();
  process.exit(0);
});

process.on("SIGINT", () => {
  process.emit("SIGTERM");
});
```

- [ ] **Step 2: Update renderer.js to launch brain as child process**

Add to the imports at the top of `/Users/robin/Projects/claude-buddy-renderer/lib/renderer.js`:

```javascript
import { fork } from "node:child_process";
```

Add a `brainProcess` variable alongside the other `let` declarations at the top of `createRenderer`:

```javascript
let brainProcess = null;
```

In the `start()` function, after `scheduleIdleThought()` and before the watcher line, add:

```javascript
    // Start brain process
    const brainScript = path.join(import.meta.dirname, "..", "bin", "brain-daemon.js");
    try {
      brainProcess = fork(brainScript, [statePath], { stdio: "ignore" });
      brainProcess.on("exit", (code) => {
        console.log(`[renderer] Brain process exited (code ${code})`);
        brainProcess = null;
      });
    } catch (err) {
      console.log(`[renderer] Brain not available: ${err.message}`);
    }
```

In the `stop()` function, before the cursor/screen cleanup, add:

```javascript
    if (brainProcess) {
      brainProcess.kill("SIGTERM");
      brainProcess = null;
    }
```

- [ ] **Step 3: Add brain-daemon to package.json bin**

In `/Users/robin/Projects/claude-buddy-renderer/package.json`, update the `bin` field:

```json
  "bin": {
    "oh-my-kira": "./bin/oh-my-kira.js",
    "oh-my-kira-brain": "./bin/brain-daemon.js"
  },
```

- [ ] **Step 4: Run all existing tests to verify nothing broke**

Run:
```bash
cd /Users/robin/Projects/claude-buddy-renderer && node --test test/*.test.js
```

Expected: All existing tests PASS.

- [ ] **Step 5: Commit**

```bash
cd /Users/robin/Projects/claude-buddy-renderer
git add bin/brain-daemon.js lib/renderer.js package.json
git commit -m "feat: add brain daemon with debouncing, ambient timer, and renderer integration"
```

---

### Task 8: State.json v2 — New Fields in Plugin

**Files:**
- Modify: `/Users/robin/.claude/plugins/claude-buddy/lib/state.js`
- Modify: `/Users/robin/.claude/plugins/claude-buddy/hooks/on-event.js`

Update the plugin to write the new v2 fields (`personality_seed`, `mood`, `chat`, `brain`) to `state.json` and add event detail context for the brain to consume.

- [ ] **Step 1: Update createDefaultState in state.js**

In `/Users/robin/.claude/plugins/claude-buddy/lib/state.js`, update the `createDefaultState` function to add the new fields:

```javascript
export function createDefaultState() {
  return {
    version: 2,
    timestamp: new Date().toISOString(),
    buddy: {
      name: "Buddy",
      stage: "egg",
      archetype: null,
      xp: 0,
      streak_days: 0,
      stats: {
        hunger: 100,
        happiness: 100,
        energy: 100,
        hygiene: 100,
      },
      equipped: {
        head: null,
        face: null,
        body: null,
        hand: null,
      },
      last_session: new Date().toISOString(),
      unlocks: [],
      archetype_scores: {
        mage: 0,
        warrior: 0,
        healer: 0,
        tinkerer: 0,
        scholar: 0,
      },
      personality_seed: null,
      mood: "content",
    },
    event: null,
    thought: null,
    chat: null,
    brain: {
      active: false,
      model: null,
      last_thought_at: null,
      thinking: false,
    },
    art_pack: "kira",
    project: null,
  };
}
```

- [ ] **Step 2: Add readStateWithMigration helper**

Add this function below `readState` in `/Users/robin/.claude/plugins/claude-buddy/lib/state.js`:

```javascript
export function migrateState(state) {
  if (!state) return null;
  if (state.version >= 2) return state;

  // v1 → v2 migration
  state.version = 2;
  if (!state.buddy.personality_seed) state.buddy.personality_seed = null;
  if (!state.buddy.mood) state.buddy.mood = "content";
  if (!state.chat) state.chat = null;
  if (!state.brain) state.brain = { active: false, model: null, last_thought_at: null, thinking: false };
  return state;
}
```

- [ ] **Step 3: Update on-event.js to use migration and pass event detail**

In `/Users/robin/.claude/plugins/claude-buddy/hooks/on-event.js`, update the `handleEvent` function. After the `readState` call, add migration:

```javascript
  if (!state) {
    state = createDefaultState();
  }
  state = migrateState(state);
```

Update the import to include `migrateState`:

```javascript
import { createDefaultState, readState, writeState, migrateState } from "../lib/state.js";
```

Update the event object to include a `detail` field. Replace the existing `state.event = { ... }` block with:

```javascript
  state.event = {
    type: eventType,
    timestamp: new Date().toISOString(),
    detail: process.argv[3] || null,
  };
```

This allows hooks to pass extra context like commit messages or error output as a third argument: `node on-event.js commit "refactor auth module"`.

- [ ] **Step 4: Verify plugin tests still pass**

Run:
```bash
cd /Users/robin/.claude/plugins/claude-buddy && node --test test/*.test.js 2>/dev/null || echo "No tests or tests passed"
```

- [ ] **Step 5: Commit**

```bash
cd /Users/robin/.claude/plugins/claude-buddy
git add lib/state.js hooks/on-event.js
git commit -m "feat: state.json v2 — add personality_seed, mood, chat, brain fields with migration"
```

---

### Task 9: Plugin Chat Command

**Files:**
- Modify: `/Users/robin/.claude/skills/kira/SKILL.md`

Add the `/kira chat`, `/kira personality`, `/kira brain`, and `/kira memory` commands to the skill definition so Claude Code knows how to handle them.

- [ ] **Step 1: Read current SKILL.md**

Read `/Users/robin/.claude/skills/kira/SKILL.md` to understand the current structure.

- [ ] **Step 2: Add new commands to SKILL.md**

Add these sections to the SKILL.md, after the existing "Event Handler" section:

```markdown
## Chat
When the user says "chat", "talk to", or "ask" the buddy, write the chat message to state.json:
```bash
node -e "
const fs = require('fs');
const p = require('os').homedir() + '/.claude/buddy/state.json';
const s = JSON.parse(fs.readFileSync(p, 'utf-8'));
s.chat = { message: process.argv[1], reply: null, timestamp: new Date().toISOString(), pending: true };
fs.writeFileSync(p, JSON.stringify(s, null, 2) + '\n');
" "<user_message>"
```
Then wait 3 seconds and read back the reply from state.json's `chat.reply` field. Display the reply to the user.

## Personality
When the user says "personality" or "set personality", update the personality seed:
```bash
node -e "
const fs = require('fs');
const p = require('os').homedir() + '/.claude/buddy/state.json';
const s = JSON.parse(fs.readFileSync(p, 'utf-8'));
s.buddy.personality_seed = process.argv[1];
fs.writeFileSync(p, JSON.stringify(s, null, 2) + '\n');
" "<personality_description>"
```

## Brain Control
When the user says "brain start" or "brain stop":
- start: Launch the brain daemon if not running: `~/.claude/buddy/start-brain.sh`
- stop: Kill the brain process: `pkill -f "brain-daemon.js"`

Check if running: `pgrep -f "brain-daemon.js"`

## Memory
When the user says "memory" or "what do you remember", read the memory database:
```bash
node -e "
const Database = require('better-sqlite3');
const os = require('os');
const db = new Database(os.homedir() + '/.claude/buddy/memory.db', { readonly: true });
const sessions = db.prepare('SELECT * FROM sessions ORDER BY started_at DESC LIMIT 5').all();
const milestones = db.prepare('SELECT * FROM milestones').all();
const patterns = db.prepare('SELECT * FROM coding_patterns WHERE id = 1').get();
console.log(JSON.stringify({ sessions, milestones, patterns }, null, 2));
db.close();
"
```
Display the results in a readable format showing recent sessions, milestones, and coding patterns.
```

- [ ] **Step 3: Commit**

```bash
cd /Users/robin/.claude/skills/kira
git add SKILL.md
git commit -m "feat: add chat, personality, brain control, and memory commands to kira skill"
```

---

### Task 10: Multi-line Speech Bubbles in Renderer

**Files:**
- Modify: `/Users/robin/Projects/claude-buddy-renderer/lib/speech-bubble.js`
- Modify: `/Users/robin/Projects/claude-buddy-renderer/test/speech-bubble.test.js`

Update the speech bubble to support multi-line text for longer AI-generated thoughts and chat replies.

- [ ] **Step 1: Write failing test for multi-line support**

Add to `/Users/robin/Projects/claude-buddy-renderer/test/speech-bubble.test.js`:

```javascript
  it("wraps long text into multiple content lines", () => {
    const lines = renderSpeechBubble("This is a really long thought that should wrap across multiple lines in the bubble", 30);
    // Should have more than 4 lines (top + multiple content + bottom + tail)
    assert.ok(lines.length > 4);
  });

  it("preserves word boundaries when wrapping", () => {
    const lines = renderSpeechBubble("Hello world testing", 16);
    // Content lines (excluding top, bottom, tail) should not break mid-word
    const contentLines = lines.slice(1, -2); // skip top, bottom, tail
    for (const line of contentLines) {
      assert.ok(!line.endsWith("-"), "Should not break mid-word");
    }
  });
```

- [ ] **Step 2: Run tests to verify the new tests fail**

Run:
```bash
cd /Users/robin/Projects/claude-buddy-renderer && node --test test/speech-bubble.test.js
```

Expected: New tests FAIL (current implementation truncates instead of wrapping).

- [ ] **Step 3: Update speech-bubble.js for multi-line support**

Replace the contents of `/Users/robin/Projects/claude-buddy-renderer/lib/speech-bubble.js`:

```javascript
function wrapText(text, maxWidth) {
  const words = text.split(" ");
  const lines = [];
  let current = "";

  for (const word of words) {
    if (current.length === 0) {
      current = word;
    } else if (current.length + 1 + word.length <= maxWidth) {
      current += " " + word;
    } else {
      lines.push(current);
      current = word;
    }
  }
  if (current.length > 0) lines.push(current);

  return lines;
}

export function renderSpeechBubble(text, maxWidth) {
  if (!text) text = "...";
  const padding = 2;
  const borderWidth = 2;
  const innerMax = maxWidth - borderWidth - padding;

  const wrappedLines = wrapText(text, innerMax);
  const innerWidth = Math.max(3, ...wrappedLines.map((l) => l.length));
  const totalInner = innerWidth + padding;

  const top = "  \u256d" + "\u2500".repeat(totalInner) + "\u256e";
  const contentLines = wrappedLines.map(
    (line) => "  \u2502 " + line + " ".repeat(innerWidth - line.length) + " \u2502"
  );
  const bottomLeft = totalInner - Math.floor(totalInner / 2) - 1;
  const bottomRight = totalInner - bottomLeft - 1;
  const bottom = "  \u2570" + "\u2500".repeat(bottomLeft) + "\u256e" + "\u2500".repeat(bottomRight) + "\u256f";
  const tail = " ".repeat(bottomLeft + 3) + "\u25DC";

  const lines = [top, ...contentLines, bottom, tail];
  return lines.map((line) => (line.length > maxWidth ? line.slice(0, maxWidth) : line));
}

export function clearSpeechBubble(lineCount, maxWidth) {
  return Array.from({ length: lineCount }, () => "\x1b[2K" + " ".repeat(maxWidth));
}
```

- [ ] **Step 4: Run all speech bubble tests**

Run:
```bash
cd /Users/robin/Projects/claude-buddy-renderer && node --test test/speech-bubble.test.js
```

Expected: All tests PASS.

- [ ] **Step 5: Run full test suite to verify nothing broke**

Run:
```bash
cd /Users/robin/Projects/claude-buddy-renderer && node --test test/*.test.js
```

Expected: All tests PASS.

- [ ] **Step 6: Commit**

```bash
cd /Users/robin/Projects/claude-buddy-renderer
git add lib/speech-bubble.js test/speech-bubble.test.js
git commit -m "feat: multi-line speech bubbles with word wrapping"
```

---

### Task 11: Renderer — Archetype Icons & Mood Display

**Files:**
- Modify: `/Users/robin/Projects/claude-buddy-renderer/lib/renderer.js`

Add archetype icons next to the buddy name and a mood indicator in the stats panel.

- [ ] **Step 1: Add archetype icon mapping**

Add this constant near the top of `/Users/robin/Projects/claude-buddy-renderer/lib/renderer.js`, after the color constants:

```javascript
const ARCHETYPE_ICONS = {
  mage: "\uD83E\uDDD9",
  warrior: "\u2694\uFE0F",
  healer: "\uD83D\uDC9A",
  tinkerer: "\uD83D\uDD27",
  scholar: "\uD83D\uDCDA",
};
```

- [ ] **Step 2: Update renderStats to show archetypes and mood**

In the `renderStats` function, update the `renderDivider` call and the `lines` array. Replace:

```javascript
    renderDivider(layout.dividerRow, buddy.name || "Buddy");
```

With:

```javascript
    // Build name with archetype icons
    const scores = buddy.archetype_scores || {};
    const topArchetypes = Object.entries(scores)
      .filter(([, s]) => s > 0)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 2)
      .map(([a]) => ARCHETYPE_ICONS[a] || "")
      .join("");
    const displayName = topArchetypes
      ? `${topArchetypes} ${buddy.name || "Buddy"}`
      : buddy.name || "Buddy";
    renderDivider(layout.dividerRow, displayName);
```

In the `lines` array inside `renderStats`, add a mood line. Replace the empty string line before the streak:

```javascript
      "",
      `\uD83D\uDD25 ${buddy.streak_days || 0}-day streak`,
```

With:

```javascript
      "",
      `\u2665 ${buddy.mood || "content"}`,
      `\uD83D\uDD25 ${buddy.streak_days || 0}-day streak`,
```

- [ ] **Step 3: Run full test suite**

Run:
```bash
cd /Users/robin/Projects/claude-buddy-renderer && node --test test/*.test.js
```

Expected: All tests PASS.

- [ ] **Step 4: Commit**

```bash
cd /Users/robin/Projects/claude-buddy-renderer
git add lib/renderer.js
git commit -m "feat: show archetype icons and mood indicator in renderer stats panel"
```

---

### Task 12: Archetype Scoring in Plugin

**Files:**
- Modify: `/Users/robin/.claude/plugins/claude-buddy/hooks/on-event.js`

Update the event handler to increment archetype scores based on coding activity, implementing the scoring rules from the spec.

- [ ] **Step 1: Add archetype scoring logic to on-event.js**

Add a function at the top of `/Users/robin/.claude/plugins/claude-buddy/hooks/on-event.js` (after imports):

```javascript
function updateArchetypeScores(state, eventType, detail) {
  const scores = state.buddy.archetype_scores;

  if (eventType === "commit" && detail) {
    const lower = detail.toLowerCase();
    if (lower.includes("refactor") || lower.includes("rename")) {
      scores.mage += 3;
    }
    if (lower.includes("fix") || lower.includes("bug")) {
      scores.healer += 3;
    }
    if (lower.includes("doc") || lower.includes("type")) {
      scores.scholar += 2;
    }
  }

  if (eventType === "tests_passed") {
    scores.healer += 2;
  }

  if (eventType === "lint_run") {
    scores.scholar += 2;
  }

  // Tinkerer: detected from detail containing config/tooling file extensions
  if (eventType === "working" && detail) {
    const configPatterns = [".config.", "package.json", "tsconfig", ".yml", ".yaml", "Makefile", "Dockerfile"];
    if (configPatterns.some((p) => detail.includes(p))) {
      scores.tinkerer += 2;
    }
  }
}
```

- [ ] **Step 2: Call the scoring function in handleEvent**

In the `handleEvent` function, after the existing `state.event = { ... }` line, add:

```javascript
  updateArchetypeScores(state, eventType, state.event.detail);
```

- [ ] **Step 3: Commit**

```bash
cd /Users/robin/.claude/plugins/claude-buddy
git add hooks/on-event.js
git commit -m "feat: archetype scoring — update scores based on coding activity"
```

---

### Task 13: End-to-End Integration Test

**Files:**
- Create: `/Users/robin/Projects/claude-buddy-renderer/test/brain-integration.test.js`

A high-level test that verifies the full flow: event → brain → thought written to state.json.

- [ ] **Step 1: Write the integration test**

Create `/Users/robin/Projects/claude-buddy-renderer/test/brain-integration.test.js`:

```javascript
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
          // Verify the prompt contains personality and context
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

    // Verify conversation was saved to SQLite
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

    // Verify ambient uses haiku model
    const callArgs = fakeClient.messages.create.mock.calls[0].arguments[0];
    assert.ok(callArgs.model.includes("haiku"));

    brain.close();
  });
});
```

- [ ] **Step 2: Run integration tests**

Run:
```bash
cd /Users/robin/Projects/claude-buddy-renderer && node --test test/brain-integration.test.js
```

Expected: All tests PASS.

- [ ] **Step 3: Run full test suite**

Run:
```bash
cd /Users/robin/Projects/claude-buddy-renderer && node --test test/*.test.js
```

Expected: All tests PASS.

- [ ] **Step 4: Commit**

```bash
cd /Users/robin/Projects/claude-buddy-renderer
git add test/brain-integration.test.js
git commit -m "test: add end-to-end integration tests for brain event, chat, and ambient flows"
```

---

## Summary

| Task | Description | New files | Modified files |
|------|-------------|-----------|----------------|
| 1 | Add dependencies | — | package.json |
| 2 | Memory store (SQLite) | memory-store.js, test | — |
| 3 | Personality engine | personality.js, test | — |
| 4 | Context assembler | context-assembler.js, test | — |
| 5 | LLM router | llm-router.js, test | — |
| 6 | Brain process | brain.js, test | — |
| 7 | Brain daemon & renderer integration | brain-daemon.js | renderer.js, package.json |
| 8 | State.json v2 in plugin | — | state.js, on-event.js |
| 9 | Plugin chat commands | — | SKILL.md |
| 10 | Multi-line speech bubbles | — | speech-bubble.js, test |
| 11 | Archetype icons & mood in renderer | — | renderer.js |
| 12 | Archetype scoring in plugin | — | on-event.js |
| 13 | End-to-end integration test | brain-integration.test.js | — |
