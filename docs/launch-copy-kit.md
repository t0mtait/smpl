# smpl. — Complete Launch Copy Kit & Marketing Playbook

> **Product**: smpl. (gosmpl.app)  
> **Tagline**: Know what you own. Let go of what you don't.  
> **Value Proposition**: A calm, intentional inventory companion that helps you surface idle possessions, curb impulse purchases with a 30-day cooldown, and offload what you don't need.  
> **Pricing**: Free forever tier (unlimited items, 30-day purgatory, possession analytics). Pro at $4.29/month or $34.99/year with a 14-day zero-risk free trial (AI Declutter Advisor, 30-day Wishlist cooldown tracker, unlimited custom categories, CSV/JSON backups).

---

## 1. Product Hunt Launch Kit

### Listing Essentials
- **Product Name**: smpl.
- **Tagline**: Mindful possession tracking & decluttering with a 30-day cooldown
- **Category / Topics**: Productivity, Personal Finance, Anti-Consumerism, Organization, Web App
- **Thumbnail / Icon**: Minimalist clay/terracotta tile with geometric `S` monogram (`smpl-logo.png`).
- **Direct Link**: `https://gosmpl.app`
- **Link Image Embed (Open Graph / Preview)**: `https://gosmpl.app/og-image.png` (Landing page hero: *"Mindful inventory & decluttering — Know what you own. Let go of what you don't."*)

### First Comment from Maker (Post immediately upon launch)
```markdown
Hey Product Hunt! 👋 I'm Tom, creator of smpl.

Like a lot of people, I found myself accumulating items over the years: camping gear used once every two summers, kitchen appliances bought on an impulse, duplicate cables, and tech accessories quietly collecting dust in drawers.

Spreadsheets always felt like work to maintain, and standard home inventory tools are designed for dry insurance claims rather than helping you live with less.

I built smpl. around three principles:
1. **Awareness without guilt**: Log your possessions, record their original purchase price and current value, and see exactly where your household net worth sits.
2. **The 30-day Purgatory clock**: When you’re unsure about getting rid of something, stage it in "Purgatory" and put it out of sight. A visual progress ring tracks 30 days. If you didn't miss it, you can sell or donate it with zero regret.
3. **The 30-day Wishlist Cooldown**: Instead of checking out immediately when an impulse strikes online, save the candidate to your smpl. wishlist. Giving yourself a 30-day cooling-off period eliminates 80%+ of impulse buys before they ever enter your home.

smpl. is built on Next.js and SQLite, runs with zero ads, and never sells user data. 

The core inventory tracker, analytics, and 30-day Purgatory are 100% free forever. For folks who want intelligent recommendations, our Pro plan unlocks the AI Declutter Advisor, Wishlist cooldown tracker, and full CSV/JSON data exporting with a 14-day free trial.

I'd love to hear your thoughts, feedback, and what features you’d love to see next!
```

---

## 2. Hacker News "Show HN" Kit

### Title Options
- `Show HN: smpl – A mindful possession and declutter tracker with a 30-day cooldown` *(Recommended)*
- `Show HN: I built an inventory app to curb impulse buys and track idle possessions`

### Post Body
```markdown
Hi HN,

I built smpl. (https://gosmpl.app) to solve a personal frustration: feeling weighed down by things I owned but barely used, combined with a habit of impulse shopping when browsing online.

Most home inventory apps are clunky corporate asset managers intended for insurance claims. Spreadsheets break easily, don't calculate seasonal cadence or idle duration, and lack interactive decision loops.

smpl. focuses on mindful possession lifecycles:
- **Possession Inventory**: Clean, table-based inventory with inline editing, photos, categories, acquisition dates, purchase prices, and estimated current values.
- **30-Day Purgatory**: A physical and digital holding pen. When you think you want to get rid of an item, you move it to Purgatory and put it in a closet. A 30-day timer runs. If you don't retrieve it in 30 days, you can offload it with confidence.
- **Wishlist Cooldown**: Instead of buying on impulse, potential purchases get logged into a cooldown queue with priority scoring (0–100). After 30 days, you decide whether to convert it into active inventory or discard the desire.
- **AI Declutter Heuristics**: An advisor engine that analyzes usage frequency, idle time, depreciation, and seasonal timing to highlight candidates for resale or donation.
- **Disposal History & Lifetime Proceeds**: Tracks what you sold, donated, or recycled, including realized sales earnings and net items per quarter.

Tech stack:
- Next.js 15 (App Router, React Server Components)
- SQLite with WAL mode (`node:sqlite`) for fast, zero-latency local queries
- Automated daily backups (raw SQLite snapshot + structured JSON dump)
- Zero ad tracking or behavioral analytics scripts

The core inventory app is free. Pro ($4.29/mo) unlocks the AI advisor, wishlist cooldown, and automated exports.

Would love any feedback on the UI, the mechanics, or the heuristics!
```

---

## 3. Reddit Launch Campaign

### Post 1: r/declutter & r/organization
**Title**: *I built a free tool to calculate the hidden cash value of unused items sitting in my house*
```markdown
Over the past year, I realized the hardest part of decluttering wasn’t the physical act of getting rid of stuff—it was the mental friction and the sunk cost fallacy ("I paid $200 for this, I can't just donate it").

To solve this for myself, I created a web app called **smpl.** (https://gosmpl.app).

Two features that made the biggest difference for me:
1. **The 30-Day Purgatory Rule**: Instead of forcing an immediate "keep or toss" decision, you stage items in Purgatory. You put the physical item in a designated "goodbye box" in a closet. The app runs a 30-day countdown ring. If a month passes and you didn’t need it or miss it once, parting with it feels effortless.
2. **Lifetime Sales & Recovery Tracking**: Every time you sell or donate an item, you record where it went and what you made. Watching your "Offloaded Earnings" counter go up turns decluttering from feeling like a loss into a rewarding asset-recovery process.

The basic inventory, purgatory timer, and dashboard analytics are completely free forever (no credit card required).

If anyone here tries it out, I'd love your thoughts on what would make it even more useful for your decluttering routines!
```

### Post 2: r/minimalism & r/Anticonsumption
**Title**: *Breaking the impulse shopping loop: how a 30-day cooling-off rule changed my relationship with possessions*
```markdown
A few months ago, I noticed that almost everything I ended up regretting buying had one thing in common: I bought it within 15 minutes of first seeing it online.

I started testing a strict personal rule: any non-essential item had to go onto a "30-day cooldown list" before I was allowed to purchase it.

I built a dedicated companion for this called **smpl.** (https://gosmpl.app). When you see an item you want:
- You save it to your Wishlist with a priority score (0–100).
- A 30-day cooldown ring visualizes your wait time.
- 8 times out of 10, by day 20 the initial dopamine rush is completely gone, and you delete it with a click, saving real money.
- If you still genuinely want and need it on day 31, you can purchase it guilt-free and convert it directly into your tracked inventory.

It has completely rewired how I view buying things. Hope this helps anyone trying to live a more intentional, lighter life!
```

### Post 3: r/Frugal & r/nobuy
**Title**: *We cataloged our household items and found ~$2,400 of idle stuff. How we turned it into cash.*
```markdown
Hey everyone! For our "No-Buy" challenge, my partner and I decided to take stock of everything we actually owned before buying anything new.

We ended up building a clean, simple web app called **smpl.** (https://gosmpl.app) to catalog our possessions, track purchase prices vs. current market values, and calculate how often we actually use our stuff.

The results surprised us:
- We had over 35 items that hadn't been touched in over 90 days.
- Total estimated value of those idle items was over $2,400.
- Over 3 months, we moved 18 items through our 30-day "purgatory" test, sold 12 of them on Facebook Marketplace/eBay, and generated $1,150 in cash that went directly into our emergency fund.

If you’re doing a no-buy year or want to see where your money is quietly tied up in closets and drawers, feel free to use it. The core inventory and dashboard tracking are 100% free.
```

---

## 4. Twitter / X & Threads 7-Post Launch Thread

- **Tweet 1 (Hook)**:  
  The average household has over $2,500 worth of unused items sitting in closets, drawers, and garages.  
  Most people don't declutter because of the sunk-cost fallacy.  
  I built smpl. to fix this. Here's how it works 🧵👇

- **Tweet 2 (The Problem)**:  
  Spreadsheets are tedious to maintain. Insurance apps feel like filing tax forms. And "maybe I'll need this one day" paralyzes decision-making.  
  smpl. turns your home inventory into an intentional, calm asset dashboard.

- **Tweet 3 (The 30-Day Purgatory)**:  
  Feature 1: The Purgatory Box.  
  Can't decide whether to get rid of something? Stage it in Purgatory. Put it out of sight for 30 days.  
  A visual progress ring tracks your time. If you don't miss it after 30 days, you can sell or donate it with zero guilt.

- **Tweet 4 (The 30-Day Wishlist Cooldown)**:  
  Feature 2: The Impulse Cooldown.  
  Instead of checking out immediately, add items to your smpl. Wishlist with a priority score (0–100).  
  smpl. holds them in a 30-day cooling-off period. Most desires fade by day 14. You save hundreds every month.

- **Tweet 5 (The AI Declutter Advisor)**:  
  Feature 3: The Heuristic Declutter Engine.  
  smpl. cross-references usage frequency, idle days, depreciation curves, and seasonal timing to highlight the top items you should offload first.

- **Tweet 6 (Privacy & Transparency)**:  
  Privacy-first:  
  • Zero ad tracking scripts  
  • No data selling  
  • Local SQLite speed  
  • Full CSV & JSON backups anytime  
  Your stuff stays yours.

- **Tweet 7 (CTA)**:  
  Ready to live a little lighter?  
  Create your free account in under 60 seconds at https://gosmpl.app  
  RT to help a friend declutter their space! 🌿

---

## 5. Short-Form Video Scripts (TikTok / Reels / Shorts)

### Script 1: "The 30-Day Impulse Rule"
- **Visual**: Creator sitting at desk looking at their phone, about to hit "Buy Now" on an impulse purchase.
- **Audio / Voiceover**:  
  *"Stop buying things the day you discover them. Here is the single rule that saved me over $4,000 this year: the 30-day cooling-off rule."*
- **B-Roll**: Screen recording of pasting the item into smpl.'s Wishlist, setting priority to 80, and the 30-day cooldown ring appearing.
- **Audio / Voiceover**:  
  *"Whenever I find something I want, I put it on a 30-day cooldown in smpl. If 30 days pass and I'm still thinking about it, I buy it guilt-free. But 80% of the time? By day 12, I don't care anymore. It's like an anti-impulse shield for your bank account."*
- **Call to Action**: *"Link in bio to try it free on gosmpl.app."*

### Script 2: "Auditing My Entire Apartment"
- **Visual**: Quick cuts of opening cluttered closet, camera shelf, kitchen drawer.
- **Audio / Voiceover**:  
  *"I spent one afternoon cataloging everything in my apartment to see how much money was quietly sitting unused."*
- **B-Roll**: Showing the smpl. dashboard status donut ("Kept vs. Purgatory vs. Offloaded") and total owned value.
- **Audio / Voiceover**:  
  *"I found $1,800 in stuff I hadn't touched in over 90 days. I staged them in 30-day purgatory, sold the ones I didn't miss, and made $620 cash in two weeks. Less clutter, clearer numbers."*

---

## 6. Influencer / Creator DM Pitch Template

```text
Subject: Thought you might like this minimal inventory & decluttering app (free lifetime Pro)

Hey [Name],

Love your videos on intentional living and home organization (especially your recent video on [Topic/Video Name])!

I built a calm, mindful possession tracker called smpl. (https://gosmpl.app). It’s designed specifically for people who want to own less, on purpose:
- A 30-day "Purgatory" staging clock to test whether you actually miss an item before selling/donating it.
- A 30-day Wishlist cooldown timer to stop impulse online shopping.
- Visual possession analytics & realized sales proceeds tracking.

I’d love to gift you a free lifetime Pro account if you'd like to check it out. No obligations to post or review—just thought it would genuinely resonate with your approach to intentional living.

Let me know if you'd like an upgrade code!

Best,
Tom
Founder, smpl.
```

---

## 7. Conversion Optimization: Free to Pro ($4.29/mo)

### The 3 Golden Moments of Conversion
1. **The Day 30 Purgatory Completion**: When an item completes its 30 days in Purgatory, the user feels validated. Prompt: *"Ready to find more idle items? Let the AI Advisor spot what to sell next with a 14-day free trial."*
2. **The First Avoided Impulse Purchase**: When a user lets a wishlist item expire or deletes it after cooling off: *"You just saved $85! Unlock unlimited wishlist candidates with Pro."*
3. **The Category Ceiling**: When a user adds their 5th custom category: *"You’ve unlocked 5 categories! Need unlimited organization? Start your 14-day Pro trial."*

### Reassurance Guarantee
Always reinforce: **Downgrading never loses data.** All wishlist candidates, priorities, custom categories, subcategories, and inventory history remain safely stored forever.
