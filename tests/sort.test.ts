/**
 * Inventory sort tests.
 *
 * The sort helper is pure, so these tests are pure too: they build
 * plain items, sort them, and assert on the order that comes out. No
 * database, no browser, no clock beyond the calendar-date helpers the
 * app already treats as the source of truth.
 *
 * The behaviours worth pinning down are the ones a naive comparator gets
 * wrong:
 *
 *   - "never recorded" is not zero, and must not float to the top when
 *     the column is flipped to descending;
 *   - the comparison is total, so equal rows never shuffle between
 *     renders;
 *   - sorting does not mutate the list it was handed.
 */
import type { Item } from "../lib/db.ts";
import {
  DEFAULT_SORT,
  SORT_COLUMNS,
  filterItems,
  idleDays,
  itemStatusRankKey,
  sortItems,
  toggleSort,
  type SortKey,
  type SortState,
} from "../lib/sort.ts";
import { daysFromNow } from "../lib/dates.ts";

let passed = 0;
let failed = 0;

function check(name: string, condition: boolean, detail = "") {
  if (condition) {
    passed++;
  } else {
    failed++;
    console.error(`FAIL: ${name}${detail ? ` — ${detail}` : ""}`);
  }
}

function eq(name: string, actual: unknown, expected: unknown) {
  check(name, actual === expected, `got ${JSON.stringify(actual)}, expected ${JSON.stringify(expected)}`);
}

/** Structural equality, for comparing objects field by field. */
function eqObj(name: string, actual: unknown, expected: unknown) {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  check(name, a === e, `got ${a}, expected ${e}`);
}

function eqList(name: string, actual: unknown[], expected: unknown[]) {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  check(name, a === e, `got ${a}, expected ${e}`);
}

/* ------------------------------------------------------------- fixtures */

let nextId = 1;

function item(overrides: Partial<Item> = {}): Item {
  return {
    id: nextId++,
    ownerId: 1,
    name: "Item",
    brand: "",
    category: "misc",
    subcategory: "",
    quality: "",
    description: "",
    location: "",
    purchaseDate: null,
    purchasePrice: null,
    currentValue: null,
    status: "owned",
    lastUsedAt: null,
    useFrequency: "unknown",
    photoPath: null,
    priority: "auto",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

/** The names of a sorted list, in order. */
function names(items: Item[]): string[] {
  return items.map((i) => i.name);
}

/* ------------------------------------------------------------ toggleSort */

{
  eqObj("toggleSort on a new column uses that column's default direction",
    toggleSort(DEFAULT_SORT, "name"),
    { key: "name", direction: "asc" });

  eqObj("toggleSort on a new numeric column starts descending",
    toggleSort(DEFAULT_SORT, "value"),
    { key: "value", direction: "desc" });

  eqObj("toggleSort on the same column flips the direction",
    toggleSort({ key: "name", direction: "asc" }, "name"),
    { key: "name", direction: "desc" });

  eqObj("toggleSort on the same column flips back",
    toggleSort({ key: "name", direction: "desc" }, "name"),
    { key: "name", direction: "asc" });

  eqObj("toggleSort onto a different column forgets the old direction",
    toggleSort({ key: "name", direction: "desc" }, "value"),
    { key: "value", direction: "desc" });

  // Every column the table renders must be one the helper understands.
  for (const col of SORT_COLUMNS) {
    const next = toggleSort(DEFAULT_SORT, col.key as SortKey);
    eq(`toggleSort accepts the "${col.label}" column`, next.key, col.key);
  }
}

/* --------------------------------------------------------- sorting: name */

{
  const items = [
    item({ name: "Chair", id: 1 }),
    item({ name: "apple", id: 2 }),
    item({ name: "Desk", id: 3 }),
  ];

  eqList("name ascending sorts alphabetically",
    names(sortItems(items, { key: "name", direction: "asc" })),
    ["apple", "Chair", "Desk"]);

  eqList("name descending reverses it",
    names(sortItems(items, { key: "name", direction: "desc" })),
    ["Desk", "Chair", "apple"]);
}

/* -------------------------------------------------- sorting: subcategory */

{
  const items = [
    item({ name: "Monitor", id: 1, subcategory: "Peripherals" }),
    item({ name: "Headphones", id: 2, subcategory: "Audio" }),
    item({ name: "Cable", id: 3, subcategory: "Accessories" }),
  ];

  eqList("subcategory ascending sorts alphabetically",
    names(sortItems(items, { key: "subcategory", direction: "asc" })),
    ["Cable", "Headphones", "Monitor"]);
}

/* -------------------------------------------------------- sorting: value */

{
  const items = [
    item({ name: "Cheap", id: 1, currentValue: 10 }),
    item({ name: "Rich", id: 2, currentValue: 900 }),
    item({ name: "Unpriced", id: 3, currentValue: null }),
    item({ name: "Middling", id: 4, currentValue: 250 }),
  ];

  eqList("value descending puts the biggest first",
    names(sortItems(items, { key: "value", direction: "desc" })),
    ["Rich", "Middling", "Cheap", "Unpriced"]);

  // The important one: flipping the column must NOT promote the item
  // whose value was never recorded to the top. It is unknown, not zero
  // and not infinite.
  eqList("value ascending keeps the unpriced item last",
    names(sortItems(items, { key: "value", direction: "asc" })),
    ["Cheap", "Middling", "Rich", "Unpriced"]);
}

/* --------------------------------------------------------- sorting: idle */

{
  const items = [
    item({ name: "Fresh", id: 1, lastUsedAt: daysFromNow(-2) }),
    item({ name: "Stale", id: 2, lastUsedAt: daysFromNow(-200) }),
    item({ name: "Never", id: 3, lastUsedAt: null, purchaseDate: null }),
    item({ name: "Middling", id: 4, lastUsedAt: daysFromNow(-40) }),
  ];

  eqList("idle descending puts the longest unused first",
    names(sortItems(items, { key: "idle", direction: "desc" })),
    ["Stale", "Middling", "Fresh", "Never"]);

  eqList("idle ascending keeps the never-used item last",
    names(sortItems(items, { key: "idle", direction: "asc" })),
    ["Fresh", "Middling", "Stale", "Never"]);

  // An item with no usage record but a purchase date still has an age.
  const bought = item({ name: "Bought", id: 5, lastUsedAt: null, purchaseDate: daysFromNow(-30) });
  eq("idleDays falls back to the purchase date", idleDays(bought), 30);
  eq("idleDays is null when there is no date at all", idleDays(item({ id: 6 })), null);
}

/* ------------------------------------------------------- sorting: status */

{
  const items = [
    item({ name: "Closed", id: 1, status: "closed" }),
    item({ name: "Sold", id: 2, status: "sold" }),
    item({ name: "Owned", id: 3, status: "owned" }),
    item({ name: "Disposed", id: 4, status: "disposed" }),
  ];

  // "Owned" is the only status that still means the thing is in the
  // inventory, so it leads.
  eqList("status sorts owned first",
    names(sortItems(items, { key: "status", direction: "asc" })),
    ["Owned", "Sold", "Disposed", "Closed"]);
}

/* --------------------------------------------------------- sorting: added */

{
  const items = [
    item({ name: "Middle", id: 1, createdAt: "2026-06-15T12:00:00.000Z" }),
    item({ name: "Oldest", id: 2, createdAt: "2025-01-02T12:00:00.000Z" }),
    item({ name: "Newest", id: 3, createdAt: "2026-11-30T12:00:00.000Z" }),
  ];

  eqList("added descending puts the newest first",
    names(sortItems(items, { key: "added", direction: "desc" })),
    ["Newest", "Middle", "Oldest"]);

  eqList("added ascending puts the oldest first",
    names(sortItems(items, { key: "added", direction: "asc" })),
    ["Oldest", "Middle", "Newest"]);
}

/* ------------------------------------------------------ ties and purity */

{
  // Two items that tie on the sorted column must still come out in one
  // fixed order, or rows shuffle between renders.
  const tied = [
    item({ name: "Beta", id: 20, currentValue: 50 }),
    item({ name: "Alpha", id: 10, currentValue: 50 }),
  ];

  const asc = names(sortItems(tied, { key: "value", direction: "asc" }));
  const desc = names(sortItems(tied, { key: "value", direction: "desc" }));
  eqList("ties break by name", asc, ["Alpha", "Beta"]);
  eqList("ties break by name whichever way the column points", desc, ["Alpha", "Beta"]);

  const same = [
    item({ name: "Same", id: 30, currentValue: 50 }),
    item({ name: "Same", id: 31, currentValue: 50 }),
  ];
  eqList("a full tie breaks by id",
    names(sortItems(same, { key: "value", direction: "asc" })),
    ["Same", "Same"]);
  eqList("a full tie breaks by id",
    sortItems(same, { key: "value", direction: "asc" }).map((i) => i.id),
    [30, 31]);

  // Sorting must not mutate the array it was given.
  const original = [item({ name: "B", id: 1 }), item({ name: "A", id: 2 })];
  const before = names(original);
  sortItems(original, { key: "name", direction: "asc" });
  eqList("sortItems does not mutate its input", names(original), before);

  eq("sortItems returns a new array", sortItems(original, DEFAULT_SORT) === original, false);
}

/* --------------------------------------------------------- filterItems */

{
  const items = [
    item({ id: 1, name: "Cast Iron Pan", brand: "Lodge", category: "kitchen", location: "Lower cupboard", description: "Heavy" }),
    item({ id: 2, name: "Hiking Boots", brand: "Merrell", category: "clothing", location: "Hall closet", description: "Size 10" }),
    item({ id: 3, name: "Old Lamp", brand: "", category: "furniture", location: "Garage", description: "Broken switch", status: "disposed" }),
  ];

  eqList("an empty query keeps everything",
    names(filterItems(items, { query: "", status: "all", category: "all" })),
    ["Cast Iron Pan", "Hiking Boots", "Old Lamp"]);

  eqList("a whitespace query keeps everything",
    names(filterItems(items, { query: "   ", status: "all", category: "all" })),
    ["Cast Iron Pan", "Hiking Boots", "Old Lamp"]);

  eqList("the query matches the name",
    names(filterItems(items, { query: "boots", status: "all", category: "all" })),
    ["Hiking Boots"]);

  eqList("the query matches the brand",
    names(filterItems(items, { query: "lodge", status: "all", category: "all" })),
    ["Cast Iron Pan"]);

  eqList("the query does not match category (filtering is used for that)",
    names(filterItems(items, { query: "kitchen", status: "all", category: "all" })),
    []);

  eqList("the query does not match location or description",
    names(filterItems(items, { query: "garage", status: "all", category: "all" })),
    []);

  eqList("the query is case-insensitive",
    names(filterItems(items, { query: "LAMP", status: "all", category: "all" })),
    ["Old Lamp"]);

  eqList("the status filter narrows the list to offloaded",
    names(filterItems(items, { query: "", status: "offloaded", category: "all" })),
    ["Old Lamp"]);

  eqList("the category filter narrows the list",
    names(filterItems(items, { query: "", status: "all", category: "clothing" })),
    ["Hiking Boots"]);

  eqList("the subcategory filter narrows within a category",
    names(filterItems([
      item({ name: "A", category: "drink", subcategory: "Coffee" }),
      item({ name: "B", category: "drink", subcategory: "Tea" }),
    ], { query: "", status: "all", category: "drink", subcategory: "Coffee" })),
    ["A"]);

  eqList("the filters combine",
    names(filterItems(items, { query: "boots", status: "all", category: "clothing" })),
    ["Hiking Boots"]);

  eqList("a query that matches nothing returns nothing",
    filterItems(items, { query: "helicopter", status: "all", category: "all" }),
    []);

  const purgItem = item({ id: 10, name: "Purgatory Item", status: "purgatory" });
  eq("purgatory status rank key", itemStatusRankKey(purgItem), "purgatory");
  eqList("purgatory filter",
    names(filterItems([purgItem, item({ id: 11, name: "Other" })], { query: "", status: "purgatory", category: "all" })),
    ["Purgatory Item"]);

  eqList("owned status filter keeps owned items and excludes offloaded or purgatory",
    names(filterItems([
      item({ id: 20, name: "Owned Item 1", status: "owned" }),
      item({ id: 21, name: "Owned Item 2", status: "owned", useFrequency: "daily" }),
      item({ id: 22, name: "In Purgatory", status: "purgatory" }),
      item({ id: 23, name: "Sold Item", status: "sold" }),
    ], { query: "", status: "owned", category: "all" })),
    ["Owned Item 1", "Owned Item 2"]);
}

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
