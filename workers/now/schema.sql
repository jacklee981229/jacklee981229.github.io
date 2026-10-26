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
