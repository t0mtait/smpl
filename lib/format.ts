/**
 * Money formatter. `null` means "never recorded" and renders as an em dash —
 * never as $0, which would be a claim we cannot back up.
 */
export function formatMoney(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return "—";
  return value.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: value % 1 === 0 ? 0 : 2,
  });
}

/** True when a monetary value was never recorded. */
export function isUnknownMoney(value: number | null | undefined): boolean {
  return value === null || value === undefined || !Number.isFinite(value);
}

export function formatDate(value: string | null | undefined): string {
  if (!value) return "—";
  const iso = value.includes("T") ? value : `${value}T00:00:00`;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
}

export function relativeDays(days: number | null): string {
  if (days === null) return "—";
  if (days <= 0) return "today";
  if (days === 1) return "yesterday";
  if (days < 30) return `${days} days ago`;
  if (days < 365) return `${Math.floor(days / 30)} mo ago`;
  const years = days / 365;
  return `${years.toFixed(1)} yr ago`;
}

export const STATUS_LABELS: Record<string, string> = {
  heavy_use: "Heavy Use",
  occasional_use: "Occasional Use",
  rare_use: "Rare Use",
  listed: "Listed",
  owned: "Owned",
  sold: "Sold",
  donated: "Donated",
  disposed: "Thrown Out",
  closed: "Closed",
};

export const STATUS_STYLES: Record<string, string> = {
  heavy_use: "bg-moss-soft text-moss",
  occasional_use: "bg-info-soft text-info",
  rare_use: "bg-clay-soft text-clay",
  listed: "bg-purple-soft text-purple",
  owned: "bg-wash text-ink-soft",
  sold: "bg-accent-soft text-accent",
  donated: "bg-info-soft text-info",
  disposed: "bg-clay-soft text-clay",
  closed: "bg-wash text-muted",
};

export function getItemStatusInfo(item: {
  status: string;
  useFrequency?: string;
  priority?: string;
  currentValue?: number | null;
}): { key: string; label: string; style: string } {
  let key = item.status;
  if (item.status === "owned") {
    if (item.useFrequency === "daily") key = "heavy_use";
    else if (item.useFrequency === "monthly") key = "occasional_use";
    else if (item.useFrequency === "rare") key = "rare_use";
    else if (item.priority === "get_rid") key = "listed";
  }
  return {
    key,
    label: STATUS_LABELS[key] ?? key,
    style: STATUS_STYLES[key] ?? STATUS_STYLES.owned,
  };
}

/**
 * Terminal states: the item is no longer in the inventory. "closed" means it
 * went away without a recorded outcome — not a sale, not a donation.
 */
export const TERMINAL_STATUSES = ["sold", "donated", "disposed", "closed"] as const;

export const FREQUENCY_LABELS: Record<string, string> = {
  daily: "Heavy Use",
  monthly: "Occasional Use",
  rare: "Rare Use",
  weekly: "Weekly",
  seasonal: "Seasonal",
  never: "Never used",
  unknown: "Unknown",
};

export const CATEGORIES = [
  "clothing",
  "electronics",
  "furniture",
  "appliance",
  "kitchen",
  "books",
  "toys",
  "sports",
  "tools",
  "hobby",
  "vehicle",
  "phone",
  "computer",
  "console",
  "camping",
  "christmas",
  "jewelry",
  "documents",
  "misc",
  "uncategorized",
];
