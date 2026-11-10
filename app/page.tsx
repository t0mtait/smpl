import Link from "next/link";
import { getStats } from "@/lib/stats";
import { scoreAll } from "@/lib/scoring";
import { listItems } from "@/lib/db";
import { formatMoney, relativeDays } from "@/lib/format";
import { BarRow, EarningsChart, ItemPhoto, ScoreRing, StatTile } from "@/components/ui";
import {
  IconBox,
  IconCash,
  IconHeart,
  IconLeaf,
  IconRecycle,
  IconSparkles,
} from "@/components/icons";

export const dynamic = "force-dynamic";

const DISPOSITION_META: Record<string, { icon: React.ReactNode; tone: string; label: string }> = {
  sold: { icon: <IconCash width={16} height={16} />, tone: "bg-moss-50 text-moss-600", label: "Sold" },
  donated: { icon: <IconHeart width={16} height={16} />, tone: "bg-sky-50 text-sky-600", label: "Donated" },
  disposed: { icon: <IconRecycle width={16} height={16} />, tone: "bg-clay-50 text-clay-500", label: "Disposed" },
};

export default function DashboardPage() {
  const stats = getStats();
  const suggestions = scoreAll(listItems()).filter((s) => s.score > 0).slice(0, 5);
  const maxCatValue = Math.max(1, ...stats.byCategory.map((c) => c.value));
  const goneCount = stats.soldItems + stats.donatedItems + stats.disposedItems;

  return (
    <div className="space-y-10">
      {/* ---------------- Hero ---------------- */}
      <header className="animate-rise">
        <p className="eyebrow">Dashboard</p>
        <h1 className="display mt-2 text-4xl leading-[1.1] sm:text-5xl">
          Your stuff, at a glance.
        </h1>
        <p className="mt-3 max-w-xl text-[15px] leading-relaxed text-muted">
          {stats.neverUsed > 0 ? (
            <>
              <span className="font-medium text-ink">
                {stats.neverUsed} item{stats.neverUsed === 1 ? "" : "s"} never opened
              </span>{" "}
              · {stats.idleOver90Days} sitting untouched for 90+ days.
            </>
          ) : (
            <>Everything you own has been touched at least once. Nice.</>
          )}
        </p>
      </header>

      {/* ---------------- Stat tiles ---------------- */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatTile
          label="Items owned"
          value={<span className="text-3xl font-semibold leading-none">{stats.ownedItems}</span>}
          sub={`${stats.totalItems} tracked all-time`}
          icon={<IconBox width={15} height={15} />}
          href="/items?status=owned"
        />
        <StatTile
          label="Value owned"
          value={<span className="text-3xl font-semibold leading-none">{formatMoney(stats.totalValueOwned)}</span>}
          sub={`avg ${formatMoney(stats.averageOwnedValue)} per item`}
          icon={<IconLeaf width={15} height={15} />}
          tone="moss"
          href="/items?status=owned"
        />
        <StatTile
          label="Lifetime sales"
          value={<span className="text-3xl font-semibold leading-none">{formatMoney(stats.lifetimeSalesEarnings)}</span>}
          sub={`${stats.soldItems} item${stats.soldItems === 1 ? "" : "s"} sold`}
          icon={<IconCash width={15} height={15} />}
          tone="moss"
          href="/items?status=sold"
        />
        <StatTile
          label="Decluttered"
          value={<span className="text-3xl font-semibold leading-none">{stats.declutterRate}%</span>}
          sub={`${goneCount} item${goneCount === 1 ? "" : "s"} gone`}
          icon={<IconRecycle width={15} height={15} />}
          tone="clay"
          href="/items?status=donated"
        />
      </div>

      {/* ---------------- Charts ---------------- */}
      <div className="grid gap-5 lg:grid-cols-5">
        <section className="card p-6 lg:col-span-3">
          <div className="mb-1 flex items-baseline justify-between gap-3">
            <h2 className="display text-xl">Sales earnings</h2>
            <span className="text-xs text-muted">last 12 months</span>
          </div>
          <p className="mb-4 text-[13px] text-muted">
            {formatMoney(stats.lifetimeSalesEarnings)} earned all-time
          </p>
          <EarningsChart data={stats.earningsByMonth} />
        </section>

        <section className="card p-6 lg:col-span-2">
          <div className="mb-1 flex items-baseline justify-between gap-3">
            <h2 className="display text-xl">Where the value sits</h2>
            <span className="text-xs text-muted">owned</span>
          </div>
          <p className="mb-5 text-[13px] text-muted">by category</p>
          {stats.byCategory.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted">Nothing tracked yet.</p>
          ) : (
            <div className="space-y-3.5">
              {stats.byCategory.slice(0, 7).map((cat, i) => (
                <BarRow
                  key={cat.category}
                  label={cat.category}
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

      {/* ---------------- Suggestions ---------------- */}
      <section className="card overflow-hidden">
        <div className="flex items-center justify-between gap-3 border-b border-line px-6 py-5">
          <div>
            <h2 className="display text-xl">Strongest candidates</h2>
            <p className="mt-0.5 text-[13px] text-muted">Highest-scoring things to get rid of</p>
          </div>
          <Link
            href="/suggestions"
            className="btn-secondary shrink-0 text-[13px]"
          >
            See all
            <IconSparkles width={15} height={15} />
          </Link>
        </div>

        {suggestions.length === 0 ? (
          <p className="px-6 py-14 text-center text-sm text-muted">
            Nothing flagged. Track some items and use them — the list fills itself in.
          </p>
        ) : (
          <ul className="divide-y divide-line">
            {suggestions.map((s) => (
              <li key={s.item.id}>
                <Link
                  href={`/items/${s.item.id}`}
                  className="group flex items-center gap-4 px-6 py-4 transition-colors hover:bg-paper"
                >
                  <ScoreRing score={s.score} size={46} stroke={4.5} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium text-ink group-hover:text-moss-600">
                      {s.item.name}
                    </p>
                    <p className="mt-0.5 truncate text-[13px] text-muted">
                      {s.reasons.map((r) => r.label).join(" · ") || "—"}
                    </p>
                  </div>
                  <div className="hidden shrink-0 text-right sm:block">
                    <p className="tabular text-sm font-medium text-ink">{formatMoney(s.item.currentValue)}</p>
                    <p className="text-xs text-muted">last used {relativeDays(s.idleDays)}</p>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* ---------------- Disposal record ---------------- */}
      <section className="card p-6">
        <div className="mb-5 flex items-baseline justify-between gap-3">
          <h2 className="display text-xl">Lifetime disposal record</h2>
          <span className="text-xs text-muted">everything that left</span>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {stats.disposalBreakdown.map((d) => {
            const meta = DISPOSITION_META[d.disposition];
            return (
              <Link
                key={d.disposition}
                href={`/items?status=${d.disposition}`}
                className="group flex items-center gap-4 rounded-xl border border-line p-4 transition-all hover:border-ink-300 hover:shadow-lift"
              >
                <span
                  className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${meta.tone}`}
                >
                  {meta.icon}
                </span>
                <div className="min-w-0">
                  <p className="text-[13px] font-medium text-ink">{meta.label}</p>
                  <p className="tabular text-2xl font-semibold leading-tight text-ink">{d.count}</p>
                  {d.disposition === "sold" ? (
                    <p className="tabular text-xs text-moss-600">{formatMoney(d.amount)} earned</p>
                  ) : d.amount > 0 ? (
                    <p className="tabular text-xs text-muted">{formatMoney(d.amount)} value</p>
                  ) : null}
                </div>
              </Link>
            );
          })}
        </div>
      </section>
    </div>
  );
}
