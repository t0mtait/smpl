"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import type { Item } from "@/lib/db";
import { formatDate, formatMoney, formatQuarter } from "@/lib/format";
import { currentQuarter } from "@/lib/dates";
import { CategoryTag } from "@/components/ui";
import { IconArrowLeft, IconBox, IconCheck, IconFlame, IconUndo } from "@/components/icons";

interface OffloadModalProps {
  item: Item;
  onClose: () => void;
  onSuccess: (updatedItem: Item) => void;
}

function OffloadModal({ item, onClose, onSuccess }: OffloadModalProps) {
  const [amount, setAmount] = useState<string>("0");
  const [date, setDate] = useState<string>(currentQuarter());
  const [notes, setNotes] = useState<string>("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);

    try {
      const numAmount = parseFloat(amount);
      const res = await fetch(`/api/items/${item.id}/offload`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: isNaN(numAmount) ? 0 : Math.max(0, numAmount),
          date: date.trim() || currentQuarter(),
          notes: notes.trim(),
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to offload item");
      }

      const data = await res.json();
      onSuccess(data.item);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "An error occurred");
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <div className="card w-full max-w-md border border-line bg-card p-6 shadow-xl">
        <div className="flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-clay-soft text-clay">
            <IconFlame width={18} height={18} />
          </span>
          <h2 className="display text-xl">Offload item</h2>
        </div>
        <p className="mt-1 text-sm text-muted">
          Recording offload for <strong className="text-ink">{item.name}</strong>.
        </p>

        {error && (
          <div className="mt-4 rounded-lg border border-danger-line bg-danger-soft p-3 text-sm text-danger">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-5 space-y-4">
          <div>
            <label className="label" htmlFor="offload-amount">
              $ Returned on offload
            </label>
            <div className="relative">
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted">
                $
              </span>
              <input
                id="offload-amount"
                type="number"
                min="0"
                step="any"
                className="input pl-7"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0"
                required
              />
            </div>
            <p className="mt-1 text-[11px] text-muted">Default is $0 (disposed / donated / no return).</p>
          </div>

          <div>
            <label className="label" htmlFor="offload-date">
              Date offloaded (e.g. {currentQuarter()})
            </label>
            <input
              id="offload-date"
              type="text"
              className="input"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              placeholder={currentQuarter()}
              required
            />
          </div>

          <div>
            <label className="label" htmlFor="offload-notes">
              Notes (optional)
            </label>
            <input
              id="offload-notes"
              type="text"
              className="input"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Sold on marketplace, given away, etc."
            />
          </div>

          <div className="mt-6 flex justify-end gap-2 pt-2">
            <button
              type="button"
              className="btn-secondary"
              onClick={onClose}
              disabled={busy}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn-clay"
              disabled={busy}
            >
              <IconCheck width={15} height={15} />
              {busy ? "Offloading…" : "Confirm Offload"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function PurgatoryClient({ initialItems }: { initialItems: Item[] }) {
  const [items, setItems] = useState<Item[]>(initialItems);
  const [offloadingItem, setOffloadingItem] = useState<Item | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);

  type PurgatorySortKey = "name" | "category" | "value" | "acquired" | "purgatoryDate";
  type SortDirection = "asc" | "desc";

  const [sort, setSort] = useState<{ key: PurgatorySortKey; direction: SortDirection }>({
    key: "purgatoryDate",
    direction: "desc",
  });

  const toggleSort = (key: PurgatorySortKey) => {
    setSort((curr) => {
      if (curr.key === key) {
        return { key, direction: curr.direction === "asc" ? "desc" : "asc" };
      }
      return { key, direction: key === "purgatoryDate" || key === "value" ? "desc" : "asc" };
    });
  };

  const sortedItems = useMemo(() => {
    const dir = sort.direction === "asc" ? 1 : -1;
    return [...items].sort((a, b) => {
      if (sort.key === "purgatoryDate") {
        const tA = a.purgatoryDate ? new Date(a.purgatoryDate).getTime() : 0;
        const tB = b.purgatoryDate ? new Date(b.purgatoryDate).getTime() : 0;
        return (tA - tB) * dir;
      }
      if (sort.key === "name") {
        return a.name.localeCompare(b.name) * dir;
      }
      if (sort.key === "category") {
        return a.category.localeCompare(b.category) * dir;
      }
      if (sort.key === "value") {
        const vA = a.currentValue ?? -1;
        const vB = b.currentValue ?? -1;
        return (vA - vB) * dir;
      }
      if (sort.key === "acquired") {
        const dA = a.purchaseDate ?? "";
        const dB = b.purchaseDate ?? "";
        return dA.localeCompare(dB) * dir;
      }
      return 0;
    });
  }, [items, sort]);

  const restore = async (item: Item) => {
    setBusyId(item.id);
    try {
      const res = await fetch(`/api/items/${item.id}/purgatory`, { method: "DELETE" });
      if (res.ok) {
        setItems((prev) => prev.filter((i) => i.id !== item.id));
      }
    } finally {
      setBusyId(null);
    }
  };

  const handleOffloaded = (updated: Item) => {
    setItems((prev) => prev.filter((i) => i.id !== updated.id));
    setOffloadingItem(null);
  };

  const totalValue = items.reduce((sum, item) => sum + (item.currentValue ?? 0), 0);

  return (
    <div className="space-y-7">
      <header className="animate-rise flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="flex h-6 w-6 items-center justify-center rounded-md bg-clay-soft text-clay">
              <IconFlame width={15} height={15} />
            </span>
            <p className="eyebrow">Purgatory</p>
          </div>
          <h1 className="display mt-2 text-4xl leading-[1.1] sm:text-5xl">Staged for offloading</h1>
          <p className="mt-2 text-[15px] text-muted">
            Items you have marked to get rid of. Offload them with a return amount and date.
          </p>
        </div>
        <Link href="/items" className="btn-secondary">
          <IconArrowLeft width={15} height={15} />
          Back to inventory
        </Link>
      </header>

      {/* Summary card */}
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="card p-5">
          <span className="eyebrow">Items in purgatory</span>
          <div className="mt-2 text-3xl font-semibold tabular text-ink">{items.length}</div>
          <div className="mt-1 text-[13px] text-muted">Staged for removal from your life</div>
        </div>
        <div className="card p-5">
          <span className="eyebrow">Estimated total value</span>
          <div className="mt-2 text-3xl font-semibold tabular text-ink">{formatMoney(totalValue)}</div>
          <div className="mt-1 text-[13px] text-muted">Potential return upon offloading</div>
        </div>
      </div>

      {/* Items list */}
      {items.length === 0 ? (
        <div className="card">
          <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
            <span className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-paper text-ink-faint">
              <IconBox width={22} height={22} />
            </span>
            <h3 className="display text-xl">Purgatory is empty</h3>
            <p className="mt-1.5 max-w-sm text-sm leading-relaxed text-muted">
              You haven&apos;t staged any items to get rid of yet. Click the <strong>X</strong> icon on any item in your inventory to stage it here.
            </p>
            <Link href="/items" className="btn-primary mt-5">
              Go to inventory
            </Link>
          </div>
        </div>
      ) : (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] border-collapse text-left">
              <thead>
                <tr className="border-b border-line text-[11px] font-semibold uppercase tracking-[0.12em] text-muted">
                  <th scope="col" className="px-4 py-3">
                    <button
                      type="button"
                      onClick={() => toggleSort("name")}
                      className={`inline-flex items-center gap-1.5 rounded transition-colors hover:text-ink ${
                        sort.key === "name" ? "text-ink" : "text-muted"
                      }`}
                    >
                      Item
                      <span className={`text-[9px] leading-none ${sort.key === "name" ? "opacity-100" : "opacity-0"}`}>
                        {sort.direction === "asc" ? "▲" : "▼"}
                      </span>
                    </button>
                  </th>
                  <th scope="col" className="px-4 py-3">
                    <button
                      type="button"
                      onClick={() => toggleSort("category")}
                      className={`inline-flex items-center gap-1.5 rounded transition-colors hover:text-ink ${
                        sort.key === "category" ? "text-ink" : "text-muted"
                      }`}
                    >
                      Category
                      <span className={`text-[9px] leading-none ${sort.key === "category" ? "opacity-100" : "opacity-0"}`}>
                        {sort.direction === "asc" ? "▲" : "▼"}
                      </span>
                    </button>
                  </th>
                  <th scope="col" className="px-4 py-3 text-right">
                    <button
                      type="button"
                      onClick={() => toggleSort("value")}
                      className={`inline-flex items-center gap-1.5 rounded transition-colors hover:text-ink ${
                        sort.key === "value" ? "text-ink" : "text-muted"
                      }`}
                    >
                      Value
                      <span className={`text-[9px] leading-none ${sort.key === "value" ? "opacity-100" : "opacity-0"}`}>
                        {sort.direction === "asc" ? "▲" : "▼"}
                      </span>
                    </button>
                  </th>
                  <th scope="col" className="px-4 py-3 text-right">
                    <button
                      type="button"
                      onClick={() => toggleSort("acquired")}
                      className={`inline-flex items-center gap-1.5 rounded transition-colors hover:text-ink ${
                        sort.key === "acquired" ? "text-ink" : "text-muted"
                      }`}
                    >
                      Acquired
                      <span className={`text-[9px] leading-none ${sort.key === "acquired" ? "opacity-100" : "opacity-0"}`}>
                        {sort.direction === "asc" ? "▲" : "▼"}
                      </span>
                    </button>
                  </th>
                  <th scope="col" className="px-4 py-3 text-right">
                    <button
                      type="button"
                      onClick={() => toggleSort("purgatoryDate")}
                      className={`inline-flex items-center gap-1.5 rounded transition-colors hover:text-ink ${
                        sort.key === "purgatoryDate" ? "text-ink" : "text-muted"
                      }`}
                      title="Sort by date added to purgatory"
                    >
                      Added to Purgatory Date
                      <span className={`text-[9px] leading-none ${sort.key === "purgatoryDate" ? "opacity-100" : "opacity-0"}`}>
                        {sort.direction === "asc" ? "▲" : "▼"}
                      </span>
                    </button>
                  </th>
                  <th scope="col" className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {sortedItems.map((item) => (
                  <tr
                    key={item.id}
                    className="border-b border-line-soft transition-colors last:border-0 even:bg-wash/60 dark:even:bg-shell/70 hover:bg-wash dark:hover:bg-wash/40"
                  >
                    <th scope="row" className="px-4 py-3 text-left font-normal">
                      <Link
                        href={`/items/${item.id}`}
                        className="font-medium text-ink hover:text-accent"
                      >
                        {item.name}
                      </Link>
                      {item.location ? (
                        <span className="block truncate text-[12px] font-normal text-muted">
                          {item.location}
                        </span>
                      ) : null}
                    </th>
                    <td className="px-4 py-3">
                      <CategoryTag category={item.category} />
                    </td>
                    <td className="tabular px-4 py-3 text-right text-[13px] font-medium text-ink">
                      {formatMoney(item.currentValue)}
                    </td>
                    <td className="tabular px-4 py-3 text-right text-[13px] text-muted">
                      {formatQuarter(item.purchaseDate)}
                    </td>
                    <td className="tabular px-4 py-3 text-right text-[13px] text-muted">
                      {formatDate(item.purgatoryDate)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          type="button"
                          className="btn-secondary px-2.5 py-1 text-[12px]"
                          onClick={() => restore(item)}
                          disabled={busyId === item.id}
                          title="Restore back to inventory"
                        >
                          <IconUndo width={13} height={13} />
                          Restore
                        </button>
                        <button
                          type="button"
                          className="btn-clay px-2.5 py-1 text-[12px]"
                          onClick={() => setOffloadingItem(item)}
                          disabled={busyId === item.id}
                        >
                          <IconCheck width={13} height={13} />
                          Offload
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {offloadingItem && (
        <OffloadModal
          item={offloadingItem}
          onClose={() => setOffloadingItem(null)}
          onSuccess={handleOffloaded}
        />
      )}
    </div>
  );
}
