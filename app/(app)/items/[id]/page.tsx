import { notFound } from "next/navigation";
import Link from "next/link";
import { getItem, listDisposals, listItems } from "@/lib/db";
import { scoreItem, findDuplicateItemIds } from "@/lib/scoring";
import { formatDate, formatMoney, FREQUENCY_LABELS, relativeDays, STATUS_LABELS, STATUS_STYLES } from "@/lib/format";
import { daysSince } from "@/lib/scoring";
import { requireUser } from "@/lib/auth";
import { ItemPhoto, ScoreRing } from "@/components/ui";
import { IconArrowLeft, IconPencil } from "@/components/icons";
import ItemActions from "./ItemActions";

export const dynamic = "force-dynamic";

export default async function ItemPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser(`/items/${id}`);
  const item = getItem(user.id, Number(id));
  if (!item) notFound();

  const disposals = listDisposals(user.id).filter((d) => d.itemId === item.id);
  // Duplicate detection needs the whole owned set, not just this item.
  const owned = listItems(user.id).filter((i) => i.status === "owned");
  const scored = scoreItem(item, findDuplicateItemIds(owned));

  const facts: { label: string; value: React.ReactNode }[] = [
    { label: "Category", value: <span className="capitalize">{item.category}</span> },
    { label: "Location", value: item.location || "—" },
    { label: "Paid", value: <span className="tabular">{formatMoney(item.purchasePrice)}</span> },
    { label: "Worth today", value: <span className="tabular">{formatMoney(item.currentValue)}</span> },
    { label: "Acquired", value: formatDate(item.purchaseDate) },
    { label: "Last used", value: formatDate(item.lastUsedAt) },
    { label: "Frequency", value: FREQUENCY_LABELS[item.useFrequency] ?? item.useFrequency },
    { label: "Idle", value: relativeDays(daysSince(item.lastUsedAt ?? item.purchaseDate)) },
  ];

  return (
    <div className="space-y-7">
      <Link
        href="/items"
        className="inline-flex items-center gap-1.5 text-[13px] font-medium text-muted transition-colors hover:text-ink"
      >
        <IconArrowLeft width={15} height={15} />
        Inventory
      </Link>

      <div className="grid gap-6 lg:grid-cols-[300px_1fr] lg:gap-8">
        {/* ---------------- Left rail ---------------- */}
        <div className="space-y-4">
          <div className="overflow-hidden rounded-2xl border border-line bg-card">
            <div className="aspect-square w-full">
              <ItemPhoto
                src={item.photoPath ? `/api/photos/${item.photoPath}` : null}
                alt={item.name}
              />
            </div>
          </div>

          {item.status === "owned" ? (
            <div className="card p-5">
              <div className="flex items-start gap-4">
                <ScoreRing score={scored.score} size={64} stroke={6} />
                <div className="min-w-0 flex-1">
                  <p className="eyebrow">Declutter score</p>
                  <p className="mt-1 text-[13px] leading-snug text-muted">
                    {scored.score >= 40
                      ? "The app thinks this is dead weight."
                      : scored.score > 0
                        ? "Something is slightly off about this."
                        : "In use and worth keeping."}
                  </p>
                </div>
              </div>
              {scored.reasons.length > 0 ? (
                <ul className="mt-4 space-y-2 border-t border-line pt-4">
                  {scored.reasons.map((r, i) => (
                    <li
                      key={`${r.label}-${i}`}
                      className="flex items-start justify-between gap-3 text-[13px]"
                    >
                      <span className="text-ink-700">{r.label}</span>
                      {r.weight > 0 ? (
                        <span className="tabular shrink-0 font-medium text-clay-500">+{r.weight}</span>
                      ) : null}
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          ) : null}
        </div>

        {/* ---------------- Main ---------------- */}
        <div className="space-y-6">
          <header className="animate-rise">
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="display text-4xl leading-[1.1]">{item.name}</h1>
              <span className={`pill ${STATUS_STYLES[item.status]}`}>{STATUS_LABELS[item.status]}</span>
            </div>
            {item.description ? (
              <p className="mt-3 max-w-2xl text-[15px] leading-relaxed text-muted">
                {item.description}
              </p>
            ) : null}
            <div className="mt-4 flex flex-wrap gap-2">
              <Link href={`/items/${item.id}/edit`} className="btn-secondary">
                <IconPencil width={15} height={15} />
                Edit details
              </Link>
            </div>
          </header>

          <div className="card grid grid-cols-2 gap-x-4 gap-y-5 p-6 sm:grid-cols-4">
            {facts.map((f) => (
              <div key={f.label}>
                <p className="label">{f.label}</p>
                <p className="text-sm text-ink">{f.value}</p>
              </div>
            ))}
          </div>

          <ItemActions item={item} />

          {disposals.length > 0 ? (
            <section className="card overflow-hidden">
              <div className="border-b border-line px-6 py-4">
                <h2 className="display text-lg">Disposal history</h2>
              </div>
              <ul className="divide-y divide-line">
                {disposals.map((d) => (
                  <li
                    key={d.id}
                    className="flex flex-wrap items-center justify-between gap-2 px-6 py-3 text-sm"
                  >
                    <span className="text-ink">
                      {STATUS_LABELS[d.disposition] ?? d.disposition} ·{" "}
                      {formatDate(d.disposedAt)}
                      {d.channel ? ` · ${d.channel}` : ""}
                    </span>
                    <span className="tabular text-muted">
                      {/* An unknown amount renders as nothing at all — no
                          dangling separator before the notes. */}
                      {d.amount !== null ? formatMoney(d.amount) : ""}
                      {d.amount !== null && d.notes ? " · " : ""}
                      {d.notes}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </div>
      </div>
    </div>
  );
}
