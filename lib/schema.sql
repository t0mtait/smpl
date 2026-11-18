-- Schema for the smpl. app.
-- Single source of truth: lib/db.ts reads this at runtime, scripts/seed.mjs too.
--
-- Every row that belongs to a person is owned by exactly one account:
-- items.owner_id points at users.id. Disposals hang off an
-- item, so they inherit the owner through that join and carry no owner column
-- of their own (one source of truth, no drift).

CREATE TABLE IF NOT EXISTS users (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  email         TEXT    NOT NULL UNIQUE,
  name          TEXT    NOT NULL DEFAULT '',
  password_hash TEXT    NOT NULL DEFAULT '',
  avatar_path   TEXT,
  -- A bootstrap account holds data that predates accounts. It has no
  -- password, cannot log in, and is claimed by the first real registration.
  is_bootstrap  INTEGER NOT NULL DEFAULT 0,
  created_at    TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS sessions (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT    NOT NULL UNIQUE,
  expires_at TEXT    NOT NULL,
  created_at TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_sessions_token ON sessions(token_hash);
CREATE INDEX IF NOT EXISTS idx_sessions_user  ON sessions(user_id);

CREATE TABLE IF NOT EXISTS items (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  owner_id        INTEGER REFERENCES users(id),
  name            TEXT    NOT NULL,
  brand           TEXT    NOT NULL DEFAULT '',
  category        TEXT    NOT NULL DEFAULT 'uncategorized',
  quality         TEXT    NOT NULL DEFAULT '',
  description     TEXT    NOT NULL DEFAULT '',
  location        TEXT    NOT NULL DEFAULT '',
  purchase_date   TEXT,
  offloaded_date  TEXT,
  -- Money is nullable on purpose: NULL means "we don't know", 0 means
  -- "genuinely free". A 0 default would be a claim we cannot back up.
  purchase_price  REAL,
  current_value   REAL,
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
  -- NULL = proceeds never recorded (a gift, or we simply don't know).
  amount      REAL,
  channel     TEXT    NOT NULL DEFAULT '',
  notes       TEXT    NOT NULL DEFAULT '',
  created_at  TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_disposals_item ON disposals(item_id);
CREATE INDEX IF NOT EXISTS idx_disposals_at   ON disposals(disposed_at);

CREATE TABLE IF NOT EXISTS wishlist_items (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  owner_id    INTEGER REFERENCES users(id),
  name        TEXT    NOT NULL,
  category    TEXT    NOT NULL DEFAULT 'misc',
  price       REAL,
  url         TEXT    NOT NULL DEFAULT '',
  notes       TEXT    NOT NULL DEFAULT '',
  priority    TEXT    NOT NULL DEFAULT 'medium',
  created_at  TEXT    NOT NULL DEFAULT (datetime('now')),
  updated_at  TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_wishlist_owner ON wishlist_items(owner_id);
