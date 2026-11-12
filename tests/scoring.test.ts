import { scoreItem, scoreAll, findDuplicateNames, findDuplicateItemIds, daysSince } from "../lib/scoring.ts";
import type { Item } from "../lib/db.ts";

function makeItem(overrides: Partial<Item> = {}): Item {
  return {
    id: 1,
    ownerId: 1,
    name: "Test item",
    category: "misc",
    description: "",
    location: "",
    purchaseDate: "2024-01-01",
    purchasePrice: 100,
    currentValue: 50,
    status: "owned",
    lastUsedAt: "2024-02-01",
    useFrequency: "monthly",
    photoPath: null,
    priority: "auto",
    createdAt: "2024-01-01 00:00:00",
    updatedAt: "2024-01-01 00:00:00",
    ...overrides,
  };
}

/**
 * A local calendar date N days back.
 *
 * Local, not UTC: the app reads a stored date back as local midnight, so a
 * UTC-built date string is a different day for part of every evening.
 */
function daysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

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

// A freshly-bought, frequently-used, valuable item should score near zero.
{
  const s = scoreItem(
    makeItem({
      lastUsedAt: daysAgo(1),
      useFrequency: "daily",
      currentValue: 900,
      purchasePrice: 900,
      category: "kitchen",
    }),
    new Set()
  );
  check("daily/valuable item scores 0", s.score === 0, `got ${s.score}`);
}

// Never used + old + worthless = maximum pressure.
{
  const s = scoreItem(
    makeItem({
      lastUsedAt: null,
      purchaseDate: daysAgo(1500),
      currentValue: 0,
      purchasePrice: 200,
      useFrequency: "never",
    }),
    new Set()
  );
  check("never-used item scores high", s.score >= 70, `got ${s.score}`);
  check(
    "never-used reason present",
    s.reasons.some((r) => r.label.includes("never used")),
    JSON.stringify(s.reasons.map((r) => r.label))
  );
}

// An old, unused, low-value item must outrank a well-used one.
{
  const dead = scoreItem(
    makeItem({ lastUsedAt: daysAgo(900), currentValue: 10, useFrequency: "rare" }),
    new Set()
  );
  const alive = scoreItem(
    makeItem({ lastUsedAt: daysAgo(2), currentValue: 400, useFrequency: "daily" }),
    new Set()
  );
  check("dead item outranks live item", dead.score > alive.score, `${dead.score} vs ${alive.score}`);
}

// Manual overrides win over the automatic score.
{
  const kept = scoreItem(
    makeItem({ lastUsedAt: null, purchaseDate: daysAgo(2000), useFrequency: "never" }),
    new Set()
  );
  const pinned = scoreItem(
    makeItem({
      lastUsedAt: null,
      purchaseDate: daysAgo(2000),
      useFrequency: "never",
      priority: "keep",
    }),
    new Set()
  );
  check("keep override zeroes the score", pinned.score === 0, `got ${pinned.score}`);
  check("automatic score was non-zero before override", kept.score > 0);
}

// get_rid override floors the score high.
{
  const s = scoreItem(
    makeItem({ lastUsedAt: daysAgo(1), useFrequency: "daily", currentValue: 900 }),
    new Set()
  );
  const forced = scoreItem(
    makeItem({
      lastUsedAt: daysAgo(1),
      useFrequency: "daily",
      currentValue: 900,
      priority: "get_rid",
    }),
    new Set()
  );
  check("get_rid override floors at 85", forced.score >= 85, `got ${forced.score}`);
  check("score never exceeds 100", s.score <= 100);
}

// Duplicates are detected on base names, and only when prices are close.
{
  const names = findDuplicateNames([
    makeItem({ id: 1, name: "Coffee Grinder" }),
    makeItem({ id: 2, name: "coffee grinder" }),
    makeItem({ id: 3, name: "Unique thing" }),
  ]);
  check("duplicate detected", names.has("coffee grinder"), [...names].join(","));
  check("non-duplicate excluded", !names.has("unique thing"));
}

// A trailing digit does not hide a duplicate: "grinder 1" and "grinder 2".
{
  const ids = findDuplicateItemIds([
    makeItem({ id: 1, name: "Coffee grinder 1", purchasePrice: 60 }),
    makeItem({ id: 2, name: "Coffee grinder 2", purchasePrice: 60 }),
    makeItem({ id: 3, name: "Camp stove", purchasePrice: 45 }),
  ]);
  check("numbered duplicates flagged", ids.has(1) && ids.has(2), [...ids].join(","));
  check("unrelated item not flagged", !ids.has(3));
}

// Same base name but very different prices = different products, not dupes.
{
  const ids = findDuplicateItemIds([
    makeItem({ id: 1, name: "iPhone 7", purchasePrice: 400 }),
    makeItem({ id: 2, name: "iPhone 9", purchasePrice: 900 }),
  ]);
  check("different price brackets not duplicates", ids.size === 0, [...ids].join(","));
}

// Two-digit suffixes stay distinct outright.
{
  const ids = findDuplicateItemIds([
    makeItem({ id: 1, name: "iPhone 15", purchasePrice: 800 }),
    makeItem({ id: 2, name: "iPhone 14", purchasePrice: 800 }),
  ]);
  check("two-digit suffixes distinct", ids.size === 0, [...ids].join(","));
}

// A duplicate adds the duplicate reason and points.
{
  const items = [
    makeItem({ id: 1, name: "Coffee grinder 1", purchasePrice: 60 }),
    makeItem({ id: 2, name: "Coffee grinder 2", purchasePrice: 60 }),
  ];
  const dupIds = findDuplicateItemIds(items);
  const s = scoreItem(items[1], dupIds);
  check(
    "duplicate reason present",
    s.reasons.some((r) => r.label.includes("Duplicate")),
    JSON.stringify(s.reasons.map((r) => r.label))
  );
}

// scoreAll only ranks owned items and sorts high to low.
{
  const scored = scoreAll([
    makeItem({ id: 1, name: "Owned dead", lastUsedAt: daysAgo(900), useFrequency: "rare" }),
    makeItem({ id: 2, name: "Sold thing", status: "sold", lastUsedAt: daysAgo(900) }),
    makeItem({ id: 3, name: "Owned live", lastUsedAt: daysAgo(1), useFrequency: "daily" }),
  ]);
  check("sold items excluded from scoring", scored.length === 2, `got ${scored.length}`);
  check("sorted high to low", scored[0].score >= scored[1].score);
}

// Seasonal items are flagged when out of season.
{
  const month = new Date().getMonth() + 1;
  const isSummer = month >= 5 && month <= 9;
  const s = scoreItem(
    makeItem({
      category: isSummer ? "winter" : "beach",
      lastUsedAt: daysAgo(30),
      useFrequency: "weekly",
      currentValue: 300,
    }),
    new Set()
  );
  check(
    "out-of-season item flagged",
    s.reasons.some((r) => r.label.includes("out of season")),
    JSON.stringify(s.reasons.map((r) => r.label))
  );
}

// daysSince handles null and invalid dates.
{
  check("daysSince(null) is null", daysSince(null) === null);
  check("daysSince(today) is 0", daysSince(daysAgo(0)) === 0);
  check("daysSince(3 days) is 3", daysSince(daysAgo(3)) === 3);
}

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
