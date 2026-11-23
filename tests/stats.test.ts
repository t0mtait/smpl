import { computeStats } from "../lib/stats.ts";
import type { Item, Disposal } from "../lib/db.ts";

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
    purchaseDate: "2026-10-15",
    purchasePrice: 100,
    currentValue: 50,
    status: "owned",
    lastUsedAt: "2026-11-01",
    useFrequency: "daily",
    photoPath: null,
    priority: "auto",
    createdAt: "2026-10-15 00:00:00",
    updatedAt: "2026-10-15 00:00:00",
    ...overrides,
  };
}

// Fixed reference date: 2026-11-23 (Q4 2026)
const now = new Date(2026, 10, 23);

/* --------------------------------------------------- Empty items --------------------------------------------------- */
{
  const stats = computeStats([], [], now);
  eq("empty stats currentQuarter", stats.currentQuarter, "Q4 2026");
  eq("empty stats currentQuarterNet", stats.currentQuarterNet, 0);
  eq("empty stats currentQuarterAcquired", stats.currentQuarterAcquired, 0);
  eq("empty stats currentQuarterOffloaded", stats.currentQuarterOffloaded, 0);
  eq("empty stats possessionsOverTime length is 8", stats.possessionsOverTime.length, 8);
  eq("empty stats last quarter is Q4 2026", stats.possessionsOverTime[7].quarter, "Q4 2026");
  eq("empty stats last quarter count is 0", stats.possessionsOverTime[7].count, 0);
}

/* --------------------------------------------------- Current quarter net & possessions --------------------------------------------------- */
{
  const items: Item[] = [
    // 3 items bought in Q4 2026
    makeItem({ id: 1, name: "Item 1", purchaseDate: "2026-10-01", status: "owned" }),
    makeItem({ id: 2, name: "Item 2", purchaseDate: "2026-11-10", status: "owned" }),
    makeItem({ id: 3, name: "Item 3", purchaseDate: "Q4 2026", status: "sold", offloadedDate: "2026-11-15" }),
    // 2 items bought in Q3 2026: 1 owned, 1 offloaded in Q4 2026
    makeItem({ id: 4, name: "Item 4", purchaseDate: "2026-07-15", status: "owned" }),
    makeItem({ id: 5, name: "Item 5", purchaseDate: "2026-08-01", status: "donated", offloadedDate: "2026-10-20" }),
    // 1 item bought in Q1 2025: owned
    makeItem({ id: 6, name: "Item 6", purchaseDate: "2025-02-01", status: "owned" }),
  ];

  const disposals: Disposal[] = [
    { id: 1, itemId: 3, disposition: "sold", disposedAt: "2026-11-15", amount: 50, channel: "", notes: "" },
    { id: 2, itemId: 5, disposition: "donated", disposedAt: "2026-10-20", amount: 0, channel: "", notes: "" },
  ];

  const stats = computeStats(items, disposals, now);

  eq("currentQuarter is Q4 2026", stats.currentQuarter, "Q4 2026");
  // Items 1, 2, 3 acquired in Q4 2026 => 3
  eq("currentQuarterAcquired is 3", stats.currentQuarterAcquired, 3);
  // Items 3 and 5 offloaded in Q4 2026 => 2
  eq("currentQuarterOffloaded is 2", stats.currentQuarterOffloaded, 2);
  // Net = 3 - 2 = 1
  eq("currentQuarterNet is 1", stats.currentQuarterNet, 1);

  // Possessions timeline (last 8 quarters: Q1 2025 to Q4 2026)
  const timeline = stats.possessionsOverTime;
  eq("possessions timeline length", timeline.length, 8);
  eq("first quarter is Q1 2025", timeline[0].quarter, "Q1 2025");
  eq("first quarter count is 1 (Item 6)", timeline[0].count, 1);

  // In Q2 2025: still 1
  eq("Q2 2025 count is 1", timeline[1].count, 1);
  // In Q3 2025: still 1
  eq("Q3 2025 count is 1", timeline[2].count, 1);
  // In Q4 2025: still 1
  eq("Q4 2025 count is 1", timeline[3].count, 1);
  // In Q1 2026: still 1
  eq("Q1 2026 count is 1", timeline[4].count, 1);
  // In Q2 2026: still 1
  eq("Q2 2026 count is 1", timeline[5].count, 1);
  // In Q3 2026: Items 4 & 5 acquired => 1 + 2 = 3
  eq("Q3 2026 count is 3", timeline[6].count, 3);
  // In Q4 2026: Net items is +1 => 3 + 1 = 4 (Items 1, 2, 4, 6 active)
  eq("Q4 2026 count is 4", timeline[7].count, 4);
}

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
