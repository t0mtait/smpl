import { notFound } from "next/navigation";
import Link from "next/link";
import { getItem, listDisposals, listItems } from "@/lib/db";
import { scoreItem, findDuplicateItemIds } from "@/lib/scoring";
import { formatDate, formatMoney, FREQUENCY_LABELS, relativeDays, STATUS_LABELS, STATUS_STYLES } from "@/lib/format";
import { daysSince } from "@/lib/scoring";
import ItemActions from "./ItemActions";

export const dynamic = "force-dynamic";

export default async function ItemPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const item = getItem(Number(id));
  if (!item) notFound();

  const disposals = listDisposals().filter((d) => d.itemId === item.id);
  // Duplicate detection needs the whole owned set, not just this item.
  const owned = listItems().filter((i) => i.status === "owned");
  const scored = scoreItem(item, findDuplicateItemIds(owned));

  return (
    <div className="space-y-6">
      <Link href="/items" className="inline-block text-sm text-ink-500 hover:underline">
        ← Inventory
      </Link>

      <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
        <div className="space-y-4">
          <div className="overflow-hidden rounded-xl border border-ink-200 bg-white">
            {item.photoPath ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={`/api/photos/${item.photoPath}`}
                alt={item.name}
                className="aspect-square w-full object-cover"
              />
            ) : (
              <div className="flex aspect-square w-full items-center justify-center bg-ink-100 text-sm text-ink-400">
                no photo
              </div>
            )}
          </div>
          {item.status === "owned" && (
            <div className="card">
              <p className="text-xs font-medium uppercase tracking-wide text-ink-500">
                Declutter score
              </p>
              <p className="mt-1 text-3xl font-semibold tabular-nums">{scored.score}</p>
              <p className="text-xs text-ink-400">higher = more reason to let it go</p>
              {scored.reasons.length > 0 && (
                <ul className="mt-3 space-y-1 border-t border-ink-100 pt-3 text-xs text-ink-600">
                  {scored.reasons.map((r, i) => (
                    <li key={`${r.label}-${i}`}>
                      {r.label}
                      {r.weight > 0 && <span className="text-ink-400"> (+{r.weight})</span>}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>

        <div className="space-y-6">
          <div>
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-2xl font-semibold tracking-tight">{item.name}</h1>
              <span className={`pill ${STATUS_STYLES[item.status]}`}>{STATUS_LABELS[item.status]}</span>
            </div>
            {item.description && (
              <p className="mt-2 max-w-2xl text-sm text-ink-600">{item.description}</p>
            )}
          </div>

          <div className="card grid grid-cols-2 gap-4 sm:grid-cols-4">
            <div>
              <p className="label">Category</p>
              <p className="text-sm capitalize">{item.category}</p>
            </div>
            <div>
              <p className="label">Location</p>
              <p className="text-sm">{item.location || "—"}</p>
            </div>
            <div>
              <p className="label">Paid</p>
              <p className="text-sm tabular-nums">{formatMoney(item.purchasePrice)}</p>
            </div>
            <div>
              <p className="label">Worth today</p>
              <p className="text-sm tabular-nums">{formatMoney(item.currentValue)}</p>
            </div>
            <div>
              <p className="label">Acquired</p>
              <p className="text-sm">{formatDate(item.purchaseDate)}</p>
            </div>
            <div>
              <p className="label">Last used</p>
              <p className="text-sm">{formatDate(item.lastUsedAt)}</p>
            </div>
            <div>
              <p className="label">Frequency</p>
              <p className="text-sm">{FREQUENCY_LABELS[item.useFrequency] ?? item.useFrequency}</p>
            </div>
            <div>
              <p className="label">Idle</p>
              <p className="text-sm">{relativeDays(daysSince(item.lastUsedAt ?? item.purchaseDate))}</p>
            </div>
          </div>

          <ItemActions item={item} />

          {disposals.length > 0 && (
            <div className="card">
              <h2 className="mb-3 font-semibold">Disposal history</h2>
              <ul className="divide-y divide-ink-100">
                {disposals.map((d) => (
                  <li key={d.id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
                    <span className="capitalize">
                      {d.disposition} · {formatDate(d.disposedAt)}
                      {d.channel ? ` · ${d.channel}` : ""}
                    </span>
                    <span className="tabular-nums text-ink-500">
                      {d.disposition === "sold" ? formatMoney(d.amount) : ""}
                      {d.notes ? ` · ${d.notes}` : ""}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
