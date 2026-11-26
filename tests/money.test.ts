/**
 * Money semantics and terminal-state tests.
 *
 * The distinction this suite protects:
 *
 *   NULL money means "we never recorded it". 0 means "genuinely free" or
 *   "genuinely worth nothing". Collapsing the two would make every
 *   unpriced item look worthless and push it to the top of the declutter
 *   list, and would report a lifetime earnings figure we cannot back up.
 *
 *   "closed" is a terminal state of its own: the item left the inventory
 *   without a sale, a donation or a throw-out. It must be counted as
 *   gone without pretending an outcome happened.
 */
import {
  formatMoney,
  isUnknownMoney,
  setClientCurrency,
  getCurrencySymbol,
  SUPPORTED_CURRENCIES,
  STATUS_LABELS,
  TERMINAL_STATUSES,
} from "../lib/format.ts";
import { scoreItem, scoreAll, findDuplicateItemIds } from "../lib/scoring.ts";
import { computeStats } from "../lib/stats.ts";
import type { Item, Disposal } from "../lib/db.ts";

function makeItem(overrides: Partial<Item> = {}): Item {
  return {
    id: 1,
    ownerId: 1,
    name: "Test item",
    brand: "",
    category: "misc",
    subcategory: "",
    quality: "",
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

function makeDisposal(overrides: Partial<Disposal> = {}): Disposal {
  return {
    id: 1,
    itemId: 1,
    disposition: "sold",
    disposedAt: "2024-06-01",
    amount: 25,
    channel: "",
    notes: "",
    ...overrides,
  };
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

function eq(name: string, actual: unknown, expected: unknown) {
  check(name, actual === expected, `got ${JSON.stringify(actual)}, expected ${JSON.stringify(expected)}`);
}

/* ------------------------------------------------------- money formatting */

eq("null money renders as an em dash", formatMoney(null), "—");
eq("undefined money renders as an em dash", formatMoney(undefined), "—");
eq("zero money renders as zero, not a dash", formatMoney(0), "$0");
eq("a known amount renders normally", formatMoney(1234.5), "$1,234.50");
eq("explicit EUR currency formats with euro", formatMoney(1234, "EUR"), "€1,234");
eq("explicit GBP currency formats with pound", formatMoney(1234, "GBP"), "£1,234");
eq("explicit JPY currency formats with yen", formatMoney(1234, "JPY"), "¥1,234");

setClientCurrency("EUR");
eq("setting client currency formats default money with euro", formatMoney(50), "€50");
eq("getCurrencySymbol returns euro symbol", getCurrencySymbol(), "€");
setClientCurrency("USD");
eq("resetting client currency formats with USD", formatMoney(50), "$50");
eq("getCurrencySymbol returns dollar symbol", getCurrencySymbol("USD"), "$");
eq("getCurrencySymbol returns pound for GBP", getCurrencySymbol("GBP"), "£");

check("null money is unknown", isUnknownMoney(null));
check("undefined money is unknown", isUnknownMoney(undefined));
check("zero money is known", !isUnknownMoney(0));
check("a real amount is known", !isUnknownMoney(5));

/* ------------------------------------------ an unknown value carries no signal */

{
  const unknown = scoreItem(makeItem({ currentValue: null }), new Set());
  check(
    "an unknown value does not claim 'no resale value'",
    !unknown.reasons.some((r) => r.label.includes("resale")),
    JSON.stringify(unknown.reasons.map((r) => r.label))
  );

  const zero = scoreItem(makeItem({ currentValue: 0 }), new Set());
  check(
    "a zero value does claim 'no resale value'",
    zero.reasons.some((r) => r.label.includes("No resale value")),
    JSON.stringify(zero.reasons.map((r) => r.label))
  );
  check("a zero value scores higher than an unknown one", zero.score > unknown.score);
}

/* ------------------------------------------------- an unknown price is not $0 */

{
  // The "value lost" signal needs both prices. With one unknown it must
  // not fire, and it must not fire on a $0-vs-known pair either.
  const bothKnown = scoreItem(
    makeItem({ purchasePrice: 200, currentValue: 50 }),
    new Set()
  );
  const oneUnknown = scoreItem(
    makeItem({ purchasePrice: null, currentValue: 50 }),
    new Set()
  );
  const freeItem = scoreItem(makeItem({ purchasePrice: 0, currentValue: 50 }), new Set());

  check(
    "a known loss is reported",
    bothKnown.reasons.some((r) => r.label.toLowerCase().includes("lost") || r.label.toLowerCase().includes("value")),
    JSON.stringify(bothKnown.reasons.map((r) => r.label))
  );
  check(
    "an unknown purchase price is not reported as a loss",
    !oneUnknown.reasons.some((r) => r.label.toLowerCase().includes("lost")),
    JSON.stringify(oneUnknown.reasons.map((r) => r.label))
  );
  check(
    "a $0 purchase is not reported as a loss either",
    !freeItem.reasons.some((r) => r.label.toLowerCase().includes("lost")),
    JSON.stringify(freeItem.reasons.map((r) => r.label))
  );
}

/* --------------------------------------------------- duplicate price evidence */

{
  // Two same-name items: one price unknown, one known. An unknown price
  // cannot rule the duplicate out.
  const unknownVsKnown = findDuplicateItemIds([
    makeItem({ id: 1, name: "Coffee grinder 1", purchasePrice: null }),
    makeItem({ id: 2, name: "Coffee grinder 2", purchasePrice: 60 }),
  ]);
  check(
    "an unknown price cannot rule out a duplicate",
    unknownVsKnown.has(1) && unknownVsKnown.has(2),
    [...unknownVsKnown].join(",")
  );

  // Two known but very different prices do rule it out.
  const knownDiffer = findDuplicateItemIds([
    makeItem({ id: 1, name: "iPhone 7", purchasePrice: 400 }),
    makeItem({ id: 2, name: "iPhone 9", purchasePrice: 900 }),
  ]);
  eq("known different prices rule out a duplicate", knownDiffer.size, 0);
}

/* ----------------------------------------------------------- closed is terminal */

{
  eq("closed is a terminal status", TERMINAL_STATUSES.includes("closed" as never), true);
  eq("closed has a label", STATUS_LABELS.closed, "Closed");

  // A closed item is not an owned item, so it is not a declutter candidate.
  const scored = scoreAll([
    makeItem({ id: 1, name: "Owned dead", lastUsedAt: null, useFrequency: "never" }),
    makeItem({ id: 2, name: "Closed thing", status: "closed" }),
  ]);
  eq("closed items are excluded from scoring", scored.length, 1);
  check("the remaining item is the owned one", scored[0].item.id === 1);
}

/* ------------------------------------------------------------------- stats */

{
  const items = [
    makeItem({ id: 1, name: "Owned known", currentValue: 100 }),
    makeItem({ id: 2, name: "Owned unknown", currentValue: null }),
    makeItem({ id: 3, name: "Sold", status: "sold", currentValue: null, purchasePrice: 40 }),
    makeItem({ id: 4, name: "Donated", status: "donated", currentValue: null, purchasePrice: null }),
    makeItem({ id: 5, name: "Closed", status: "closed", currentValue: null, purchasePrice: null }),
    makeItem({ id: 6, name: "Sold unknown", status: "sold", currentValue: null, purchasePrice: null }),
  ];
  const disposals = [
    makeDisposal({ id: 1, itemId: 3, disposition: "sold", amount: 40 }),
    makeDisposal({ id: 2, itemId: 4, disposition: "donated", amount: null }),
    makeDisposal({ id: 3, itemId: 5, disposition: "closed", amount: null }),
    // A sale whose proceeds were never written down.
    makeDisposal({ id: 4, itemId: 6, disposition: "sold", amount: null }),
  ];

  const stats = computeStats(items, disposals);

  eq("owned count", stats.ownedItems, 2);
  eq("sold count", stats.soldItems, 2);
  eq("donated count", stats.donatedItems, 1);
  eq("closed count", stats.closedItems, 1);
  eq("closed is counted as gone", stats.totalItems - stats.ownedItems, 4);

  eq("only known values are summed", stats.totalValueOwned, 100);
  eq("unknown-value items are counted separately", stats.ownedWithoutValue, 1);
  eq(
    "the average divides by the priced items only",
    Math.round(stats.averageOwnedValue),
    100
  );

  eq("only known sale proceeds are summed", stats.lifetimeSalesEarnings, 40);
  eq("disposals with no amount are counted", stats.disposalsWithoutAmount, 3);
  eq("sales with no recorded proceeds are counted separately", stats.soldWithoutAmount, 1);

  const breakdown = Object.fromEntries(
    stats.disposalBreakdown.map((d) => [d.disposition, d.count])
  );
  eq("the breakdown includes closed", breakdown.closed, 1);
  eq("the breakdown counts both sales", breakdown.sold, 2);
  eq("the breakdown includes donated", breakdown.donated, 1);

  const closedEntry = stats.disposalBreakdown.find((d) => d.disposition === "closed");
  eq("a closed disposal has no money attached", closedEntry?.amount, 0);
}

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
