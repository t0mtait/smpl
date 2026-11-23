import Link from "next/link";
import { getStats } from "@/lib/stats";
import { listDisposals, listItems } from "@/lib/db";
import { formatCategory, formatMoney, formatQuarter } from "@/lib/format";
import { requireUser } from "@/lib/auth";
import {
  BarRow,
  EarningsChart,
  PossessionsChart,
  QuarterlyChangeChart,
  StatTile,
} from "@/components/ui";
import { UserAvatar } from "@/components/UserAvatar";
import {
  IconBox,
  IconCash,
  IconChart,
  IconFlame,
  IconLeaf,
  IconRecycle,
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

  const disposals = listDisposals(user.id);
  const soldForReturn = disposals.filter(
    (d) => d.disposition === "sold" && d.amount !== null && d.amount > 0
  );
  const soldForReturnCount = soldForReturn.length;
  const soldForReturnTotal = soldForReturn.reduce((sum, d) => sum + (d.amount ?? 0), 0);
  const noReturnCount = Math.max(0, goneCount - soldForReturnCount);

  return (
    <div className="space-y-10">
      {/* ---------------- Hero ---------------- */}
      <header className="animate-rise flex items-center gap-4 sm:gap-5">
        <Link href="/account" className="shrink-0 transition-transform hover:scale-105" title="Manage account">
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
      </header>

      {/* ---------------- Stat tiles ---------------- */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
        <StatTile
          label="Items owned"
          value={<span className="text-3xl font-semibold leading-none">{stats.ownedItems}</span>}
          icon={<IconBox width={15} height={15} />}
          href="/items?status=owned"
        />
        <StatTile
          label="Value owned"
          value={<span className="text-3xl font-semibold leading-none">{formatMoney(stats.totalValueOwned)}</span>}
          sub={
            stats.ownedWithoutValue > 0
              ? `${stats.ownedItems - stats.ownedWithoutValue} of ${stats.ownedItems} items valued`
              : `avg ${formatMoney(stats.averageOwnedValue)} per item`
          }
          icon={<IconLeaf width={15} height={15} />}
          tone="moss"
          href="/items?status=owned"
        />
        <StatTile
          label={`Net items (${stats.currentQuarter})`}
          value={
            <span className="tabular text-3xl font-semibold leading-none">
              {stats.currentQuarterNet > 0 ? `+${stats.currentQuarterNet}` : stats.currentQuarterNet}
            </span>
          }
          sub={`${stats.currentQuarterAcquired} in · ${stats.currentQuarterOffloaded} out`}
          icon={<IconChart width={15} height={15} />}
          tone={stats.currentQuarterNet > 0 ? "clay" : stats.currentQuarterNet < 0 ? "moss" : "neutral"}
          href="/items"
        />
        <StatTile
          label="In purgatory"
          value={<span className="text-3xl font-semibold leading-none">{purgatoryItems.length}</span>}
          sub={formatMoney(purgatoryValue)}
          icon={<IconFlame width={15} height={15} />}
          tone="clay"
          href="/purgatory"
        />
        <StatTile
          label="Lifetime sales"
          value={<span className="text-3xl font-semibold leading-none">{formatMoney(stats.lifetimeSalesEarnings)}</span>}
          icon={<IconCash width={15} height={15} />}
          tone="moss"
          href="/items?status=sold"
        />
        <StatTile
          label="Decluttered"
          value={<span className="text-3xl font-semibold leading-none">{goneCount}</span>}
          icon={<IconRecycle width={15} height={15} />}
          tone="clay"
          href="/items"
        />
      </div>

      {/* ---------------- Possessions over time & Category breakdown ---------------- */}
      <div className="grid gap-5 lg:grid-cols-5">
        <section className="card flex flex-col justify-between p-6 lg:col-span-3">
          <div>
            <div className="mb-1 flex items-baseline justify-between gap-3">
              <h2 className="display text-xl">Possessions over time</h2>
              <span className="text-xs text-muted">last 8 quarters</span>
            </div>
            <p className="mb-3 text-[13px] text-muted">
              {stats.ownedItems} items owned today · {stats.currentQuarterNet > 0 ? `+${stats.currentQuarterNet}` : stats.currentQuarterNet} net in {stats.currentQuarter}
            </p>
          </div>
          <div className="mt-auto pt-2">
            <PossessionsChart data={stats.possessionsOverTime} />
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
                  max={maxCatValue}
                  suffix={` · ${cat.count}`}
                  tone={i === 0 ? "clay" : "moss"}
                />
              ))}
            </div>
          )}
        </section>
      </div>

      {/* ---------------- Quarterly Change (% Value vs % Items) ---------------- */}
      <section className="card p-6">
        <div className="mb-1 flex items-baseline justify-between gap-3">
          <h2 className="display text-xl">Quarterly inventory & value growth (%)</h2>
          <span className="text-xs text-muted">last 8 quarters</span>
        </div>
        <p className="mb-3 text-[13px] text-muted">
          Quarter-over-quarter percentage change in total estimated value ($) and item count.
        </p>
        <div className="pt-2">
          <QuarterlyChangeChart data={stats.quarterlyChange} />
        </div>
      </section>

      {/* ---------------- Earnings & Disposals ---------------- */}
      <div className="grid gap-5 lg:grid-cols-5">
        <section className="card flex flex-col justify-between p-6 lg:col-span-3">
          <div>
            <div className="mb-1 flex items-baseline justify-between gap-3">
              <h2 className="display text-xl">Sales earnings</h2>
              <span className="text-xs text-muted">last 12 months</span>
            </div>
            <p className="mb-3 text-[13px] text-muted">
              {formatMoney(stats.lifetimeSalesEarnings)} earned all-time
            </p>
          </div>
          <div className="mt-auto pt-2">
            <EarningsChart data={stats.earningsByMonth} />
          </div>
        </section>

        <section className="card flex flex-col justify-between p-6 lg:col-span-2">
          <div>
            <div className="mb-1 flex items-baseline justify-between gap-3">
              <h2 className="display text-xl">Offloaded items</h2>
              <span className="text-xs text-muted">{goneCount} total</span>
            </div>
            <p className="mb-3 text-[13px] text-muted">Sales proceeds and decluttered goods</p>
          </div>
          <div className="grid grid-cols-1 gap-2.5">
            <Link
              href="/items?status=sold"
              className="group flex items-center gap-3.5 rounded-xl border border-line p-3 transition-all hover:border-line-strong hover:shadow-lift"
            >
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-accent-soft text-accent">
                <IconCash width={16} height={16} />
              </span>
              <div className="min-w-0">
                <p className="text-[12px] font-medium text-ink">Sold for return</p>
                <p className="tabular text-xl font-semibold leading-tight text-ink">{soldForReturnCount}</p>
                <p className="tabular text-[11px] text-accent">
                  {formatMoney(soldForReturnTotal)} total proceeds
                </p>
              </div>
            </Link>

            <Link
              href="/items"
              className="group flex items-center gap-3.5 rounded-xl border border-line p-3 transition-all hover:border-line-strong hover:shadow-lift"
            >
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-clay-soft text-clay">
                <IconRecycle width={16} height={16} />
              </span>
              <div className="min-w-0">
                <p className="text-[12px] font-medium text-ink">No return</p>
                <p className="tabular text-xl font-semibold leading-tight text-ink">{noReturnCount}</p>
                <p className="tabular text-[11px] text-muted">
                  Donated, disposed, or $0 return
                </p>
              </div>
            </Link>
          </div>
        </section>
      </div>
    </div>
  );
}
