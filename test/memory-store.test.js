import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { createMemoryStore } from "../lib/memory-store.js";

describe("createMemoryStore", () => {
  let store;

  beforeEach(() => {
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
