CREATE TABLE IF NOT EXISTS scores (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  name       TEXT    NOT NULL,
  score      INTEGER NOT NULL,
  week       INTEGER NOT NULL,
  seed       TEXT    NOT NULL,
  daily      INTEGER NOT NULL,
  t          INTEGER NOT NULL,
  houses     INTEGER NOT NULL,
  ip         TEXT    NOT NULL,
  created_at TEXT    NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS scores_daily ON scores (daily, seed, score DESC);
CREATE INDEX IF NOT EXISTS scores_ip    ON scores (ip, created_at);
