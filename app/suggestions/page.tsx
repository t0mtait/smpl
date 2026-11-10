import Link from "next/link";
import { listItems } from "@/lib/db";
import { scoreAll } from "@/lib/scoring";
import { formatMoney, relativeDays } from "@/lib/format";

export const dynamic = "force-dynamic";

export default function SuggestionsPage() {
  const scored = scoreAll(listItems());
  const strong = scored.filter((s) => s.score >= 40);
  const moderate = scored.filter((s) => s.score > 0 && s.score < 40);
  const keep = scored.filter((s) => s.score === 0);

  const Section = ({
    title,
    blurb,
    items,
    tone,
  }: {
    title: string;
    blurb: string;
    items: typeof scored;
    tone: string;
  }) => (
    <section className="card">
      <div className="mb-4">
        <h2 className="text-lg font-semibold">{title}</h2>
        <p className="text-sm text-ink-500">{blurb}</p>
      </div>
      {items.length === 0 ? (
        <p className="py-6 text-center text-sm text-ink-400">Nothing here.</p>
      ) : (
        <ul className="divide-y divide-ink-100">
          {items.map((s) => (
            <li key={s.item.id} className="flex items-start gap-4 py-3">
              <span
                className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-sm font-semibold ${tone}`}
              >
                {s.score}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-baseline gap-x-2">
                  <Link href={`/items/${s.item.id}`} className="font-medium hover:underline">
                    {s.item.name}
                  </Link>
                  <span className="text-xs capitalize text-ink-400">
                    {s.item.category}
                    {s.item.location ? ` · ${s.item.location}` : ""}
                  </span>
                </div>
                {s.reasons.length > 0 && (
                  <ul className="mt-1 flex flex-wrap gap-1.5">
                    {s.reasons.map((r, i) => (
                      <li key={`${r.label}-${i}`} className="pill bg-ink-100 text-ink-600">
                        {r.label}
                        {r.weight > 0 && <span className="text-ink-400"> +{r.weight}</span>}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              <div className="shrink-0 text-right text-xs">
                <p className="tabular-nums text-ink-600">{formatMoney(s.item.currentValue)}</p>
                <p className="text-ink-400">{relativeDays(s.idleDays)}</p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Get rid of these</h1>
        <p className="mt-1 max-w-2xl text-sm text-ink-500">
          Scored from how long an item has gone unused, how rarely you use it, what it is
          worth, whether you own duplicates, and whether it is out of season. The score is a
          nudge, not a verdict — you decide.
        </p>
      </div>

      {scored.length === 0 ? (
        <div className="card py-16 text-center text-ink-500">
          Nothing tracked yet.{" "}
          <Link href="/items/new" className="text-moss-700 underline">
            Add your first item
          </Link>
          .
        </div>
      ) : (
        <div className="space-y-6">
          <Section
            title="Strong candidates"
            blurb="Score 40+ — the app thinks these are dead weight."
            items={strong}
            tone="bg-clay-500/15 text-clay-600"
          />
          <Section
            title="Worth a look"
            blurb="Score 1-39 — something is slightly off about them."
            items={moderate}
            tone="bg-ink-100 text-ink-600"
          />
          <Section
            title="Living their best life"
            blurb="Score 0 — in use, valuable, or marked keep."
            items={keep}
            tone="bg-moss-500/15 text-moss-700"
          />
        </div>
      )}
    </div>
  );
}
