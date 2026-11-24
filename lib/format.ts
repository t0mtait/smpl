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
  const trimmed = value.trim();
  if (!trimmed) return "—";

  // Check for leading date part YYYY-MM-DD (e.g. from ISO or SQLite 'YYYY-MM-DD HH:MM:SS')
  const dateMatch = /^(\d{4})-(\d{2})-(\d{2})/.exec(trimmed);
  if (dateMatch) {
    const y = parseInt(dateMatch[1], 10);
    const m = parseInt(dateMatch[2], 10) - 1;
    const d = parseInt(dateMatch[3], 10);
    const dateObj = new Date(y, m, d);
    return dateObj.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
  }

  const d = new Date(trimmed);
  if (!Number.isNaN(d.getTime())) {
    return d.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
  }
  return trimmed;
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

/**
 * Return conditional color styling for a year string / date.
 * Different colors depending on the year (Q value doesn't matter).
 */
export function getYearStyle(value: string | null | undefined): string {
  if (!value) return "";
  const m = /(\d{4})/.exec(value);
  if (!m) return "";
  const year = parseInt(m[1], 10);
  const styles: Record<number, string> = {
    2026: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300",
    2025: "bg-sky-100 text-sky-800 dark:bg-sky-950/60 dark:text-sky-300",
    2024: "bg-purple-100 text-purple-800 dark:bg-purple-950/60 dark:text-purple-300",
    2023: "bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300",
    2022: "bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300",
    2021: "bg-teal-100 text-teal-800 dark:bg-teal-950/60 dark:text-teal-300",
    2020: "bg-orange-100 text-orange-800 dark:bg-orange-950/60 dark:text-orange-300",
    2019: "bg-indigo-100 text-indigo-800 dark:bg-indigo-950/60 dark:text-indigo-300",
    2018: "bg-fuchsia-100 text-fuchsia-800 dark:bg-fuchsia-950/60 dark:text-fuchsia-300",
  };
  if (styles[year]) return styles[year];
  const palette = [
    "bg-lime-100 text-lime-800 dark:bg-lime-950/60 dark:text-lime-300",
    "bg-cyan-100 text-cyan-800 dark:bg-cyan-950/60 dark:text-cyan-300",
    "bg-pink-100 text-pink-800 dark:bg-pink-950/60 dark:text-pink-300",
    "bg-yellow-100 text-yellow-800 dark:bg-yellow-950/60 dark:text-yellow-300",
  ];
  return palette[Math.abs(year) % palette.length];
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
  heavy_use: "Heavy",
  occasional_use: "Occasional",
  rare_use: "Rare",
  purgatory: "Purgatory",
  offloaded_sold: "Offloaded ($)",
  offloaded: "Offloaded",
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
  offloaded_sold: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300",
  offloaded: "bg-wash text-muted",
  listed: "bg-warn-soft text-warn",
  owned: "bg-warn-soft text-warn",
  sold: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300",
  donated: "bg-wash text-muted",
  disposed: "bg-wash text-muted",
  closed: "bg-wash text-muted",
};

export function getItemStatusInfo(item: {
  status: string;
  useFrequency?: string;
  priority?: string;
  currentValue?: number | null;
  offloadedDate?: string | null;
  disposalAmount?: number | null;
}): { key: string; label: string; style: string; isSold?: boolean } {
  if (item.status === "purgatory") {
    return {
      key: "purgatory",
      label: "Purgatory",
      style: STATUS_STYLES.purgatory,
    };
  }

  const isOffloaded =
    item.status === "sold" ||
    item.status === "donated" ||
    item.status === "disposed" ||
    item.status === "closed" ||
    item.status === "offloaded" ||
    Boolean(item.offloadedDate && item.status !== "owned");

  if (isOffloaded) {
    const hasDollar =
      item.status === "sold" ||
      (item.disposalAmount !== null && item.disposalAmount !== undefined && item.disposalAmount > 0);
    if (hasDollar) {
      return {
        key: "offloaded_sold",
        label: "Offloaded ($)",
        style: STATUS_STYLES.offloaded_sold,
        isSold: true,
      };
    }
    return {
      key: "offloaded",
      label: "Offloaded",
      style: STATUS_STYLES.offloaded,
      isSold: false,
    };
  }

  const freq = item.useFrequency || "";
  if (freq === "daily" || freq === "weekly" || item.status === "heavy_use") {
    return {
      key: "heavy_use",
      label: "Heavy",
      style: STATUS_STYLES.heavy_use,
    };
  }
  if (freq === "rare" || freq === "never" || item.status === "rare_use") {
    return {
      key: "rare_use",
      label: "Rare",
      style: STATUS_STYLES.rare_use,
    };
  }

  return {
    key: "occasional_use",
    label: "Occasional",
    style: STATUS_STYLES.occasional_use,
  };
}

/**
 * Terminal states: the item is no longer in the inventory. "closed" means it
 * went away without a recorded outcome — not a sale, not a donation.
 */
export const TERMINAL_STATUSES = ["sold", "donated", "disposed", "closed"] as const;

export const FREQUENCY_LABELS: Record<string, string> = {
  daily: "Heavy",
  monthly: "Occasional",
  rare: "Rare",
  weekly: "Weekly",
  seasonal: "Seasonal",
  never: "Never used",
  unknown: "Unknown",
};

export const CATEGORIES = [
  "clothing",
  "electronics",
  "home",
  "kitchen",
  "sports",
  "hobbies",
  "tools",
  "misc",
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
  home: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300",
  kitchen: "bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300",
  sports: "bg-lime-100 text-lime-800 dark:bg-lime-950/60 dark:text-lime-300",
  hobbies: "bg-purple-100 text-purple-800 dark:bg-purple-950/60 dark:text-purple-300",
  tools: "bg-orange-100 text-orange-800 dark:bg-orange-950/60 dark:text-orange-300",
  misc: "bg-stone-100 text-stone-700 dark:bg-stone-800 dark:text-stone-300",
  // Legacy aliases
  furniture: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300",
  appliance: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300",
  computer: "bg-sky-100 text-sky-800 dark:bg-sky-950/60 dark:text-sky-300",
  phone: "bg-sky-100 text-sky-800 dark:bg-sky-950/60 dark:text-sky-300",
  console: "bg-sky-100 text-sky-800 dark:bg-sky-950/60 dark:text-sky-300",
  hobby: "bg-purple-100 text-purple-800 dark:bg-purple-950/60 dark:text-purple-300",
  toys: "bg-purple-100 text-purple-800 dark:bg-purple-950/60 dark:text-purple-300",
  books: "bg-purple-100 text-purple-800 dark:bg-purple-950/60 dark:text-purple-300",
  entertainment: "bg-purple-100 text-purple-800 dark:bg-purple-950/60 dark:text-purple-300",
  camping: "bg-lime-100 text-lime-800 dark:bg-lime-950/60 dark:text-lime-300",
  health: "bg-lime-100 text-lime-800 dark:bg-lime-950/60 dark:text-lime-300",
  vehicle: "bg-orange-100 text-orange-800 dark:bg-orange-950/60 dark:text-orange-300",
  documents: "bg-stone-100 text-stone-700 dark:bg-stone-800 dark:text-stone-300",
  jewelry: "bg-stone-100 text-stone-700 dark:bg-stone-800 dark:text-stone-300",
  christmas: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300",
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
