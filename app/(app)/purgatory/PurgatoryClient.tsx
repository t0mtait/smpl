"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { Item } from "@/lib/db";
import { CATEGORIES, formatCategory, formatMoney, formatQuarter } from "@/lib/format";
import { currentQuarter, daysSinceDate } from "@/lib/dates";
import { CategoryTag, Pagination } from "@/components/ui";
import { IconArrowLeft, IconBox, IconCheck,
  IconSearch, IconFlame, IconUndo } from "@/components/icons";

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

const PURGATORY_LIMIT_DAYS = 30;

/** Circular progress that fills completely at 30 days in purgatory. */
function DaysRing({ days }: { days: number | null }) {
  if (days === null) return <span>—</span>;
  const d = Math.max(0, days);
  const pct = Math.min(d / PURGATORY_LIMIT_DAYS, 1);
  const r = 14;
  const c = 2 * Math.PI * r;
  const full = d >= PURGATORY_LIMIT_DAYS;
  return (
    <span
      className="inline-flex items-center justify-end"
      title={`${d} ${d === 1 ? "day" : "days"} in purgatory${full ? " — time to decide" : ` · ${PURGATORY_LIMIT_DAYS - d} to go`}`}
    >
      <span className="relative inline-flex h-8 w-8 items-center justify-center">
        <svg viewBox="0 0 36 36" className="absolute inset-0 -rotate-90" aria-hidden="true">
          <circle cx="18" cy="18" r={r} fill="none" strokeWidth="3.5" className="stroke-line" />
          <circle
            cx="18"
            cy="18"
            r={r}
            fill="none"
            strokeWidth="3.5"
            strokeLinecap="round"
            strokeDasharray={`${pct * c} ${c}`}
            className={full ? "stroke-clay" : "stroke-accent"}
          />
        </svg>
        <span className={`tabular relative text-[11px] font-semibold ${full ? "text-clay" : "text-ink"}`}>
          {d}
        </span>
      </span>
    </span>
  );
}

export default function PurgatoryClient({ initialItems }: { initialItems: Item[] }) {
  const router = useRouter();
  const [items, setItems] = useState<Item[]>(initialItems);
  const categories = useMemo(() => {
    const set = new Set(items.map((i) => i.category));
    return [...set].sort();
  }, [items]);

  const [query, setQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [page, setPage] = useState(1);

  const filteredItems = useMemo(() => {
    const q = query.trim().toLowerCase();
    return items.filter((item) => {
      if (categoryFilter !== "all" && item.category !== categoryFilter) return false;
      if (!q) return true;
      return (
        item.name.toLowerCase().includes(q) ||
        (item.brand && item.brand.toLowerCase().includes(q)) ||
        item.category.toLowerCase().includes(q)
      );
    });
  }, [items, query, categoryFilter]);
  const [offloadingItem, setOffloadingItem] = useState<Item | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);

  // Inline cell editing: click a value to edit it in place, as in Inventory.
  const [editingCell, setEditingCell] = useState<{ itemId: number; field: string } | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [userCategories, setUserCategories] = useState<string[]>([]);

  useEffect(() => {
    fetch("/api/user/categories")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        const list = data?.categories as { category: string }[] | undefined;
        if (list?.length) setUserCategories(list.map((u) => u.category));
      })
      .catch(() => {});
  }, []);

  const saveInline = async (id: number, patch: Record<string, unknown>) => {
    setEditingCell(null);
    setSaveError(null);
    try {
      const res = await fetch(`/api/items/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      if (res.ok) {
        const data = await res.json();
        setItems((prev) => prev.map((it) => (it.id === id ? { ...it, ...data.item } : it)));
      } else {
        setSaveError("Failed to save changes.");
      }
    } catch {
      setSaveError("Network error while saving.");
    }
  };
  const isEditing = (id: number, field: string) =>
    editingCell?.itemId === id && editingCell.field === field;
  const cellBtn =
    "inline-block py-1 px-1.5 -mx-1.5 rounded hover:bg-wash cursor-pointer transition-colors";

  type PurgatorySortKey = "name" | "brand" | "category" | "value" | "acquired" | "purgatoryDate";
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
    return [...filteredItems].sort((a, b) => {
      if (sort.key === "purgatoryDate") {
        const dA = daysSinceDate(a.purgatoryDate) ?? -1;
        const dB = daysSinceDate(b.purgatoryDate) ?? -1;
        return (dA - dB) * dir;
      }
      if (sort.key === "name") {
        return a.name.localeCompare(b.name) * dir;
      }
      if (sort.key === "brand") {
        return (a.brand || "").localeCompare(b.brand || "") * dir;
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
  }, [filteredItems, sort]);

  useEffect(() => {
    setPage(1);
  }, [query, categoryFilter]);

  const totalPages = Math.max(1, Math.ceil(sortedItems.length / 10));
  const safePage = Math.min(page, totalPages);
  const paginatedItems = sortedItems.slice((safePage - 1) * 10, safePage * 10);

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
        </div>

        {/* Search & filters beside header */}
        <div className="flex w-full flex-row items-center gap-2 sm:flex-wrap sm:items-end xl:w-auto xl:flex-1 xl:justify-end">
          <div className="min-w-0 flex-1 xl:max-w-[260px]">
            <label className="label hidden sm:block" htmlFor="purgatory-q">
              Search
            </label>
            <div className="relative">
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-faint">
                <IconSearch width={15} height={15} />
              </span>
              <input
                id="purgatory-q"
                className="input pl-9 text-xs sm:text-sm py-1.5 sm:py-2"
                placeholder="Search purgatory…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </div>
          </div>

          <div className="w-32 sm:w-40 shrink-0">
            <label className="label hidden sm:block" htmlFor="purgatory-cat">
              Category
            </label>
            <select
              id="purgatory-cat"
              className="input text-xs sm:text-sm px-2 py-1.5 sm:py-2"
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
            >
              <option value="all">All categories</option>
              {categories.map((c) => (
                <option key={c} value={c}>
                  {formatCategory(c)}
                </option>
              ))}
            </select>
          </div>
        </div>
      </header>

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
            <table className="w-full min-w-full sm:min-w-[960px] border-collapse text-left">
              <thead>
                <tr className="h-11 border-b border-line text-[11px] font-semibold uppercase tracking-[0.12em] text-muted">
                  <th scope="col" className="px-3 sm:px-4 py-2.5 align-middle w-full sm:w-auto">
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
                  <th scope="col" className="hidden sm:table-cell px-4 py-2.5 align-middle">
                    <button
                      type="button"
                      onClick={() => toggleSort("brand")}
                      className={`inline-flex items-center gap-1.5 rounded transition-colors hover:text-ink ${
                        sort.key === "brand" ? "text-ink" : "text-muted"
                      }`}
                    >
                      Brand
                      <span className={`text-[9px] leading-none ${sort.key === "brand" ? "opacity-100" : "opacity-0"}`}>
                        {sort.direction === "asc" ? "▲" : "▼"}
                      </span>
                    </button>
                  </th>
                  <th scope="col" className="px-3 sm:px-4 py-2.5 align-middle">
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
                  <th scope="col" className="hidden sm:table-cell px-4 py-2.5 align-middle text-right">
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
                  <th scope="col" className="hidden sm:table-cell px-4 py-2.5 align-middle text-right">
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
                  <th scope="col" className="px-2 sm:px-4 py-2.5 align-middle text-right whitespace-nowrap w-16 sm:w-28">
                    <button
                      type="button"
                      onClick={() => toggleSort("purgatoryDate")}
                      className={`inline-flex items-center gap-1.5 rounded transition-colors hover:text-ink ${
                        sort.key === "purgatoryDate" ? "text-ink" : "text-muted"
                      }`}
                      title="Sort by age"
                    >
                      Age
                      <span className={`text-[9px] leading-none ${sort.key === "purgatoryDate" ? "opacity-100" : "opacity-0"}`}>
                        {sort.direction === "asc" ? "▲" : "▼"}
                      </span>
                    </button>
                  </th>
                  <th scope="col" className="hidden sm:table-cell px-4 py-2.5 align-middle text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {paginatedItems.map((item) => (
                  <tr
                    key={item.id}
                    onClick={() => {
                      if (typeof window !== "undefined" && window.innerWidth < 640) {
                        router.push(`/items/${item.id}`);
                      }
                    }}
                    className="h-[52px] sm:h-[54px] border-b border-line-soft transition-colors last:border-0 even:bg-wash/60 dark:even:bg-shell/70 hover:bg-wash dark:hover:bg-wash/40 cursor-pointer sm:cursor-default"
                  >
                    <th scope="row" className="px-3 sm:px-4 py-2 sm:py-2.5 align-middle text-left font-normal">
                      <Link
                        href={`/items/${item.id}`}
                        className="font-medium text-ink hover:text-accent"
                      >
                        {item.name}
                      </Link>
                    </th>
                    <td className="hidden sm:table-cell px-4 py-2 sm:py-2.5 align-middle text-[13px] text-ink-soft">
                      {isEditing(item.id, "brand") ? (
                        <input
                          type="text"
                          autoFocus
                          defaultValue={item.brand}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") e.currentTarget.blur();
                            if (e.key === "Escape") setEditingCell(null);
                          }}
                          onBlur={(e) => saveInline(item.id, { brand: e.currentTarget.value.trim() })}
                          className="input py-0.5 px-2 text-xs h-7 max-w-[120px]"
                        />
                      ) : (
                        <span
                          onClick={(e) => {
                            e.stopPropagation();
                            setEditingCell({ itemId: item.id, field: "brand" });
                          }}
                          className={cellBtn}
                          title="Click to edit brand"
                        >
                          {item.brand || <span className="text-muted/60">—</span>}
                        </span>
                      )}
                    </td>
                    <td className="px-3 sm:px-4 py-2 sm:py-2.5 align-middle">
                      {isEditing(item.id, "category") ? (
                        <select
                          autoFocus
                          defaultValue={item.category}
                          onChange={(e) => saveInline(item.id, { category: e.target.value })}
                          onBlur={() => setEditingCell(null)}
                          className="input py-0.5 px-2 text-xs h-7"
                        >
                          {(userCategories.length > 0 ? userCategories : CATEGORIES).map((c) => (
                            <option key={c} value={c}>
                              {formatCategory(c)}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <span
                          onClick={(e) => {
                            e.stopPropagation();
                            setEditingCell({ itemId: item.id, field: "category" });
                          }}
                          className={cellBtn}
                          title="Click to edit category"
                        >
                          <CategoryTag category={item.category} />
                        </span>
                      )}
                    </td>
                    <td className="hidden sm:table-cell tabular px-4 py-2 sm:py-2.5 align-middle text-right text-[13px] font-medium text-ink">
                      {isEditing(item.id, "value") ? (
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          autoFocus
                          defaultValue={item.currentValue === null ? "" : String(item.currentValue)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") e.currentTarget.blur();
                            if (e.key === "Escape") setEditingCell(null);
                          }}
                          onBlur={(e) => {
                            const val = e.currentTarget.value.trim();
                            saveInline(item.id, { currentValue: val === "" ? null : Number(val) });
                          }}
                          className="input py-0.5 px-2 text-xs h-7 tabular text-right max-w-[90px]"
                        />
                      ) : (
                        <span
                          onClick={(e) => {
                            e.stopPropagation();
                            setEditingCell({ itemId: item.id, field: "value" });
                          }}
                          className={cellBtn}
                          title="Click to edit value"
                        >
                          {formatMoney(item.currentValue)}
                        </span>
                      )}
                    </td>
                    <td className="hidden sm:table-cell tabular px-4 py-2 sm:py-2.5 align-middle text-right text-[13px] text-muted">
                      {isEditing(item.id, "acquired") ? (
                        <input
                          type="text"
                          placeholder="YYYY-MM-DD or Q1 2024"
                          autoFocus
                          defaultValue={item.purchaseDate || ""}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") e.currentTarget.blur();
                            if (e.key === "Escape") setEditingCell(null);
                          }}
                          onBlur={(e) =>
                            saveInline(item.id, { purchaseDate: e.currentTarget.value.trim() || null })
                          }
                          className="input py-0.5 px-2 text-xs h-7 tabular text-right max-w-[120px]"
                        />
                      ) : (
                        <span
                          onClick={(e) => {
                            e.stopPropagation();
                            setEditingCell({ itemId: item.id, field: "acquired" });
                          }}
                          className={cellBtn}
                          title="Click to edit acquired date"
                        >
                          {formatQuarter(item.purchaseDate)}
                        </span>
                      )}
                    </td>
                    <td className="tabular px-2 sm:px-4 py-2 sm:py-2.5 align-middle text-right text-[13px] text-muted whitespace-nowrap w-16 sm:w-28">
                      <DaysRing days={daysSinceDate(item.purgatoryDate)} />
                    </td>
                    <td className="hidden sm:table-cell px-4 py-2 sm:py-2.5 align-middle text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          type="button"
                          className="btn-secondary px-2.5 py-1 text-[12px]"
                          onClick={(e) => {
                            e.stopPropagation();
                            restore(item);
                          }}
                          disabled={busyId === item.id}
                          title="Restore back to inventory"
                        >
                          <IconUndo width={13} height={13} />
                          Restore
                        </button>
                        <button
                          type="button"
                          className="btn-clay px-2.5 py-1 text-[12px]"
                          onClick={(e) => {
                            e.stopPropagation();
                            setOffloadingItem(item);
                          }}
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
          <Pagination
            currentPage={safePage}
            totalItems={sortedItems.length}
            pageSize={10}
            onPageChange={setPage}
          />
        </div>
      )}

      {saveError && (
        <div className="rounded-lg border border-danger-line bg-danger-soft p-3 text-sm text-danger">
          {saveError}
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
