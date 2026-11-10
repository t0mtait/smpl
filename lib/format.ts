export function formatMoney(value: number): string {
  return value.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: value % 1 === 0 ? 0 : 2,
  });
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
  owned: "Owned",
  sold: "Sold",
  donated: "Donated",
  disposed: "Disposed",
};

export const STATUS_STYLES: Record<string, string> = {
  owned: "bg-ink-100 text-ink-700",
  sold: "bg-moss-500/15 text-moss-700",
  donated: "bg-sky-500/15 text-sky-700",
  disposed: "bg-clay-500/15 text-clay-600",
};

export const FREQUENCY_LABELS: Record<string, string> = {
  daily: "Daily",
  weekly: "Weekly",
  monthly: "Monthly",
  seasonal: "Seasonal",
  rare: "Rarely",
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
