import { DatabaseSync } from "node:sqlite";
import fs from "node:fs";
import path from "node:path";

export const DATA_DIR = process.env.DECLUTTER_DATA_DIR
  ? path.resolve(process.env.DECLUTTER_DATA_DIR)
  : path.join(process.cwd(), "data");
export const UPLOAD_DIR = path.join(DATA_DIR, "uploads");
const DB_PATH = path.join(DATA_DIR, "declutter.db");

let db: DatabaseSync | null = null;

const SCHEMA_PATH = path.join(process.cwd(), "lib", "schema.sql");

function readSchema(): string {
  return fs.readFileSync(SCHEMA_PATH, "utf8");
}

/**
 * SQLite has no "ADD COLUMN IF NOT EXISTS". Older databases were created
 * before accounts existed, so the owner columns have to be added on open.
 */
function ensureColumn(d: DatabaseSync, table: string, column: string, ddl: string): void {
  const cols = d.prepare(`PRAGMA table_info(${table})`).all() as { name: string }[];
  if (!cols.some((c) => c.name === column)) {
    d.exec(`ALTER TABLE ${table} ADD COLUMN ${ddl}`);
  }
}

/**
 * Data that predates accounts has no owner. It is parked on a bootstrap
 * account — a user row with no password that nobody can log into — and the
 * first real registration claims it. This keeps existing inventories intact
 * instead of orphaning them behind a migration that needs manual repair.
 */
const BOOTSTRAP_EMAIL = "bootstrap@declutter.invalid";

function ensureBootstrapUser(d: DatabaseSync): number {
  const existing = d.prepare("SELECT id FROM users WHERE is_bootstrap = 1 LIMIT 1").get() as
    | { id: number }
    | undefined;
  if (existing) return existing.id;
  const res = d
    .prepare(
      "INSERT INTO users (email, name, password_hash, is_bootstrap) VALUES (?, ?, '', 1)"
    )
    .run(BOOTSTRAP_EMAIL, "Previous owner");
  return Number(res.lastInsertRowid);
}

/** Adopt any ownerless rows (and ownerless alerts) onto the bootstrap account. */
function adoptOrphans(d: DatabaseSync): void {
  const orphanItems = d.prepare("SELECT COUNT(*) c FROM items WHERE owner_id IS NULL").get() as {
    c: number;
  };
  const orphanAlerts = d.prepare("SELECT COUNT(*) c FROM alerts WHERE owner_id IS NULL").get() as {
    c: number;
  };
  if (orphanItems.c === 0 && orphanAlerts.c === 0) return;
  const id = ensureBootstrapUser(d);
  if (orphanItems.c > 0) d.prepare("UPDATE items SET owner_id = ? WHERE owner_id IS NULL").run(id);
  if (orphanAlerts.c > 0) d.prepare("UPDATE alerts SET owner_id = ? WHERE owner_id IS NULL").run(id);
}

export function getDb(): DatabaseSync {
  if (db) return db;
  try {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    fs.mkdirSync(UPLOAD_DIR, { recursive: true });
  } catch (err) {
    throw new Error(
      `Cannot create the data directory at ${DATA_DIR}: ${(err as Error).message}. ` +
        `If this is a bind mount, make sure the container user can write to it ` +
        `(the image runs as uid 1000 — chown the host directory to match).`
    );
  }
  db = new DatabaseSync(DB_PATH);
  db.exec("PRAGMA journal_mode = WAL;");
  db.exec("PRAGMA foreign_keys = ON;");
  db.exec(readSchema());
  // Pre-account databases need the owner columns added before anything else.
  ensureColumn(db, "items", "owner_id", "owner_id INTEGER REFERENCES users(id)");
  ensureColumn(db, "alerts", "owner_id", "owner_id INTEGER REFERENCES users(id)");
  db.exec("CREATE INDEX IF NOT EXISTS idx_items_owner ON items(owner_id);");
  db.exec("CREATE INDEX IF NOT EXISTS idx_alerts_owner ON alerts(owner_id);");
  adoptOrphans(db);
  return db;
}

/** Rows come back as plain objects with snake_case keys; map them to camelCase. */
function toItem(row: Record<string, unknown>): Item {
  return {
    id: Number(row.id),
    ownerId: Number(row.owner_id),
    name: String(row.name),
    category: String(row.category),
    description: String(row.description),
    location: String(row.location),
    purchaseDate: (row.purchase_date as string) ?? null,
    purchasePrice: Number(row.purchase_price ?? 0),
    currentValue: Number(row.current_value ?? 0),
    status: String(row.status) as ItemStatus,
    lastUsedAt: (row.last_used_at as string) ?? null,
    useFrequency: String(row.use_frequency) as UseFrequency,
    photoPath: (row.photo_path as string) ?? null,
    priority: String(row.priority) as Priority,
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}

export type ItemStatus = "owned" | "sold" | "donated" | "disposed";
export type Priority = "auto" | "keep" | "get_rid";
export type Disposition = "sold" | "donated" | "disposed";
export type UseFrequency = "daily" | "weekly" | "monthly" | "seasonal" | "rare" | "never" | "unknown";

export interface Item {
  id: number;
  ownerId: number;
  name: string;
  category: string;
  description: string;
  location: string;
  purchaseDate: string | null;
  purchasePrice: number;
  currentValue: number;
  status: ItemStatus;
  lastUsedAt: string | null;
  useFrequency: UseFrequency;
  photoPath: string | null;
  priority: Priority;
  createdAt: string;
  updatedAt: string;
}

export interface Disposal {
  id: number;
  itemId: number;
  disposition: Disposition;
  disposedAt: string;
  amount: number;
  channel: string;
  notes: string;
}

export interface Alert {
  id: number;
  label: string;
  cadenceDays: number;
  nextDue: string;
  active: boolean;
}

export interface User {
  id: number;
  email: string;
  name: string;
  createdAt: string;
}

/* ------------------------------------------------------------------ users */

export function createUser(email: string, name: string, passwordHash: string): User {
  const res = getDb()
    .prepare("INSERT INTO users (email, name, password_hash) VALUES (?, ?, ?)")
    .run(email, name, passwordHash);
  return getUserById(Number(res.lastInsertRowid))!;
}

export function getUserById(id: number): User | null {
  const row = getDb().prepare("SELECT * FROM users WHERE id = ?").get(id) as
    | Record<string, unknown>
    | undefined;
  return row ? toUser(row) : null;
}

export function getUserByEmail(email: string): (User & { passwordHash: string; isBootstrap: boolean }) | null {
  const row = getDb()
    .prepare("SELECT * FROM users WHERE email = ? COLLATE NOCASE")
    .get(email.trim()) as Record<string, unknown> | undefined;
  if (!row) return null;
  return { ...toUser(row), passwordHash: String(row.password_hash), isBootstrap: Number(row.is_bootstrap) === 1 };
}

function toUser(row: Record<string, unknown>): User {
  return {
    id: Number(row.id),
    email: String(row.email),
    name: String(row.name ?? ""),
    createdAt: String(row.created_at),
  };
}

/** How many real (non-bootstrap) accounts exist. */
export function countUsers(): number {
  const row = getDb()
    .prepare("SELECT COUNT(*) c FROM users WHERE is_bootstrap = 0")
    .get() as { c: number };
  return row.c;
}

/**
 * Hand any pre-account inventory to a freshly registered account and retire
 * the bootstrap holder. No-op when there is nothing to claim.
 */
export function claimBootstrapData(newUserId: number): void {
  const d = getDb();
  const boot = d.prepare("SELECT id FROM users WHERE is_bootstrap = 1").all() as { id: number }[];
  for (const b of boot) {
    d.prepare("UPDATE items SET owner_id = ? WHERE owner_id = ?").run(newUserId, b.id);
    d.prepare("UPDATE alerts SET owner_id = ? WHERE owner_id = ?").run(newUserId, b.id);
    d.prepare("DELETE FROM users WHERE id = ?").run(b.id);
  }
}

/* --------------------------------------------------------------- sessions */

export function createSession(userId: number, tokenHash: string, expiresAt: string): void {
  getDb()
    .prepare("INSERT INTO sessions (user_id, token_hash, expires_at) VALUES (?, ?, ?)")
    .run(userId, tokenHash, expiresAt);
}

/** The signed-in user for a session token, or null if the session is gone/expired. */
export function findSessionUser(tokenHash: string): User | null {
  const row = getDb()
    .prepare(
      `SELECT u.* FROM sessions s
       JOIN users u ON u.id = s.user_id
       WHERE s.token_hash = ? AND s.expires_at > ?`
    )
    .get(tokenHash, new Date().toISOString()) as Record<string, unknown> | undefined;
  if (!row) return null;
  return toUser(row);
}

export function deleteSession(tokenHash: string): void {
  getDb().prepare("DELETE FROM sessions WHERE token_hash = ?").run(tokenHash);
}

export function purgeExpiredSessions(): void {
  getDb().prepare("DELETE FROM sessions WHERE expires_at <= ?").run(new Date().toISOString());
}

/* ------------------------------------------------------------------ items */

/** Every item belonging to one account, newest first. */
export function listItems(ownerId: number): Item[] {
  const rows = getDb()
    .prepare("SELECT * FROM items WHERE owner_id = ? ORDER BY created_at DESC, id DESC")
    .all(ownerId) as Record<string, unknown>[];
  return rows.map(toItem);
}

/** A single item, but only if the account owns it. */
export function getItem(ownerId: number, id: number): Item | null {
  const row = getDb()
    .prepare("SELECT * FROM items WHERE id = ? AND owner_id = ?")
    .get(id, ownerId) as Record<string, unknown> | undefined;
  return row ? toItem(row) : null;
}

/** Find the item that owns a photo file, for serving it without leaking. */
export function getItemByPhotoPath(ownerId: number, photoPath: string): Item | null {
  const row = getDb()
    .prepare("SELECT * FROM items WHERE photo_path = ? AND owner_id = ? LIMIT 1")
    .get(photoPath, ownerId) as Record<string, unknown> | undefined;
  return row ? toItem(row) : null;
}

export interface ItemInput {
  name: string;
  category: string;
  description: string;
  location: string;
  purchaseDate: string | null;
  purchasePrice: number;
  currentValue: number;
  status: ItemStatus;
  lastUsedAt: string | null;
  useFrequency: UseFrequency;
  photoPath: string | null;
  priority: Priority;
}

export function createItem(ownerId: number, input: ItemInput): Item {
  const res = getDb()
    .prepare(
      `INSERT INTO items (owner_id, name, category, description, location, purchase_date, purchase_price,
                          current_value, status, last_used_at, use_frequency, photo_path, priority)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      ownerId,
      input.name,
      input.category,
      input.description,
      input.location,
      input.purchaseDate,
      input.purchasePrice,
      input.currentValue,
      input.status,
      input.lastUsedAt,
      input.useFrequency,
      input.photoPath,
      input.priority
    );
  return getItem(ownerId, Number(res.lastInsertRowid))!;
}

export function updateItem(ownerId: number, id: number, input: Partial<ItemInput>): Item | null {
  const existing = getItem(ownerId, id);
  if (!existing) return null;
  const merged: ItemInput = {
    name: input.name ?? existing.name,
    category: input.category ?? existing.category,
    description: input.description ?? existing.description,
    location: input.location ?? existing.location,
    purchaseDate: input.purchaseDate !== undefined ? input.purchaseDate : existing.purchaseDate,
    purchasePrice: input.purchasePrice ?? existing.purchasePrice,
    currentValue: input.currentValue ?? existing.currentValue,
    status: input.status ?? existing.status,
    lastUsedAt: input.lastUsedAt !== undefined ? input.lastUsedAt : existing.lastUsedAt,
    useFrequency: input.useFrequency ?? existing.useFrequency,
    photoPath: input.photoPath !== undefined ? input.photoPath : existing.photoPath,
    priority: input.priority ?? existing.priority,
  };
  getDb()
    .prepare(
      `UPDATE items SET name = ?, category = ?, description = ?, location = ?, purchase_date = ?,
              purchase_price = ?, current_value = ?, status = ?, last_used_at = ?, use_frequency = ?,
              photo_path = ?, priority = ?, updated_at = datetime('now')
       WHERE id = ? AND owner_id = ?`
    )
    .run(
      merged.name,
      merged.category,
      merged.description,
      merged.location,
      merged.purchaseDate,
      merged.purchasePrice,
      merged.currentValue,
      merged.status,
      merged.lastUsedAt,
      merged.useFrequency,
      merged.photoPath,
      merged.priority,
      id,
      ownerId
    );
  return getItem(ownerId, id);
}

export function deleteItem(ownerId: number, id: number): boolean {
  const existing = getItem(ownerId, id);
  if (!existing) return false;
  getDb().prepare("DELETE FROM disposals WHERE item_id = ?").run(id);
  const res = getDb().prepare("DELETE FROM items WHERE id = ? AND owner_id = ?").run(id, ownerId);
  return Number(res.changes) > 0;
}

/**
 * Mark an item sold / donated / disposed. Records a disposal row and flips
 * the item's status. Items are never silently deleted — they stay in the
 * inventory with a status so lifetime stats stay accurate.
 */
export function disposeItem(
  ownerId: number,
  id: number,
  disposition: Disposition,
  disposedAt: string,
  amount: number,
  channel: string,
  notes: string
): Item | null {
  const existing = getItem(ownerId, id);
  if (!existing) return null;
  getDb()
    .prepare(
      `INSERT INTO disposals (item_id, disposition, disposed_at, amount, channel, notes)
       VALUES (?, ?, ?, ?, ?, ?)`
    )
    .run(id, disposition, disposedAt, amount, channel, notes);
  getDb()
    .prepare("UPDATE items SET status = ?, updated_at = datetime('now') WHERE id = ? AND owner_id = ?")
    .run(disposition, id, ownerId);
  return getItem(ownerId, id);
}

/** Un-dispose: puts an item back to owned and removes the disposal record. */
export function restoreItem(ownerId: number, id: number): Item | null {
  const existing = getItem(ownerId, id);
  if (!existing) return null;
  getDb().prepare("DELETE FROM disposals WHERE item_id = ?").run(id);
  getDb()
    .prepare("UPDATE items SET status = 'owned', updated_at = datetime('now') WHERE id = ? AND owner_id = ?")
    .run(id, ownerId);
  return getItem(ownerId, id);
}

/** Disposals for one account, newest first. */
export function listDisposals(ownerId: number): Disposal[] {
  const rows = getDb()
    .prepare(
      `SELECT d.* FROM disposals d
       JOIN items i ON i.id = d.item_id
       WHERE i.owner_id = ?
       ORDER BY d.disposed_at DESC, d.id DESC`
    )
    .all(ownerId) as Record<string, unknown>[];
  return rows.map((r) => ({
    id: Number(r.id),
    itemId: Number(r.item_id),
    disposition: String(r.disposition) as Disposition,
    disposedAt: String(r.disposed_at),
    amount: Number(r.amount ?? 0),
    channel: String(r.channel ?? ""),
    notes: String(r.notes ?? ""),
  }));
}

/* ----------------------------------------------------------------- alerts */

export function listAlerts(ownerId: number): Alert[] {
  const rows = getDb()
    .prepare("SELECT * FROM alerts WHERE owner_id = ? ORDER BY next_due ASC")
    .all(ownerId) as Record<string, unknown>[];
  return rows.map((r) => ({
    id: Number(r.id),
    label: String(r.label),
    cadenceDays: Number(r.cadence_days),
    nextDue: String(r.next_due),
    active: Number(r.active) === 1,
  }));
}

export function createAlert(ownerId: number, label: string, cadenceDays: number): Alert {
  const nextDue = new Date(Date.now() + cadenceDays * 86400000).toISOString().slice(0, 10);
  const res = getDb()
    .prepare(
      "INSERT INTO alerts (owner_id, label, cadence_days, next_due) VALUES (?, ?, ?, ?)"
    )
    .run(ownerId, label, cadenceDays, nextDue);
  const row = getDb()
    .prepare("SELECT * FROM alerts WHERE id = ? AND owner_id = ?")
    .get(Number(res.lastInsertRowid), ownerId) as Record<string, unknown>;
  return {
    id: Number(row.id),
    label: String(row.label),
    cadenceDays: Number(row.cadence_days),
    nextDue: String(row.next_due),
    active: Number(row.active) === 1,
  };
}

/** Roll an alert's due date forward by its cadence. */
export function snoozeAlert(ownerId: number, id: number): void {
  getDb()
    .prepare(
      "UPDATE alerts SET next_due = date(next_due, '+' || cadence_days || ' days') WHERE id = ? AND owner_id = ?"
    )
    .run(id, ownerId);
}

export function toggleAlert(ownerId: number, id: number, active: boolean): void {
  getDb()
    .prepare("UPDATE alerts SET active = ? WHERE id = ? AND owner_id = ?")
    .run(active ? 1 : 0, id, ownerId);
}

export function deleteAlert(ownerId: number, id: number): void {
  getDb().prepare("DELETE FROM alerts WHERE id = ? AND owner_id = ?").run(id, ownerId);
}
