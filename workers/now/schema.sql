-- The Now editor's D1 database: Jack's scores for Morning Brief items (scores.js). One row per item; scoring it
-- again replaces the row, and taking a score back deletes it. Safe to run again.
CREATE TABLE IF NOT EXISTS brief_scores (
  id TEXT PRIMARY KEY,
  day TEXT NOT NULL,
  title TEXT NOT NULL,
  kind TEXT NOT NULL,
  source TEXT NOT NULL,
  score INTEGER NOT NULL CHECK (score BETWEEN 1 AND 5),
  scored_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS brief_scores_newest ON brief_scores (scored_at DESC);

-- Jack's drafts (drafts.js): posts written on the site and kept here, private, until Publish commits them to GitHub
-- and removes them. Each picture is kept as base64 text under its name in the post's folder (drafts.js says why).
CREATE TABLE IF NOT EXISTS drafts (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL DEFAULT '',
  topic TEXT NOT NULL DEFAULT '',
  tags TEXT NOT NULL DEFAULT '',
  body TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS draft_images (
  draft_id TEXT NOT NULL REFERENCES drafts (id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  type TEXT NOT NULL,
  size INTEGER NOT NULL,
  data TEXT NOT NULL,
  created_at TEXT NOT NULL,
  PRIMARY KEY (draft_id, name)
);

-- Jack's open to-dos (todos.js), pushed whole from his laptop's to-do widget: one row, the list as JSON (its projects
-- in order and the to-dos oldest first) and when the laptop read it, in milliseconds. Only a newer push replaces it.
CREATE TABLE IF NOT EXISTS todo_list (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  list TEXT NOT NULL,
  pushed_at INTEGER NOT NULL
);
