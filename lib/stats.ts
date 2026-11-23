import { listDisposals, listItems } from "./db.ts";
import type { Item, Disposal } from "./db.ts";
import { daysSince } from "./scoring.ts";
import { currentQuarter, quarterToOrder, orderToQuarter } from "./dates.ts";

export interface Stats {
  totalItems: number;
  ownedItems: number;
  soldItems: number;
  donatedItems: number;
  disposedItems: number;
  /** Items that left the inventory without a recorded outcome. */
  closedItems: number;
  /** Sum of the values we actually know. Items with an unknown value are excluded. */
  totalValueOwned: number;
  /** Sum of the prices we actually know. Items with an unknown price are excluded. */
  totalSpent: number;
  lifetimeSalesEarnings: number;
  lifetimeDonationValue: number;
  itemsDisposed: number;
  declutterRate: number;
  averageOwnedValue: number;
  /** How many owned items have no recorded value — the totals above are partial. */
  ownedWithoutValue: number;
  /** How many items have no recorded purchase price. */
  itemsWithoutPrice: number;
  /** How many disposals have no recorded amount (gifted away, or never written down). */
  disposalsWithoutAmount: number;
  /** Sales with no recorded proceeds. The earnings total covers only the rest. */
  soldWithoutAmount: number;
  byCategory: { category: string; count: number; value: number }[];
  earningsByMonth: { month: string; amount: number }[];
  disposalBreakdown: { disposition: string; count: number; amount: number }[];
  topCategories: { category: string; count: number }[];
  neverUsed: number;
  idleOver90Days: number;
  currentQuarter: string;
  currentQuarterNet: number;
  currentQuarterAcquired: number;
  currentQuarterOffloaded: number;
  possessionsOverTime: { quarter: string; count: number }[];
}

function monthKey(date: string): string {
  return date.slice(0, 7);
}

export function computeStats(items: Item[], disposals: Disposal[], now: Date = new Date()): Stats {
  const owned = items.filter((i) => i.status === "owned");
  const sold = items.filter((i) => i.status === "sold");
  const donated = items.filter((i) => i.status === "donated");
  const disposed = items.filter((i) => i.status === "disposed");
  const closed = items.filter((i) => i.status === "closed");

  // Only known amounts count towards a total. An unknown value is not $0 —
  // folding it in would quietly understate what the inventory is worth.
  const totalValueOwned = owned.reduce((sum, i) => sum + (i.currentValue ?? 0), 0);
  const totalSpent = items.reduce((sum, i) => sum + (i.purchasePrice ?? 0), 0);
  const ownedWithoutValue = owned.filter((i) => i.currentValue === null).length;
  const itemsWithoutPrice = items.filter((i) => i.purchasePrice === null).length;

  const lifetimeSalesEarnings = disposals
    .filter((d) => d.disposition === "sold")
    .reduce((sum, d) => sum + (d.amount ?? 0), 0);
  const lifetimeDonationValue = disposals
    .filter((d) => d.disposition === "donated")
    .reduce((sum, d) => sum + (d.amount ?? 0), 0);
  const disposalsWithoutAmount = disposals.filter((d) => d.amount === null).length;
  const soldWithoutAmount = disposals.filter(
    (d) => d.disposition === "sold" && d.amount === null
  ).length;

  const goneCount = items.length - owned.length;
  const declutterRate = items.length === 0 ? 0 : Math.round((goneCount / items.length) * 100);

  // Categories
  const catMap = new Map<string, { count: number; value: number }>();
  for (const item of owned) {
    const key = item.category || "uncategorized";
    const entry = catMap.get(key) ?? { count: 0, value: 0 };
    entry.count += 1;
    entry.value += item.currentValue ?? 0;
    catMap.set(key, entry);
  }
  const byCategory = [...catMap.entries()]
    .map(([category, v]) => ({ category, ...v }))
    .sort((a, b) => b.value - a.value || b.count - a.count);

  // Earnings by month, last 12 months
  const monthKeys: string[] = [];
  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    monthKeys.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
  }
  const earnMap = new Map<string, number>();
  for (const key of monthKeys) earnMap.set(key, 0);
  for (const d of disposals) {
    if (d.disposition !== "sold") continue;
    const key = monthKey(d.disposedAt);
    if (earnMap.has(key)) earnMap.set(key, (earnMap.get(key) ?? 0) + (d.amount ?? 0));
  }
  const earningsByMonth = monthKeys.map((month) => ({ month, amount: earnMap.get(month) ?? 0 }));

  // Net items & possessions over time
  const curQuarter = currentQuarter(now);
  const curOrder = quarterToOrder(curQuarter)!;

  const dispMap = new Map<number, string>();
  for (const d of disposals) {
    if (!dispMap.has(d.itemId)) {
      dispMap.set(d.itemId, d.disposedAt);
    }
  }

  const TERMINAL_SET = new Set(["sold", "donated", "disposed", "closed"]);

  const timeline = items.map((item) => {
    const acqOrder = quarterToOrder(item.purchaseDate);
    let offloadOrder: number | null = null;
    if (TERMINAL_SET.has(item.status)) {
      const dispDate = dispMap.get(item.id);
      offloadOrder = quarterToOrder(item.offloadedDate) ?? (dispDate ? quarterToOrder(dispDate) : null);
    }
    return { acqOrder, offloadOrder };
  });

  let currentQuarterAcquired = 0;
  let currentQuarterOffloaded = 0;
  for (const t of timeline) {
    if (t.acqOrder === curOrder) {
      currentQuarterAcquired++;
    }
    if (t.offloadOrder === curOrder) {
      currentQuarterOffloaded++;
    }
  }
  const currentQuarterNet = currentQuarterAcquired - currentQuarterOffloaded;

  const possessionsOverTime: { quarter: string; count: number }[] = [];
  for (let i = 7; i >= 0; i--) {
    const ord = curOrder - i;
    const quarterLabel = orderToQuarter(ord);
    const count = timeline.filter((t) => {
      if (t.acqOrder !== null && t.acqOrder > ord) return false;
      if (t.offloadOrder !== null) {
        const effectiveOffload = Math.min(t.offloadOrder, curOrder);
        if (effectiveOffload <= ord) return false;
      }
      return true;
    }).length;
    possessionsOverTime.push({ quarter: quarterLabel, count });
  }

  const breakdownMap = new Map<string, { count: number; amount: number }>();
  for (const d of disposals) {
    const entry = breakdownMap.get(d.disposition) ?? { count: 0, amount: 0 };
    entry.count += 1;
    entry.amount += d.amount ?? 0;
    breakdownMap.set(d.disposition, entry);
  }
  const disposalBreakdown = ["sold", "donated", "disposed", "closed"].map((disposition) => ({
    disposition,
    count: breakdownMap.get(disposition)?.count ?? 0,
    amount: breakdownMap.get(disposition)?.amount ?? 0,
  }));

  const allCatCounts = new Map<string, number>();
  for (const item of items) {
    const key = item.category || "uncategorized";
    allCatCounts.set(key, (allCatCounts.get(key) ?? 0) + 1);
  }
  const topCategories = [...allCatCounts.entries()]
    .map(([category, count]) => ({ category, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 8);

  const neverUsed = owned.filter((i) => !i.lastUsedAt).length;
  const idleOver90Days = owned.filter((i) => {
    const ref = i.lastUsedAt ?? i.purchaseDate;
    if (!ref) return false;
    // Calendar days, not elapsed milliseconds: an item last used on the
    // 90th day is idle once the 90 days are up, not a few hours early.
    const days = daysSince(ref);
    return days !== null && days > 90;
  }).length;

  return {
    totalItems: items.length,
    ownedItems: owned.length,
    soldItems: sold.length,
    soldWithoutAmount,
    donatedItems: donated.length,
    disposedItems: disposed.length,
    closedItems: closed.length,
    totalValueOwned,
    totalSpent,
    lifetimeSalesEarnings,
    lifetimeDonationValue,
    itemsDisposed: disposed.length,
    declutterRate,
    averageOwnedValue:
      owned.length - ownedWithoutValue === 0
        ? 0
        : totalValueOwned / (owned.length - ownedWithoutValue),
    ownedWithoutValue,
    itemsWithoutPrice,
    disposalsWithoutAmount,
    byCategory,
    earningsByMonth,
    disposalBreakdown,
    topCategories,
    neverUsed,
    idleOver90Days,
    currentQuarter: curQuarter,
    currentQuarterNet,
    currentQuarterAcquired,
    currentQuarterOffloaded,
    possessionsOverTime,
  };
}

export function getStats(ownerId: number): Stats {
  return computeStats(listItems(ownerId), listDisposals(ownerId));
}
