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
    "smpl. is a mindful personal inventory and decluttering companion. Track what you own, spot what sits unused, and let go with confidence.",
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
    title: "An AI advisor that nudges you",
    body: "smpl. looks at how often you use things, their value and how long they've sat idle, then suggests what to sell, donate or keep.",
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
    title: "A wishlist to curb impulse buys",
    body: "Park the things you want before you buy them. If you still want it later, it's a considered purchase.",
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
        <section className="mx-auto grid max-w-6xl items-center gap-12 px-4 pb-16 pt-14 sm:px-6 lg:grid-cols-2 lg:pb-24 lg:pt-20">
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
          </div>
          <InteractivePreviewWidget />
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
                    <Check>AI advisor suggestions</Check>
                    <Check>Wishlist</Check>
                    <Check>Unlimited categories &amp; subcategories</Check>
                    <Check>Data export</Check>
                  </ul>
                </div>
                <div className="mt-7">
                  <Link href="/auth/register" className="btn-primary w-full">
                    Free Trial
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
