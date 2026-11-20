import { DatabaseSync } from "node:sqlite";
import fs from "node:fs";
import path from "node:path";
import { today, quarterToIso } from "./dates.ts";

export const DATA_DIR = (process.env.SMPL_DATA_DIR || process.env.DECLUTTER_DATA_DIR)
  ? path.resolve(process.env.SMPL_DATA_DIR || process.env.DECLUTTER_DATA_DIR!)
  : path.join(process.cwd(), "data");
export const UPLOAD_DIR = path.join(DATA_DIR, "uploads");
const DB_NAME = fs.existsSync(path.join(DATA_DIR, "declutter.db")) ? "declutter.db" : "smpl.db";
const DB_PATH = path.join(DATA_DIR, DB_NAME);

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
const BOOTSTRAP_EMAIL = "bootstrap@smpl.invalid";

/**
 * Money columns have to be nullable: NULL means "never recorded", 0 means
 * "genuinely free". Databases created before that distinction existed store
 * the money columns as NOT NULL DEFAULT 0, and SQLite cannot relax a NOT NULL
 * constraint with ALTER TABLE — the table has to be rebuilt.
 *
 * The rebuild renames the old table aside, recreates it from lib/schema.sql
 * (the canonical definition), copies the rows across and drops the leftover.
 * `legacy_alter_table` keeps SQLite from rewriting the REFERENCES clauses in
 * other tables while the table is renamed.
 */
function isNotNull(d: DatabaseSync, table: string, column: string): boolean {
  const cols = d.prepare(`PRAGMA table_info(${table})`).all() as {
    name: string;
    notnull: number;
  }[];
  const col = cols.find((c) => c.name === column);
  return !!col && col.notnull === 1;
}

/** Pull the canonical CREATE TABLE statement for one table out of the schema. */
function createTableStatement(schema: string, table: string): string {
  const match = new RegExp(`CREATE TABLE IF NOT EXISTS ${table}\\s*\\([\\s\\S]*?\\n\\);`).exec(
    schema
  );
  if (!match) throw new Error(`lib/schema.sql has no CREATE TABLE for ${table}`);
  return match[0];
}

/** Rebuild one table so it matches the current schema, keeping every row. */
function rebuildTable(d: DatabaseSync, schema: string, table: string): void {
  const legacy = `${table}_pre_nullable`;
  const existing = (d.prepare(`PRAGMA table_info(${table})`).all() as { name: string }[]).map(
    (c) => c.name
  );
  d.exec(`ALTER TABLE ${table} RENAME TO ${legacy}`);
  d.exec(createTableStatement(schema, table));
  const target = (d.prepare(`PRAGMA table_info(${table})`).all() as { name: string }[]).map(
    (c) => c.name
  );
  const shared = target.filter((c) => existing.includes(c));
  if (shared.length > 0) {
    const list = shared.join(", ");
    d.exec(`INSERT INTO ${table} (${list}) SELECT ${list} FROM ${legacy}`);
  }
  d.exec(`DROP TABLE ${legacy}`);
}

/**
 * Idempotent migration: make the money columns nullable if they are not
 * already. Safe to run on every open — it does nothing once the columns
 * allow NULL.
 */
function migrateMoneyColumns(d: DatabaseSync): void {
  const schema = readSchema();
  const itemsNeedRebuild =
    isNotNull(d, "items", "purchase_price") || isNotNull(d, "items", "current_value");
  const disposalsNeedRebuild = isNotNull(d, "disposals", "amount");
  if (!itemsNeedRebuild && !disposalsNeedRebuild) return;

  d.exec("PRAGMA foreign_keys = OFF;");
  d.exec("PRAGMA legacy_alter_table = ON;");
  try {
    d.exec("BEGIN;");
    // Items first: disposals reference items(id), and the legacy rename must
    // not rewrite those references.
    if (itemsNeedRebuild) rebuildTable(d, schema, "items");
    if (disposalsNeedRebuild) rebuildTable(d, schema, "disposals");
    d.exec("COMMIT;");
  } catch (err) {
    try {
      d.exec("ROLLBACK;");
    } catch {
      /* the transaction was never opened */
    }
    throw err;
  } finally {
    d.exec("PRAGMA legacy_alter_table = OFF;");
    d.exec("PRAGMA foreign_keys = ON;");
  }
  // The old tables took their indexes with them — recreate them.
  d.exec(schema);
}

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

/** Adopt any ownerless rows onto the bootstrap account. */
function adoptOrphans(d: DatabaseSync): void {
  const orphanItems = d.prepare("SELECT COUNT(*) c FROM items WHERE owner_id IS NULL").get() as {
    c: number;
  };
  const orphanWishlist = d.prepare("SELECT COUNT(*) c FROM wishlist_items WHERE owner_id IS NULL").get() as {
    c: number;
  };
  if (orphanItems.c === 0 && orphanWishlist.c === 0) return;
  const id = ensureBootstrapUser(d);
  if (orphanItems.c > 0) d.prepare("UPDATE items SET owner_id = ? WHERE owner_id IS NULL").run(id);
  if (orphanWishlist.c > 0) d.prepare("UPDATE wishlist_items SET owner_id = ? WHERE owner_id IS NULL").run(id);
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
  ensureColumn(db, "items", "offloaded_date", "offloaded_date TEXT");
  ensureColumn(db, "items", "brand", "brand TEXT NOT NULL DEFAULT ''");
  ensureColumn(db, "items", "subcategory", "subcategory TEXT NOT NULL DEFAULT ''");
  ensureColumn(db, "items", "quality", "quality TEXT NOT NULL DEFAULT ''");
  ensureColumn(db, "users", "avatar_path", "avatar_path TEXT");
  // Money columns must allow NULL ("never recorded") rather than 0 ("free").
  migrateMoneyColumns(db);
  db.exec("CREATE INDEX IF NOT EXISTS idx_items_owner ON items(owner_id);");
  adoptOrphans(db);
  backfillBrandAndQuality(db);
  return db;
}

function extractTag(desc: string, tag: string): string {
  const m = new RegExp(`(?:^|·\\s*)${tag}:\\s*([^·]+)`).exec(desc);
  return m ? m[1].trim() : "";
}

function backfillBrandAndQuality(d: DatabaseSync): void {
  try {
    const rows = d
      .prepare(
        "SELECT id, description FROM items WHERE (brand IS NULL OR brand = '') AND description LIKE '%Brand:%'"
      )
      .all() as { id: number; description: string }[];
    for (const r of rows) {
      const b = extractTag(r.description, "Brand");
      if (b) d.prepare("UPDATE items SET brand = ? WHERE id = ?").run(b, r.id);
    }
    const qRows = d
      .prepare(
        "SELECT id, description FROM items WHERE (quality IS NULL OR quality = '') AND description LIKE '%Quality:%'"
      )
      .all() as { id: number; description: string }[];
    for (const r of qRows) {
      const q = extractTag(r.description, "Quality");
      if (q) d.prepare("UPDATE items SET quality = ? WHERE id = ?").run(q, r.id);
    }
    const sRows = d
      .prepare(
        "SELECT id, description FROM items WHERE (subcategory IS NULL OR subcategory = '') AND (description LIKE '%Type:%' OR description LIKE '%Subcategory:%')"
      )
      .all() as { id: number; description: string }[];
    for (const r of sRows) {
      const s = extractTag(r.description, "Subcategory") || extractTag(r.description, "Type");
      if (s) d.prepare("UPDATE items SET subcategory = ? WHERE id = ?").run(s, r.id);
    }
  } catch {
    /* ignore backfill errors */
  }
}

/** Rows come back as plain objects with snake_case keys; map them to camelCase. */
function toItem(row: Record<string, unknown>): Item {
  const desc = String(row.description ?? "");
  const brand =
    row.brand != null && String(row.brand).trim()
      ? String(row.brand).trim()
      : extractTag(desc, "Brand");
  const subcategory =
    row.subcategory != null && String(row.subcategory).trim()
      ? String(row.subcategory).trim()
      : (extractTag(desc, "Subcategory") || extractTag(desc, "Type"));
  const quality =
    row.quality != null && String(row.quality).trim()
      ? String(row.quality).trim()
      : extractTag(desc, "Quality");

  return {
    id: Number(row.id),
    ownerId: Number(row.owner_id),
    name: String(row.name),
    brand,
    category: String(row.category),
    subcategory,
    quality,
    description: desc,
    location: String(row.location ?? ""),
    purchaseDate: (row.purchase_date as string) ?? null,
    offloadedDate: (row.offloaded_date as string) ?? null,
    purchasePrice: row.purchase_price == null ? null : Number(row.purchase_price),
    currentValue: row.current_value == null ? null : Number(row.current_value),
    status: String(row.status) as ItemStatus,
    lastUsedAt: (row.last_used_at as string) ?? null,
    useFrequency: String(row.use_frequency) as UseFrequency,
    photoPath: (row.photo_path as string) ?? null,
    priority: String(row.priority) as Priority,
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}

/**
 * "closed" is a fourth terminal state: the item is gone from the inventory
 * but we never recorded how it went. The source inventory uses "Close" for
 * items that stopped being tracked without a sale, donation or disposal —
 * inventing one of those three would be a claim we cannot back up.
 */
export type ItemStatus = "owned" | "sold" | "donated" | "disposed" | "closed" | "purgatory";
export type Priority = "auto" | "keep" | "get_rid";
export type Disposition = "sold" | "donated" | "disposed" | "closed";
export type UseFrequency = "daily" | "weekly" | "monthly" | "seasonal" | "rare" | "never" | "unknown";

export interface Item {
  id: number;
  ownerId: number;
  name: string;
  brand: string;
  category: string;
  subcategory: string;
  quality: string;
  description: string;
  location: string;
  purchaseDate: string | null;
  offloadedDate?: string | null;
  purchasePrice: number | null;
  currentValue: number | null;
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
  amount: number | null;
  channel: string;
  notes: string;
}

export interface User {
  id: number;
  email: string;
  name: string;
  avatarPath?: string | null;
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
    avatarPath: (row.avatar_path as string | null) ?? null,
    createdAt: String(row.created_at),
  };
}

export function updateUserProfile(
  id: number,
  fields: { name?: string; email?: string; passwordHash?: string; avatarPath?: string | null }
): User | null {
  const existing = getUserById(id);
  if (!existing) return null;

  const sets: string[] = [];
  const args: (string | number | null)[] = [];

  if (typeof fields.name === "string") {
    sets.push("name = ?");
    args.push(fields.name.trim());
  }
  if (typeof fields.email === "string" && fields.email.trim()) {
    sets.push("email = ?");
    args.push(fields.email.trim().toLowerCase());
  }
  if (typeof fields.passwordHash === "string" && fields.passwordHash) {
    sets.push("password_hash = ?");
    args.push(fields.passwordHash);
  }
  if (fields.avatarPath !== undefined) {
    sets.push("avatar_path = ?");
    args.push(fields.avatarPath);
  }

  if (sets.length === 0) return existing;

  args.push(id);
  getDb()
    .prepare(`UPDATE users SET ${sets.join(", ")} WHERE id = ?`)
    .run(...args);

  return getUserById(id);
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
    d.prepare("UPDATE wishlist_items SET owner_id = ? WHERE owner_id = ?").run(newUserId, b.id);
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
  brand?: string;
  category: string;
  subcategory?: string;
  quality?: string;
  description: string;
  location: string;
  purchaseDate: string | null;
  offloadedDate?: string | null;
  purchasePrice: number | null;
  currentValue: number | null;
  status: ItemStatus;
  lastUsedAt: string | null;
  useFrequency: UseFrequency;
  photoPath: string | null;
  priority: Priority;
}

export function createItem(ownerId: number, input: ItemInput): Item {
  const res = getDb()
    .prepare(
      `INSERT INTO items (owner_id, name, brand, category, subcategory, quality, description, location, purchase_date, offloaded_date,
                          purchase_price, current_value, status, last_used_at, use_frequency, photo_path, priority)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      ownerId,
      input.name,
      input.brand ?? "",
      input.category,
      input.subcategory ?? "",
      input.quality ?? "",
      input.description,
      input.location,
      input.purchaseDate,
      input.offloadedDate ?? null,
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
    brand: input.brand !== undefined ? input.brand : existing.brand,
    category: input.category ?? existing.category,
    subcategory: input.subcategory !== undefined ? input.subcategory : existing.subcategory,
    quality: input.quality !== undefined ? input.quality : existing.quality,
    description: input.description ?? existing.description,
    location: input.location ?? existing.location,
    purchaseDate: input.purchaseDate !== undefined ? input.purchaseDate : existing.purchaseDate,
    offloadedDate:
      input.offloadedDate !== undefined ? input.offloadedDate : existing.offloadedDate,
    purchasePrice:
      input.purchasePrice !== undefined ? input.purchasePrice : existing.purchasePrice,
    currentValue: input.currentValue !== undefined ? input.currentValue : existing.currentValue,
    status: input.status ?? existing.status,
    lastUsedAt: input.lastUsedAt !== undefined ? input.lastUsedAt : existing.lastUsedAt,
    useFrequency: input.useFrequency ?? existing.useFrequency,
    photoPath: input.photoPath !== undefined ? input.photoPath : existing.photoPath,
    priority: input.priority ?? existing.priority,
  };
  getDb()
    .prepare(
      `UPDATE items SET name = ?, brand = ?, category = ?, subcategory = ?, quality = ?, description = ?, location = ?, purchase_date = ?, offloaded_date = ?,
              purchase_price = ?, current_value = ?, status = ?, last_used_at = ?, use_frequency = ?,
              photo_path = ?, priority = ?, updated_at = datetime('now')
       WHERE id = ? AND owner_id = ?`
    )
    .run(
      merged.name,
      merged.brand ?? "",
      merged.category,
      merged.subcategory ?? "",
      merged.quality ?? "",
      merged.description,
      merged.location,
      merged.purchaseDate,
      merged.offloadedDate ?? null,
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
  amount: number | null,
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

/** Move an item into purgatory. */
export function moveItemToPurgatory(ownerId: number, id: number): Item | null {
  const existing = getItem(ownerId, id);
  if (!existing) return null;
  getDb()
    .prepare("UPDATE items SET status = 'purgatory', updated_at = datetime('now') WHERE id = ? AND owner_id = ?")
    .run(id, ownerId);
  return getItem(ownerId, id);
}

/**
 * Offload an item from purgatory or inventory with return amount ($) and quarter date.
 * If amount > 0, disposition is 'sold'. If amount == 0, disposition is 'disposed'.
 */
export function offloadItem(
  ownerId: number,
  id: number,
  amount: number,
  dateStr: string,
  notes: string = ""
): Item | null {
  const existing = getItem(ownerId, id);
  if (!existing) return null;

  const disposition: Disposition = amount > 0 ? "sold" : "disposed";
  const isoDate = quarterToIso(dateStr) || today();

  getDb()
    .prepare(
      `INSERT INTO disposals (item_id, disposition, disposed_at, amount, channel, notes)
       VALUES (?, ?, ?, ?, ?, ?)`
    )
    .run(id, disposition, isoDate, amount, "", notes);

  getDb()
    .prepare(
      `UPDATE items SET status = ?, offloaded_date = ?, updated_at = datetime('now') WHERE id = ? AND owner_id = ?`
    )
    .run(disposition, dateStr, id, ownerId);

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
    amount: r.amount == null ? null : Number(r.amount),
    channel: String(r.channel ?? ""),
    notes: String(r.notes ?? ""),
  }));
}

/* ---------------------------------------------------------------- wishlist */

export interface WishlistItem {
  id: number;
  ownerId: number;
  name: string;
  category: string;
  price: number | null;
  url: string;
  notes: string;
  priority: "high" | "medium" | "low";
  createdAt: string;
  updatedAt: string;
}

export interface WishlistInput {
  name: string;
  category?: string;
  price?: number | null;
  url?: string;
  notes?: string;
  priority?: "high" | "medium" | "low";
}

function toWishlistItem(row: Record<string, unknown>): WishlistItem {
  return {
    id: Number(row.id),
    ownerId: Number(row.owner_id),
    name: String(row.name),
    category: String(row.category ?? "misc"),
    price: row.price === null || row.price === undefined ? null : Number(row.price),
    url: String(row.url ?? ""),
    notes: String(row.notes ?? ""),
    priority: (String(row.priority ?? "medium") as "high" | "medium" | "low") || "medium",
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}

export function listWishlist(ownerId: number): WishlistItem[] {
  const rows = getDb()
    .prepare("SELECT * FROM wishlist_items WHERE owner_id = ? ORDER BY created_at DESC, id DESC")
    .all(ownerId) as Record<string, unknown>[];
  return rows.map(toWishlistItem);
}

export function getWishlistItem(ownerId: number, id: number): WishlistItem | null {
  const row = getDb()
    .prepare("SELECT * FROM wishlist_items WHERE id = ? AND owner_id = ?")
    .get(id, ownerId) as Record<string, unknown> | undefined;
  return row ? toWishlistItem(row) : null;
}

export function createWishlistItem(ownerId: number, input: WishlistInput): WishlistItem {
  const res = getDb()
    .prepare(
      `INSERT INTO wishlist_items (owner_id, name, category, price, url, notes, priority)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      ownerId,
      input.name.trim(),
      (input.category ?? "misc").trim() || "misc",
      input.price === null || input.price === undefined ? null : Number(input.price),
      (input.url ?? "").trim(),
      (input.notes ?? "").trim(),
      input.priority ?? "medium"
    );
  return getWishlistItem(ownerId, Number(res.lastInsertRowid))!;
}

export function updateWishlistItem(
  ownerId: number,
  id: number,
  input: Partial<WishlistInput>
): WishlistItem | null {
  const existing = getWishlistItem(ownerId, id);
  if (!existing) return null;

  const merged = {
    name: input.name !== undefined ? input.name.trim() : existing.name,
    category: input.category !== undefined ? input.category.trim() || "misc" : existing.category,
    price: input.price !== undefined ? (input.price === null ? null : Number(input.price)) : existing.price,
    url: input.url !== undefined ? input.url.trim() : existing.url,
    notes: input.notes !== undefined ? input.notes.trim() : existing.notes,
    priority: input.priority !== undefined ? input.priority : existing.priority,
  };

  getDb()
    .prepare(
      `UPDATE wishlist_items
       SET name = ?, category = ?, price = ?, url = ?, notes = ?, priority = ?, updated_at = datetime('now')
       WHERE id = ? AND owner_id = ?`
    )
    .run(
      merged.name,
      merged.category,
      merged.price,
      merged.url,
      merged.notes,
      merged.priority,
      id,
      ownerId
    );

  return getWishlistItem(ownerId, id);
}

export function deleteWishlistItem(ownerId: number, id: number): boolean {
  const res = getDb()
    .prepare("DELETE FROM wishlist_items WHERE id = ? AND owner_id = ?")
    .run(id, ownerId);
  return Number(res.changes) > 0;
}

export function convertWishlistItemToInventory(
  ownerId: number,
  id: number,
  purchasePrice?: number | null
): Item | null {
  const wish = getWishlistItem(ownerId, id);
  if (!wish) return null;

  const finalPrice = purchasePrice !== undefined ? purchasePrice : wish.price;

  const newItem = createItem(ownerId, {
    name: wish.name,
    category: wish.category,
    description: wish.notes,
    location: "",
    purchaseDate: today(),
    purchasePrice: finalPrice,
    currentValue: finalPrice,
    status: "owned",
    lastUsedAt: null,
    useFrequency: "unknown",
    photoPath: null,
    priority: "auto",
  });

  deleteWishlistItem(ownerId, id);
  return newItem;
}
