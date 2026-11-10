import { listDisposals, listItems } from "./db";
import type { Item, Disposal } from "./db";

export interface Stats {
  totalItems: number;
  ownedItems: number;
  soldItems: number;
  donatedItems: number;
  disposedItems: number;
  totalValueOwned: number;
  totalSpent: number;
  lifetimeSalesEarnings: number;
  lifetimeDonationValue: number;
  itemsDisposed: number;
  declutterRate: number;
  averageOwnedValue: number;
  byCategory: { category: string; count: number; value: number }[];
  earningsByMonth: { month: string; amount: number }[];
  disposalBreakdown: { disposition: string; count: number; amount: number }[];
  topCategories: { category: string; count: number }[];
  neverUsed: number;
  idleOver90Days: number;
}

function monthKey(date: string): string {
  return date.slice(0, 7);
}

export function computeStats(items: Item[], disposals: Disposal[]): Stats {
  const owned = items.filter((i) => i.status === "owned");
  const sold = items.filter((i) => i.status === "sold");
  const donated = items.filter((i) => i.status === "donated");
  const disposed = items.filter((i) => i.status === "disposed");

  const totalValueOwned = owned.reduce((sum, i) => sum + i.currentValue, 0);
  const totalSpent = items.reduce((sum, i) => sum + i.purchasePrice, 0);

  const lifetimeSalesEarnings = disposals
    .filter((d) => d.disposition === "sold")
    .reduce((sum, d) => sum + d.amount, 0);
  const lifetimeDonationValue = disposals
    .filter((d) => d.disposition === "donated")
    .reduce((sum, d) => sum + d.amount, 0);

  const closed = items.length - owned.length;
  const declutterRate = items.length === 0 ? 0 : Math.round((closed / items.length) * 100);

  // Categories
  const catMap = new Map<string, { count: number; value: number }>();
  for (const item of owned) {
    const key = item.category || "uncategorized";
    const entry = catMap.get(key) ?? { count: 0, value: 0 };
    entry.count += 1;
    entry.value += item.currentValue;
    catMap.set(key, entry);
  }
  const byCategory = [...catMap.entries()]
    .map(([category, v]) => ({ category, ...v }))
    .sort((a, b) => b.value - a.value || b.count - a.count);

  // Earnings by month, last 12 months
  const now = new Date();
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
    if (earnMap.has(key)) earnMap.set(key, (earnMap.get(key) ?? 0) + d.amount);
  }
  const earningsByMonth = monthKeys.map((month) => ({ month, amount: earnMap.get(month) ?? 0 }));

  const breakdownMap = new Map<string, { count: number; amount: number }>();
  for (const d of disposals) {
    const entry = breakdownMap.get(d.disposition) ?? { count: 0, amount: 0 };
    entry.count += 1;
    entry.amount += d.amount;
    breakdownMap.set(d.disposition, entry);
  }
  const disposalBreakdown = ["sold", "donated", "disposed"].map((disposition) => ({
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

  const nowMs = Date.now();
  const neverUsed = owned.filter((i) => !i.lastUsedAt).length;
  const idleOver90Days = owned.filter((i) => {
    const ref = i.lastUsedAt ?? i.purchaseDate;
    if (!ref) return false;
    const t = new Date(ref.includes("T") ? ref : `${ref}T00:00:00`).getTime();
    if (Number.isNaN(t)) return false;
    return nowMs - t > 90 * 86400000;
  }).length;

  return {
    totalItems: items.length,
    ownedItems: owned.length,
    soldItems: sold.length,
    donatedItems: donated.length,
    disposedItems: disposed.length,
    totalValueOwned,
    totalSpent,
    lifetimeSalesEarnings,
    lifetimeDonationValue,
    itemsDisposed: disposed.length,
    declutterRate,
    averageOwnedValue: owned.length === 0 ? 0 : totalValueOwned / owned.length,
    byCategory,
    earningsByMonth,
    disposalBreakdown,
    topCategories,
    neverUsed,
    idleOver90Days,
  };
}

export function getStats(): Stats {
  return computeStats(listItems(), listDisposals());
}
