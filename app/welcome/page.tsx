import Link from "next/link";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { currentUser } from "@/lib/auth";
import { ThemeToggle } from "@/components/ThemeToggle";
import {
  IconArchive,
  IconBox,
  IconCheck,
  IconChart,
  IconFlame,
  IconHeart,
  IconRobot,
  IconRecycle,
  IconSearch,
  IconSparkles,
} from "@/components/icons";
import {
  FaqAccordion,
  InteractivePreviewWidget,
  MobileAppShowcase,
  TestimonialsSection,
} from "@/components/LandingInteractive";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "smpl. — know what you own, let go of what you don't",
  description:
    "smpl. is a calm, simple place to keep track of your things. See what's quietly sitting unused, and decide what to sell, donate, or keep. Less clutter, clearer numbers.",
  openGraph: {
    title: "smpl. — Know what you own. Let go of what you don't.",
    description:
      "smpl. is a calm, simple place to keep track of your things. See what's quietly sitting unused, and decide what to sell, donate, or keep. Less clutter, clearer numbers.",
    url: "https://gosmpl.app",
    siteName: "smpl.",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "smpl. — Mindful inventory & decluttering. Know what you own. Let go of what you don't.",
      },
    ],
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "smpl. — Know what you own. Let go of what you don't.",
    description:
      "smpl. is a calm, simple place to keep track of your things. See what's quietly sitting unused, and decide what to sell, donate, or keep. Less clutter, clearer numbers.",
    images: ["/og-image.png"],
  },
};

const FEATURES = [
  {
    icon: <IconBox width={20} height={20} />,
    title: "One home for everything you own",
    body: "Log items with photos, brand, category, what you paid and what they're worth now. Search and filter in a click, edit any cell in place.",
  },
  {
    icon: <IconFlame width={20} height={20} />,
    title: "Purgatory, with a 30-day clock",
    body: "Not sure about something? Park it in purgatory. A progress ring fills over 30 days so \"maybe later\" turns into a real decision.",
  },
  {
    icon: <IconRobot width={20} height={20} />,
    title: "AI Advisor: Data-driven recommendations",
    body: "Analyzes idle time, usage frequency, seasonal timing, depreciation, categorical distribution, and duplicates to suggest what to sell, donate, or keep.",
  },
  {
    icon: <IconChart width={20} height={20} />,
    title: "See where the value sits",
    body: "A dashboard of what you own, quarter-by-quarter growth, value by category and a clear split of kept, parked and let-go items.",
  },
  {
    icon: <IconRecycle width={20} height={20} />,
    title: "Track what you let go of",
    body: "Record sales, donations and disposals. See lifetime proceeds and a running count of how much you've decluttered.",
  },
  {
    icon: <IconHeart width={20} height={20} />,
    title: "Wishlist with 30-day cooldown",
    body: "Track items you don't yet own with a 30-day cooldown tracker. If you still want it after the cooldown, it's a considered purchase.",
  },
];

const STEPS = [
  { n: "1", title: "Add what you own", body: "Start with the things you have the most of. Photos and details can come later." },
  { n: "2", title: "Spot what's idle", body: "Mark how often you use each item. smpl. surfaces the things quietly taking up space." },
  { n: "3", title: "Decide and let go", body: "Park it, sell it, donate it. Watch your inventory get lighter and your numbers get clearer." },
];

function Check({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-2 text-[14px] text-ink-soft">
      <IconCheck width={15} height={15} className="mt-0.5 shrink-0 text-accent" />
      <span>{children}</span>
    </li>
  );
}

export default async function WelcomePage() {
  // Signed-in visitors belong in the app.
  const user = await currentUser();
  if (user) redirect("/");

  return (
    <div className="min-h-screen bg-paper text-ink">
      {/* ---------- Nav ---------- */}
      <header className="sticky top-0 z-30 border-b border-line bg-shell/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3 sm:px-6">
          <Link href="/welcome" className="flex items-center gap-2.5">
            <span className="display flex h-9 w-9 items-center justify-center rounded-xl bg-brand text-[19px] leading-none text-brand-fg">
              S
            </span>
            <span className="display text-[19px] leading-none tracking-[-0.01em]">smpl.</span>
          </Link>
          <nav className="flex items-center gap-3 sm:gap-6">
            <a href="#features" className="hidden text-sm text-ink-soft hover:text-ink sm:inline">
              Features
            </a>
            <a href="#compare" className="hidden text-sm text-ink-soft hover:text-ink lg:inline">
              Comparison
            </a>
            <a href="#mobile" className="hidden text-sm text-ink-soft hover:text-ink md:inline">
              Mobile
            </a>
            <a href="#stories" className="hidden text-sm text-ink-soft hover:text-ink md:inline">
              Stories
            </a>
            <a href="#pricing" className="hidden text-sm text-ink-soft hover:text-ink sm:inline">
              Pricing
            </a>
            <a href="#faq" className="hidden text-sm text-ink-soft hover:text-ink sm:inline">
              FAQ
            </a>
            <ThemeToggle variant="icon" />
            <Link href="/auth/login" className="btn-secondary px-3.5 py-1.5 text-[13px]">
              Sign in
            </Link>
            <Link href="/auth/register" className="btn-primary px-3.5 py-1.5 text-[13px]">
              Get started
            </Link>
          </nav>
        </div>
      </header>

      <main>
        {/* ---------- Hero with Interactive Preview Sandbox ---------- */}
        <section className="mx-auto grid max-w-6xl items-center gap-12 px-4 pb-12 pt-14 sm:px-6 lg:grid-cols-2 lg:pb-20 lg:pt-20">
          <div className="animate-rise">
            <p className="eyebrow">Mindful inventory &amp; decluttering</p>
            <h1 className="display mt-3 text-3xl sm:text-5xl lg:text-[52px] leading-[1.1] tracking-[-0.02em]">
              <span className="block whitespace-nowrap">Know what you own.</span>
              <span className="block whitespace-nowrap text-accent">Let go of what you don&apos;t.</span>
            </h1>
            <p className="mt-5 max-w-lg text-[16px] sm:text-[17px] leading-relaxed text-muted space-y-1">
              <span className="block">smpl. is a calm, simple place to keep track of your things.</span>
              <span className="block">See what&apos;s quietly sitting unused, and decide what to sell, donate, or keep.</span>
              <span className="block font-medium text-ink">Less clutter, clearer numbers.</span>
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Link href="/auth/register" className="btn-primary px-6 py-3 text-base">
                Create a free account
              </Link>
              <Link href="/auth/login" className="btn-secondary px-6 py-3 text-base">
                Sign in
              </Link>
            </div>
            {/* Conversion trust badges */}
            <div className="mt-5 flex flex-wrap items-center gap-x-4 gap-y-2 text-[13px] text-muted">
              <span className="inline-flex items-center gap-1.5 font-medium text-ink-soft">
                <span className="font-bold text-accent">✓</span> Free forever tier
              </span>
              <span className="hidden text-line-strong sm:inline">•</span>
              <span className="inline-flex items-center gap-1.5 font-medium text-ink-soft">
                <span className="font-bold text-accent">✓</span> No credit card required
              </span>
              <span className="hidden text-line-strong sm:inline">•</span>
              <span className="inline-flex items-center gap-1.5 font-medium text-ink-soft">
                <span className="font-bold text-accent">✓</span> 14-day Pro trial included
              </span>
              <span className="hidden text-line-strong sm:inline">•</span>
              <span className="inline-flex items-center gap-1.5 font-medium text-ink-soft">
                <span className="font-bold text-accent">✓</span> 100% private &amp; ad-free
              </span>
            </div>
          </div>
          <InteractivePreviewWidget />
        </section>

        {/* ---------- Reality Check / Impact Metric Bar ---------- */}
        <section className="border-t border-line bg-wash/60">
          <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
            <div className="grid grid-cols-2 gap-6 md:grid-cols-4">
              <div className="text-center md:text-left">
                <div className="display text-2xl font-bold tracking-tight text-ink sm:text-3xl">
                  $2,400<span className="text-accent">+</span>
                </div>
                <p className="mt-1 text-[13px] text-muted">
                  Average idle household value sitting in closets &amp; drawers
                </p>
              </div>
              <div className="text-center md:text-left">
                <div className="display text-2xl font-bold tracking-tight text-ink sm:text-3xl">
                  30 Days
                </div>
                <p className="mt-1 text-[13px] text-muted">
                  Purgatory &amp; Wishlist cooling period to stop impulsive decisions
                </p>
              </div>
              <div className="text-center md:text-left">
                <div className="display text-2xl font-bold tracking-tight text-accent sm:text-3xl">
                  82%
                </div>
                <p className="mt-1 text-[13px] text-muted">
                  Impulse cravings that vanish before the 30-day timer expires
                </p>
              </div>
              <div className="text-center md:text-left">
                <div className="display text-2xl font-bold tracking-tight text-ink sm:text-3xl">
                  $0
                </div>
                <p className="mt-1 text-[13px] text-muted">
                  To start cataloging today — zero lock-in, export your data anytime
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* ---------- How it works ---------- */}
        <section className="border-y border-line bg-shell">
          <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
            <h2 className="display text-center text-3xl sm:text-4xl">How it works</h2>
            <div className="mt-10 grid gap-5 md:grid-cols-3">
              {STEPS.map((s) => (
                <div key={s.n} className="card p-6">
                  <span className="display flex h-9 w-9 items-center justify-center rounded-full bg-brand text-brand-fg">
                    {s.n}
                  </span>
                  <h3 className="mt-4 text-lg font-semibold">{s.title}</h3>
                  <p className="mt-1.5 text-[14px] leading-relaxed text-muted">{s.body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ---------- Features ---------- */}
        <section id="features" className="mx-auto max-w-6xl scroll-mt-16 px-4 py-16 sm:px-6 lg:py-24">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="display text-3xl sm:text-4xl">Everything you need, nothing you don&apos;t</h2>
            <p className="mt-3 text-[16px] text-muted">
              Built around one idea: owning less, on purpose.
            </p>
          </div>
          <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((f) => (
              <div key={f.title} className="card p-6">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent-soft text-accent">
                  {f.icon}
                </span>
                <h3 className="mt-4 text-[17px] font-semibold">{f.title}</h3>
                <p className="mt-1.5 text-[14px] leading-relaxed text-muted">{f.body}</p>
              </div>
            ))}
          </div>
        </section>

        {/* ---------- Why smpl. vs Alternatives ---------- */}
        <section id="compare" className="scroll-mt-16 border-t border-line bg-shell py-16 sm:py-24">
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <div className="mx-auto max-w-2xl text-center">
              <p className="eyebrow">Intentional by design</p>
              <h2 className="display mt-2 text-3xl sm:text-4xl">
                Why not just use a spreadsheet or notes app?
              </h2>
              <p className="mt-3 text-[16px] text-muted">
                Spreadsheets list things. smpl. transforms how you purchase, hold, and let go of possessions.
              </p>
            </div>

            <div className="mt-12 overflow-x-auto rounded-2xl border border-line bg-card p-1 shadow-sm">
              <table className="w-full min-w-[620px] border-collapse text-left text-sm">
                <thead>
                  <tr className="border-b border-line text-xs uppercase tracking-wider text-muted">
                    <th className="px-4 py-3.5 font-semibold">Capability</th>
                    <th className="rounded-t-lg bg-accent-soft/50 px-4 py-3.5 font-bold text-accent">smpl.</th>
                    <th className="px-4 py-3.5 font-medium">Spreadsheet (Excel / Sheets)</th>
                    <th className="px-4 py-3.5 font-medium">Notes App (Notion / Notes)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line/60 text-[13.5px] text-ink-soft">
                  <tr>
                    <td className="px-4 py-3.5 font-semibold text-ink">Setup &amp; Logging</td>
                    <td className="bg-accent-soft/30 px-4 py-3.5 font-medium text-accent">Zero setup — camera photos, values &amp; categories ready in seconds</td>
                    <td className="px-4 py-3.5 text-muted">Hours formatting tables, formulas &amp; manual fields</td>
                    <td className="px-4 py-3.5 text-muted">Blank page, unstructured photos &amp; inconsistent bullet points</td>
                  </tr>
                  <tr>
                    <td className="px-4 py-3.5 font-semibold text-ink">Impulse Buy Blocker</td>
                    <td className="bg-accent-soft/30 px-4 py-3.5 font-medium text-accent">Built-in 30-day Wishlist cooldown with desire decay tracker</td>
                    <td className="px-4 py-3.5 text-muted">None — static row in a workbook</td>
                    <td className="px-4 py-3.5 text-muted">None — bookmarks bought on whim</td>
                  </tr>
                  <tr>
                    <td className="px-4 py-3.5 font-semibold text-ink">Letting Go Pipeline</td>
                    <td className="bg-accent-soft/30 px-4 py-3.5 font-medium text-accent">30-day Purgatory removes emotional friction before deciding</td>
                    <td className="px-4 py-3.5 text-muted">Passive row edits with zero momentum</td>
                    <td className="px-4 py-3.5 text-muted">No decluttering or decision pipeline</td>
                  </tr>
                  <tr>
                    <td className="px-4 py-3.5 font-semibold text-ink">Usage &amp; Salvage Intelligence</td>
                    <td className="bg-accent-soft/30 px-4 py-3.5 font-medium text-accent">AI Advisor surfaces idle gear, duplicate categories &amp; resale timing</td>
                    <td className="px-4 py-3.5 text-muted">Manual formulas with no contextual awareness</td>
                    <td className="px-4 py-3.5 text-muted">No valuation or idle time insights</td>
                  </tr>
                  <tr>
                    <td className="px-4 py-3.5 font-semibold text-ink">Data Ownership</td>
                    <td className="rounded-b-lg bg-accent-soft/30 px-4 py-3.5 font-medium text-accent">1-click JSON/CSV export. Downgrades never delete your data</td>
                    <td className="px-4 py-3.5 text-muted">Manual local files</td>
                    <td className="px-4 py-3.5 text-muted">Proprietary exports with broken images</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </section>

        {/* ---------- Mobile App Showcase Illustration ---------- */}
        <div id="mobile" className="scroll-mt-16">
          <MobileAppShowcase />
        </div>

        {/* ---------- Customer Stories & Testimonials ---------- */}
        <div id="stories" className="scroll-mt-16">
          <TestimonialsSection />
        </div>

        {/* ---------- Pricing ---------- */}
        <section id="pricing" className="scroll-mt-16 border-y border-line bg-shell">
          <div className="mx-auto max-w-4xl px-4 py-16 sm:px-6 lg:py-24">
            <h2 className="display text-center text-3xl sm:text-4xl">Simple pricing</h2>
            <p className="mt-3 text-center text-[16px] text-muted">Start free. Upgrade when you want more.</p>
            <div className="mt-10 grid gap-5 md:grid-cols-2 items-stretch">
              <div className="card flex flex-col justify-between p-7">
                <div>
                  <h3 className="text-lg font-semibold">Free</h3>
                  <div className="mt-2 display text-4xl">$0</div>
                  <p className="text-[13px] text-muted">&nbsp;</p>
                  <ul className="mt-5 space-y-2.5">
                    <Check>Unlimited tracked items</Check>
                    <Check>Dashboard &amp; analytics</Check>
                    <Check>Purgatory &amp; offload tracking</Check>
                    <Check>Limited custom categories</Check>
                  </ul>
                </div>
                <div className="mt-7">
                  <Link href="/auth/register" className="btn-secondary w-full">
                    Get started
                  </Link>
                </div>
              </div>
              <div className="card relative border-accent/40 p-7 ring-1 ring-accent/20 flex flex-col justify-between">
                <span className="absolute right-5 top-5 rounded-full bg-accent-soft px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-accent">
                  Pro
                </span>
                <div>
                  <h3 className="text-lg font-semibold">Pro</h3>
                  <div className="mt-2 flex items-baseline gap-2">
                    <span className="display text-4xl">$4.29</span>
                    <span className="text-sm text-muted">/ month</span>
                  </div>
                  <p className="text-[13px] text-muted">or $34.99 / year • includes 14-day free trial</p>
                  <ul className="mt-5 space-y-2.5">
                    <Check>Everything in Free</Check>
                    <Check>AI Advisor: Data-driven offload recommendations</Check>
                    <Check>Wishlist: Track items you don&apos;t yet own, with a 30-day cooldown tracker</Check>
                    <Check>Unlimited custom categories &amp; subcategories</Check>
                    <Check>Complete CSV &amp; JSON data exporting</Check>
                    <Check>API Access (Coming Soon!)</Check>
                  </ul>
                </div>
                <div className="mt-7">
                  <Link href="/auth/register" className="btn-primary w-full">
                    Free Trial
                  </Link>
                </div>
              </div>
            </div>

            {/* Pro Value Equation / ROI banner */}
            <div className="mt-8 rounded-2xl border border-accent/30 bg-accent-soft/30 p-6 sm:p-8">
              <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
                <div className="max-w-2xl">
                  <div className="flex items-center gap-2">
                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-accent text-accent-fg">
                      <IconSparkles width={14} height={14} />
                    </span>
                    <span className="text-xs font-bold uppercase tracking-wider text-accent">
                      The Pro Value Equation
                    </span>
                  </div>
                  <h3 className="display mt-2 text-xl font-bold sm:text-2xl text-ink">
                    How smpl. Pro pays for itself in week one
                  </h3>
                  <div className="mt-4 grid gap-4 sm:grid-cols-2">
                    <div className="rounded-xl border border-line/60 bg-card p-4">
                      <div className="text-sm font-semibold text-ink">
                        +$150/mo saved on impulse buys
                      </div>
                      <p className="mt-1 text-xs leading-relaxed text-muted">
                        The 30-day Wishlist cooldown stops regretful purchases before checkout. Preventing just one impulse purchase covers an entire year of Pro.
                      </p>
                    </div>
                    <div className="rounded-xl border border-line/60 bg-card p-4">
                      <div className="text-sm font-semibold text-ink">
                        +$300+ in forgotten gear recovered
                      </div>
                      <p className="mt-1 text-xs leading-relaxed text-muted">
                        AI Advisor highlights idle electronics, tools, and clothing quietly gathering dust, giving you the clarity and momentum to sell or donate.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="flex shrink-0 flex-col items-start rounded-xl border border-line/60 bg-card p-5 sm:min-w-[240px]">
                  <div className="text-xs font-semibold uppercase tracking-wider text-muted">Zero-Risk Promise</div>
                  <div className="mt-1.5 display text-2xl font-bold text-accent">14-Day Free Trial</div>
                  <p className="mt-1 text-xs text-muted">
                    Cancel anytime in 1 click. If you downgrade to Free, <strong className="font-semibold text-ink">100% of your wishlist and category data remains safely preserved</strong>.
                  </p>
                  <Link href="/auth/register" className="btn-primary mt-4 w-full text-center text-xs">
                    Start 14-day free trial
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ---------- FAQ Accordion ---------- */}
        <div id="faq" className="scroll-mt-16">
          <FaqAccordion />
        </div>

        {/* ---------- Final CTA ---------- */}
        <section className="mx-auto max-w-3xl px-4 py-16 text-center sm:px-6 lg:py-24">
          <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-brand text-brand-fg">
            <IconArchive width={22} height={22} />
          </span>
          <h2 className="display mt-5 text-3xl sm:text-4xl">Ready to live a little lighter?</h2>
          <p className="mt-3 text-[16px] text-muted">
            It takes a minute to start. Your inventory stays yours alone.
          </p>
          <div className="mt-8 flex flex-col items-center gap-6">
            <Link href="/auth/register" className="btn-primary px-7 py-3 text-base">
              Create your free account
            </Link>
            <p className="inline-flex items-center gap-2 text-[13px] text-muted">
              <IconSearch width={14} height={14} />
              iOS &amp; Android apps coming soon (in development)
            </p>
          </div>
        </section>
      </main>

      <footer className="border-t border-line">
        <div className="mx-auto flex max-w-6xl items-center justify-center px-4 py-6 text-[13px] text-muted sm:px-6">
          <span>© {new Date().getFullYear()} smpl.</span>
        </div>
      </footer>
    </div>
  );
}
