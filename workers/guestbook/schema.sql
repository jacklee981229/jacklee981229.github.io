-- Jack's Space guestbook (workers/guestbook): the notes, the words that make a note wait for Jack, and the Worker's own
-- settings. Safe to run again: it only makes what isn't there yet.

CREATE TABLE IF NOT EXISTS notes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  email TEXT,
  website TEXT,
  message TEXT NOT NULL,
  -- UTC, as "2026-10-07T14:05:00Z".
  created_at TEXT NOT NULL,
  -- 1 while it waits for Jack (a word from the list, or a web address), or once he's hidden it.
  hidden INTEGER NOT NULL DEFAULT 0,
  -- 1 to keep it on the wall of notes, before the newest.
  pinned INTEGER NOT NULL DEFAULT 0,
  reply TEXT,
  reply_at TEXT,
  -- The poster's address, scrambled, to count their notes over the last few minutes; cleared after a day.
  ip_hash TEXT
);
CREATE INDEX IF NOT EXISTS notes_shown ON notes (hidden, created_at);
CREATE INDEX IF NOT EXISTS notes_by_poster ON notes (ip_hash, created_at);

CREATE TABLE IF NOT EXISTS words (word TEXT PRIMARY KEY);

CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT NOT NULL);
