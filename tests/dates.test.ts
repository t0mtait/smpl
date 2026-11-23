/**
 * Date-handling tests.
 *
 * These exist because of a real bug: the app wrote calendar dates with
 * `toISOString()` (UTC) and read them back as local midnight. In the
 * Atlantic timezone that made "today" read as tomorrow during the evening,
 * and made every item look one day older than it was.
 *
 * The rule the app follows now:
 *   - a stored date is a calendar date in the user's timezone
 *   - writing "today" produces today's local calendar date
 *   - reading it back gives 0 days, never -1
 */
import { toDateOnly, today, parseDateOnly, daysFromNow, daysSinceDate, quarterToOrder, orderToQuarter } from "../lib/dates.ts";
import { daysSince } from "../lib/scoring.ts";
import { formatDate, formatQuarter } from "../lib/format.ts";

let passed = 0;
let failed = 0;

function check(name: string, condition: boolean, detail = "") {
  if (condition) {
    passed++;
  } else {
    failed++;
    console.error(`FAIL: ${name}${detail ? ` — ${detail}` : ""}`);
  }
}

function eq(name: string, actual: unknown, expected: unknown) {
  check(name, actual === expected, `got ${JSON.stringify(actual)}, expected ${JSON.stringify(expected)}`);
}

/* --------------------------------------------------------- writing dates */

{
  const now = new Date();
  eq("toDateOnly matches the local calendar date", toDateOnly(now), today());

  // The written date, read back, must be the same calendar day.
  const written = today();
  const readBack = parseDateOnly(written);
  check("today parses", readBack !== null);
  eq("today reads back as the same day", readBack?.getDate(), now.getDate());
  eq("today reads back in the same month", readBack?.getMonth(), now.getMonth());
  eq("today reads back in the same year", readBack?.getFullYear(), now.getFullYear());
}

/* --------------------------------------------------------- reading dates */

{
  // daysSince of today's date is 0 — never negative.
  eq("daysSince(today) is 0", daysSince(today()), 0);
  eq("daysSinceDate(today) is 0", daysSinceDate(today()), 0);

  // A date N days back is N days back, whatever time it is.
  for (const n of [1, 3, 30, 90, 365]) {
    eq(`daysSince(${n} days ago) is ${n}`, daysSince(daysFromNow(-n)), n);
    eq(`daysSinceDate(${n} days ago) is ${n}`, daysSinceDate(daysFromNow(-n)), n);
  }

  // A future date is negative, and stays consistent.
  eq("daysSince(tomorrow) is -1", daysSince(daysFromNow(1)), -1);
}

/* ------------------------------------------- the write/read round trip */

{
  // The exact bug: build a date string with UTC semantics, then read it
  // back the way the app does. When the two land on different calendar
  // days, reading the UTC string back gives the wrong age — which is
  // exactly why the app writes local dates instead.
  const now = new Date();
  const utcString = now.toISOString().slice(0, 10);
  const localString = toDateOnly(now);
  const utcDay = parseDateOnly(utcString)?.getDate();
  const localDay = parseDateOnly(localString)?.getDate();

  eq("the local string parses to the local day", localDay, now.getDate());
  eq("reading the local string back gives 0 days", daysSince(localString), 0);

  if (utcDay !== localDay) {
    // The UTC string is a different calendar day, so reading it back
    // gives a different age. It may even be in the future, which is the
    // "today is -1 days old" bug this module exists to prevent.
    check(
      "a UTC date string on another day does not read back as today",
      daysSince(utcString) !== 0,
      `got ${daysSince(utcString)}`
    );
  }
}

/* --------------------------------------------------------- formatDate */

{
  eq("formatDate renders the local calendar day", formatDate(today()).length > 0, true);
  eq("formatDate handles a null date", formatDate(null), "—");
  eq("formatDate handles an empty string", formatDate(""), "—");
}

/* ------------------------------------------------------- formatQuarter */

{
  eq("formatQuarter handles null", formatQuarter(null), "—");
  eq("formatQuarter handles empty string", formatQuarter(""), "—");
  eq("formatQuarter Q1 from ISO", formatQuarter("2024-01-15"), "Q1 2024");
  eq("formatQuarter Q2 from ISO", formatQuarter("2024-04-01"), "Q2 2024");
  eq("formatQuarter Q3 from ISO", formatQuarter("2024-07-01"), "Q3 2024");
  eq("formatQuarter Q4 from ISO", formatQuarter("2024-10-01"), "Q4 2024");
  eq("formatQuarter handles YYYY QN", formatQuarter("2024 Q3"), "Q3 2024");
  eq("formatQuarter handles QN YYYY", formatQuarter("Q3 2024"), "Q3 2024");
  eq("formatQuarter handles YYYY-QN", formatQuarter("2026-Q1"), "Q1 2026");
}

/* ------------------------------------------------------- quarterToOrder & orderToQuarter */

{
  eq("quarterToOrder handles null", quarterToOrder(null), null);
  eq("quarterToOrder handles empty string", quarterToOrder(""), null);
  eq("quarterToOrder Q1 from ISO", quarterToOrder("2024-01-15"), 2024 * 4 + 1);
  eq("quarterToOrder Q4 from ISO", quarterToOrder("2026-11-23"), 2026 * 4 + 4);
  eq("quarterToOrder from QN YYYY", quarterToOrder("Q4 2026"), 2026 * 4 + 4);
  eq("quarterToOrder from YYYY QN", quarterToOrder("2025 Q2"), 2025 * 4 + 2);
  eq("orderToQuarter Q4 2026", orderToQuarter(2026 * 4 + 4), "Q4 2026");
  eq("orderToQuarter Q1 2025", orderToQuarter(2025 * 4 + 1), "Q1 2025");
}

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
