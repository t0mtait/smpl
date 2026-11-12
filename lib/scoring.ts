import type { Item, UseFrequency } from "./db.ts";
import { daysSinceDate } from "./dates.ts";

/**
 * The declutter heuristic.
 *
 * Every owned item gets a 0-100 "declutter score" — higher means the app
 * thinks you should get rid of it. The score is a weighted sum of signals,
 * each of which also emits a human-readable reason so the user can judge
 * for themselves rather than blindly trusting a number.
 *
 * Signals:
 *   idle days      - how long since it was last used (or acquired, if never)
 *   never used     - acquired but has no usage record at all
 *   low value      - cheap to part with, little resale upside
 *   duplicate      - same normalized name as another owned item
 *   seasonal       - seasonal category used outside its season
 *   frequency      - declared use frequency (rare/never is a red flag)
 */

export interface ScoreReason {
  label: string;
  weight: number;
}

export interface ScoredItem {
  item: Item;
  score: number;
  reasons: ScoreReason[];
  idleDays: number | null;
}

const SEASONAL_CATEGORIES = new Set([
  "clothing",
  "coat",
  "jacket",
  "ski",
  "camping",
  "hiking",
  "beach",
  "christmas",
  "holiday",
  "costume",
  "winter",
  "summer",
]);

/** Categories whose value tends to collapse with age. */
const DEPRECIATING = new Set([
  "furniture",
  "electronics",
  "appliance",
  "vehicle",
  "computer",
  "phone",
  "console",
  "tool",
]);

function normalizeName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * The name minus a trailing single digit, so "Coffee grinder 1" and
 * "Coffee grinder 2" share a base. Two-digit suffixes are left alone so
 * "iPhone 15" and "iPhone 14" stay distinct.
 */
function baseName(name: string): string {
  return normalizeName(name).replace(/ [1-9]$/, "");
}

/**
 * Price comparison between two possible duplicates.
 *
 *   match   - the prices sit in the same ballpark
 *   differ  - the prices rule them out (different price brackets)
 *   unknown - we never recorded one of the prices, so nothing rules them out
 *
 * The price check is what keeps "iPhone 7" and "iPhone 9" from being called
 * duplicates of each other. An unknown price is not evidence of a difference,
 * so it never rules a pair out — it just leaves them unproven.
 */
function priceEvidence(a: number | null, b: number | null): "match" | "differ" | "unknown" {
  if (a === null || b === null) return "unknown";
  if (a <= 0 && b <= 0) return "match";
  if (a <= 0 || b <= 0) return "differ";
  const high = Math.max(a, b);
  const low = Math.min(a, b);
  return high - low <= Math.max(5, high * 0.25) ? "match" : "differ";
}

/** Identical names (ignoring case and punctuation) mean the same product. */
function namesMatch(a: string, b: string): boolean {
  return normalizeName(a) === normalizeName(b);
}

/**
 * Whole calendar days between a date and now.
 *
 * This compares calendar days, not elapsed milliseconds. A date stored as
 * "2026-11-09" means local midnight on the 9th, so at 23:42 on the 12th
 * that is three calendar days — not 2.98 days, which would floor to 2.
 * Elapsed-time arithmetic makes every date look a day older than it is
 * for most of the day, and makes "today" negative in the evening.
 */
export function daysSince(value: string | null): number | null {
  return daysSinceDate(value);
}

function seasonOf(category: string): "summer" | "winter" | null {
  const c = category.toLowerCase();
  if (["coat", "jacket", "ski", "winter", "camping", "hiking"].some((k) => c.includes(k))) {
    return "winter";
  }
  if (["beach", "summer", "christmas", "holiday"].some((k) => c.includes(k))) {
    return "summer";
  }
  return null;
}

const FREQUENCY_TEXT: Record<UseFrequency, string> = {
  daily: "daily",
  weekly: "weekly",
  monthly: "monthly",
  seasonal: "seasonal",
  rare: "rarely",
  never: "never",
  unknown: "on no set schedule",
};

/** How a frequency reads inside "idle longer than a ___ item would sit". */
const CADENCE_PHRASE: Record<UseFrequency, string> = {
  daily: "daily used",
  weekly: "weekly used",
  monthly: "monthly used",
  seasonal: "seasonal",
  rare: "rarely used",
  never: "never used",
  unknown: "regularly used",
};

const FREQUENCY_IDLE_DAYS: Record<UseFrequency, number> = {
  daily: 3,
  weekly: 14,
  monthly: 60,
  seasonal: 120,
  rare: 180,
  never: 365,
  unknown: 45,
};

/**
 * Score a single item. `duplicateIds` holds the IDs of owned items that have
 * a twin — every item sharing a duplicate is flagged, since we can't tell
 * which copy is the keeper.
 */
export function scoreItem(item: Item, duplicateIds: Set<number>): ScoredItem {
  const reasons: ScoreReason[] = [];
  let score = 0;

  const idleDays = daysSince(item.lastUsedAt ?? item.purchaseDate);

  // 1. Idle time — up to 40 points. 30 days idle = ~1 point, scaling to
  //    full marks at roughly 3 years of no use. For an item that has never
  //    been used, the acquisition date is the idle reference.
  {
    const idle = idleDays ?? 0;
    const idlePoints = Math.min(40, Math.round((idle / 1095) * 40));
    if (idlePoints > 0) {
      reasons.push({
        label: item.lastUsedAt
          ? `Unused for ${idle} day${idle === 1 ? "" : "s"}`
          : `Sitting unused for ${idle} day${idle === 1 ? "" : "s"}`,
        weight: idlePoints,
      });
      score += idlePoints;
    }
  }

  // 2. Never used — 25 points. An item with no usage record and no
  //    last-used date is the strongest "this is dead weight" signal we have.
  const neverUsed = !item.lastUsedAt;
  if (neverUsed) {
    const acquiredDays = daysSince(item.purchaseDate);
    if (acquiredDays !== null && acquiredDays > 30) {
      reasons.push({
        label: `Owned ${acquiredDays} days, never used`,
        weight: 25,
      });
      score += 25;
    }
  }

  // 3. Declared frequency — up to 20 points.
  const freqPoints: Record<UseFrequency, number> = {
    never: 20,
    rare: 14,
    seasonal: 8,
    unknown: 4,
    monthly: 4,
    weekly: 1,
    daily: 0,
  };
  if (freqPoints[item.useFrequency] > 0) {
    // The never-used reason already covers this case — don't say it twice.
    if (!(item.useFrequency === "never" && neverUsed)) {
      reasons.push({
        label:
          item.useFrequency === "never"
            ? "Never used"
            : `Used ${FREQUENCY_TEXT[item.useFrequency]}`,
        weight: freqPoints[item.useFrequency],
      });
    }
    score += freqPoints[item.useFrequency];
  }

  // 4. Low value — up to 15 points. The resale upside is small, so keeping
  //    it around costs more space than it is worth.
  //
  //    An unknown value is not a low value. If we treated "never recorded" as
  //    $0, every priceless item we failed to price would be pushed to the top
  //    of the declutter list. Unknown values simply carry no signal.
  const value = item.currentValue;
  if (value !== null) {
    if (value < 50) {
      const points = value <= 0 ? 15 : Math.round((1 - value / 50) * 15);
      reasons.push({
        label: value <= 0 ? "No resale value" : `Low value ($${value.toFixed(0)})`,
        weight: points,
      });
      score += points;
    } else if (value < 200) {
      const points = Math.round((1 - (value - 50) / 150) * 8);
      reasons.push({ label: `Modest value ($${value.toFixed(0)})`, weight: points });
      score += points;
    }
  }

  // 5. Duplicates — 12 points.
  if (duplicateIds.has(item.id)) {
    reasons.push({ label: "Duplicate of another owned item", weight: 12 });
    score += 12;
  }

  // 6. Seasonal out of season — 10 points.
  const season = seasonOf(item.category);
  if (season) {
    const month = new Date().getMonth() + 1;
    const isSummerSeason = season === "summer";
    const inSeason = isSummerSeason ? month >= 5 && month <= 9 : month >= 10 || month <= 3;
    if (!inSeason) {
      reasons.push({ label: `${item.category} out of season`, weight: 10 });
      score += 10;
    }
  }

  // 7. Depreciating + already paid for — up to 8 points of pure sunk cost.
  //    Only computable when both figures are known.
  if (
    DEPRECIATING.has(item.category.toLowerCase()) &&
    item.purchasePrice !== null &&
    item.currentValue !== null &&
    item.purchasePrice > item.currentValue
  ) {
    const lost = item.purchasePrice - item.currentValue;
    const points = Math.min(8, Math.max(2, Math.round(lost / 100)));
    reasons.push({ label: `Lost ~$${lost.toFixed(0)} in value`, weight: points });
    score += points;
  }

  // 8. Idle relative to its own expected cadence — up to 10 points.
  const expectedIdle = FREQUENCY_IDLE_DAYS[item.useFrequency];
  if (item.lastUsedAt && idleDays !== null && idleDays > expectedIdle * 2) {
    const points = Math.min(10, Math.round(((idleDays - expectedIdle) / expectedIdle) * 4));
    if (points > 0) {
      reasons.push({
        label: `Idle far longer than a ${CADENCE_PHRASE[item.useFrequency]} item would sit`,
        weight: points,
      });
      score += points;
    }
  }

  // Manual overrides sit on top of the automatic score.
  if (item.priority === "keep") {
    reasons.push({ label: "Marked keep", weight: 0 });
    score = 0;
  } else if (item.priority === "get_rid") {
    reasons.push({ label: "Marked get rid of", weight: 0 });
    score = Math.max(score, 85);
  }

  return {
    item,
    score: Math.max(0, Math.min(100, Math.round(score))),
    reasons: reasons.filter((r) => r.weight > 0 || r.label.startsWith("Marked")),
    idleDays,
  };
}

/**
 * Find owned items that are duplicates of each other.
 *
 * Returns the set of item IDs that have at least one twin. The caller
 * supplies a set of item IDs rather than names because the same base name
 * can appear on genuinely different products.
 */
export function findDuplicateItemIds(items: Item[]): Set<number> {
  const groups = new Map<string, Item[]>();
  for (const item of items) {
    const key = baseName(item.name);
    if (!key) continue;
    const group = groups.get(key) ?? [];
    group.push(item);
    groups.set(key, group);
  }

  const dupes = new Set<number>();
  for (const group of groups.values()) {
    if (group.length < 2) continue;
    for (const item of group) {
      const hasTwin = group.some(
        (other) =>
          other.id !== item.id &&
          (namesMatch(item.name, other.name) ||
            priceEvidence(item.purchasePrice, other.purchasePrice) !== "differ")
      );
      if (hasTwin) dupes.add(item.id);
    }
  }
  return dupes;
}

/**
 * Names held by more than one owned item — the plain base-name view of
 * duplicates, kept for the tests and for callers that only need names.
 */
export function findDuplicateNames(items: Item[]): Set<string> {
  const counts = new Map<string, number>();
  for (const item of items) {
    const key = baseName(item.name);
    if (!key) continue;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  const dupes = new Set<string>();
  for (const [name, count] of counts) {
    if (count > 1) dupes.add(name);
  }
  return dupes;
}

/** Score every owned item and return them ranked, highest score first. */
export function scoreAll(items: Item[]): ScoredItem[] {
  const owned = items.filter((i) => i.status === "owned");
  const dupes = findDuplicateItemIds(owned);
  return owned
    .map((item) => scoreItem(item, dupes))
    .sort((a, b) => b.score - a.score || a.item.name.localeCompare(b.item.name));
}
