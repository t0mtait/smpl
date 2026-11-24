import Link from "next/link";
import { getStats } from "@/lib/stats";
import { listItems } from "@/lib/db";
import { formatCategory, formatMoney } from "@/lib/format";
import { requireUser } from "@/lib/auth";
import {
  BarRow,
  QuarterlyChangeChart,
  StatTile,
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
  const statusSlices = [
    { label: "Kept", value: keptCount, stroke: "stroke-accent", dot: "bg-accent" },
    { label: "In purgatory", value: purgatoryItems.length, stroke: "stroke-clay", dot: "bg-clay" },
    { label: "Sold", value: stats.soldItems, stroke: "stroke-ink", dot: "bg-ink" },
    { label: "Donated", value: stats.donatedItems, stroke: "stroke-ink-soft", dot: "bg-ink-soft" },
    { label: "Disposed", value: stats.disposedItems, stroke: "stroke-muted", dot: "bg-muted" },
    { label: "Closed", value: stats.closedItems, stroke: "stroke-line", dot: "bg-line" },
  ];

  return (
    <div className="space-y-10">
      {/* ---------------- Hero ---------------- */}
      <header className="animate-rise flex flex-wrap items-center gap-4 sm:gap-5">
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
        <Link
          href="/items/advisor"
          className="btn-secondary px-5 py-3 text-base font-semibold sm:ml-auto"
        >
          <IconRobot width={22} height={22} />
          AI Advisor
          {user.plan !== "premium" && (
            <span className="rounded bg-accent-soft px-1.5 py-0.5 text-[9px] font-bold text-accent">PRO</span>
          )}
        </Link>
      </header>

      {/* ---------------- Stat tiles (2x2) beside status chart ---------------- */}
      <div className="grid gap-5 lg:grid-cols-2">
        <div className="grid grid-cols-2 grid-rows-2 gap-4">
          <StatTile
            label="Items owned"
            value={
              <div className="flex items-baseline gap-2.5">
                <span className="tabular text-3xl font-semibold leading-none">{stats.ownedItems}</span>
                <span className="tabular text-xs font-medium text-moss" title="Total estimated value">
                  {formatMoney(stats.totalValueOwned)}
                </span>
              </div>
            }
            icon={<IconBox width={15} height={15} />}
            href="/items?status=owned"
          />
          <StatTile
            label={`Net items (${stats.currentQuarter})`}
            value={
              <div className="flex items-baseline gap-2.5">
                <span className="tabular text-3xl font-semibold leading-none">
                  {stats.currentQuarterNet > 0 ? `+${stats.currentQuarterNet}` : stats.currentQuarterNet}
                </span>
                <span className="inline-flex items-center gap-1.5 text-xs font-medium text-muted tabular">
                  <span className="inline-flex items-center text-clay" title={`${stats.currentQuarterAcquired} acquired`}>
                    ↑{stats.currentQuarterAcquired}
                  </span>
                  <span className="inline-flex items-center text-accent" title={`${stats.currentQuarterOffloaded} offloaded`}>
                    ↓{stats.currentQuarterOffloaded}
                  </span>
                </span>
              </div>
            }
            icon={<IconChart width={15} height={15} />}
            tone={stats.currentQuarterNet > 0 ? "clay" : stats.currentQuarterNet < 0 ? "moss" : "neutral"}
            href="/items"
          />
          <StatTile
            label="In purgatory"
            value={
              <div className="flex items-baseline gap-2.5">
                <span className="tabular text-3xl font-semibold leading-none">{purgatoryItems.length}</span>
                {purgatoryValue > 0 && (
                  <span className="tabular text-xs font-medium text-muted">
                    {formatMoney(purgatoryValue)}
                  </span>
                )}
              </div>
            }
            icon={<IconFlame width={15} height={15} />}
            tone="clay"
            href="/purgatory"
          />
          <StatTile
            label="Decluttered"
            value={
              <div className="flex items-baseline gap-2.5">
                <span className="tabular text-3xl font-semibold leading-none">{goneCount}</span>
                <span className="tabular text-xs font-medium text-accent" title="Total sales proceeds">
                  {formatMoney(stats.lifetimeSalesEarnings)}
                </span>
              </div>
            }
            icon={<IconRecycle width={15} height={15} />}
            tone="moss"
            href="/offloaded"
          />
        </div>

        {/* ---------------- Status breakdown ---------------- */}
        <section className="card flex flex-col p-6">
          <div className="mb-1 flex items-baseline justify-between gap-3">
            <h2 className="display text-xl">Where your items stand</h2>
            <span className="text-xs text-muted">all time</span>
          </div>
          <p className="mb-4 text-[13px] text-muted">Every item you have tracked, by current status.</p>
          <StatusDonut slices={statusSlices} />
        </section>
      </div>

      {/* ---------------- Quarterly Change & Category breakdown ---------------- */}
      <div className="grid gap-5 lg:grid-cols-5">
        <section className="card flex flex-col justify-between p-6 lg:col-span-3">
          <div>
            <div className="mb-1 flex items-baseline justify-between gap-3">
              <h2 className="display text-xl">Quarterly inventory & value growth (%)</h2>
              <span className="text-xs text-muted">last 8 quarters</span>
            </div>
            <p className="mb-3 text-[13px] text-muted">
              Quarter-over-quarter percentage change in total estimated value ($) and item count.
            </p>
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


      <p className="pb-2 text-center text-[12px] text-muted">
        iOS &amp; Android apps coming soon.
      </p>
    </div>
  );
}
