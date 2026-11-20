/**
 * Seed the declutter database with realistic sample data.
 *
 *   npm run seed                # wipe and reseed (parks data on the bootstrap account)
 *   npm run seed -- keep        # keep existing rows, add sample data on top
 *   npm run seed -- you@x.com   # attach the data to an existing account
 *
 * The schema comes from lib/schema.sql — the same file the app reads — so
 * seed and runtime can never drift.
 *
 * Ownership: seeded rows belong to an account. With no email argument the
 * data is parked on the non-loginable bootstrap account, and the first real
 * registration claims it. Pass an email to seed straight into that account.
 */
import { DatabaseSync } from "node:sqlite";
import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const DATA_DIR = (process.env.SMPL_DATA_DIR || process.env.DECLUTTER_DATA_DIR)
  ? path.resolve(process.env.SMPL_DATA_DIR || process.env.DECLUTTER_DATA_DIR)
  : path.join(ROOT, "data");
const DB_NAME = fs.existsSync(path.join(DATA_DIR, "declutter.db")) ? "declutter.db" : "smpl.db";
const DB_PATH = path.join(DATA_DIR, DB_NAME);
const keepExisting = process.argv.includes("keep");
const emailArg = process.argv.find(
  (a) => a.includes("@") && !a.startsWith("--")
);

fs.mkdirSync(DATA_DIR, { recursive: true });
fs.mkdirSync(path.join(DATA_DIR, "uploads"), { recursive: true });

const db = new DatabaseSync(DB_PATH);
db.exec("PRAGMA journal_mode = WAL;");
db.exec("PRAGMA foreign_keys = ON;");
db.exec(fs.readFileSync(path.join(ROOT, "lib", "schema.sql"), "utf8"));

/* ------------------------------------------------------------- owner */

const BOOTSTRAP_EMAIL = "bootstrap@smpl.invalid";

function resolveOwnerId() {
  if (emailArg) {
    const email = emailArg.trim().toLowerCase();
    const row = db.prepare("SELECT id FROM users WHERE email = ? COLLATE NOCASE").get(email);
    if (!row) {
      console.error(`No account found for ${email}. Register it in the app first.`);
      process.exit(1);
    }
    return Number(row.id);
  }
  // Bootstrap account — cannot log in, exists so pre-account data has a home.
  const existing = db.prepare("SELECT id FROM users WHERE is_bootstrap = 1 LIMIT 1").get();
  if (existing) return Number(existing.id);
  const res = db
    .prepare(
      "INSERT INTO users (email, name, password_hash, is_bootstrap) VALUES (?, ?, '', 1)"
    )
    .run(BOOTSTRAP_EMAIL, "Previous owner");
  return Number(res.lastInsertRowid);
}

const ownerId = resolveOwnerId();

if (!keepExisting) {
  db.exec("DELETE FROM disposals; DELETE FROM items;");
}

// Local calendar dates, matching how the app reads them back.
const daysAgo = (n) => {
  const d = new Date();
  d.setDate(d.getDate() - n);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};

const insert = db.prepare(
  `INSERT INTO items (owner_id, name, category, description, location, purchase_date, purchase_price,
                       current_value, status, last_used_at, use_frequency, priority, created_at)
   VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'owned', ?, ?, ?, datetime('now'))`
);

// [name, category, description, location, age, paid, value, idleDays, frequency, priority]
const owned = [
  ["Cast iron skillet", "kitchen", "Bought before the move, still the best one", "kitchen cabinet", 900, 45, 35, 3, "weekly", "auto"],
  ["Espresso machine", "appliance", "Gave up on making latte art", "counter", 1400, 320, 120, 700, "rare", "auto"],
  ["Winter jacket", "clothing", "Too warm now that we have the good one", "closet top shelf", 1100, 90, 45, 900, "seasonal", "auto"],
  ["Camping stove", "camping", "Took it twice since 2021", "garage bin 3", 1500, 45, 25, 1200, "rare", "auto"],
  ["Drone", "hobby", "Bought during a brief enthusiasm", "office cabinet", 800, 400, 250, 300, "rare", "auto"],
  ["Office chair", "furniture", "Back hurts more, not less", "office", 1300, 150, 80, 500, "daily", "auto"],
  ["Extra monitor", "electronics", "Third screen is a luxury", "office desk", 500, 90, 45, 400, "monthly", "auto"],
  ["Ski equipment", "sports", "Skied once in three years", "garage rack", 1700, 250, 110, 1500, "seasonal", "auto"],
  ["Board game", "toys", "Nobody ever pulls it out", "living room shelf", 400, 15, 8, 800, "rare", "auto"],
  ["Old iPad", "electronics", "Screen cracked, won't update", "drawer", 1000, 60, 30, 1100, "never", "auto"],
  ["Chef knife", "kitchen", "Sharpened last week", "kitchen drawer", 700, 90, 70, 2, "weekly", "keep"],
  ["Yoga mat", "sports", "Used twice", "bedroom closet", 200, 20, 12, 500, "rare", "auto"],
  ["Cardboard boxes", "misc", "Eleven of them, in the attic", "attic", 200, 0, 0, 600, "never", "auto"],
  ["Suit", "clothing", "Job is fully remote", "closet", 1800, 120, 40, 1000, "rare", "auto"],
  ["Backpack", "misc", "Daily driver, keep", "hall closet", 600, 80, 60, 1, "daily", "keep"],
  ["Aquarium", "hobby", "Bought the house, never set it up", "living room", 400, 60, 45, 700, "never", "auto"],
  ["Tent", "camping", "Pitched it once, in the rain", "garage bin 1", 900, 220, 90, 800, "rare", "auto"],
  ["E-reader", "electronics", "Replaced by the phone in my pocket", "nightstand", 1100, 130, 35, 950, "rare", "auto"],
  ["Dining table", "furniture", "We eat on the couch now", "dining room", 2200, 400, 180, 1100, "monthly", "auto"],
  ["Snowblower", "tools", "Three storms a year, one use", "shed", 1300, 320, 140, 1300, "seasonal", "auto"],
];

for (const [name, category, description, location, age, paid, value, idle, freq, prio] of owned) {
  // A "never used" item has no last-used date at all — that is the whole
  // point of the never-used signal.
  const lastUsed = freq === "never" ? null : daysAgo(idle);
  insert.run(
    ownerId, name, category, description, location, daysAgo(age), paid, value,
    lastUsed, freq, prio
  );
}

// Two grinders — the duplicate signal should catch these.
for (const i of [1, 2]) {
  insert.run(
    ownerId,
    `Coffee grinder ${i}`,
    "kitchen",
    i === 1 ? "The good one" : "Backup, never used",
    "kitchen cabinet",
    daysAgo(600),
    60,
    i === 1 ? 40 : 20,
    i === 1 ? daysAgo(2) : null,
    i === 1 ? "weekly" : "never",
    "auto"
  );
}

// Items that are already gone — inserted as owned, then disposed below.
const gone = [
  ["Old monitor", "electronics", "Died the day the new one arrived", "office desk", 800, 120, 180, 320],
  ["ThinkPad laptop", "computer", "Replaced by the work laptop", "office shelf", 1600, 400, 650, 800],
  ["Blender", "kitchen", "Motor burned out", "kitchen cabinet", 1200, 25, 60, 900],
  ["Winter boots", "clothing", "Outgrew them", "closet floor", 1000, 40, 20, 800],
  ["Baby books", "books", "Thirty of them, all the same age", "living room shelf", 2000, 60, 0, 1200],
  ["Broken toaster", "kitchen", "Never worked properly", "attic", 900, 25, 0, 850],
];

const ids = new Map();
for (const [name, category, description, location, age, paid, value, idle] of gone) {
  insert.run(
    ownerId, name, category, description, location, daysAgo(age), paid, value,
    daysAgo(idle), "rare", "auto"
  );
  const row = db
    .prepare("SELECT id FROM items WHERE owner_id = ? AND name = ? ORDER BY id DESC LIMIT 1")
    .get(ownerId, name);
  ids.set(name, row.id);
}

const dispose = db.prepare(
  `INSERT INTO disposals (item_id, disposition, disposed_at, amount, channel, notes) VALUES (?, ?, ?, ?, ?, ?)`
);
const setStatus = db.prepare("UPDATE items SET status = ? WHERE id = ? AND owner_id = ?");

// Disposals are spread over the last several months so the earnings chart
// has something to show.
const disposals = [
  ["Old monitor", "sold", 8, 120, 180, "eBay", "Sold to a coworker"],
  ["ThinkPad laptop", "sold", 3, 400, 650, "Facebook Marketplace", "Replaced by the work laptop"],
  ["Blender", "sold", 1, 25, 60, "Buy Nothing", "Gave it away for free — $0 earned"],
  ["Winter boots", "donated", 5, 0, 0, "Buy Nothing", "Took them to the shelter"],
  ["Baby books", "donated", 2, 0, 0, "Local library", "Thirty of them"],
  ["Broken toaster", "disposed", 4, 0, 0, "", "Took it apart, binned the parts"],
];

for (const [name, disposition, age, amount, value, channel, notes] of disposals) {
  const id = ids.get(name);
  if (!id) continue;
  dispose.run(id, disposition, daysAgo(age), amount, channel, notes);
  setStatus.run(disposition, id, ownerId);
}

const counts = {
  items: db.prepare("SELECT COUNT(*) c FROM items WHERE owner_id = ?").get(ownerId).c,
  disposals: db
    .prepare(
      "SELECT COUNT(*) c FROM disposals d JOIN items i ON i.id = d.item_id WHERE i.owner_id = ?"
    )
    .get(ownerId).c,
  sales: db
    .prepare(
      "SELECT COALESCE(SUM(d.amount),0) s FROM disposals d JOIN items i ON i.id = d.item_id WHERE d.disposition='sold' AND i.owner_id = ?"
    )
    .get(ownerId).s,
};

const ownerLabel = emailArg ? emailArg.trim().toLowerCase() : "the bootstrap account (first registration claims it)";
console.log(`Seeded ${counts.items} items, ${counts.disposals} disposals for ${ownerLabel}.`);
console.log(`Lifetime sales earnings: $${counts.sales}`);
db.close();
