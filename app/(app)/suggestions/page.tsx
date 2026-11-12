import Link from "next/link";
import { listItems } from "@/lib/db";
import { scoreAll } from "@/lib/scoring";
import type { ScoredItem } from "@/lib/scoring";
import { formatMoney, relativeDays } from "@/lib/format";
import { requireUser } from "@/lib/auth";
import { ItemPhoto, ScoreRing } from "@/components/ui";
import { IconCheck, IconSparkles } from "@/components/icons";

export const dynamic = "force-dynamic";

function Section({
  title,
  blurb,
  items,
  tone,
  ring,
}: {
  title: string;
  blurb: string;
  items: ScoredItem[];
  tone: "clay" | "amber" | "moss";
  ring: "high" | "mid" | "low";
}) {
  const toneStyles = {
    clay: "bg-clay-50 text-clay-600",
    amber: "bg-amber-50 text-amber-700",
    moss: "bg-moss-50 text-moss-600",
  };
  const dot = { clay: "bg-clay-500", amber: "bg-amber-500", moss: "bg-moss-500" };

  return (
    <section className="card overflow-hidden">
      <div className="flex items-start gap-3 border-b border-line px-6 py-5">
        <span className={`mt-1 h-2.5 w-2.5 shrink-0 rounded-full ${dot[tone]}`} />
        <div>
          <h2 className="display text-xl">{title}</h2>
          <p className="mt-0.5 text-[13px] text-muted">{blurb}</p>
        </div>
        <span
          className={`pill ml-auto shrink-0 ${toneStyles[tone]}`}
        >
          {items.length}
        </span>
      </div>

      {items.length === 0 ? (
        <p className="px-6 py-10 text-center text-sm text-muted">Nothing here.</p>
      ) : (
        <ul className="divide-y divide-line">
          {items.map((s) => (
            <li key={s.item.id}>
              <Link
                href={`/items/${s.item.id}`}
                className="group flex items-center gap-4 px-6 py-4 transition-colors hover:bg-paper"
              >
                <div className="hidden h-14 w-14 shrink-0 overflow-hidden rounded-xl border border-line sm:block">
                  <ItemPhoto
                    src={s.item.photoPath ? `/api/photos/${s.item.photoPath}` : null}
                    alt={s.item.name}
                  />
                </div>
                <ScoreRing score={s.score} size={48} stroke={4.5} />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                    <span className="truncate font-medium text-ink group-hover:text-moss-600">
                      {s.item.name}
                    </span>
                    <span className="text-[12px] capitalize text-muted">
                      {s.item.category}
                      {s.item.location ? ` · ${s.item.location}` : ""}
                    </span>
                  </div>
                  {s.reasons.length > 0 ? (
                    <ul className="mt-1.5 flex flex-wrap gap-1.5">
                      {s.reasons.map((r, i) => (
                        <li
                          key={`${r.label}-${i}`}
                          className={`pill ${toneStyles[tone]} font-medium`}
                        >
                          {r.label}
                          {r.weight > 0 ? (
                            <span className="opacity-60">+{r.weight}</span>
                          ) : null}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="mt-1.5 flex items-center gap-1.5 text-[13px] text-moss-600">
                      <IconCheck width={14} height={14} />
                      In use and worth keeping
                    </p>
                  )}
                </div>
                <div className="hidden shrink-0 text-right sm:block">
                  <p className="tabular text-sm font-medium text-ink">
                    {formatMoney(s.item.currentValue)}
                  </p>
                  <p className="text-xs text-muted">
                    {s.idleDays === null ? "no usage data" : `used ${relativeDays(s.idleDays)}`}
                  </p>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export default async function SuggestionsPage() {
  const user = await requireUser();
  const scored = scoreAll(listItems(user.id));
  const strong = scored.filter((s) => s.score >= 40);
  const moderate = scored.filter((s) => s.score > 0 && s.score < 40);
  const keep = scored.filter((s) => s.score === 0);
  // Unknown values are excluded, not treated as $0 — a sum that silently
  // counts unpriced items as worthless would overstate what you can reclaim.
  const reclaimable = strong.reduce(
    (sum, s) => sum + (s.item.currentValue ?? 0),
    0
  );
  const unpriced = strong.filter((s) => s.item.currentValue === null).length;

  return (
    <div className="space-y-8">
      <header className="animate-rise">
        <p className="eyebrow">Get rid of</p>
        <h1 className="display mt-2 text-4xl leading-[1.1] sm:text-5xl">The shortlist</h1>
        <p className="mt-3 max-w-2xl text-[15px] leading-relaxed text-muted">
          Scored from how long an item has gone unused, how rarely you use it, what it is
          worth, whether you own duplicates, and whether it is out of season. The score is a
          nudge, not a verdict — you decide.
        </p>
        {strong.length > 0 ? (
          <div className="mt-5 inline-flex items-center gap-2.5 rounded-xl border border-clay-200 bg-clay-50 px-4 py-2.5">
            <IconSparkles width={16} height={16} className="text-clay-500" />
            <span className="text-sm text-clay-600">
              <span className="font-semibold">{formatMoney(reclaimable)}</span> sitting in{" "}
              {strong.length} candidate{strong.length === 1 ? "" : "s"}
            </span>
          </div>
        ) : null}
      </header>

      {scored.length === 0 ? (
        <div className="card">
          <div className="flex flex-col items-center px-6 py-16 text-center">
            <span className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-paper text-ink-400">
              <IconSparkles width={22} height={22} />
            </span>
            <h2 className="display text-xl">Nothing to score yet</h2>
            <p className="mt-1.5 max-w-sm text-sm leading-relaxed text-muted">
              Track a few things and this page will tell you which ones are actually dead
              weight.
            </p>
            <Link href="/items/new" className="btn-primary mt-5">
              Add your first item
            </Link>
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          <Section
            title="Strong candidates"
            blurb="Score 40+ — the app thinks these are dead weight."
            items={strong}
            tone="clay"
            ring="high"
          />
          <Section
            title="Worth a look"
            blurb="Score 1–39 — something is slightly off about them."
            items={moderate}
            tone="amber"
            ring="mid"
          />
          <Section
            title="Living their best life"
            blurb="Score 0 — in use, valuable, or marked keep."
            items={keep}
            tone="moss"
            ring="low"
          />
        </div>
      )}
    </div>
  );
}
