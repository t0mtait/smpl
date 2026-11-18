# smpl.

Track every possession you own, get a nudge about what to get rid of, and keep
a running record of what you sold, donated, and threw away.

Built as a self-hosted app: Next.js 15 (App Router) + SQLite via Node 22's
built-in `node:sqlite`. No database server, no native modules, no external
services.

## Run it

```bash
npm install
npm run seed     # optional: 28 sample items so the screens aren't empty
npm run dev      # http://localhost:3000
```

Production:

```bash
npm run build
npm start
```

The first thing you'll see is **Create an account**. The sample data is parked
on a bootstrap account that can't log in — your first registration claims it,
so you start with a populated app instead of an empty one.

## What it does

**Inventory** — every item you own, with category, location, what you paid,
what it's worth now, when you last used it, and how often you use it. Search
and filter by status, category, value, or how long it's sat unused.

**Photos** — attach one photo per item. Stored on disk in `data/uploads/`.

**Get rid of these** — every owned item gets a 0-100 declutter score from a
weighted set of signals:

| Signal | Max points | What it means |
|---|---|---|
| Idle time | 40 | how long since it was last used (or acquired, if never) |
| Never used | 25 | owned for a month+ with no usage record |
| Use frequency | 20 | never / rare / seasonal are red flags |
| Low value | 15 | little resale upside, so keeping it costs more than it's worth |
| Duplicate | 12 | you own more than one of the same thing |
| Out of season | 10 | a winter coat in July |
| Sunk value | 8 | depreciating category that already lost money |
| Past cadence | 10 | idle far longer than its own use frequency warrants |

Every point comes with a plain-language reason, so the number is never
unsupported. You can override it per item: **Keep it** zeroes the score,
**Get rid of it** floors it at 85.

**Status + money** — mark an item sold, donated, or disposed. Sales record the
amount and the channel (eBay, Facebook Marketplace, Buy Nothing, …). Items are
never deleted when you dispose of them; they keep a status so lifetime stats
stay accurate. Restore puts one back to owned.

**Stats** — items owned, value owned, lifetime sales earnings, declutter rate,
sales earnings by month for the last 12 months, value by category, and the
full disposal breakdown.

**Wishlist** — pause before you purchase. Track items you are considering buying,
their target prices, URLs, and priority. The 30-day cooldown helps separate
passing impulses from genuine utility, with one-click conversion to owned inventory
when you do acquire them.

## Accounts

Everything — items, photos, disposals, stats, recommendations, wishlist — belongs
to an account. Two people can use the same server without seeing each other's
inventory.

**Registration and login** live at `/auth/register` and `/auth/login`. The
first registration on a fresh database claims the seeded sample data; every
account after that starts empty.

**How the security works:**

| Concern | How it's handled |
|---|---|
| Passwords | `scrypt` (N=16384, r=8, p=1) with a per-user random salt. Only the hash is stored. |
| Sessions | 32 random bytes in an `httpOnly`, `sameSite=lax` cookie. Only the SHA-256 hash is stored in SQLite. |
| Expiry | Sessions last 30 days and are purged server-side. |
| Sign out | Destroys the session row server-side and clears the cookie — not just a client-side redirect. |
| Authorization | Every query is scoped by owner id. A record belonging to another account returns 404, not 403, so ids don't leak. |
| Photos | Uploaded files are named with the account id and are only served to their owner. A filename alone is never proof of ownership. |

`middleware.ts` does a fast check for a missing session cookie and redirects
unauthenticated page requests to the login screen. It is a convenience layer,
**not** the security boundary — every page and API route independently resolves
the session and enforces ownership server-side.

**Cookie security** follows the request protocol, so local HTTP dev works and
Caddy-terminated HTTPS still gets a `Secure` cookie:

| Variable | Effect |
|---|---|
| (default) | `Secure` when the request arrives over HTTPS (including `x-forwarded-proto: https`) |
| `DECLUTTER_FORCE_SECURE_COOKIE=1` | always set `Secure` |
| `DECLUTTER_INSECURE_COOKIE=1` | never set `Secure` |

**Environment variables**

| Variable | Default | Purpose |
|---|---|---|
| `DECLUTTER_DATA_DIR` | `./data` | where the SQLite DB and uploads live |
| `DECLUTTER_FORCE_SECURE_COOKIE` | unset | force the `Secure` cookie flag |
| `DECLUTTER_INSECURE_COOKIE` | unset | disable the `Secure` cookie flag |

## Layout

```
app/
  (app)/           account-gated pages (dashboard, items, suggestions, wishlist)
  auth/            login and registration
  api/
    auth/          login, register, session (login/register/logout)
    items/         list, create, update, delete, restore, dispose, photo
    photos/        owner-scoped photo serving
    stats/         aggregates
    suggestions/   scored candidates
    wishlist/      list, create, update, delete, convert to inventory
  fonts.ts        self-hosted Inter + Instrument Serif via next/font/local
components/
  icons.tsx       inline SVG icon set (no icon-font dependency)
  ui.tsx          shared primitives: score gauge, stat tile, charts, empty state
  NavLinks.tsx    sidebar nav with active-route highlighting
  SignOutButton.tsx
fonts/            the .woff2 files themselves (committed, served via next/font)
lib/
  auth.ts         session resolution, cookies, server-side guards
  password.ts     scrypt hashing (kept separate from next/headers so it's testable)
  db.ts           SQLite access layer (node:sqlite), owner-scoped
  schema.sql      the schema — single source of truth, read by app and seed
  scoring.ts      the declutter heuristic
  stats.ts        stat aggregation
scripts/
  seed.mjs        sample data
  run-tests.mjs   test runner (scoring + auth suites)
tests/
  scoring.test.ts
  auth.test.ts
middleware.ts     fast missing-cookie gate (not the security boundary)
```

### Design

The UI is a custom design system, not default Tailwind:

- **Type** — Inter for UI text, Instrument Serif for display headings. Both are
  self-hosted in `fonts/` and served through `next/font/local`, so they are
  fingerprinted, preloaded, and never require a network fetch at build or run time.
- **Colour** — warm paper (`#f7f6f3`) ground, ink for text, moss for "keep",
  clay for "get rid of". Every text/background pair clears WCAG AA (4.5:1),
  verified per page.
- **Layout** — persistent 256px sidebar on desktop, top bar plus bottom tab bar
  on mobile. No horizontal overflow at 390px.
- **Charts** — earnings are an SVG line/area chart with axis and gridlines;
  declutter scores are donut gauges with severity-coloured strokes.


## Data

Everything lives in `data/`:

- `data/declutter.db` — the SQLite database
- `data/uploads/` — item photos

`data/` is gitignored. Back it up by copying the directory.

## API

All endpoints require a session cookie. Unauthenticated requests get `401`;
pages redirect to `/auth/login`. Records owned by another account return `404`.

| Method | Path | Purpose |
|---|---|---|
| POST | `/api/auth/register` | create an account (first one claims the sample data) |
| POST | `/api/auth/login` | sign in |
| GET/DELETE | `/api/auth/session` | current session / sign out |
| GET/POST | `/api/items` | list / create |
| GET/PATCH/DELETE/PUT | `/api/items/:id` | read / update / delete / restore |
| POST | `/api/items/:id/dispose` | mark sold, donated, disposed |
| POST | `/api/items/:id/photo` | upload a photo (multipart, field `photo`) |
| GET | `/api/photos/:name` | serve a photo (owner only) |
| GET | `/api/stats` | all aggregate stats |
| GET | `/api/suggestions?min=N` | scored candidates |
| GET/POST | `/api/wishlist` | list / create wishlist candidates |
| GET/PATCH/DELETE | `/api/wishlist/:id` | read / update / delete wishlist item |
| POST | `/api/wishlist/:id/convert` | move wishlist item to owned inventory |

## Tests

```bash
npm test
```

Five suites, 207 assertions:

- **scoring** (21) — signal weighting, manual overrides, duplicate detection,
  seasonal logic, and date handling.
- **auth** (32) — password hashing and verification, hashed session storage,
  session expiry, cross-account denial on read/update/delete/photo-lookup, and
  bootstrap-data claiming. Runs against a throwaway database in a temp
  directory, so it never touches your real data.
- **money** (35) — unknown (`NULL`) versus explicit zero, nullable purchase
  prices, current values and disposal proceeds, tri-state duplicate-price
  matching, and `closed` terminal items.
- **dates** (23) — local-calendar date writing and parsing, whole-day ages,
  and the DST boundaries that previously shifted a result by a day.
- **import** (96) — the StuffDB workbook mapper and the destructive write
  path, including the hidden-row accounting, unknown-vs-zero money, duplicate
  rows, and owner scoping.

## Importing a workbook

```bash
node scripts/import-stuffdb.mjs --xlsx ~/Downloads/StuffDB.xlsx --email mail@tomjt.com --dry-run
node scripts/import-stuffdb.mjs --xlsx ~/Downloads/StuffDB.xlsx --email mail@tomjt.com
```

The importer replaces the target account's inventory with every row in the
workbook — including rows hidden behind a saved AutoFilter, which is where the
sale history usually lives. It is destructive for that account only: other
accounts' items and photos are untouched.

What it guarantees:

- Missing money stays unknown (`NULL`) rather than becoming `$0`. An explicit
  `$0` in the source stays a numeric zero. The two are different facts.
- Every source row is kept, including exact duplicates. They are flagged, not
  dropped.
- `Close` maps to a `closed` terminal state — gone, but with no invented sale,
  donation, throw-out, or proceeds.
- `Sold` / `Donated` / `Thrown Out` map to `sold` / `donated` / `disposed`.
- Source-only fields (`Brand`, `Quality`, `Acquisition`, `EOL`) are preserved
  in the item notes, because the app has no dedicated columns for them.
- `Received` is read in context: proceeds for a sale, asking price for a
  listed item.

Always run with `--dry-run` first and read the plan.

## Seeding

```bash
npm run seed              # wipe and reseed, parked on the bootstrap account
npm run seed -- keep      # keep existing rows, add sample data on top
npm run seed -- you@x.com # attach the data to an existing account
```

In Docker:

```bash
docker exec declutter node scripts/seed.mjs
```

## Deploying

There's a `Dockerfile` and `docker-compose.yml` ready. It runs on host port
5010 with `./data` bind-mounted for persistence, as uid 1000 so the bind mount
stays writable without chowning it inside the container. The image ships the
schema, the seed script, and the workbook importer.

To put it behind Caddy on `declutter.tomjt.com`:

1. Add a Porkbun A record for `declutter.tomjt.com`.
2. Add a Caddy site block proxying to the container.
3. Change the Compose port mapping to `127.0.0.1:5010:3000` so only Caddy can
   reach the backend.

The app has server-side authentication and per-account isolation, so it is no
longer publishable-without-auth. Two things to sort out before exposing it
publicly: the sample data should be reseeded or removed, and you should
confirm the cookie's `Secure` flag is being set (it follows the request
protocol, so it will be behind Caddy).
