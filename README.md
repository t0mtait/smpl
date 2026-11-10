# Declutter

Track every possession you own, get a nudge about what to get rid of, and keep
a running record of what you sold, donated, and threw away.

Built as a single-user self-hosted app: Next.js 15 (App Router) + SQLite via
Node 22's built-in `node:sqlite`. No database server, no native modules, no
external services.

## Run it

```bash
npm install
npm run seed     # optional: 24 sample items so the screens aren't empty
npm run dev      # http://localhost:3000
```

Production:

```bash
npm run build
npm start
```

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

**Alerts** — recurring declutter prompts on a cadence you choose ("review the
garage shelves" every 30 days). Overdue alerts surface on their own page.

## Layout

```
app/
  api/            REST endpoints (items, disposals, photos, stats, suggestions, alerts)
  fonts.ts        self-hosted Inter + Instrument Serif via next/font/local
  items/          inventory list, add/edit form, item detail
  suggestions/    scored declutter candidates
  alerts/         recurring declutter prompts
components/
  icons.tsx       inline SVG icon set (no icon-font dependency)
  ui.tsx          shared primitives: score gauge, stat tile, charts, empty state
  NavLinks.tsx    sidebar nav with active-route highlighting
fonts/            the .woff2 files themselves (committed, served via next/font)
lib/
  db.ts           SQLite access layer (node:sqlite)
  schema.sql      the schema — single source of truth, read by app and seed
  scoring.ts      the declutter heuristic
  stats.ts        stat aggregation
scripts/
  seed.mjs        sample data
  run-tests.mjs   scoring test runner
tests/
  scoring.test.ts
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

| Method | Path | Purpose |
|---|---|---|
| GET/POST | `/api/items` | list / create |
| GET/PATCH/DELETE/PUT | `/api/items/:id` | read / update / delete / restore |
| POST | `/api/items/:id/dispose` | mark sold, donated, disposed |
| POST | `/api/items/:id/photo` | upload a photo (multipart, field `photo`) |
| GET | `/api/photos/:name` | serve a photo |
| GET | `/api/stats` | all aggregate stats |
| GET | `/api/suggestions?min=N` | scored candidates |
| GET/POST/PATCH/DELETE | `/api/alerts` | recurring declutter prompts |

## Tests

```bash
npm test
```

16 assertions over the scoring engine — signal weighting, manual overrides,
duplicate detection, seasonal logic, and date handling.

## Deploying

There's a `Dockerfile` and `docker-compose.yml` ready. It runs on host port
5010 with `./data` bind-mounted for persistence. To put it behind Caddy on
`declutter.tomjt.com`, add the site block and a Porkbun A record, and add
server-side auth — the app has no authentication of its own, so don't publish
it without one.
