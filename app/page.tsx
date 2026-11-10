import Link from "next/link";
import { getStats } from "@/lib/stats";
import { scoreAll } from "@/lib/scoring";
import { listItems } from "@/lib/db";
import { formatMoney, relativeDays } from "@/lib/format";

export const dynamic = "force-dynamic";

export default function DashboardPage() {
  const stats = getStats();
  const suggestions = scoreAll(listItems()).filter((s) => s.score > 0).slice(0, 5);
  const maxEarn = Math.max(1, ...stats.earningsByMonth.map((m) => m.amount));

  const statCards = [
    {
      label: "Items owned",
      value: String(stats.ownedItems),
      hint: `${stats.totalItems} tracked all-time`,
      href: "/items?status=owned",
    },
    {
      label: "Value owned",
      value: formatMoney(stats.totalValueOwned),
      hint: `avg ${formatMoney(stats.averageOwnedValue)} per item`,
      href: "/items?status=owned",
    },
    {
      label: "Lifetime sales",
      value: formatMoney(stats.lifetimeSalesEarnings),
      hint: `${stats.soldItems} item${stats.soldItems === 1 ? "" : "s"} sold`,
      href: "/items?status=sold",
    },
    {
      label: "Decluttered",
      value: `${stats.declutterRate}%`,
      hint: `${stats.ownedItems + stats.soldItems + stats.donatedItems + stats.disposedItems > 0 ? stats.soldItems + stats.donatedItems + stats.disposedItems : 0} items gone`,
      href: "/items?status=donated",
    },
  ];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Your stuff, at a glance</h1>
        <p className="mt-1 text-sm text-ink-500">
          {stats.neverUsed} item{stats.neverUsed === 1 ? "" : "s"} never used ·{" "}
          {stats.idleOver90Days} idle for 90+ days
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {statCards.map((card) => (
          <Link key={card.label} href={card.href} className="card transition-shadow hover:shadow-md">
            <p className="text-xs font-medium uppercase tracking-wide text-ink-500">{card.label}</p>
            <p className="mt-2 text-2xl font-semibold tabular-nums">{card.value}</p>
            <p className="mt-1 text-xs text-ink-400">{card.hint}</p>
          </Link>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="card">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-semibold">Sales earnings</h2>
            <span className="text-xs text-ink-400">last 12 months</span>
          </div>
          {stats.lifetimeSalesEarnings === 0 ? (
            <p className="py-8 text-center text-sm text-ink-400">
              No sales yet. Mark an item as sold and it shows up here.
            </p>
          ) : (
            <div className="flex h-40 items-end gap-1.5">
              {stats.earningsByMonth.map((m) => (
                <div key={m.month} className="flex flex-1 flex-col items-center gap-1">
                  <div
                    className="w-full rounded-t bg-moss-500/70"
                    style={{ height: `${Math.max(2, (m.amount / maxEarn) * 100)}%` }}
                    title={`${m.month}: ${formatMoney(m.amount)}`}
                  />
                  <span className="text-[10px] text-ink-400">{m.month.slice(5)}</span>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="card">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-semibold">Where the value sits</h2>
            <span className="text-xs text-ink-400">owned, by category</span>
          </div>
          {stats.byCategory.length === 0 ? (
            <p className="py-8 text-center text-sm text-ink-400">
              Nothing tracked yet. Add your first item.
            </p>
          ) : (
            <ul className="space-y-2">
              {stats.byCategory.slice(0, 7).map((cat) => {
                const pct = stats.totalValueOwned > 0 ? (cat.value / stats.totalValueOwned) * 100 : 0;
                return (
                  <li key={cat.category}>
                    <div className="flex items-baseline justify-between text-sm">
                      <span className="capitalize">{cat.category}</span>
                      <span className="tabular-nums text-ink-500">
                        {formatMoney(cat.value)} · {cat.count}
                      </span>
                    </div>
                    <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-ink-100">
                      <div className="h-full rounded-full bg-moss-500" style={{ width: `${pct}%` }} />
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>

      <section className="card">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-semibold">Strongest candidates to get rid of</h2>
          <Link href="/suggestions" className="text-sm font-medium text-moss-700 hover:underline">
            See all →
          </Link>
        </div>
        {suggestions.length === 0 ? (
          <p className="py-8 text-center text-sm text-ink-400">
            Nothing flagged. Track some items and use them — the list fills itself in.
          </p>
        ) : (
          <ul className="divide-y divide-ink-100">
            {suggestions.map((s) => (
              <li key={s.item.id} className="flex items-center gap-4 py-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-clay-500/15 text-sm font-semibold text-clay-600">
                  {s.score}
                </span>
                <div className="min-w-0 flex-1">
                  <Link
                    href={`/items/${s.item.id}`}
                    className="block truncate font-medium hover:underline"
                  >
                    {s.item.name}
                  </Link>
                  <p className="truncate text-xs text-ink-400">
                    {s.reasons.map((r) => r.label).join(" · ") || "—"}
                  </p>
                </div>
                <div className="shrink-0 text-right text-xs text-ink-400">
                  <p>{formatMoney(s.item.currentValue)}</p>
                  <p>{relativeDays(s.idleDays)}</p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="card">
        <h2 className="mb-4 font-semibold">Lifetime disposal record</h2>
        <div className="grid grid-cols-3 gap-4">
          {stats.disposalBreakdown.map((d) => (
            <Link
              key={d.disposition}
              href={`/items?status=${d.disposition}`}
              className="rounded-lg border border-ink-100 p-4 transition-colors hover:bg-ink-50"
            >
              <p className="text-xs font-medium uppercase tracking-wide text-ink-500 capitalize">
                {d.disposition}
              </p>
              <p className="mt-1 text-xl font-semibold tabular-nums">{d.count}</p>
              {d.disposition === "sold" && (
                <p className="text-xs text-moss-700">{formatMoney(d.amount)} earned</p>
              )}
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
