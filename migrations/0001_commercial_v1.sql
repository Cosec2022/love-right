PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS users (
  love_id TEXT PRIMARY KEY COLLATE NOCASE,
  nickname TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  last_seen_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS sessions (
  token_hash TEXT PRIMARY KEY,
  love_id TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  expires_at TEXT NOT NULL,
  FOREIGN KEY (love_id) REFERENCES users(love_id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_sessions_love_id ON sessions(love_id);
CREATE INDEX IF NOT EXISTS idx_sessions_expires ON sessions(expires_at);

CREATE TABLE IF NOT EXISTS completions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  love_id TEXT NOT NULL,
  story_id TEXT NOT NULL,
  story_title TEXT NOT NULL,
  label_id TEXT NOT NULL,
  label_title TEXT NOT NULL,
  label_hook TEXT NOT NULL DEFAULT '',
  archetype_id TEXT NOT NULL DEFAULT '',
  outcome TEXT NOT NULL DEFAULT '',
  result_title TEXT NOT NULL DEFAULT '',
  traits_json TEXT NOT NULL DEFAULT '{}',
  result_fingerprint TEXT NOT NULL,
  completed_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (love_id) REFERENCES users(love_id) ON DELETE CASCADE,
  UNIQUE (love_id, story_id, result_fingerprint)
);
CREATE INDEX IF NOT EXISTS idx_completions_user_time ON completions(love_id, completed_at DESC);
CREATE INDEX IF NOT EXISTS idx_completions_story ON completions(story_id);

CREATE TABLE IF NOT EXISTS story_votes (
  love_id TEXT NOT NULL,
  story_id TEXT NOT NULL,
  vote INTEGER NOT NULL CHECK (vote IN (-1, 1)),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (love_id, story_id),
  FOREIGN KEY (love_id) REFERENCES users(love_id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_story_votes_story ON story_votes(story_id, vote);
