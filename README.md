# smpl.

> **A mindful, self-hosted personal inventory and decluttering companion.**  
> Know what you own, curb impulse buys, and let intelligent signals guide what to let go.

---

## Overview

**smpl.** is a lightweight, privacy-first web application designed to bring clarity and intentionality to physical possessions. Instead of maintaining a passive spreadsheet, **smpl.** actively evaluates your inventory—giving you transparent, data-driven nudges on what to sell, donate, or dispose of, while tracking lifetime earnings and recovery value.

Built with **Next.js 15 (App Router)** and **Node 22's native `node:sqlite`**, it requires zero external database services, zero native binary dependencies, and runs smoothly on any basic VPS or home server.

---

## Key Features

- 📦 **Effortless Inventory Management**  
  Catalog everything you own with categories, locations, purchase prices, current estimated values, and usage history. Attach photos stored directly on disk.
  
- 🧠 **Smart Declutter Scoring (0–100)**  
  Every item receives an automated declutter score based on multi-factor heuristics (idle duration, usage frequency, low resale value, duplicates, and seasonal cadence). Every score comes with a plain-English explanation. Easily override any item with **Keep** or **Get rid of**.

- ⏳ **The 30-Day Wishlist (Impulse Buffer)**  
  Pause before you purchase. Track items you are considering buying with target prices and priorities. The built-in 30-day cooldown helps separate fleeting impulses from genuine utility, with one-click conversion to owned inventory when acquired.

- 💰 **Disposal & Sales Tracking**  
  Mark items as **Sold**, **Donated**, or **Disposed**. Record sales proceeds and marketplace channels (eBay, FB Marketplace, Buy Nothing). Items retain their history for lifetime statistics and can be restored at any time.

- 📊 **Insightful Stats & Trends**  
  Instant visibility into your total owned value, declutter conversion rate, monthly sales earnings over the last 12 months, and category-by-category breakdowns.

- 🔒 **Multi-User & Secure by Default**  
  Multi-tenant architecture with complete account isolation. Passwords hashed using `scrypt`, 32-byte cryptographic session cookies, and strict server-side ownership enforcement on all routes and photo assets.

---

## Tech Stack

- **Framework:** [Next.js 15](https://nextjs.org/) (App Router, Server Actions, API routes)
- **Runtime & Database:** [Node.js 22](https://nodejs.org/) with built-in `node:sqlite` (zero database servers or native C++ modules)
- **Styling:** [Tailwind CSS](https://tailwindcss.com/) with a bespoke, accessible Warm Paper design system (WCAG AA certified)
- **Typography:** Self-hosted *Inter* & *Instrument Serif* via `next/font/local` (fully offline, zero external font CDNs)
- **Testing:** Native Node test runner with 200+ unit and integration test assertions

---

## Quickstart

### Prerequisites

- **Node.js 22+** (required for native `node:sqlite` support)
- **npm** or **pnpm**

### 1. Clone & Install

```bash
git clone git@github.com:t0mtait/smpl.git
cd smpl
npm install
```

### 2. Seed Sample Data (Optional)

Populate 28 sample items across categories to explore the interface right away:

```bash
npm run seed
```

### 3. Start Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser. The first registered account automatically claims the seeded sample data!

---

## Production & Docker

### Standard Build

```bash
npm run build
npm start
```

### Running with Docker Compose

A ready-to-use `docker-compose.yml` and `Dockerfile` are included:

```bash
docker compose up -d
```

The container runs on port `5010` by default with persistent SQLite data and uploads stored in `./data`.

---

## How Declutter Scoring Works

Every item you own is continuously evaluated against a transparent 100-point heuristic:

| Signal | Max Points | Rationale |
|---|---|---|
| **Idle Time** | 40 | Months elapsed since the item was last used (or acquired) |
| **Never Used** | 25 | Owned for over a month with zero recorded uses |
| **Use Frequency** | 20 | Flagged if frequency is set to *Never*, *Rare*, or *Seasonal* |
| **Low Resale Value** | 15 | Low financial upside where physical storage cost outweighs value |
| **Duplicates** | 12 | Redundant possessions within the same category |
| **Out of Season** | 10 | Seasonal items lingering unused across multiple cycles |
| **Past Cadence** | 10 | Idle time significantly exceeding its expected usage interval |
| **Sunk Value** | 8 | Rapidly depreciating assets that have already lost most value |

> **Manual Overrides:**  
> - **Keep it**: Immediately resets score to `0`  
> - **Get rid of it**: Automatically sets a floor score of `85`

---

## Environment Configuration

| Variable | Default | Description |
|---|---|---|
| `SMPL_DATA_DIR` (or `DECLUTTER_DATA_DIR`) | `./data` | Directory where SQLite database and file uploads are stored |
| `SMPL_FORCE_SECURE_COOKIE` (or `DECLUTTER_FORCE_SECURE_COOKIE`) | *unset* | Force `Secure` flag on session cookies (useful behind reverse proxies) |
| `SMPL_INSECURE_COOKIE` (or `DECLUTTER_INSECURE_COOKIE`) | *unset* | Explicitly disable `Secure` cookie flag (for non-HTTPS testing) |

---

## Testing

Run the full suite of unit and integration tests (scoring heuristics, money rounding, dates/DST, and security boundaries):

```bash
npm test
```

---

## License

MIT License. Feel free to use, modify, and self-host for your personal inventory management.
