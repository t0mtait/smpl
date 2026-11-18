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

export type SortKey = "name" | "category" | "status" | "value" | "acquired" | "offloaded" | "idle" | "added";
export type SortDirection = "asc" | "desc";

export interface SortState {
  key: SortKey;
  direction: SortDirection;
}

export interface InventoryFilters {
  query: string;
  status: string;
  category: string;
}

/**
 * Return the status key used for sorting and filtering.
 */
export function itemStatusRankKey(item: Item): string {
  if (item.status === "sold") return "sold";
  if (item.status === "donated") return "donated";
  if (item.status === "disposed") return "disposed";
  if (item.status === "closed") return "closed";
  if (item.priority === "get_rid" && item.currentValue) return "listed";
  if (item.useFrequency === "daily") return "heavy_use";
  if (item.useFrequency === "monthly") return "occasional_use";
  if (item.useFrequency === "rare") return "rare_use";
  return "owned";
}

/**
 * The order statuses appear in when the column is sorted.
 * Active cadences lead, followed by terminal states.
 */
const STATUS_ORDER: Record<string, number> = {
  heavy_use: 0,
  occasional_use: 1,
  rare_use: 2,
  listed: 3,
  owned: 4,
  sold: 5,
  donated: 6,
  disposed: 7,
  closed: 8,
};

/**
 * The direction a column starts in the first time it is clicked.
 */
const DEFAULT_DIRECTION: Record<SortKey, SortDirection> = {
  name: "asc",
  category: "asc",
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
  { key: "category", label: "Category" },
  { key: "status", label: "Status" },
  { key: "value", label: "Value", numeric: true },
  { key: "acquired", label: "Date acquired", numeric: true },
  { key: "offloaded", label: "Date offloaded", numeric: true },
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

/** Compare two items on one column, in the given direction. */
function compareOn(a: Item, b: Item, key: SortKey, dir: 1 | -1): number {
  switch (key) {
    case "name":
      return a.name.localeCompare(b.name) * dir;
    case "category":
      return a.category.localeCompare(b.category) * dir;
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
 * Narrow a list of items by the search box and the two dropdowns.
 */
export function filterItems(items: readonly Item[], filters: InventoryFilters): Item[] {
  const query = filters.query.trim().toLowerCase();

  return items.filter((item) => {
    if (filters.status !== "all") {
      const key = itemStatusRankKey(item);
      if (filters.status === "heavy_use") {
        if (key !== "heavy_use") return false;
      } else if (filters.status === "occasional_use") {
        if (key !== "occasional_use") return false;
      } else if (filters.status === "rare_use") {
        if (key !== "rare_use") return false;
      } else if (filters.status === "listed") {
        if (key !== "listed") return false;
      } else if (filters.status === "owned") {
        if (item.status !== "owned") return false;
      } else if (item.status !== filters.status && key !== filters.status) {
        return false;
      }
    }
    if (filters.category !== "all" && item.category !== filters.category) return false;
    if (!query) return true;
    return (
      item.name.toLowerCase().includes(query) ||
      item.category.toLowerCase().includes(query) ||
      item.location.toLowerCase().includes(query) ||
      item.description.toLowerCase().includes(query)
    );
  });
}
