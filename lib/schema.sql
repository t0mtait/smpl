-- Schema for the declutter app.
-- Single source of truth: lib/db.ts reads this at runtime, scripts/seed.mjs too.

CREATE TABLE IF NOT EXISTS items (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  name            TEXT    NOT NULL,
  category        TEXT    NOT NULL DEFAULT 'uncategorized',
  description     TEXT    NOT NULL DEFAULT '',
  location        TEXT    NOT NULL DEFAULT '',
  purchase_date   TEXT,
  purchase_price  REAL    NOT NULL DEFAULT 0,
  current_value   REAL    NOT NULL DEFAULT 0,
  status          TEXT    NOT NULL DEFAULT 'owned',
  last_used_at    TEXT,
  use_frequency   TEXT    NOT NULL DEFAULT 'unknown',
  photo_path      TEXT,
  priority        TEXT    NOT NULL DEFAULT 'auto',
  created_at      TEXT    NOT NULL DEFAULT (datetime('now')),
  updated_at      TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_items_status   ON items(status);
CREATE INDEX IF NOT EXISTS idx_items_category ON items(category);
CREATE INDEX IF NOT EXISTS idx_items_name     ON items(name);

CREATE TABLE IF NOT EXISTS disposals (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  item_id     INTEGER NOT NULL REFERENCES items(id),
  disposition TEXT    NOT NULL,
  disposed_at TEXT    NOT NULL,
  amount      REAL    NOT NULL DEFAULT 0,
  channel     TEXT    NOT NULL DEFAULT '',
  notes       TEXT    NOT NULL DEFAULT '',
  created_at  TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_disposals_item ON disposals(item_id);
CREATE INDEX IF NOT EXISTS idx_disposals_at   ON disposals(disposed_at);

CREATE TABLE IF NOT EXISTS alerts (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  label        TEXT    NOT NULL,
  cadence_days INTEGER NOT NULL DEFAULT 30,
  next_due     TEXT    NOT NULL,
  active       INTEGER NOT NULL DEFAULT 1,
  created_at   TEXT    NOT NULL DEFAULT (datetime('now'))
);
