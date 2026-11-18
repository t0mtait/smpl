/**
 * Import a TomsHQ-style inventory workbook into the declutter app.
 *
 *   node scripts/import-stuffdb.mjs --xlsx ~/Downloads/StuffDB.xlsx --email mail@tomjt.com
 *   node scripts/import-stuffdb.mjs --xlsx ... --email ... --dry-run
 *
 * The workbook (one sheet, 11 columns) holds the real inventory:
 *
 *   Name | Brand | Category | Subcategory | Status | Quality | Acquisition |
 *   EOL | Paid ALL-IN | Received | Notes
 *
 * The three stages are separate on purpose:
 *
 *   readWorkbook()  parse the file (scripts/xlsx.mjs)
 *   planImport()    decide what each row means (lib/stuffdb-map.ts)
 *   applyImport()   replace the account's inventory in the database
 *
 * Only the first stage needs the real file, so the mapping and the
 * destructive write can both be tested without one.
 *
 * The write is a replacement, not an addition: every item belonging to the
 * target account is removed first, along with its disposal history and any
 * photo file that account owned. Other accounts are untouched.
 *
 * Persistence goes through lib/db.ts, so the import uses the same schema,
 * the same owner scoping and the same migrations as the app itself.
 */
import fs from "node:fs";
import path from "node:path";
import { readFirstSheet, sheetNameOf } from "./xlsx.mjs";

const ROOT = process.cwd();

/* ---------------------------------------------------------------- stages */

/** Read every row of the workbook, including the ones the AutoFilter hid. */
export function readWorkbook(xlsxPath) {
  const { rows } = readFirstSheet(xlsxPath);
  const sheetName = sheetNameOf(xlsxPath);
  return { rows, sheetName };
}

/**
 * Turn source rows into items. Pure: no database, no clock of its own
 * beyond the injectable `now`.
 */
export async function planImport(rows, sheetName, now = new Date()) {
  const { mapRows } = await import("../lib/stuffdb-map.ts");
  return mapRows(rows, sheetName, now);
}

/**
 * Replace one account's inventory with the planned items.
 *
 * Everything happens in a single transaction: either the account ends up
 * with the new inventory, or it keeps the one it had.
 */
export async function applyImport(ownerId, items, options = {}) {
  const { dryRun = false } = options;
  const { getDb, listItems, deleteItem, createItem, disposeItem, UPLOAD_DIR } = await import(
    "../lib/db.ts"
  );
  const db = getDb();

  const before = {
    items: listItems(ownerId).length,
    disposals: db
      .prepare(
        "SELECT COUNT(*) c FROM disposals d JOIN items i ON i.id = d.item_id WHERE i.owner_id = ?"
      )
      .get(ownerId).c,
  };

  if (dryRun) return { before, after: before, removedPhotos: [] };

  // Photo files are prefixed with the owner id, so only files this account
  // owns can be removed.
  const oldItems = listItems(ownerId);
  const removedPhotos = [];
  for (const item of oldItems) {
    if (!item.photoPath) continue;
    if (!item.photoPath.startsWith(`u${ownerId}-`)) continue;
    const file = path.join(UPLOAD_DIR, path.basename(item.photoPath));
    if (fs.existsSync(file)) removedPhotos.push(file);
  }

  db.exec("BEGIN");
  try {
    for (const item of oldItems) {
      deleteItem(ownerId, item.id);
    }

    for (const item of items) {
      const created = createItem(ownerId, {
        name: item.name,
        category: item.category,
        description: item.description,
        location: item.location,
        purchaseDate: item.purchaseDate,
        offloadedDate: item.offloadedDate,
        purchasePrice: item.purchasePrice,
        currentValue: item.currentValue,
        status: item.status,
        lastUsedAt: item.lastUsedAt,
        useFrequency: item.useFrequency,
        photoPath: null,
        priority: item.priority,
      });

      if (item.disposal) {
        disposeItem(
          ownerId,
          created.id,
          item.disposal.disposition,
          item.disposal.disposedAt,
          item.disposal.amount,
          item.disposal.channel,
          item.disposal.notes
        );
      }
    }
    db.exec("COMMIT");
  } catch (error) {
    try {
      db.exec("ROLLBACK");
    } catch {
      /* the transaction was never opened */
    }
    throw error;
  }

  for (const file of removedPhotos) {
    try {
      fs.unlinkSync(file);
    } catch {
      /* best effort — a missing photo file must not fail the import */
    }
  }

  const after = {
    items: listItems(ownerId).length,
    disposals: db
      .prepare(
        "SELECT COUNT(*) c FROM disposals d JOIN items i ON i.id = d.item_id WHERE i.owner_id = ?"
      )
      .get(ownerId).c,
    sales: db
      .prepare(
        "SELECT COALESCE(SUM(d.amount),0) s FROM disposals d JOIN items i ON i.id = d.item_id " +
          "WHERE d.disposition = 'sold' AND i.owner_id = ?"
      )
      .get(ownerId).s,
    ownedValue: db
      .prepare(
        "SELECT COALESCE(SUM(current_value),0) v FROM items WHERE owner_id = ? AND status = 'owned'"
      )
      .get(ownerId).v,
    spent: db
      .prepare("SELECT COALESCE(SUM(purchase_price),0) v FROM items WHERE owner_id = ?").get(ownerId)
      .v,
    ownedWithoutValue: db
      .prepare(
        "SELECT COUNT(*) c FROM items WHERE owner_id = ? AND status = 'owned' AND current_value IS NULL"
      )
      .get(ownerId).c,
  };

  return { before, after, removedPhotos };
}

/* --------------------------------------------------------------- the CLI */

function arg(name) {
  const index = process.argv.indexOf(`--${name}`);
  return index === -1 ? null : process.argv[index + 1];
}

function money(value) {
  return value === null ? "—" : `$${value.toFixed(2)}`;
}

function summarize(items) {
  const counts = new Map();
  let paid = 0;
  let paidKnown = 0;
  let value = 0;
  let sales = 0;
  for (const item of items) {
    counts.set(item.status, (counts.get(item.status) ?? 0) + 1);
    if (item.purchasePrice !== null) {
      paid += item.purchasePrice;
      paidKnown += 1;
    }
    if (item.currentValue !== null) value += item.currentValue;
    if (item.disposal?.disposition === "sold" && item.disposal.amount !== null) {
      sales += item.disposal.amount;
    }
  }
  return {
    owned: counts.get("owned") ?? 0,
    sold: counts.get("sold") ?? 0,
    donated: counts.get("donated") ?? 0,
    disposed: counts.get("disposed") ?? 0,
    closed: counts.get("closed") ?? 0,
    "marked get rid of": items.filter((i) => i.priority === "get_rid").length,
    "total purchase cost": `$${paid.toFixed(2)} (${paidKnown} of ${items.length} priced)`,
    "owned value": `$${value.toFixed(2)}`,
    "sale proceeds": `$${sales.toFixed(2)}`,
  };
}

async function main() {
  const xlsxPath = path.resolve(arg("xlsx") ?? path.join(ROOT, "StuffDB.xlsx"));
  const email = (arg("email") ?? "").trim().toLowerCase();
  const dryRun = process.argv.includes("--dry-run");

  if (!email) {
    console.error(
      "Usage: node scripts/import-stuffdb.mjs --xlsx <file.xlsx> --email <account> [--dry-run]"
    );
    process.exit(1);
  }
  if (!fs.existsSync(xlsxPath)) {
    console.error(`Workbook not found: ${xlsxPath}`);
    process.exit(1);
  }

  const { rows, sheetName } = readWorkbook(xlsxPath);
  const { items, exportedAt, skipped } = await planImport(rows, sheetName);

  console.log(`Workbook: ${xlsxPath}`);
  console.log(`Sheet:    ${sheetName ?? "(unnamed)"}`);
  console.log(`Rows read: ${rows.length}  (every row, including filtered/hidden ones)`);
  console.log(`Rows skipped (no name): ${skipped}`);
  console.log(`Workbook snapshot date: ${exportedAt}`);
  console.log("");

  console.log("Planned import");
  for (const [label, value] of Object.entries(summarize(items))) {
    console.log(`  ${label.padEnd(30)} ${value}`);
  }
  console.log("");
  console.log("Category mapping");
  const byCategory = new Map();
  for (const item of items) {
    byCategory.set(item.category, (byCategory.get(item.category) ?? 0) + 1);
  }
  for (const [category, count] of [...byCategory.entries()].sort((a, b) => b[1] - a[1])) {
    console.log(`  ${category.padEnd(30)} ${count}`);
  }
  console.log("");
  console.log("Money coverage");
  console.log(`  ${"paid amount known".padEnd(30)} ${items.filter((i) => i.purchasePrice !== null).length}`);
  console.log(`  ${"paid amount missing".padEnd(30)} ${items.filter((i) => i.purchasePrice === null).length}`);
  console.log(`  ${"paid amount explicitly $0".padEnd(30)} ${items.filter((i) => i.purchasePrice === 0).length}`);
  console.log(`  ${"current value known".padEnd(30)} ${items.filter((i) => i.currentValue !== null).length}`);
  console.log(`  ${"current value unknown".padEnd(30)} ${items.filter((i) => i.currentValue === null).length}`);
  console.log("");
  console.log("First 5 items");
  for (const item of items.slice(0, 5)) {
    console.log(
      `  ${item.name} | ${item.category} | ${item.status} | ${item.useFrequency} | ` +
        `paid ${money(item.purchasePrice)} | value ${money(item.currentValue)} | ${item.priority}`
    );
  }

  if (dryRun) {
    console.log("");
    console.log("Dry run — nothing was written.");
    return;
  }

  const { getUserByEmail } = await import("../lib/db.ts");
  const user = getUserByEmail(email);
  if (!user) {
    console.error(`No account found for ${email}. Register it in the app first.`);
    process.exit(1);
  }

  const { before, after, removedPhotos } = await applyImport(user.id, items);

  console.log("");
  console.log("Removed");
  console.log(`  ${"items for " + email.padEnd(22)} ${before.items}`);
  console.log(`  ${"disposals".padEnd(30)} ${before.disposals}`);
  console.log(`  ${"photo files".padEnd(30)} ${removedPhotos.length}`);
  console.log("");
  console.log("Imported");
  console.log(`  ${"items".padEnd(30)} ${after.items}`);
  console.log(`  ${"disposals".padEnd(30)} ${after.disposals}`);
  console.log(`  ${"lifetime sales earnings".padEnd(30)} $${after.sales.toFixed(2)}`);
  console.log(`  ${"total paid".padEnd(30)} $${after.spent.toFixed(2)}`);
  console.log(`  ${"owned value".padEnd(30)} $${after.ownedValue.toFixed(2)}`);
  console.log(`  ${"owned items with no value".padEnd(30)} ${after.ownedWithoutValue}`);
}

// Only run the CLI when this file is the entry point, so the stages above
// can be imported by the tests.
if (process.argv[1] && process.argv[1].endsWith("import-stuffdb.mjs")) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
