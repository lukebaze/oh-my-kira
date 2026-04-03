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

  function getRecentEvents() { return [...workingEvents]; }
  function getRecentThoughts() { return [...recentThoughts]; }
  function getSessionDurationMin() { return Math.round((Date.now() - sessionStartTime) / 60000); }

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
      state.brain = { ...state.brain, active: true, last_thought_at: new Date().toISOString(), thinking: false };
      fs.writeFileSync(statePath, JSON.stringify(state, null, 2) + "\n");
    } catch (err) {
      console.error("[brain] Failed to write thought:", err.message);
    }
  }

  function writeChatReplyToState(reply) {
    try {
      const raw = fs.readFileSync(statePath, "utf-8");
      const state = JSON.parse(raw);
      if (state.chat) { state.chat.reply = reply; state.chat.pending = false; }
      state.brain = { ...state.brain, active: true, last_thought_at: new Date().toISOString(), thinking: false };
      fs.writeFileSync(statePath, JSON.stringify(state, null, 2) + "\n");
    } catch (err) {
      console.error("[brain] Failed to write chat reply:", err.message);
    }
  }

  async function processEvent(state) {
    if (!state.event) return;
    const context = buildContext(state);
    recordEvent({ type: state.event.type, timestamp: state.event.timestamp, detail: state.event.detail || state.event.type });
    const { system, user } = assembleEventPrompt(context, { type: state.event.type, detail: state.event.detail || state.event.type });
    const thought = await router.generate({ type: "event", system, user });
    if (thought) { addThought(thought); writeThoughtToState(thought); }
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
    if (thought) { addThought(thought); writeThoughtToState(thought); }
  }

  return {
    processEvent, processChat, generateAmbientThought,
    recordEvent, getRecentEvents, getRecentThoughts,
    store,
    close() { store.close(); },
  };
}
