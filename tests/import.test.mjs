/**
 * Import tests: the workbook -> app mapping and the database write.
 *
 * Run directly by scripts/run-tests.mjs. Node strips the types in
 * lib/stuffdb-map.ts and lib/db.ts at runtime, so this suite exercises the
 * exact modules the importer uses.
 *
 * The mapping tests run against synthetic rows so they do not depend on a
 * workbook being present. When the real workbook is available
 * (STUFFDB_XLSX, or ~/Downloads/StuffDB.xlsx) the whole file is checked
 * against it as well.
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { readFirstSheet, sheetNameOf } from "../scripts/xlsx.mjs";
import { mapRows, categoryFor, quarterStart, quarterEnd, money, snapshotDate } from "../lib/stuffdb-map.ts";

let passed = 0;
let failed = 0;

function check(name, condition, detail = "") {
  if (condition) {
    passed++;
  } else {
    failed++;
    console.error(`FAIL: ${name}${detail ? ` — ${detail}` : ""}`);
  }
}

function eq(name, actual, expected) {
  check(name, actual === expected, `got ${JSON.stringify(actual)}, expected ${JSON.stringify(expected)}`);
}

/* ------------------------------------------------------------- fixtures */

const SHEET = "2026-09-13T08_23_31.892ZTomsHQ-";
const NOW = new Date("2026-11-11T12:00:00Z");

function row(overrides = {}) {
  return {
    Name: "",
    Brand: "",
    Category: "",
    Subcategory: "",
    Status: "",
    Quality: "",
    Acquisition: "",
    EOL: "",
    "Paid ALL-IN": null,
    Received: null,
    Notes: "",
    ...overrides,
  };
}

/* ------------------------------------------------------ status mapping */

{
  const { items } = mapRows(
    [
      row({ Name: "Sold thing", Status: "Sold", "Paid ALL-IN": 100, Received: 60 }),
      row({ Name: "Gifted thing", Status: "Donated", "Paid ALL-IN": 40 }),
      row({ Name: "Binned thing", Status: "Thrown Out", "Paid ALL-IN": 10 }),
      row({ Name: "Gone thing", Status: "Close", "Paid ALL-IN": 25 }),
    ],
    SHEET,
    NOW
  );

  eq("sold maps to sold", items[0].status, "sold");
  eq("sold has a disposal", items[0].disposal.disposition, "sold");
  eq("sold keeps the proceeds", items[0].disposal.amount, 60);
  eq("sold has no current value", items[0].currentValue, null);

  eq("donated maps to donated", items[1].status, "donated");
  eq("donated has no amount", items[1].disposal.amount, null);
  eq("donated notes say so", items[1].disposal.notes.includes("Donated"), true);

  eq("thrown out maps to disposed", items[2].status, "disposed");
  eq("thrown out has no amount", items[2].disposal.amount, null);

  eq("close maps to closed", items[3].status, "closed");
  eq("close has a closed disposal", items[3].disposal.disposition, "closed");
  eq("close has no amount", items[3].disposal.amount, null);
  check("close is not recorded as a sale", items[3].disposal.disposition !== "sold");
  check("close is not recorded as a donation", items[3].disposal.disposition !== "donated");
  check("close is not recorded as a throw-out", items[3].disposal.disposition !== "disposed");
}

/* --------------------------------------------------------- money rules */

{
  const { items } = mapRows(
    [
      row({ Name: "Free thing", "Paid ALL-IN": 0 }),
      row({ Name: "Unpaid thing" }),
      row({ Name: "Paid thing", "Paid ALL-IN": 250 }),
      row({ Name: "Sold for nothing", Status: "Sold", "Paid ALL-IN": 100, Received: 0 }),
      row({ Name: "Listed thing", Status: "Listed", "Paid ALL-IN": 100, Received: 300 }),
    ],
    SHEET,
    NOW
  );

  eq("an explicit $0 stays $0", items[0].purchasePrice, 0);
  eq("a free item has no value, not $0", items[0].currentValue, null);
  check("a free item says its value is unknown", items[0].description.includes("Current value not recorded"));

  eq("a missing price stays unknown", items[1].purchasePrice, null);
  check("a missing price says so", items[1].description.includes("Paid amount not recorded"));

  eq("a known price is kept", items[2].purchasePrice, 250);
  eq("a known price stands in for the value", items[2].currentValue, 250);

  eq("a $0 sale keeps its $0 proceeds", items[3].disposal.amount, 0);

  eq("a listed item takes the asking price", items[4].currentValue, 300);
  eq("a listed item is marked get rid of", items[4].priority, "get_rid");
  eq("a listed item is still owned", items[4].status, "owned");
}

/* -------------------------------------------------- cadence and usage */

{
  const { items } = mapRows(
    [
      row({ Name: "Daily thing", Status: "Heavy Use", "Paid ALL-IN": 100 }),
      row({ Name: "Monthly thing", Status: "Occasional Use", "Paid ALL-IN": 100 }),
      row({ Name: "Rare thing", Status: "Rare Use", "Paid ALL-IN": 100 }),
      row({ Name: "Silent thing", Status: "", "Paid ALL-IN": 100 }),
    ],
    SHEET,
    NOW
  );

  eq("Heavy Use is daily", items[0].useFrequency, "daily");
  eq("Heavy Use was used recently", items[0].lastUsedAt, "2026-11-08");
  check("the inferred date is disclosed", items[0].description.includes("Last used inferred from cadence"));

  eq("Occasional Use is monthly", items[1].useFrequency, "monthly");
  eq("Occasional Use was used a while back", items[1].lastUsedAt, "2026-09-12");

  eq("Rare Use is rare", items[2].useFrequency, "rare");

  eq("a row with no cadence has no frequency", items[3].useFrequency, "unknown");
  eq("a row with no cadence has no last-used date", items[3].lastUsedAt, null);
  check("the missing usage record is disclosed", items[3].description.includes("No usage record in source"));
}

/* ------------------------------------------------------ source fields */

{
  const { items } = mapRows(
    [
      row({
        Name: "Thing",
        Brand: "Sony",
        Category: "Electronics",
        Subcategory: "Audio",
        Status: "Heavy Use",
        Quality: "Excellent",
        Acquisition: "2024 Q3",
        EOL: "2026 Q2",
        "Paid ALL-IN": 400,
        Notes: "Gift from mum",
      }),
    ],
    SHEET,
    NOW
  );

  const d = items[0].description;
  check("brand is preserved", d.includes("Brand: Sony"), d);
  check("quality is preserved", d.includes("Quality: Excellent"), d);
  check("the source category is preserved", d.includes("Source category: Electronics"), d);
  check("the subcategory is preserved", d.includes("Type: Audio"), d);
  check("the acquisition quarter is preserved", d.includes("Acquired: 2024 Q3"), d);
  check("the end of life is preserved", d.includes("Expected end of life: 2026-06-30"), d);
  check("the notes are preserved", d.includes("Note: Gift from mum"), d);
  eq("the purchase date is the quarter start", items[0].purchaseDate, "2024-07-01");
}

/* ---------------------------------------------------------- categories */

{
  eq("a blank category still gets a category", categoryFor("Mystery", "", ""), "misc");
  check("the fallback is never empty", categoryFor("Mystery", "", "").length > 0);
  check("clothing maps to clothing", categoryFor("Shirt", "Clothing", "").startsWith("clothing"));
  eq("an override wins", categoryFor("Nintendo Switch 2", "Electronics", "Gaming"), "console");
}

/* ----------------------------------------------------------- duplicates */

{
  const duplicate = row({ Name: "Same thing", Category: "Clothing", "Paid ALL-IN": 20 });
  const { items } = mapRows([duplicate, { ...duplicate }], SHEET, NOW);
  eq("duplicate rows are both imported", items.length, 2);
  eq("duplicates keep their name", items[1].name, "Same thing");
}

/* ------------------------------------------------------------- helpers */

{
  eq("a quarter start is computed", quarterStart("2024 Q3"), "2024-07-01");
  eq("a quarter end is computed", quarterEnd("2024 Q3"), "2024-09-30");
  eq("a quarter start of Q1 is January", quarterStart("2025 Q1"), "2025-01-01");
  eq("a quarter end of Q4 is December", quarterEnd("2025 Q4"), "2025-12-31");
  eq("a non-quarter is not a quarter", quarterStart("sometime"), null);
  eq("money reads a number", money({ a: 12.5 }, "a"), 12.5);
  eq("money reads a formatted string", money({ a: "$1,200.50" }, "a"), 1200.5);
  eq("money reads an empty cell as unknown", money({ a: null }, "a"), null);
  eq("money reads a blank string as unknown", money({ a: "" }, "a"), null);
  eq("the snapshot date comes from the sheet name", snapshotDate(SHEET, "2026-01-01"), "2026-09-13");
  eq("a nameless sheet falls back", snapshotDate(null, "2026-01-01"), "2026-01-01");
}

/* ------------------------------------------------------- the real file */

const REAL_XLSX =
  process.env.STUFFDB_XLSX ?? path.join(os.homedir(), "Downloads", "StuffDB.xlsx");

if (fs.existsSync(REAL_XLSX)) {
  const { rows } = readFirstSheet(REAL_XLSX);
  const sheetName = sheetNameOf(REAL_XLSX);
  const { items, exportedAt, skipped } = mapRows(rows, sheetName, NOW);

  eq("every row is accounted for", items.length + skipped, rows.length);
  eq("no row is skipped", skipped, 0);
  eq("the snapshot date is right", exportedAt, "2026-09-13");

  const tally = (status) => items.filter((i) => i.status === status).length;
  eq("the owned count is right", tally("owned"), 169);
  eq("the sold count is right", tally("sold"), 27);
  eq("the donated count is right", tally("donated"), 15);
  eq("the thrown-out count is right", tally("disposed"), 2);
  eq("the closed count is right", tally("closed"), 4);

  check(
    "every item has a category",
    items.every((i) => typeof i.category === "string" && i.category.length > 0)
  );
  check(
    "terminal items carry a disposal",
    items.every((i) =>
      i.status === "owned" ? i.disposal === null : i.disposal !== null
    )
  );
  check(
    "only sold items carry proceeds",
    items.every((i) => (i.disposal?.disposition === "sold" ? true : (i.disposal?.amount ?? null) === null))
  );
  check(
    "a missing price never becomes $0",
    items.filter((i) => i.purchasePrice === null).length === 95
  );
  check(
    "explicit zeros survive as zeros",
    items.filter((i) => i.purchasePrice === 0).length === 11
  );
  check(
    "a free item never gets a $0 value",
    items.filter((i) => i.purchasePrice === 0).every((i) => i.currentValue !== 0)
  );
  check(
    "no owned item has a $0 value",
    items.filter((i) => i.status === "owned").every((i) => i.currentValue !== 0)
  );
  check(
    "the $0 sale is preserved",
    items.some((i) => i.disposal?.disposition === "sold" && i.disposal.amount === 0)
  );
  check(
    "no owned item has a negative value",
    items.filter((i) => i.currentValue !== null).every((i) => i.currentValue >= 0)
  );
  check(
    "every description mentions the source status",
    items.every((i) => i.description.includes("Source status:"))
  );
  check(
    "no purchase date is in the future",
    items.every((i) => i.purchaseDate === null || i.purchaseDate <= "2026-11-11")
  );
} else {
  console.log(`(no workbook at ${REAL_XLSX} — real-file checks skipped)`);
}

/* ------------------------------------------------- the database write */

{
  const { getDb, createUser, createItem, disposeItem, listItems, listDisposals, UPLOAD_DIR } =
    await import("../lib/db.ts");
  const { applyImport } = await import("../scripts/import-stuffdb.mjs");

  const db = getDb();

  const owner = createUser("owner@example.com", "Owner", "x");
  const other = createUser("other@example.com", "Other", "x");

  // The account's old inventory: two items, one already sold, one alert.
  const oldItem = createItem(owner.id, {
    name: "Old thing",
    category: "misc",
    description: "",
    location: "",
    purchaseDate: "2020-01-01",
    purchasePrice: 10,
    currentValue: 5,
    status: "owned",
    lastUsedAt: null,
    useFrequency: "never",
    photoPath: null,
    priority: "auto",
  });
  disposeItem(owner.id, oldItem.id, "sold", "2020-06-01", 3, "", "");
  createItem(owner.id, {
    name: "Old photo item",
    category: "misc",
    description: "",
    location: "",
    purchaseDate: "2020-01-01",
    purchasePrice: null,
    currentValue: null,
    status: "owned",
    lastUsedAt: null,
    useFrequency: "unknown",
    photoPath: null,
    priority: "auto",
  });
  db.prepare("INSERT INTO alerts (owner_id, label, cadence_days, next_due) VALUES (?, ?, 30, ?)").run(
    owner.id,
    "Keep an eye out",
    "2026-12-01"
  );

  // Another account that must not be touched.
  createItem(other.id, {
    name: "Someone else's thing",
    category: "misc",
    description: "",
    location: "",
    purchaseDate: "2020-01-01",
    purchasePrice: 1,
    currentValue: 1,
    status: "owned",
    lastUsedAt: null,
    useFrequency: "never",
    photoPath: null,
    priority: "auto",
  });

  const { items } = mapRows(
    [
      row({ Name: "New thing", Status: "Sold", "Paid ALL-IN": 100, Received: 50 }),
      row({ Name: "New closed thing", Status: "Close", "Paid ALL-IN": 20 }),
      row({ Name: "New owned thing", Status: "Heavy Use", "Paid ALL-IN": 30 }),
    ],
    SHEET,
    NOW
  );

  const { before, after } = await applyImport(owner.id, items);

  eq("the old items are counted first", before.items, 2);
  eq("the old disposal is counted first", before.disposals, 1);
  eq("the new items are in place", after.items, 3);
  eq("the new disposals are in place", after.disposals, 2);
  eq("the alert survives the import", after.alerts, 1);

  const newItems = listItems(owner.id);
  check(
    "the old items are gone",
    newItems.every((i) => !i.name.startsWith("Old ")),
    newItems.map((i) => i.name).join(", ")
  );
  check(
    "the new items are there",
    newItems.filter((i) => i.name.startsWith("New ")).length === 3
  );
  eq(
    "the old disposal is gone",
    listDisposals(owner.id).filter((d) => d.disposition === "sold" && d.amount === 3).length,
    0
  );

  const sold = listDisposals(owner.id).find((d) => d.disposition === "sold");
  eq("the new sale kept its proceeds", sold.amount, 50);
  const closed = listDisposals(owner.id).find((d) => d.disposition === "closed");
  check("the new close is recorded as closed", closed !== undefined);
  eq("the new close has no amount", closed.amount, null);

  const owned = newItems.find((i) => i.name === "New owned thing");
  eq("the owned item is owned", owned.status, "owned");
  eq("the owned item kept its price", owned.purchasePrice, 30);

  eq(
    "the other account is untouched",
    listItems(other.id).filter((i) => i.name === "Someone else's thing").length,
    1
  );
  eq(
    "the other account still has its own item count",
    listItems(other.id).length,
    1
  );

  // A dry run changes nothing.
  const { before: dryBefore, after: dryAfter } = await applyImport(owner.id, items, {
    dryRun: true,
  });
  eq("a dry run leaves the items alone", dryAfter.items, dryBefore.items);
  eq("the item count is unchanged", listItems(owner.id).length, 3);
}

/* ------------------------------------------------------------- summary */

console.log(`${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
