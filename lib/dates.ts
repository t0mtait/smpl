/**
 * Calendar-date helpers.
 *
 * The app stores dates as plain "YYYY-MM-DD" strings — a purchase date, a
 * sale date, an alert due date. Those are *calendar* dates, not instants:
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
  const iso = value.includes("T") ? value : `${value}T00:00:00`;
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
