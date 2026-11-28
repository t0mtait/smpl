/**
 * Inventory list ordering.
 *
 * Pure and client-safe on purpose: this module is imported by a client
 * component, so it must not pull the database into the browser bundle.
 * The only value import is `daysSince` from lib/scoring.ts, whose own
 * value graph reaches only lib/dates.ts (no imports at all). lib/db.ts
 * enters as a *type* only, and `import type` is erased at compile time,
 * so node:sqlite never lands in the client graph.
 *
 * The rules encoded here are the ones the table view cannot get wrong:
 *
 *   - "Never recorded" is not zero. An unknown value sorts last in both
 *     directions rather than pretending to be the smallest number, so
 *     flipping the column never floats unpriced items to the top.
 *   - Every comparison is total. Two items that tie on the sorted
 *     column fall back to name and then id, so the same list always
 *     produces the same order — no row shuffle between renders.
 */

import type { Item, ItemStatus } from "./db.ts";
import { daysSince } from "./scoring.ts";

export type SortKey = "name" | "brand" | "category" | "subcategory" | "quality" | "status" | "value" | "acquired" | "offloaded" | "idle" | "added";
export type SortDirection = "asc" | "desc";

export interface SortState {
  key: SortKey;
  direction: SortDirection;
}

export interface InventoryFilters {
  query: string;
  status: string;
  category: string;
  subcategory?: string;
}

/**
 * Return the status key used for sorting and filtering.
 * Consolidated statuses: heavy_use, occasional_use, rare_use, purgatory, offloaded, offloaded_sold.
 */
export function itemStatusRankKey(item: Item): string {
  const statusStr = String(item.status);
  if (statusStr === "purgatory") return "purgatory";
  if (statusStr === "sold") return "sold";
  if (statusStr === "donated") return "donated";
  if (statusStr === "disposed") return "disposed";
  if (statusStr === "closed") return "closed";
  if (statusStr === "offloaded") return "offloaded";
  if (Boolean(item.offloadedDate && statusStr !== "owned")) {
    return (item.disposalAmount != null && item.disposalAmount > 0) ? "sold" : "offloaded";
  }
  const freq = item.useFrequency || "";
  if (freq === "daily" || freq === "weekly" || statusStr === "heavy_use") {
    return "heavy_use";
  }
  if (freq === "rare" || freq === "never" || statusStr === "rare_use") {
    return "rare_use";
  }
  return "occasional_use";
}

/**
 * The order statuses appear in when the column is sorted.
 * Active cadences lead, followed by terminal states.
 */
const STATUS_ORDER: Record<string, number> = {
  heavy_use: 0,
  occasional_use: 1,
  rare_use: 2,
  purgatory: 3,
  listed: 4,
  owned: 5,
  sold: 6,
  offloaded_sold: 6,
  donated: 7,
  disposed: 8,
  closed: 9,
  offloaded: 10,
};

/**
 * The direction a column starts in the first time it is clicked.
 */
const DEFAULT_DIRECTION: Record<SortKey, SortDirection> = {
  name: "asc",
  brand: "asc",
  category: "asc",
  subcategory: "asc",
  quality: "asc",
  status: "asc",
  value: "desc",
  acquired: "desc",
  offloaded: "desc",
  idle: "desc",
  added: "desc",
};

/**
 * The sortable columns of the inventory table.
 *
 * `numeric` marks the columns that hold numbers, which are right
 * aligned and set in tabular figures.
 */
export const SORT_COLUMNS: { key: SortKey; label: string; numeric?: boolean }[] = [
  { key: "name", label: "Item" },
  { key: "brand", label: "Brand" },
  { key: "category", label: "Category" },
  { key: "subcategory", label: "Subcategory" },
  { key: "quality", label: "Quality" },
  { key: "status", label: "Usage" },
  { key: "value", label: "Value", numeric: true },
  { key: "acquired", label: "Acquired", numeric: true },
];

/** The sort the table starts in. */
export const DEFAULT_SORT: SortState = { key: "acquired", direction: "desc" };

/**
 * The state after the user clicks a column header.
 *
 * Clicking the column that is already sorted flips its direction;
 * clicking a different one starts that column in its default direction.
 */
export function toggleSort(current: SortState, key: SortKey): SortState {
  if (current.key === key) {
    return { key, direction: current.direction === "asc" ? "desc" : "asc" };
  }
  return { key, direction: DEFAULT_DIRECTION[key] };
}

/** How many days an item has gone unused, or null if we never recorded it. */
export function idleDays(item: Item): number | null {
  return daysSince(item.lastUsedAt ?? item.purchaseDate);
}

/**
 * Compare two numbers where either side may be unknown.
 */
function compareNullable(a: number | null, b: number | null, dir: 1 | -1): number {
  if (a === null && b === null) return 0;
  if (a === null) return 1;
  if (b === null) return -1;
  return (a - b) * dir;
}

/**
 * Compare two date strings where either side may be unknown.
 * Unknown dates sort last in both directions.
 */
function compareNullableDate(a: string | null | undefined, b: string | null | undefined, dir: 1 | -1): number {
  const valA = a ?? null;
  const valB = b ?? null;
  if (valA === null && valB === null) return 0;
  if (valA === null) return 1;
  if (valB === null) return -1;
  if (valA === valB) return 0;
  return (valA < valB ? -1 : 1) * dir;
}

/**
 * Compare two ISO timestamps chronologically.
 */
function compareTimestamp(a: string, b: string, dir: 1 | -1): number {
  if (a === b) return 0;
  return (a < b ? -1 : 1) * dir;
}

function qualityRank(q: string | null | undefined): number {
  if (!q) return 0;
  const s = q.trim().toLowerCase();
  if (s === "high" || s === "top") return 3;
  if (s === "medium" || s === "med") return 2;
  if (s === "low" || s === "budget") return 1;
  return 0;
}

/** Compare two items on one column, in the given direction. */
function compareOn(a: Item, b: Item, key: SortKey, dir: 1 | -1): number {
  switch (key) {
    case "name":
      return a.name.localeCompare(b.name) * dir;
    case "brand":
      return (a.brand || "").localeCompare(b.brand || "") * dir;
    case "category":
      return a.category.localeCompare(b.category) * dir;
    case "subcategory":
      return (a.subcategory || "").localeCompare(b.subcategory || "") * dir;
    case "quality": {
      const qA = qualityRank(a.quality);
      const qB = qualityRank(b.quality);
      if (qA !== qB) return (qB - qA) * dir;
      return (a.quality || "").localeCompare(b.quality || "") * dir;
    }
    case "status": {
      const rankA = STATUS_ORDER[itemStatusRankKey(a)] ?? 4;
      const rankB = STATUS_ORDER[itemStatusRankKey(b)] ?? 4;
      return (rankA - rankB) * dir;
    }
    case "value":
      return compareNullable(a.currentValue, b.currentValue, dir);
    case "acquired":
      return compareNullableDate(a.purchaseDate, b.purchaseDate, dir);
    case "offloaded":
      return compareNullableDate(a.offloadedDate, b.offloadedDate, dir);
    case "idle":
      return compareNullable(idleDays(a), idleDays(b), dir);
    case "added":
      return compareTimestamp(a.createdAt, b.createdAt, dir);
  }
}

/**
 * Order a list of items.
 *
 * Returns a new array; the input is not mutated.
 */
export function sortItems(items: readonly Item[], sort: SortState): Item[] {
  const dir: 1 | -1 = sort.direction === "asc" ? 1 : -1;

  return [...items].sort((a, b) => {
    const primary = compareOn(a, b, sort.key, dir);
    if (primary !== 0) return primary;

    // A total order, so the same list always renders the same way.
    const byName = a.name.localeCompare(b.name);
    if (byName !== 0) return byName;
    return a.id - b.id;
  });
}

/**
 * Narrow a list of items by search (name or brand only), category, subcategory, and status.
 */
export function filterItems(items: readonly Item[], filters: InventoryFilters): Item[] {
  const query = filters.query.trim().toLowerCase();

  return items.filter((item) => {
    if (filters.status !== "all") {
      const key = itemStatusRankKey(item);
      const isOffloaded =
        key === "offloaded" ||
        key === "offloaded_sold" ||
        key === "sold" ||
        key === "donated" ||
        key === "disposed" ||
        key === "closed";

      if (filters.status === "owned") {
        if (item.status !== "owned" || isOffloaded || key === "purgatory") return false;
      } else if (filters.status === "offloaded") {
        if (!isOffloaded) return false;
      } else if (filters.status === "offloaded_sold") {
        if (key !== "offloaded_sold" && key !== "sold") return false;
      } else if (filters.status === "offloaded_nosold") {
        if (!isOffloaded || key === "offloaded_sold" || key === "sold") return false;
      } else if (key !== filters.status) {
        return false;
      }
    }
    if (filters.category !== "all" && item.category !== filters.category) return false;
    if (
      filters.category !== "all" &&
      filters.subcategory &&
      filters.subcategory !== "all" &&
      (item.subcategory || "").toLowerCase() !== filters.subcategory.toLowerCase()
    ) {
      return false;
    }
    if (!query) return true;
    return (
      item.name.toLowerCase().includes(query) ||
      Boolean(item.brand && item.brand.toLowerCase().includes(query))
    );
  });
}
