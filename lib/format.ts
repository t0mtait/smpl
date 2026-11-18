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

/**
 * Format a calendar date or quarter string as "QN YYYY" (e.g. "Q3 2024").
 * Returns an em dash for missing values.
 */
export function formatQuarter(value: string | null | undefined): string {
  if (!value) return "—";
  const trimmed = value.trim();
  if (!trimmed) return "—";

  // Check for already in "QN YYYY"
  const qy = /^Q([1-4])\s*(\d{4})$/i.exec(trimmed);
  if (qy) return `Q${qy[1]} ${qy[2]}`;

  // Check for "YYYY QN" or "YYYY-QN"
  const yq = /^(\d{4})[-\s]*Q([1-4])$/i.exec(trimmed);
  if (yq) return `Q${yq[2]} ${yq[1]}`;

  // Check for ISO date "YYYY-MM-DD" or "YYYY-MM"
  const iso = /^(\d{4})-(\d{2})(?:-\d{2})?/.exec(trimmed);
  if (iso) {
    const year = iso[1];
    const month = parseInt(iso[2], 10);
    if (month >= 1 && month <= 12) {
      const q = Math.ceil(month / 3);
      return `Q${q} ${year}`;
    }
  }

  // Fallback to Date object parsing
  const d = new Date(trimmed.includes("T") ? trimmed : `${trimmed}T00:00:00`);
  if (!Number.isNaN(d.getTime())) {
    const year = d.getFullYear();
    const month = d.getMonth() + 1;
    const q = Math.ceil(month / 3);
    return `Q${q} ${year}`;
  }

  return trimmed;
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
  purgatory: "Purgatory",
  listed: "Listed",
  owned: "Owned",
  sold: "Sold",
  donated: "Donated",
  disposed: "Thrown Out",
  closed: "Closed",
};

export const STATUS_STYLES: Record<string, string> = {
  heavy_use: "bg-accent-soft text-accent",
  occasional_use: "bg-warn-soft text-warn",
  rare_use: "bg-danger-soft text-danger",
  purgatory: "bg-clay-soft text-clay",
  listed: "bg-purple-100 text-purple-800 dark:bg-purple-950/60 dark:text-purple-300",
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

/** Capitalize the first letter of each word in a category string. */
export function formatCategory(category: string | null | undefined): string {
  if (!category) return "Uncategorized";
  return category
    .trim()
    .split(/\s+/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");
}

export const CATEGORY_STYLES: Record<string, string> = {
  clothing: "bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300",
  electronics: "bg-sky-100 text-sky-800 dark:bg-sky-950/60 dark:text-sky-300",
  computer: "bg-indigo-100 text-indigo-800 dark:bg-indigo-950/60 dark:text-indigo-300",
  phone: "bg-cyan-100 text-cyan-800 dark:bg-cyan-950/60 dark:text-cyan-300",
  console: "bg-violet-100 text-violet-800 dark:bg-violet-950/60 dark:text-violet-300",
  kitchen: "bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300",
  furniture: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300",
  tools: "bg-orange-100 text-orange-800 dark:bg-orange-950/60 dark:text-orange-300",
  books: "bg-yellow-100 text-yellow-800 dark:bg-yellow-950/60 dark:text-yellow-300",
  sports: "bg-lime-100 text-lime-800 dark:bg-lime-950/60 dark:text-lime-300",
  hobby: "bg-fuchsia-100 text-fuchsia-800 dark:bg-fuchsia-950/60 dark:text-fuchsia-300",
  toys: "bg-pink-100 text-pink-800 dark:bg-pink-950/60 dark:text-pink-300",
  vehicle: "bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300",
  appliance: "bg-teal-100 text-teal-800 dark:bg-teal-950/60 dark:text-teal-300",
  camping: "bg-green-100 text-green-800 dark:bg-green-950/60 dark:text-green-300",
  jewelry: "bg-purple-100 text-purple-800 dark:bg-purple-950/60 dark:text-purple-300",
  documents: "bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-300",
  christmas: "bg-red-100 text-red-800 dark:bg-red-950/60 dark:text-red-300",
  misc: "bg-stone-100 text-stone-700 dark:bg-stone-800 dark:text-stone-300",
  uncategorized: "bg-stone-100 text-stone-700 dark:bg-stone-800 dark:text-stone-300",
};

const CATEGORY_PALETTE = [
  "bg-sky-100 text-sky-800 dark:bg-sky-950/60 dark:text-sky-300",
  "bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300",
  "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300",
  "bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300",
  "bg-violet-100 text-violet-800 dark:bg-violet-950/60 dark:text-violet-300",
  "bg-orange-100 text-orange-800 dark:bg-orange-950/60 dark:text-orange-300",
  "bg-cyan-100 text-cyan-800 dark:bg-cyan-950/60 dark:text-cyan-300",
  "bg-fuchsia-100 text-fuchsia-800 dark:bg-fuchsia-950/60 dark:text-fuchsia-300",
  "bg-lime-100 text-lime-800 dark:bg-lime-950/60 dark:text-lime-300",
  "bg-indigo-100 text-indigo-800 dark:bg-indigo-950/60 dark:text-indigo-300",
  "bg-yellow-100 text-yellow-800 dark:bg-yellow-950/60 dark:text-yellow-300",
  "bg-pink-100 text-pink-800 dark:bg-pink-950/60 dark:text-pink-300",
  "bg-teal-100 text-teal-800 dark:bg-teal-950/60 dark:text-teal-300",
  "bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300",
];

export function getCategoryStyle(category: string | null | undefined): string {
  if (!category) return CATEGORY_STYLES.uncategorized;
  const key = category.trim().toLowerCase();
  if (CATEGORY_STYLES[key]) return CATEGORY_STYLES[key];
  let hash = 0;
  for (let i = 0; i < key.length; i++) {
    hash = (hash << 5) - hash + key.charCodeAt(i);
    hash |= 0;
  }
  return CATEGORY_PALETTE[Math.abs(hash) % CATEGORY_PALETTE.length];
}
