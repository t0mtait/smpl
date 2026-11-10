"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.UPLOAD_DIR = exports.DATA_DIR = void 0;
exports.getDb = getDb;
exports.listItems = listItems;
exports.getItem = getItem;
exports.createItem = createItem;
exports.updateItem = updateItem;
exports.deleteItem = deleteItem;
exports.disposeItem = disposeItem;
exports.restoreItem = restoreItem;
exports.listDisposals = listDisposals;
exports.listAlerts = listAlerts;
exports.createAlert = createAlert;
exports.snoozeAlert = snoozeAlert;
exports.toggleAlert = toggleAlert;
exports.deleteAlert = deleteAlert;
const node_sqlite_1 = require("node:sqlite");
const node_fs_1 = __importDefault(require("node:fs"));
const node_path_1 = __importDefault(require("node:path"));
exports.DATA_DIR = node_path_1.default.join(process.cwd(), "data");
exports.UPLOAD_DIR = node_path_1.default.join(exports.DATA_DIR, "uploads");
const DB_PATH = node_path_1.default.join(exports.DATA_DIR, "declutter.db");
let db = null;
const SCHEMA_PATH = node_path_1.default.join(process.cwd(), "lib", "schema.sql");
function readSchema() {
    return node_fs_1.default.readFileSync(SCHEMA_PATH, "utf8");
}
function getDb() {
    if (db)
        return db;
    node_fs_1.default.mkdirSync(exports.DATA_DIR, { recursive: true });
    node_fs_1.default.mkdirSync(exports.UPLOAD_DIR, { recursive: true });
    db = new node_sqlite_1.DatabaseSync(DB_PATH);
    db.exec("PRAGMA journal_mode = WAL;");
    db.exec("PRAGMA foreign_keys = ON;");
    db.exec(readSchema());
    return db;
}
/** Rows come back as plain objects with snake_case keys; map them to camelCase. */
function toItem(row) {
    return {
        id: Number(row.id),
        name: String(row.name),
        category: String(row.category),
        description: String(row.description),
        location: String(row.location),
        purchaseDate: row.purchase_date ?? null,
        purchasePrice: Number(row.purchase_price ?? 0),
        currentValue: Number(row.current_value ?? 0),
        status: String(row.status),
        lastUsedAt: row.last_used_at ?? null,
        useFrequency: String(row.use_frequency),
        photoPath: row.photo_path ?? null,
        priority: String(row.priority),
        createdAt: String(row.created_at),
        updatedAt: String(row.updated_at),
    };
}
/** All non-disposed items, newest first. */
function listItems() {
    const rows = getDb()
        .prepare("SELECT * FROM items ORDER BY created_at DESC, id DESC")
        .all();
    return rows.map(toItem);
}
function getItem(id) {
    const row = getDb().prepare("SELECT * FROM items WHERE id = ?").get(id);
    return row ? toItem(row) : null;
}
function createItem(input) {
    const res = getDb()
        .prepare(`INSERT INTO items (name, category, description, location, purchase_date, purchase_price,
                          current_value, status, last_used_at, use_frequency, photo_path, priority)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
        .run(input.name, input.category, input.description, input.location, input.purchaseDate, input.purchasePrice, input.currentValue, input.status, input.lastUsedAt, input.useFrequency, input.photoPath, input.priority);
    return getItem(Number(res.lastInsertRowid));
}
function updateItem(id, input) {
    const existing = getItem(id);
    if (!existing)
        return null;
    const merged = {
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
        .prepare(`UPDATE items SET name = ?, category = ?, description = ?, location = ?, purchase_date = ?,
              purchase_price = ?, current_value = ?, status = ?, last_used_at = ?, use_frequency = ?,
              photo_path = ?, priority = ?, updated_at = datetime('now')
       WHERE id = ?`)
        .run(merged.name, merged.category, merged.description, merged.location, merged.purchaseDate, merged.purchasePrice, merged.currentValue, merged.status, merged.lastUsedAt, merged.useFrequency, merged.photoPath, merged.priority, id);
    return getItem(id);
}
function deleteItem(id) {
    getDb().prepare("DELETE FROM disposals WHERE item_id = ?").run(id);
    const res = getDb().prepare("DELETE FROM items WHERE id = ?").run(id);
    return Number(res.changes) > 0;
}
/**
 * Mark an item sold / donated / disposed. Records a disposal row and flips
 * the item's status. Items are never silently deleted — they stay in the
 * inventory with a status so lifetime stats stay accurate.
 */
function disposeItem(id, disposition, disposedAt, amount, channel, notes) {
    const existing = getItem(id);
    if (!existing)
        return null;
    getDb()
        .prepare(`INSERT INTO disposals (item_id, disposition, disposed_at, amount, channel, notes)
       VALUES (?, ?, ?, ?, ?, ?)`)
        .run(id, disposition, disposedAt, amount, channel, notes);
    getDb()
        .prepare("UPDATE items SET status = ?, updated_at = datetime('now') WHERE id = ?")
        .run(disposition, id);
    return getItem(id);
}
/** Un-dispose: puts an item back to owned and removes the disposal record. */
function restoreItem(id) {
    const existing = getItem(id);
    if (!existing)
        return null;
    getDb().prepare("DELETE FROM disposals WHERE item_id = ?").run(id);
    getDb()
        .prepare("UPDATE items SET status = 'owned', updated_at = datetime('now') WHERE id = ?")
        .run(id);
    return getItem(id);
}
function listDisposals() {
    const rows = getDb()
        .prepare("SELECT * FROM disposals ORDER BY disposed_at DESC, id DESC")
        .all();
    return rows.map((r) => ({
        id: Number(r.id),
        itemId: Number(r.item_id),
        disposition: String(r.disposition),
        disposedAt: String(r.disposed_at),
        amount: Number(r.amount ?? 0),
        channel: String(r.channel ?? ""),
        notes: String(r.notes ?? ""),
    }));
}
function listAlerts() {
    const rows = getDb().prepare("SELECT * FROM alerts ORDER BY next_due ASC").all();
    return rows.map((r) => ({
        id: Number(r.id),
        label: String(r.label),
        cadenceDays: Number(r.cadence_days),
        nextDue: String(r.next_due),
        active: Number(r.active) === 1,
    }));
}
function createAlert(label, cadenceDays) {
    const nextDue = new Date(Date.now() + cadenceDays * 86400000).toISOString().slice(0, 10);
    const res = getDb()
        .prepare("INSERT INTO alerts (label, cadence_days, next_due) VALUES (?, ?, ?)")
        .run(label, cadenceDays, nextDue);
    const row = getDb().prepare("SELECT * FROM alerts WHERE id = ?").get(Number(res.lastInsertRowid));
    const r = row;
    return {
        id: Number(r.id),
        label: String(r.label),
        cadenceDays: Number(r.cadence_days),
        nextDue: String(r.next_due),
        active: Number(r.active) === 1,
    };
}
/** Roll an alert's due date forward by its cadence. */
function snoozeAlert(id) {
    getDb()
        .prepare("UPDATE alerts SET next_due = date(next_due, '+' || cadence_days || ' days') WHERE id = ?")
        .run(id);
}
function toggleAlert(id, active) {
    getDb().prepare("UPDATE alerts SET active = ? WHERE id = ?").run(active ? 1 : 0, id);
}
function deleteAlert(id) {
    getDb().prepare("DELETE FROM alerts WHERE id = ?").run(id);
}
