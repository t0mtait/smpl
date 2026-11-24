import Link from "next/link";
import { getStats } from "@/lib/stats";
import { listItems } from "@/lib/db";
import { formatCategory, formatMoney } from "@/lib/format";
import { requireUser } from "@/lib/auth";
import {
  BarRow,
  QuarterlyChangeChart,
} from "@/components/ui";
import { StatusDonut } from "@/components/StatusDonut";
import { UserAvatar } from "@/components/UserAvatar";
import {
  IconBox,
  IconChart,
  IconFlame,
  IconRecycle,
  IconRobot,
  IconSparkles,
} from "@/components/icons";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const user = await requireUser();
  const username = user.name?.trim() || user.email.split("@")[0] || "User";
  const possessiveName = `${username}'${username.toLowerCase().endsWith("s") ? "" : "s"}`;
  const stats = getStats(user.id);
  const allItems = listItems(user.id);
  const purgatoryItems = allItems.filter((i) => i.status === "purgatory");
  const purgatoryValue = purgatoryItems.reduce((sum, item) => sum + (item.currentValue ?? 0), 0);

  const maxCatValue = Math.max(1, ...stats.byCategory.map((c) => c.value));
  const goneCount =
    stats.soldItems + stats.donatedItems + stats.disposedItems + stats.closedItems;

  const keptCount = Math.max(0, stats.ownedItems - purgatoryItems.length);
  const noReturnCount = stats.donatedItems + stats.disposedItems + stats.closedItems;
  const statusSlices = [
    { label: "Kept", value: keptCount, stroke: "stroke-accent", dot: "bg-accent" },
    { label: "In purgatory", value: purgatoryItems.length, stroke: "stroke-clay", dot: "bg-clay" },
    { label: "Offloaded for return", value: stats.soldItems, stroke: "stroke-ink", dot: "bg-ink" },
    { label: "Offloaded for no return", value: noReturnCount, stroke: "stroke-muted", dot: "bg-muted" },
  ];

  return (
    <div className="space-y-10">
      {/* ---------------- Hero ---------------- */}
      <header className="animate-rise flex flex-wrap items-center gap-4 sm:gap-5">
        <Link href="/account" className="hidden sm:block shrink-0 transition-transform hover:scale-105" title="Manage account">
          <UserAvatar
            name={user.name}
            email={user.email}
            avatarPath={user.avatarPath}
            size={56}
            className="ring-2 ring-line"
          />
        </Link>
        <div>
          <div className="flex items-center gap-2">
            <p className="eyebrow">Dashboard</p>
            {user.plan === "premium" ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-accent-soft px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-accent">
                <IconSparkles width={10} height={10} />
                Premium
              </span>
            ) : (
              <Link
                href="/account#subscription"
                className="inline-flex items-center gap-1 rounded-full bg-paper px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-muted hover:bg-clay-soft hover:text-clay transition-colors"
                title="Upgrade to unlock premium features"
              >
                Free Plan · Upgrade
              </Link>
            )}
          </div>
          <h1 className="display mt-1 text-3xl leading-[1.1] tracking-[-0.02em] sm:text-5xl">
            {possessiveName} stuff, at a glance.
          </h1>
        </div>
        <Link
          href="/items/advisor"
          className="btn-secondary px-3 py-2 text-xs sm:px-6 sm:py-3.5 sm:text-lg font-bold sm:ml-auto shadow-sm hover:shadow flex items-center gap-1.5 sm:gap-2"
        >
          <IconRobot className="h-4 w-4 sm:h-6 sm:w-6 shrink-0" />
          <span>AI Advisor</span>
          {user.plan !== "premium" && (
            <span className="rounded bg-accent-soft px-1.5 py-0.5 text-[9px] font-bold text-accent">PRO</span>
          )}
        </Link>
      </header>

      {/* ---------------- Stat tiles beside status chart ---------------- */}
      <div className="grid gap-5 lg:grid-cols-2">
        {/* Mobile: single compact row for all 4 tiles */}
        <div className="card p-3 sm:hidden shadow-sm">
          <div className="grid grid-cols-4 divide-x divide-line text-center">
            <Link href="/items?status=owned" className="px-1 py-0.5 block hover:opacity-80">
              <div className="text-[9px] font-semibold uppercase tracking-wider text-muted">Owned</div>
              <div className="mt-1 text-base font-bold tabular text-ink leading-none">{stats.ownedItems}</div>
              <div className="mt-1 text-[9px] tabular font-medium text-moss">{formatMoney(stats.totalValueOwned)}</div>
            </Link>
            <Link href="/purgatory" className="px-1 py-0.5 block hover:opacity-80">
              <div className="text-[9px] font-semibold uppercase tracking-wider text-muted">Purgatory</div>
              <div className="mt-1 text-base font-bold tabular text-clay leading-none">{purgatoryItems.length}</div>
              <div className="mt-1 text-[9px] tabular text-muted">{purgatoryValue > 0 ? formatMoney(purgatoryValue) : "—"}</div>
            </Link>
            <Link href="/offloaded" className="px-1 py-0.5 block hover:opacity-80">
              <div className="text-[9px] font-semibold uppercase tracking-wider text-muted">Declutter</div>
              <div className="mt-1 text-base font-bold tabular text-ink leading-none">{goneCount}</div>
              <div className="mt-1 text-[9px] tabular font-medium text-accent">{formatMoney(stats.lifetimeSalesEarnings)}</div>
            </Link>
            <Link href="/items" className="px-1 py-0.5 block hover:opacity-80">
              <div className="text-[9px] font-semibold uppercase tracking-wider text-muted">Net Qtr</div>
              <div className="mt-1 text-base font-bold tabular text-ink leading-none">
                {stats.currentQuarterNet > 0 ? `+${stats.currentQuarterNet}` : stats.currentQuarterNet}
              </div>
              <div className="mt-1 text-[9px] tabular text-muted">↑{stats.currentQuarterAcquired} ↓{stats.currentQuarterOffloaded}</div>
            </Link>
          </div>
        </div>

        {/* Desktop / Tablet: Consolidated top tile (double width) + Net items tile below (double width) */}
        <div className="hidden sm:flex sm:flex-col sm:gap-4 sm:h-full">
          {/* Consolidated tile for owned, purgatory, and offloaded */}
          <div className="card p-5 sm:p-6 shadow-sm flex-1 flex flex-col justify-between">
            <div className="grid grid-cols-3 divide-x divide-line h-full items-center">
              <Link href="/items?status=owned" className="px-4 py-2 group hover:bg-wash/40 rounded-lg transition-colors flex flex-col justify-center h-full">
                <div className="flex items-center justify-between text-muted">
                  <span className="text-[11px] font-semibold uppercase tracking-wider">Items owned</span>
                  <span className="text-muted group-hover:text-ink"><IconBox width={15} height={15} /></span>
                </div>
                <div className="mt-3 flex items-baseline gap-2">
                  <span className="tabular text-3xl sm:text-4xl font-semibold leading-none text-ink">{stats.ownedItems}</span>
                  <span className="tabular text-xs font-medium text-moss" title="Total estimated value">
                    {formatMoney(stats.totalValueOwned)}
                  </span>
                </div>
              </Link>
              <Link href="/purgatory" className="px-4 py-2 group hover:bg-wash/40 rounded-lg transition-colors flex flex-col justify-center h-full">
                <div className="flex items-center justify-between text-muted">
                  <span className="text-[11px] font-semibold uppercase tracking-wider">In purgatory</span>
                  <span className="text-clay"><IconFlame width={15} height={15} /></span>
                </div>
                <div className="mt-3 flex items-baseline gap-2">
                  <span className="tabular text-3xl sm:text-4xl font-semibold leading-none text-ink">{purgatoryItems.length}</span>
                  {purgatoryValue > 0 && (
                    <span className="tabular text-xs font-medium text-muted">
                      {formatMoney(purgatoryValue)}
                    </span>
                  )}
                </div>
              </Link>
              <Link href="/offloaded" className="px-4 py-2 group hover:bg-wash/40 rounded-lg transition-colors flex flex-col justify-center h-full">
                <div className="flex items-center justify-between text-muted">
                  <span className="text-[11px] font-semibold uppercase tracking-wider">Decluttered</span>
                  <span className="text-moss"><IconRecycle width={15} height={15} /></span>
                </div>
                <div className="mt-3 flex items-baseline gap-2">
                  <span className="tabular text-3xl sm:text-4xl font-semibold leading-none text-ink">{goneCount}</span>
                  <span className="tabular text-xs font-medium text-accent" title="Total sales proceeds">
                    {formatMoney(stats.lifetimeSalesEarnings)}
                  </span>
                </div>
              </Link>
            </div>
          </div>

          {/* Net items & Declutter rate tile below it, double its width as well */}
          <div className="card p-5 sm:p-6 shadow-sm flex-1 flex flex-col justify-between">
            <div className="grid grid-cols-2 divide-x divide-line h-full items-center">
              <Link href="/items" className="px-4 py-2 group hover:bg-wash/40 rounded-lg transition-colors flex flex-col justify-center h-full">
                <div className="flex items-center justify-between text-muted">
                  <span className="text-[11px] font-semibold uppercase tracking-wider">Net items ({stats.currentQuarter})</span>
                  <span className="text-muted group-hover:text-ink"><IconChart width={15} height={15} /></span>
                </div>
                <div className="mt-3 flex items-baseline gap-2.5">
                  <span className={`tabular text-3xl sm:text-4xl font-semibold leading-none ${
                    stats.currentQuarterNet > 0 ? "text-clay" : stats.currentQuarterNet < 0 ? "text-moss" : "text-ink"
                  }`}>
                    {stats.currentQuarterNet > 0 ? `+${stats.currentQuarterNet}` : stats.currentQuarterNet}
                  </span>
                  <span className="inline-flex items-center gap-1.5 text-xs font-medium text-muted tabular">
                    <span className="inline-flex items-center text-clay" title={`${stats.currentQuarterAcquired} acquired`}>
                      ↑{stats.currentQuarterAcquired} acquired
                    </span>
                    <span className="inline-flex items-center text-accent" title={`${stats.currentQuarterOffloaded} offloaded`}>
                      ↓{stats.currentQuarterOffloaded} offloaded
                    </span>
                  </span>
                </div>
              </Link>
              <Link href="/offloaded" className="px-4 py-2 group hover:bg-wash/40 rounded-lg transition-colors flex flex-col justify-center h-full">
                <div className="flex items-center justify-between text-muted">
                  <span className="text-[11px] font-semibold uppercase tracking-wider">Declutter rate</span>
                  <span className="text-moss group-hover:text-ink"><IconSparkles width={15} height={15} /></span>
                </div>
                <div className="mt-3 flex items-baseline gap-2">
                  <span className="tabular text-3xl sm:text-4xl font-semibold leading-none text-ink">
                    {stats.declutterRate}%
                  </span>
                  <span className="tabular text-xs font-medium text-muted" title={`${goneCount} of ${stats.totalItems} items offloaded`}>
                    {goneCount} of {stats.totalItems} offloaded
                  </span>
                </div>
              </Link>
            </div>
          </div>
        </div>

        {/* ---------------- Status breakdown ---------------- */}
        <section className="card flex flex-col p-6">
          <div className="mb-1 flex items-baseline justify-between gap-3">
            <h2 className="display text-xl">Where your items stand</h2>
            <span className="text-xs text-muted">all time</span>
          </div>
          <p className="hidden sm:block mb-4 text-[13px] text-muted">Every item you have tracked, by current status.</p>
          <StatusDonut slices={statusSlices} />
        </section>
      </div>

      {/* ---------------- Quarterly Change & Category breakdown ---------------- */}
      <div className="grid gap-5 lg:grid-cols-5">
        <section className="card flex flex-col justify-between p-6 lg:col-span-3">
          <div>
            <div className="mb-1 flex items-baseline justify-between gap-3">
              <h2 className="display text-xl">Quarterly growth</h2>
            </div>
          </div>
          <div className="mt-auto pt-2">
            <QuarterlyChangeChart data={stats.quarterlyChange} />
          </div>
        </section>

        <section className="card p-6 lg:col-span-2">
          <div className="mb-1 flex items-baseline justify-between gap-3">
            <h2 className="display text-xl">Where the value sits</h2>
            <span className="text-xs text-muted">owned</span>
          </div>
          <p className="mb-3 text-[13px] text-muted">by category</p>
          {stats.byCategory.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted">Nothing tracked yet.</p>
          ) : (
            <div className="space-y-2.5">
              {stats.byCategory.slice(0, 6).map((cat, i) => (
                <BarRow
                  key={cat.category}
                  label={formatCategory(cat.category)}
                  value={cat.value}
                  valueDisplay={formatMoney(cat.value)}
                  max={maxCatValue}
                  suffix={` · ${cat.count}`}
                  tone={i === 0 ? "clay" : "moss"}
                />
              ))}
            </div>
          )}
        </section>
      </div>


    </div>
  );
}
