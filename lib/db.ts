import { DatabaseSync } from "node:sqlite";
import fs from "node:fs";
import path from "node:path";

export const DATA_DIR = path.join(process.cwd(), "data");
export const UPLOAD_DIR = path.join(DATA_DIR, "uploads");
const DB_PATH = path.join(DATA_DIR, "declutter.db");

let db: DatabaseSync | null = null;

const SCHEMA_PATH = path.join(process.cwd(), "lib", "schema.sql");

function readSchema(): string {
  return fs.readFileSync(SCHEMA_PATH, "utf8");
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
  return db;
}

/** Rows come back as plain objects with snake_case keys; map them to camelCase. */
function toItem(row: Record<string, unknown>): Item {
  return {
    id: Number(row.id),
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

/** All non-disposed items, newest first. */
export function listItems(): Item[] {
  const rows = getDb()
    .prepare("SELECT * FROM items ORDER BY created_at DESC, id DESC")
    .all() as Record<string, unknown>[];
  return rows.map(toItem);
}

export function getItem(id: number): Item | null {
  const row = getDb().prepare("SELECT * FROM items WHERE id = ?").get(id) as
    | Record<string, unknown>
    | undefined;
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

export function createItem(input: ItemInput): Item {
  const res = getDb()
    .prepare(
      `INSERT INTO items (name, category, description, location, purchase_date, purchase_price,
                          current_value, status, last_used_at, use_frequency, photo_path, priority)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
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
  return getItem(Number(res.lastInsertRowid))!;
}

export function updateItem(id: number, input: Partial<ItemInput>): Item | null {
  const existing = getItem(id);
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
       WHERE id = ?`
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
      id
    );
  return getItem(id);
}

export function deleteItem(id: number): boolean {
  getDb().prepare("DELETE FROM disposals WHERE item_id = ?").run(id);
  const res = getDb().prepare("DELETE FROM items WHERE id = ?").run(id);
  return Number(res.changes) > 0;
}

/**
 * Mark an item sold / donated / disposed. Records a disposal row and flips
 * the item's status. Items are never silently deleted — they stay in the
 * inventory with a status so lifetime stats stay accurate.
 */
export function disposeItem(
  id: number,
  disposition: Disposition,
  disposedAt: string,
  amount: number,
  channel: string,
  notes: string
): Item | null {
  const existing = getItem(id);
  if (!existing) return null;
  getDb()
    .prepare(
      `INSERT INTO disposals (item_id, disposition, disposed_at, amount, channel, notes)
       VALUES (?, ?, ?, ?, ?, ?)`
    )
    .run(id, disposition, disposedAt, amount, channel, notes);
  getDb()
    .prepare("UPDATE items SET status = ?, updated_at = datetime('now') WHERE id = ?")
    .run(disposition, id);
  return getItem(id);
}

/** Un-dispose: puts an item back to owned and removes the disposal record. */
export function restoreItem(id: number): Item | null {
  const existing = getItem(id);
  if (!existing) return null;
  getDb().prepare("DELETE FROM disposals WHERE item_id = ?").run(id);
  getDb()
    .prepare("UPDATE items SET status = 'owned', updated_at = datetime('now') WHERE id = ?")
    .run(id);
  return getItem(id);
}

export function listDisposals(): Disposal[] {
  const rows = getDb()
    .prepare("SELECT * FROM disposals ORDER BY disposed_at DESC, id DESC")
    .all() as Record<string, unknown>[];
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

export function listAlerts(): Alert[] {
  const rows = getDb().prepare("SELECT * FROM alerts ORDER BY next_due ASC").all() as Record<
    string,
    unknown
  >[];
  return rows.map((r) => ({
    id: Number(r.id),
    label: String(r.label),
    cadenceDays: Number(r.cadence_days),
    nextDue: String(r.next_due),
    active: Number(r.active) === 1,
  }));
}

export function createAlert(label: string, cadenceDays: number): Alert {
  const nextDue = new Date(Date.now() + cadenceDays * 86400000).toISOString().slice(0, 10);
  const res = getDb()
    .prepare("INSERT INTO alerts (label, cadence_days, next_due) VALUES (?, ?, ?)")
    .run(label, cadenceDays, nextDue);
  const row = getDb().prepare("SELECT * FROM alerts WHERE id = ?").get(Number(res.lastInsertRowid));
  const r = row as Record<string, unknown>;
  return {
    id: Number(r.id),
    label: String(r.label),
    cadenceDays: Number(r.cadence_days),
    nextDue: String(r.next_due),
    active: Number(r.active) === 1,
  };
}

/** Roll an alert's due date forward by its cadence. */
export function snoozeAlert(id: number): void {
  getDb()
    .prepare("UPDATE alerts SET next_due = date(next_due, '+' || cadence_days || ' days') WHERE id = ?")
    .run(id);
}

export function toggleAlert(id: number, active: boolean): void {
  getDb().prepare("UPDATE alerts SET active = ? WHERE id = ?").run(active ? 1 : 0, id);
}

export function deleteAlert(id: number): void {
  getDb().prepare("DELETE FROM alerts WHERE id = ?").run(id);
}
