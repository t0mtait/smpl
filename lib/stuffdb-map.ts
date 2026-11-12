/**
 * Pure mapping from a TomsHQ inventory workbook row to the app's item and
 * disposal records.
 *
 * This module does no I/O and imports nothing, on purpose: the 217-row
 * mapping can be exercised in tests without touching a database. The
 * importer (scripts/import-stuffdb.mjs) does the reading and the writing;
 * this file only decides what each row means.
 *
 * Source columns (one sheet, 11 columns):
 *
 *   Name | Brand | Category | Subcategory | Status | Quality | Acquisition |
 *   EOL | Paid ALL-IN | Received | Notes
 *
 * Mapping decisions, in the order they matter:
 *
 *   Status
 *     "Sold"        -> sold      (disposal: sold, proceeds = Received)
 *     "Donated"     -> donated   (disposal: donated, no proceeds recorded)
 *     "Thrown Out"  -> disposed  (disposal: disposed, no proceeds recorded)
 *     "Close"       -> closed    (disposal: closed, no outcome recorded)
 *     everything else -> owned
 *
 *     "Close" is a terminal state, not a usage frequency: the item stopped
 *     being tracked without a sale, a donation or a throw-out. Recording one
 *     of those three would be a claim the source does not support, so it
 *     gets its own "closed" disposition instead.
 *
 *   Status -> use frequency
 *     "Heavy Use"       -> daily
 *     "Occasional Use"  -> monthly
 *     "Rare Use"        -> rare
 *     "Listed" and a blank status record no cadence at all -> unknown
 *
 *   Last used
 *     The workbook has no last-used column. For rows that declare a
 *     cadence, the last-used date is set to one cadence window ago (daily
 *     3d, monthly 60d, rare 180d) — the same windows the scorer reasons
 *     with. Leaving it empty would tell the app the item was never used,
 *     which the source directly contradicts. The description says the date
 *     was inferred, so it is never mistaken for a recorded fact.
 *     Rows with no cadence keep a null last-used date: there is genuinely
 *     no usage record for them.
 *
 *   Money
 *     "Paid ALL-IN" -> purchase_price. A missing cell stays null ("never
 *     recorded"); an explicit 0 stays 0 ("genuinely free"). The two are not
 *     the same and the difference changes the score.
 *
 *     "Received" -> the sale proceeds on sold rows, the asking price on
 *     listed rows, and nothing anywhere else.
 *
 *     current_value -> the asking price when the source records one, else
 *     the amount paid as a conservative proxy, else null. An item acquired
 *     for $0 keeps an unknown value: it was free, which says nothing about
 *     what it is worth now, and a $0 value would trigger the scorer's
 *     "no resale value" signal on an item that was never priced.
 *
 *   Source-only fields
 *     Brand, Quality, Subcategory, Acquisition, EOL and Notes have no
 *     columns in the app, so they are written into the item description in
 *     a fixed order.
 *
 *   Duplicates
 *     Every source row becomes its own item. The workbook contains exact
 *     duplicate rows; they are kept, because deciding what to do about a
 *     duplicate is the app's job (the duplicate signal flags it), not the
 *     importer's.
 */

export type SourceRow = Record<string, string | number | null | undefined>;

export type MappedStatus = "owned" | "sold" | "donated" | "disposed" | "closed";
export type MappedFrequency = "daily" | "weekly" | "monthly" | "seasonal" | "rare" | "never" | "unknown";
export type MappedPriority = "auto" | "keep" | "get_rid";

export interface MappedDisposal {
  disposition: "sold" | "donated" | "disposed" | "closed";
  disposedAt: string;
  amount: number | null;
  channel: string;
  notes: string;
}

export interface MappedItem {
  name: string;
  category: string;
  description: string;
  location: string;
  purchaseDate: string | null;
  purchasePrice: number | null;
  currentValue: number | null;
  status: MappedStatus;
  lastUsedAt: string | null;
  useFrequency: MappedFrequency;
  priority: MappedPriority;
  disposal: MappedDisposal | null;
}

export interface MapResult {
  items: MappedItem[];
  /** The date the workbook was exported — used to date the disposals. */
  exportedAt: string;
  /** Rows with no name at all, which cannot become items. */
  skipped: number;
}

const DAY = 86400000;

/* ----------------------------------------------------------------- dates */

/** "2026 Q2" -> the first day of that quarter. */
export function quarterStart(value: string): string | null {
  const match = /^(\d{4})\s*Q([1-4])$/i.exec(value.trim());
  if (!match) return null;
  const year = Number(match[1]);
  const quarter = Number(match[2]);
  const month = (quarter - 1) * 3 + 1;
  return new Date(Date.UTC(year, month - 1, 1)).toISOString().slice(0, 10);
}

/** "2026 Q2" -> the last day of that quarter (end of the expected useful life). */
export function quarterEnd(value: string): string | null {
  const match = /^(\d{4})\s*Q([1-4])$/i.exec(value.trim());
  if (!match) return null;
  const year = Number(match[1]);
  const quarter = Number(match[2]);
  return new Date(Date.UTC(year, quarter * 3, 0)).toISOString().slice(0, 10);
}

function isoDate(date: Date): string {
  // Local calendar date. A quarter boundary and "today" are both calendar
  // concepts; toISOString() would give the UTC date, which is a day ahead
  // for part of every evening.
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/* ------------------------------------------------------------ vocabulary */

/** Terminal source statuses, and how the app records them. */
const TERMINAL_STATUSES: Record<string, MappedStatus> = {
  Sold: "sold",
  Donated: "donated",
  "Thrown Out": "disposed",
  Close: "closed",
};

/** Source usage vocabulary -> the app's use_frequency. */
const STATUS_TO_FREQUENCY: Record<string, MappedFrequency> = {
  "Heavy Use": "daily",
  "Occasional Use": "monthly",
  "Rare Use": "rare",
};

/**
 * How long an item of a given cadence may sit unused before it looks idle.
 * These are the same windows the scorer reasons with.
 */
const FREQUENCY_WINDOW_DAYS: Record<string, number> = {
  daily: 3,
  monthly: 60,
  rare: 180,
};

/** Source category/subcategory -> the app's category vocabulary. */
const SUBCATEGORY_TO_CATEGORY: Record<string, Record<string, string>> = {
  Clothing: { _default: "clothing" },
  Electronics: { _default: "electronics" },
  Household: {
    Kitchen: "kitchen",
    Furniture: "furniture",
    Equipment: "furniture",
    Utility: "tools",
    Accessories: "misc",
    _default: "misc",
  },
  Personal: {
    Equipment: "sports",
    Furniture: "furniture",
    Health: "misc",
    "Hygiene & Grooming": "misc",
    Accessories: "misc",
    _default: "misc",
  },
  Health: { Equipment: "sports", _default: "misc" },
  _default: { _default: "misc" },
};

/** A handful of items the generic mapping gets wrong. */
const ITEM_CATEGORY_OVERRIDES: Record<string, string> = {
  "iphone 17": "phone",
  "mac mini": "computer",
  "homelab": "computer",
  "gaming pc": "computer",
  "ipad pro 13 inch": "computer",
  "msi pro z790-p wifi mobo": "computer",
  "intel core i7 14700kf": "computer",
  "msi liquid cooler": "computer",
  "nintendo switch 2": "console",
  "ps5 pro": "console",
  "gameboy color": "console",
  "psp-3000": "console",
  "nintendo ds lite": "console",
  "dsi xl": "console",
  "gameboy games": "toys",
  "pacifica 112v electric guitar": "hobby",
  "champion 2 25 amp": "hobby",
  "corolla 2015": "vehicle",
  "books": "books",
  "dinosaur car toy": "toys",
  "groot toy": "toys",
  "lifting straps": "sports",
  "lifting wraps": "sports",
  "lifting wraps, straps": "sports",
  "lifting belt": "sports",
  "yoga mat": "sports",
  "foam roller": "sports",
  "kitchen scale": "kitchen",
  "pour-over coffee filter": "kitchen",
  "stainless steel holder + spatula": "kitchen",
  "multi-head screwdriver": "tools",
};

/**
 * The app's category for one source row. Always returns a category — an
 * item with no category would be invisible to every category filter, and
 * "uncategorized" is a hole in the data rather than an answer.
 */
export function categoryFor(name: string, category: string, subcategory: string): string {
  const override = ITEM_CATEGORY_OVERRIDES[name.trim().toLowerCase()];
  if (override) return override;
  const group = SUBCATEGORY_TO_CATEGORY[category] ?? SUBCATEGORY_TO_CATEGORY._default;
  return group[subcategory] ?? group._default;
}

/* ------------------------------------------------------------ cell access */

function cell(row: SourceRow, key: string): string | number | null {
  const value = row[key];
  return value === undefined || value === null ? null : value;
}

export function text(row: SourceRow, key: string): string {
  const value = cell(row, key);
  if (value === null) return "";
  return String(value).trim();
}

/**
 * A money cell. An empty cell is null ("never recorded"); anything the
 * source actually wrote down — including 0 — is a number.
 */
export function money(row: SourceRow, key: string): number | null {
  const value = cell(row, key);
  if (value === null) return null;
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  const cleaned = value.replace(/[$,\s]/g, "");
  if (cleaned === "") return null;
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : null;
}

/* ------------------------------------------------------------- description */

/**
 * The source-only fields, in a fixed order, so the same row always produces
 * the same description.
 */
export function buildDescription(
  row: SourceRow,
  sourceStatus: string,
  options: { paidKnown: boolean; cadenceInferred: boolean; noUsageRecord: boolean; valueUnknown: boolean }
): string {
  const parts: string[] = [];
  const brand = text(row, "Brand");
  const category = text(row, "Category");
  const subcategory = text(row, "Subcategory");
  const quality = text(row, "Quality");
  const acquisition = text(row, "Acquisition");
  const eol = quarterEnd(text(row, "EOL"));
  const notes = text(row, "Notes");

  if (brand) parts.push(`Brand: ${brand}`);
  if (category) parts.push(`Source category: ${category}`);
  if (subcategory) parts.push(`Type: ${subcategory}`);
  if (quality) parts.push(`Quality: ${quality}`);
  if (acquisition) parts.push(`Acquired: ${acquisition}`);
  if (eol) parts.push(`Expected end of life: ${eol}`);
  if (sourceStatus) parts.push(`Source status: ${sourceStatus}`);
  else parts.push("Source status: not recorded in source");
  if (options.cadenceInferred) parts.push("Last used inferred from cadence");
  if (options.noUsageRecord) parts.push("No usage record in source");
  if (!options.paidKnown) parts.push("Paid amount not recorded in source");
  if (options.valueUnknown) parts.push("Current value not recorded in source");
  if (notes) parts.push(`Note: ${notes}`);

  return parts.join(" · ");
}

/* -------------------------------------------------------------- disposal */

function buildDisposalNotes(sourceStatus: string, received: number | null): string {
  switch (sourceStatus) {
    case "Sold":
      return received === null
        ? "Sold — proceeds not recorded in source"
        : `Sold for $${received.toFixed(2)}`;
    case "Donated":
      return "Donated — no proceeds recorded in source";
    case "Thrown Out":
      return "Thrown out — no proceeds recorded in source";
    case "Close":
      return "Closed — no sale, donation or disposal recorded in source";
    default:
      return "";
  }
}

/* ---------------------------------------------------------------- mapping */

/**
 * The workbook snapshot date. TomsHQ names the sheet after the export
 * timestamp, e.g. "2026-09-13T08_23_31.892ZTomsHQ-".
 */
export function snapshotDate(sheetName: string | null, fallback: string): string {
  const match = /^(\d{4}-\d{2}-\d{2})T/.exec(sheetName ?? "");
  return match ? match[1] : fallback;
}

/**
 * Map every source row to an item (and, for terminal rows, a disposal).
 *
 * `now` is injectable so the derived last-used dates are deterministic in
 * tests.
 */
export function mapRows(rows: SourceRow[], sheetName: string | null, now: Date = new Date()): MapResult {
  const today = isoDate(now);
  const exportedAt = snapshotDate(sheetName, today);
  const items: MappedItem[] = [];
  let skipped = 0;

  for (const row of rows) {
    const name = text(row, "Name");
    if (!name) {
      skipped += 1;
      continue;
    }

    const sourceStatus = text(row, "Status");
    const status: MappedStatus = TERMINAL_STATUSES[sourceStatus] ?? "owned";
    const isOwned = status === "owned";

    const frequency: MappedFrequency = STATUS_TO_FREQUENCY[sourceStatus] ?? "unknown";
    const window = FREQUENCY_WINDOW_DAYS[frequency];
    const cadenceInferred = isOwned && window !== undefined;
    const noUsageRecord = isOwned && window === undefined;

    const lastUsedAt = cadenceInferred
      ? isoDate(new Date(now.getTime() - window * DAY))
      : null;

    const paid = money(row, "Paid ALL-IN");
    const received = money(row, "Received");
    const acquisition = quarterStart(text(row, "Acquisition"));

    // The purchase date comes from a quarter, so it can never be a day in
    // the future — but a quarter that starts after today would be.
    let purchaseDate: string | null = null;
    if (acquisition) {
      purchaseDate = acquisition > today ? today : acquisition;
    }

    // current_value: an asking price beats the purchase price; an item
    // acquired for free has no known value at all.
    let currentValue: number | null = null;
    if (isOwned) {
      if (received !== null) currentValue = received;
      else if (paid !== null && paid > 0) currentValue = paid;
    }

    const description = buildDescription(row, sourceStatus, {
      paidKnown: paid !== null,
      cadenceInferred,
      noUsageRecord,
      valueUnknown: isOwned && currentValue === null,
    });

    const disposal: MappedDisposal | null = isOwned
      ? null
      : {
          disposition: status as MappedDisposal["disposition"],
          disposedAt: exportedAt,
          amount: status === "sold" ? received : null,
          channel: "",
          notes: buildDisposalNotes(sourceStatus, received),
        };

    items.push({
      name,
      category: categoryFor(name, text(row, "Category"), text(row, "Subcategory")),
      description,
      location: "",
      purchaseDate,
      purchasePrice: paid,
      currentValue,
      status,
      lastUsedAt,
      useFrequency: frequency,
      // "Listed" means it is already on the market: the source itself says
      // this one is going.
      priority: sourceStatus === "Listed" ? "get_rid" : "auto",
      disposal,
    });
  }

  return { items, exportedAt, skipped };
}
