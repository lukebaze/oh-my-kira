# AI Companion for Claude Buddy

**Date:** 2026-04-03
**Status:** Draft
**Approach:** Background Brain Process

## Overview

Add AI intelligence to the Claude Buddy tamagotchi so the companion generates contextual, personality-driven thoughts and can hold direct conversations with the user. The buddy becomes aware of what you're coding, remembers past sessions, and develops a unique personality shaped by your coding style.

## Architecture

A persistent **brain process** runs alongside the renderer. It receives events from hooks, maintains a rolling context window, and generates thoughts via the Claude API. The renderer remains unchanged — it watches `state.json` as before, now receiving smarter content.

```
Claude Code Session
  ├── hooks (on-event.js) ──► writes events to state.json
  └── /kira chat "msg"   ──► writes chat message to state.json
                                    │
                                    ▼
                            Brain Process (brain.js)
                            ├── Context Assembler
                            ├── Personality Engine
                            ├── Memory Store (SQLite)
                            └── LLM Router
                                    │
                          writes thought/reply to state.json
                                    │
                                    ▼
                            Renderer (existing)
                            └── displays in speech bubble
```

### Key design decisions

- **IPC via state.json** — brain writes to `state.json` just like hooks do today. No new IPC protocol. The renderer already watches this file.
- **Ambient thought timer** — brain generates idle thoughts on a 30–90s random interval. Rate-limited to avoid API spam. Skips if a recent event already triggered a thought.
- **Event debouncing** — rapid events (5 edits in 10s) get batched into a single AI call with combined context.
- **Brain lifecycle** — auto-starts with the renderer, auto-stops with it. Can also be manually controlled via `/kira brain start|stop` independently (e.g., to disable AI temporarily without closing the renderer).

## LLM Routing

| Call type | Model | When |
|-----------|-------|------|
| Ambient thought | Haiku | Random 30–90s interval during idle periods |
| Event reaction | Haiku | On commit, test result, error, feed, pet |
| Direct chat | Sonnet | User sends `/kira chat "message"` |
| Deep reflection | Opus | Rare — session milestones, evolution moments |

## Memory System

Three layers, from ephemeral to permanent.

### Working Memory (in-process, ephemeral)

- Current session events (last ~20)
- Recent diffs (last 3 commits, truncated)
- Active errors / test output
- Current file being edited
- Time-in-session, event frequency
- Ongoing chat conversation (last 5 turns)

Lifespan: current brain process. Cost: free.

### Session Memory (SQLite, per-session)

- Session start/end, duration
- Key events (commits, test results, errors)
- Mood arc (how stats changed over session)
- Projects touched (repo paths, file patterns)
- Chat highlights (user-initiated conversations)
- AI-generated session summary (1–2 sentences)

Written on `session_end` or every 30 minutes.

### Identity Memory (SQLite, long-term)

- Coding patterns (avg session length, peak hours, languages used, test frequency)
- Archetype scores (updated from session data)
- Personality evolution log
- Relationship milestones ("first commit together", "100th session", "survived a 3am debug")
- User preferences learned from chat

Updated on `session_end`.

### Context Assembly

| Context | Ambient (Haiku) | Event (Haiku) | Chat (Sonnet) |
|---------|-----------------|---------------|----------------|
| Personality prompt | yes | yes | yes |
| Current stats & mood | yes | yes | yes |
| Time of day / session duration | yes | yes | yes |
| Triggering event + context | — | yes (diff/error) | yes |
| Recent events (last 10) | yes | yes | yes |
| Chat history (last 5 turns) | — | — | yes |
| Session summaries (last 5) | — | — | yes |
| Identity memory | summary | summary | full |

### SQLite Schema

```sql
sessions (
  id, started_at, ended_at, duration_min,
  project_path, events_count, commits_count,
  tests_passed, tests_failed, summary_text,
  mood_start, mood_end
)

conversations (
  id, session_id, timestamp,
  role, -- 'user' or 'buddy'
  message, model_used
)

coding_patterns (
  id, updated_at,
  avg_session_min, peak_hour, preferred_languages,
  test_frequency, commit_frequency,
  archetype_scores_json
)

milestones (
  id, achieved_at, type, description
)
```

## Personality Engine

Personality is composed from three layers:

### 1. Base Tone (user-configured)

A short personality seed the user provides via `/kira personality "description"`. Stored in `state.json` as `buddy.personality_seed`. Examples:

- "cheerful and encouraging, uses kaomoji"
- "dry humor, sarcastic but supportive"
- "quiet and thoughtful, speaks in haiku"

### 2. Archetype Modifier (evolves from coding style)

The existing archetype scores (`mage`, `warrior`, `healer`, `tinkerer`, `scholar`) determine personality flavor. Top 2 archetypes blend into the system prompt.

| Archetype | Coding signal | Personality flavor |
|-----------|--------------|-------------------|
| Mage | Refactors, abstractions | Philosophical, sees patterns |
| Warrior | Fast commits, rapid iteration | Action-oriented, competitive |
| Healer | Bug fixes, tests | Caring, detail-oriented |
| Tinkerer | Config, tooling, infra | Practical, curious about internals |
| Scholar | Docs, types, careful commits | Precise, values clarity |

**Scoring rules:**

| Event | Archetype | Points |
|-------|-----------|--------|
| Commit with refactor/rename in message | Mage | +3 |
| 3+ commits in 1 hour | Warrior | +2 |
| Tests passed | Healer | +2 |
| Bug fix commit (fix/bug in message) | Healer | +3 |
| Config/tooling file edited | Tinkerer | +2 |
| Lint run | Scholar | +2 |
| Doc/type file edited | Scholar | +2 |

### 3. Mood State (derived from current stats)

| Mood | Condition | Effect on voice |
|------|-----------|-----------------|
| thriving | All stats > 80 | Warm, playful, extra talkative |
| content | All stats > 50 | Balanced, normal personality |
| struggling | Any stat < 30 | Subdued, gentle encouragement |
| critical | 2+ stats < 20 | Minimal speech, needs care |
| energized | After feed/pet/tests_passed | Grateful, excited, brief burst |

### Example Prompt

```
You are Mỹ Linh, a coding companion.

Personality: energetic anime girl who loves clean code
Archetype blend: 60% Healer (caring, detail-oriented),
  30% Scholar (precise, values clarity)
Mood: content (all stats above 50)

Current state:
- Stage: baby (25 XP)
- Hunger: 74, Happy: 82, Energy: 90, Hygiene: 65
- Session duration: 45 minutes
- Time: 2:30 PM

Recent events:
- 3 min ago: edited src/auth.js
- 8 min ago: tests passed (12/12)
- 15 min ago: commit "add token refresh logic"

Generate a short ambient thought (max 60 chars).
It should feel natural, in-character, and aware
of what's happening. Do not repeat recent thoughts.

Recent thoughts (do not repeat):
- "Those tests are looking solid!"
- "Token refresh... nice security thinking~"
```

## Chat System

### Flow

1. User types `/kira chat "how's our test coverage?"`
2. Plugin writes `chat.message` to state.json with `pending: true`
3. Brain detects chat message
4. Brain assembles full context (personality + working memory + chat history + session summaries + identity memory)
5. Brain calls Sonnet
6. Brain writes `chat.reply` to state.json, sets `pending: false`
7. Brain saves conversation turn to SQLite
8. Renderer displays reply in extended speech bubble
9. Plugin reads reply, echoes in terminal

### Renderer Updates

- **Multi-line speech bubbles** for longer AI-generated thoughts and chat replies
- **Archetype icons** next to buddy name (e.g., 🧙📚)
- **Mood indicator** in the stats panel

## State.json v2

New fields added to the existing schema:

```json
{
  "version": 2,

  "buddy": {
    "...existing fields...",
    "personality_seed": "energetic anime girl who loves clean code",
    "mood": "content"
  },

  "chat": {
    "message": "user's message or null",
    "reply": "buddy's reply or null",
    "timestamp": "...",
    "pending": false
  },

  "brain": {
    "active": true,
    "model": "haiku",
    "last_thought_at": "...",
    "thinking": false
  }
}
```

Backward compatible — renderer falls back to existing behavior if `brain.active` is false or missing.

## New Plugin Commands

| Command | Description |
|---------|-------------|
| `/kira chat "msg"` | Talk to the buddy. Reply shown in renderer + terminal. |
| `/kira personality "desc"` | Set base personality tone. |
| `/kira brain start\|stop` | Manually control the brain process. |
| `/kira memory` | Show what the buddy remembers (sessions, milestones, patterns). |

## New Files

```
lib/
  brain.js              # Main brain process — event loop, thought generation
  context-assembler.js  # Builds prompts from memory layers
  personality.js        # Composes personality from seed + archetype + mood
  llm-router.js         # Routes calls to Haiku/Sonnet/Opus
  memory-store.js       # SQLite read/write for sessions, conversations, patterns
```

## Dependencies

- `@anthropic-ai/sdk` — Claude API client
- `better-sqlite3` — SQLite for memory store

## Testing Strategy

- **Unit tests** for each new module (context assembly, personality composition, archetype scoring, memory CRUD)
- **Integration test** for brain event loop — feed mock events, verify thoughts are generated and state.json is updated
- **Prompt snapshot tests** — verify assembled prompts match expected structure for each call type
- Mock the Claude API in tests to avoid real API calls
