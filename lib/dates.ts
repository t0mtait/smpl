/**
 * Calendar-date helpers.
 *
 * The app stores dates as plain "YYYY-MM-DD" strings — a purchase date, a
 * sale date. Those are *calendar* dates, not instants:
 * "I sold this on the 13th" means the 13th where the person is, not the
 * 13th in Greenwich.
 *
 * The bug this module exists to prevent: writing those strings with
 * `new Date().toISOString().slice(0, 10)` produces a UTC date, while
 * reading them back with `new Date("YYYY-MM-DD")` parses local midnight.
 * The two disagree by a day for part of every day, so late in the evening
 * the app would record "tomorrow" as "today", and reading it back would
 * give a negative age.
 *
 * Everything here works in the server's local calendar, which is the one
 * the person using the app means.
 */

const MS_PER_DAY = 86400000;

/** "2026-11-11" for the given instant, in local calendar terms. */
export function toDateOnly(date: Date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** Today, as a local calendar date. */
export function today(): string {
  return toDateOnly(new Date());
}

/**
 * Parse a "YYYY-MM-DD" string as local midnight. Returns null for
 * anything unparseable so callers can decide what that means.
 */
export function parseDateOnly(value: string | null | undefined): Date | null {
  if (!value) return null;
  // Legacy SQLite rows are "YYYY-MM-DD HH:MM:SS"; keep just the date part.
  const iso = value.includes("T") ? value : `${value.slice(0, 10)}T00:00:00`;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : d;
}

/**
 * The local calendar date `days` days from now (negative goes backwards).
 *
 * Calendar arithmetic via setDate, not milliseconds: adding 30 * 86400000
 * crosses a DST boundary and lands an hour early, which can drop the
 * result back to the previous day.
 */
export function daysFromNow(days: number, from: Date = new Date()): string {
  const d = new Date(from.getFullYear(), from.getMonth(), from.getDate());
  d.setDate(d.getDate() + days);
  return toDateOnly(d);
}

/** The local calendar date `days` days before the given date string. */
export function daysBefore(dateOnly: string, days: number): string {
  const d = parseDateOnly(dateOnly);
  if (!d) return dateOnly;
  const out = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  out.setDate(out.getDate() - days);
  return toDateOnly(out);
}

/**
 * Whole calendar days between a date string and now.
 *
 * Calendar days, not elapsed milliseconds: "2026-11-09" means local
 * midnight on the 9th, so at 23:42 on the 12th that is three calendar
 * days, not 2.98. Rounding the start-of-day difference also absorbs the
 * one-hour shift a DST boundary introduces.
 */
export function daysSinceDate(value: string | null | undefined, now: Date = new Date()): number | null {
  const d = parseDateOnly(value);
  if (!d) return null;
  const startOfDay = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  return Math.round((startOfDay(now) - startOfDay(d)) / MS_PER_DAY);
}

/** Current calendar quarter, e.g. "Q4 2026". */
export function currentQuarter(date: Date = new Date()): string {
  const y = date.getFullYear();
  const q = Math.ceil((date.getMonth() + 1) / 3);
  return `Q${q} ${y}`;
}

/** Convert a quarter string like "Q4 2026" or "2026 Q4" to ISO date "2026-10-01". */
export function quarterToIso(value: string | null | undefined): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  const m1 = /^Q([1-4])\s*(\d{4})$/i.exec(trimmed);
  if (m1) {
    const q = Number(m1[1]);
    const y = Number(m1[2]);
    const m = String((q - 1) * 3 + 1).padStart(2, "0");
    return `${y}-${m}-01`;
  }
  const m2 = /^(\d{4})[-\s]*Q([1-4])$/i.exec(trimmed);
  if (m2) {
    const y = Number(m2[1]);
    const q = Number(m2[2]);
    const m = String((q - 1) * 3 + 1).padStart(2, "0");
    return `${y}-${m}-01`;
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    return trimmed;
  }
  return null;
}

/**
 * Convert a quarter string or ISO date string to a monotonic quarter order number:
 * year * 4 + quarter.
 * e.g. "Q4 2026" or "2026-10-01" -> 2026 * 4 + 4 = 8108.
 * Returns null for unparseable dates.
 */
export function quarterToOrder(value: string | null | undefined): number | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;

  const qy = /^Q([1-4])\s*(\d{4})$/i.exec(trimmed);
  if (qy) return Number(qy[2]) * 4 + Number(qy[1]);

  const yq = /^(\d{4})[-\s]*Q([1-4])$/i.exec(trimmed);
  if (yq) return Number(yq[1]) * 4 + Number(yq[2]);

  const iso = /^(\d{4})-(\d{2})(?:-\d{2})?/.exec(trimmed);
  if (iso) {
    const year = Number(iso[1]);
    const month = parseInt(iso[2], 10);
    if (month >= 1 && month <= 12) {
      const q = Math.ceil(month / 3);
      return year * 4 + q;
    }
  }

  const d = new Date(trimmed.includes("T") ? trimmed : `${trimmed}T00:00:00`);
  if (!Number.isNaN(d.getTime())) {
    return d.getFullYear() * 4 + Math.ceil((d.getMonth() + 1) / 3);
  }

  return null;
}

/**
 * Convert a quarter order number back to "QN YYYY".
 * e.g. 8108 -> "Q4 2026".
 */
export function orderToQuarter(order: number): string {
  const year = Math.floor((order - 1) / 4);
  const q = ((order - 1) % 4) + 1;
  return `Q${q} ${year}`;
}

