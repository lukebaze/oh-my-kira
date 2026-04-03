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
    SELECT * FROM (SELECT * FROM conversations ORDER BY id DESC LIMIT ?) sub ORDER BY id ASC
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
    saveSession(data) { insertSession.run(data); },
    getRecentSessions(limit) { return selectRecentSessions.all(limit); },
    saveConversation(data) { insertConversation.run(data); },
    getRecentConversations(limit) { return selectRecentConversations.all(limit); },
    upsertCodingPatterns(data) { upsertPatterns.run(data); },
    getCodingPatterns() { return selectPatterns.get() || null; },
    saveMilestone(data) { insertMilestone.run(data); },
    getMilestones() { return selectMilestones.all(); },
    close() { db.close(); },
  };
}
