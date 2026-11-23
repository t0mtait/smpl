"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import type { WishlistItem } from "@/lib/db";
import { formatMoney, formatCategory, CATEGORIES } from "@/lib/format";
import { daysSinceDate } from "@/lib/dates";
import { CategoryTag, PriorityRing } from "@/components/ui";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import {
  IconCheck,
  IconExternalLink,
  IconHeart,
  IconPlus,
  IconSearch,
  IconTrash,
} from "@/components/icons";

type WishlistSortKey = "name" | "priority" | "category" | "price" | "url" | "waiting";
type SortDirection = "asc" | "desc";

interface WishlistSortState {
  key: WishlistSortKey;
  direction: SortDirection;
}

const WISHLIST_COLUMNS: { key: WishlistSortKey; label: string; numeric?: boolean }[] = [
  { key: "name", label: "Item" },
  { key: "priority", label: "Priority" },
  { key: "category", label: "Category" },
  { key: "price", label: "Price", numeric: true },
  { key: "url", label: "Store Link" },
  { key: "waiting", label: "Cooldown", numeric: true },
];

const COMMON_CATEGORIES = CATEGORIES;

function getDomain(urlStr: string): string {
  try {
    const u = new URL(urlStr.startsWith("http") ? urlStr : `https://${urlStr}`);
    return u.hostname.replace(/^www\./, "");
  } catch {
    return "Store";
  }
}

export default function WishlistClient() {
  const [items, setItems] = useState<WishlistItem[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters & search
  const [query, setQuery] = useState("");
  const [priorityFilter, setPriorityFilter] = useState<string>("all");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [sort, setSort] = useState<WishlistSortState>({ key: "waiting", direction: "desc" });

  // Add form toggle
  const [showAddForm, setShowAddForm] = useState(false);
  const [addName, setAddName] = useState("");
  const [addCategory, setAddCategory] = useState("misc");
  const [addPrice, setAddPrice] = useState("");
  const [addUrl, setAddUrl] = useState("");
  const [addNotes, setAddNotes] = useState("");
  const [addPriority, setAddPriority] = useState<number>(50);
  const [addBusy, setAddBusy] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);

  // General edit popup state
  const [editingItem, setEditingItem] = useState<WishlistItem | null>(null);
  const [deletingItem, setDeletingItem] = useState<WishlistItem | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [editName, setEditName] = useState("");
  const [editCategory, setEditCategory] = useState("");
  const [editPrice, setEditPrice] = useState("");
  const [editUrl, setEditUrl] = useState("");
  const [editNotes, setEditNotes] = useState("");
  const [editPriority, setEditPriority] = useState<number>(50);
  const [editBusy, setEditBusy] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  // Inline cell edit state
  const [editingCell, setEditingCell] = useState<{ itemId: number; field: string } | null>(null);
  const [inlinePriority, setInlinePriority] = useState<number>(50);

  // Convert to inventory modal state
  const [convertingItem, setConvertingItem] = useState<WishlistItem | null>(null);
  const [convertPrice, setConvertPrice] = useState("");
  const [convertBusy, setConvertBusy] = useState(false);
  const [convertError, setConvertError] = useState<string | null>(null);
  const [convertedNotice, setConvertedNotice] = useState<{ name: string; id: number } | null>(null);

  const load = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/wishlist");
      if (res.status === 401) {
        window.location.href = "/auth/login?next=/wishlist";
        return;
      }
      const data = await res.json();
      setItems(data.items ?? []);
      setError(null);
    } catch {
      setError("Failed to load wishlist items.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const categories = useMemo(() => {
    const set = new Set((items ?? []).map((i) => i.category || "misc"));
    return [...set].sort();
  }, [items]);

  const filteredItems = useMemo(() => {
    let list = items ?? [];
    if (query.trim()) {
      const q = query.toLowerCase().trim();
      list = list.filter(
        (i) =>
          i.name.toLowerCase().includes(q) ||
          i.category.toLowerCase().includes(q) ||
          i.notes.toLowerCase().includes(q)
      );
    }
    if (priorityFilter === "high") {
      list = list.filter((i) => i.priority >= 70);
    } else if (priorityFilter === "medium") {
      list = list.filter((i) => i.priority >= 40 && i.priority < 70);
    } else if (priorityFilter === "low") {
      list = list.filter((i) => i.priority < 40);
    }
    if (categoryFilter !== "all") {
      list = list.filter((i) => i.category === categoryFilter);
    }

    const dir = sort.direction === "asc" ? 1 : -1;
    return [...list].sort((a, b) => {
      if (sort.key === "name") {
        return a.name.localeCompare(b.name) * dir;
      }
      if (sort.key === "priority") {
        return (a.priority - b.priority) * dir;
      }
      if (sort.key === "category") {
        return a.category.localeCompare(b.category) * dir;
      }
      if (sort.key === "price") {
        const pA = a.price ?? -1;
        const pB = b.price ?? -1;
        if (pA === pB) return 0;
        return (pA - pB) * dir;
      }
      if (sort.key === "url") {
        return (a.url || "").localeCompare(b.url || "") * dir;
      }
      if (sort.key === "waiting") {
        const tA = new Date(a.createdAt).getTime();
        const tB = new Date(b.createdAt).getTime();
        return (tA - tB) * dir;
      }
      return 0;
    });
  }, [items, query, priorityFilter, categoryFilter, sort]);

  const toggleSort = (key: WishlistSortKey) => {
    setSort((curr) => {
      if (curr.key === key) {
        return { key, direction: curr.direction === "asc" ? "desc" : "asc" };
      }
      const defaultDir: "asc" | "desc" =
        key === "price" || key === "waiting" || key === "priority" ? "desc" : "asc";
      return { key, direction: defaultDir };
    });
  };

  const stats = useMemo(() => {
    const list = items ?? [];
    const totalCount = list.length;
    const totalEstCost = list.reduce((sum, item) => sum + (item.price ?? 0), 0);
    const highPriorityCount = list.filter((i) => i.priority >= 70).length;
    const matureCount = list.filter((i) => {
      const days = daysSinceDate(i.createdAt.slice(0, 10));
      return days !== null && days >= 30;
    }).length;
    return { totalCount, totalEstCost, highPriorityCount, matureCount };
  }, [items]);

  // Submit new item
  const handleAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!addName.trim()) return;
    setAddBusy(true);
    setAddError(null);

    try {
      const res = await fetch("/api/wishlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: addName.trim(),
          category: addCategory.trim() || "misc",
          price: addPrice.trim() === "" ? null : Number(addPrice),
          url: addUrl.trim(),
          notes: addNotes.trim(),
          priority: addPriority,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setAddError(data.error ?? "Failed to save item.");
        setAddBusy(false);
        return;
      }

      setAddName("");
      setAddCategory("misc");
      setAddPrice("");
      setAddUrl("");
      setAddNotes("");
      setAddPriority(50);
      setShowAddForm(false);
      setAddBusy(false);
      load();
    } catch {
      setAddError("Network error. Try again.");
      setAddBusy(false);
    }
  };

  // Start edit (general edit popup opened by clicking item name)
  const openEdit = (item: WishlistItem) => {
    setEditingItem(item);
    setEditName(item.name);
    setEditCategory(item.category);
    setEditPrice(item.price === null ? "" : String(item.price));
    setEditUrl(item.url);
    setEditNotes(item.notes);
    setEditPriority(item.priority);
    setEditError(null);
  };

  // Submit edit
  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingItem || !editName.trim()) return;
    setEditBusy(true);
    setEditError(null);

    try {
      const res = await fetch(`/api/wishlist/${editingItem.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: editName.trim(),
          category: editCategory.trim() || "misc",
          price: editPrice.trim() === "" ? null : Number(editPrice),
          url: editUrl.trim(),
          notes: editNotes.trim(),
          priority: editPriority,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setEditError(data.error ?? "Failed to update item.");
        setEditBusy(false);
        return;
      }

      setEditingItem(null);
      setEditBusy(false);
      load();
    } catch {
      setEditError("Network error. Try again.");
      setEditBusy(false);
    }
  };

  // Inline cell save
  const saveInline = async (id: number, patch: Record<string, unknown>) => {
    setEditingCell(null);
    try {
      const res = await fetch(`/api/wishlist/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      if (res.ok) {
        const data = await res.json();
        setItems((prev) =>
          prev ? prev.map((it) => (it.id === id ? { ...it, ...data.item } : it)) : null
        );
      } else {
        setError("Failed to update item field.");
      }
    } catch {
      setError("Network error while saving.");
    }
  };

  // Delete
  const handleDelete = (item: WishlistItem) => {
    setDeletingItem(item);
  };

  const confirmDeleteWishlistItem = async () => {
    if (!deletingItem) return;
    setDeleteBusy(true);
    try {
      const res = await fetch(`/api/wishlist/${deletingItem.id}`, { method: "DELETE" });
      if (res.ok) {
        setDeletingItem(null);
        load();
      }
    } finally {
      setDeleteBusy(false);
    }
  };

  // Start conversion to inventory
  const openConvert = (item: WishlistItem) => {
    setConvertingItem(item);
    setConvertPrice(item.price === null ? "" : String(item.price));
    setConvertError(null);
  };

  // Confirm conversion
  const handleConvertSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!convertingItem) return;
    setConvertBusy(true);
    setConvertError(null);

    try {
      const res = await fetch(`/api/wishlist/${convertingItem.id}/convert`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          purchasePrice: convertPrice.trim() === "" ? null : Number(convertPrice),
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setConvertError(data.error ?? "Failed to move item to inventory.");
        setConvertBusy(false);
        return;
      }

      const data = await res.json();
      setConvertedNotice({ name: convertingItem.name, id: data.item.id });
      setConvertingItem(null);
      setConvertBusy(false);
      load();
    } catch {
      setConvertError("Network error. Try again.");
      setConvertBusy(false);
    }
  };

  return (
    <div className="space-y-8">
      {/* ---------------- Header ---------------- */}
      <header className="animate-rise flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow">Intentional Living</p>
          <h1 className="display mt-2 text-4xl leading-[1.1] sm:text-5xl">Wishlist</h1>
          <p className="mt-2 text-[15px] text-muted">
            Pause before you purchase. The 30-day cooldown helps separate impulse from genuine utility.
          </p>
        </div>

        <div>
          <button
            type="button"
            onClick={() => setShowAddForm(!showAddForm)}
            className="btn-primary"
          >
            <IconPlus width={16} height={16} />
            {showAddForm ? "Close form" : "Add to wishlist"}
          </button>
        </div>
      </header>

      {/* ---------------- Notice if converted ---------------- */}
      {convertedNotice && (
        <div className="flex items-center justify-between rounded-xl border border-accent bg-accent-soft px-4 py-3 text-sm text-accent">
          <div className="flex items-center gap-2">
            <IconCheck width={18} height={18} />
            <span>
              <strong>{convertedNotice.name}</strong> was moved to your inventory!
            </span>
          </div>
          <Link href={`/items/${convertedNotice.id}`} className="font-semibold underline hover:text-accent-solid">
            View item &rarr;
          </Link>
        </div>
      )}

      {/* ---------------- Add Form Card ---------------- */}
      {showAddForm && (
        <form onSubmit={handleAddSubmit} className="card animate-rise space-y-4 p-6 border-brand">
          <div className="flex items-center justify-between border-b border-line pb-3">
            <h2 className="display text-xl">New wishlist candidate</h2>
            <button
              type="button"
              onClick={() => setShowAddForm(false)}
              className="text-xs text-muted hover:text-ink"
            >
              Cancel
            </button>
          </div>

          {addError && (
            <div className="rounded-lg border border-danger-line bg-danger-soft p-3 text-sm text-danger">
              {addError}
            </div>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="label" htmlFor="add-name">
                Item name *
              </label>
              <input
                id="add-name"
                className="input"
                required
                placeholder="e.g. Merino Wool Sweater"
                value={addName}
                onChange={(e) => setAddName(e.target.value)}
                autoFocus
              />
            </div>

            <div>
              <label className="label" htmlFor="add-price">
                Price ($)
              </label>
              <input
                id="add-price"
                type="number"
                min="0"
                step="0.01"
                className="input"
                placeholder="e.g. 120"
                value={addPrice}
                onChange={(e) => setAddPrice(e.target.value)}
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="label" htmlFor="add-cat">
                Category
              </label>
              <input
                id="add-cat"
                list="category-suggestions"
                className="input"
                placeholder="misc"
                value={addCategory}
                onChange={(e) => setAddCategory(e.target.value)}
              />
              <datalist id="category-suggestions">
                {COMMON_CATEGORIES.map((c) => (
                  <option key={c} value={c} />
                ))}
              </datalist>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="label mb-0" htmlFor="add-priority">Priority</label>
                <span className="text-xs font-semibold tabular text-muted">{addPriority} / 100</span>
              </div>
              <div className="flex items-center gap-3">
                <PriorityRing priority={addPriority} size={38} stroke={3.5} />
                <input
                  id="add-priority"
                  type="range"
                  min="0"
                  max="100"
                  value={addPriority}
                  onChange={(e) => setAddPriority(Number(e.target.value))}
                  className="flex-1 accent-brand h-2 bg-wash rounded-lg cursor-pointer"
                />
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={addPriority}
                  onChange={(e) => {
                    const val = e.target.value === "" ? 0 : Math.min(100, Math.max(0, Number(e.target.value)));
                    setAddPriority(val);
                  }}
                  className="input w-16 py-1 px-2 text-center text-sm font-semibold tabular"
                />
              </div>
            </div>
          </div>

          <div>
            <label className="label" htmlFor="add-url">
              Store / Shopping Link <span className="font-normal text-muted">(optional)</span>
            </label>
            <input
              id="add-url"
              type="url"
              className="input"
              placeholder="https://..."
              value={addUrl}
              onChange={(e) => setAddUrl(e.target.value)}
            />
          </div>

          <div>
            <label className="label" htmlFor="add-notes">
              Notes / Why do you want this? <span className="font-normal text-muted">(optional)</span>
            </label>
            <textarea
              id="add-notes"
              rows={2}
              className="input"
              placeholder="What problem does this solve? Does it replace something else?"
              value={addNotes}
              onChange={(e) => setAddNotes(e.target.value)}
            />
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={() => setShowAddForm(false)}
              className="btn border border-line"
            >
              Cancel
            </button>
            <button type="submit" disabled={addBusy} className="btn-primary">
              {addBusy ? "Adding…" : "Save to wishlist"}
            </button>
          </div>
        </form>
      )}

      {/* ---------------- Quick Stat Strip ---------------- */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <div className="card p-4">
          <p className="text-[12px] font-medium uppercase tracking-wider text-muted">Waiting</p>
          <p className="mt-1 text-2xl font-semibold text-ink">{stats.totalCount}</p>
          <p className="mt-0.5 text-xs text-muted">items on list</p>
        </div>

        <div className="card p-4">
          <p className="text-[12px] font-medium uppercase tracking-wider text-muted">Total Price</p>
          <p className="mt-1 text-2xl font-semibold text-ink">{formatMoney(stats.totalEstCost)}</p>
          <p className="mt-0.5 text-xs text-muted">unspent capital</p>
        </div>

        <div className="card p-4">
          <p className="text-[12px] font-medium uppercase tracking-wider text-muted">Cooldown Passed</p>
          <p className="mt-1 text-2xl font-semibold text-accent">{stats.matureCount}</p>
          <p className="mt-0.5 text-xs text-muted">30+ days waiting</p>
        </div>

        <div className="card p-4">
          <p className="text-[12px] font-medium uppercase tracking-wider text-muted">High Priority</p>
          <p className="mt-1 text-2xl font-semibold text-clay">{stats.highPriorityCount}</p>
          <p className="mt-0.5 text-xs text-muted">urgent considerations</p>
        </div>
      </div>

      {/* ---------------- Filter & Search Bar ---------------- */}
      <div className="card p-4 space-y-3">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative min-w-[200px] flex-1">
            <IconSearch
              width={16}
              height={16}
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted"
            />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search wishlist…"
              className="input pl-9"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <select
              value={priorityFilter}
              onChange={(e) => setPriorityFilter(e.target.value)}
              className="input w-auto text-sm"
              aria-label="Filter by priority"
            >
              <option value="all">All priorities</option>
              <option value="high">High priority (70–100)</option>
              <option value="medium">Medium priority (40–69)</option>
              <option value="low">Low priority (0–39)</option>
            </select>

            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="input w-auto text-sm"
              aria-label="Filter by category"
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
      </div>

      {/* ---------------- Content / Items List ---------------- */}
      {loading ? (
        <div className="py-16 text-center text-sm text-muted">Loading your wishlist…</div>
      ) : error ? (
        <div className="rounded-xl border border-danger-line bg-danger-soft p-4 text-center text-sm text-danger">
          {error}
        </div>
      ) : filteredItems.length === 0 ? (
        <div className="card flex flex-col items-center justify-center p-12 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-brand/5 text-muted">
            <IconHeart width={28} height={28} />
          </div>
          <h3 className="display mt-4 text-2xl">
            {items && items.length > 0 ? "No matches found" : "Your wishlist is empty"}
          </h3>
          <p className="mt-2 max-w-sm text-sm text-muted">
            {items && items.length > 0
              ? "Try adjusting your search query or filters to find what you are looking for."
              : "Pause before impulse buying. Put things here and give them 30 days to see if you still need them."}
          </p>
          {!showAddForm && (
            <button
              type="button"
              onClick={() => setShowAddForm(true)}
              className="btn-primary mt-6"
            >
              <IconPlus width={16} height={16} />
              Add something to wishlist
            </button>
          )}
        </div>
      ) : (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[840px] border-collapse text-left">
              <thead>
                <tr className="border-b border-line">
                  {WISHLIST_COLUMNS.map((col) => {
                    const active = sort.key === col.key;
                    return (
                      <th
                        key={col.key}
                        scope="col"
                        aria-sort={
                          active
                            ? sort.direction === "asc"
                              ? "ascending"
                              : "descending"
                            : "none"
                        }
                        className={`whitespace-nowrap px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.12em] ${
                          col.numeric ? "text-right" : "text-left"
                        }`}
                      >
                        <button
                          type="button"
                          onClick={() => toggleSort(col.key)}
                          className={`inline-flex items-center gap-1.5 rounded transition-colors hover:text-ink ${
                            active ? "text-ink" : "text-muted"
                          }`}
                        >
                          {col.label}
                          <span
                            aria-hidden="true"
                            className={`text-[9px] leading-none ${active ? "opacity-100" : "opacity-0"}`}
                          >
                            {sort.direction === "asc" ? "▲" : "▼"}
                          </span>
                        </button>
                      </th>
                    );
                  })}
                  <th
                    scope="col"
                    className="whitespace-nowrap px-4 py-3 text-right text-[11px] font-semibold uppercase tracking-[0.12em] text-muted"
                  >
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {filteredItems.map((item) => {
                  const daysWaiting = daysSinceDate(item.createdAt.slice(0, 10)) ?? 0;
                  const cooldownPassed = daysWaiting >= 30;

                  return (
                    <tr
                      key={item.id}
                      className="border-b border-line-soft transition-colors last:border-0 hover:bg-paper"
                    >
                      {/* Item Name (click to open general edit popup) */}
                      <th scope="row" className="px-4 py-3 text-left font-normal">
                        <div className="min-w-0">
                          <button
                            type="button"
                            onClick={() => openEdit(item)}
                            className="text-left font-medium text-ink hover:text-accent transition-colors block cursor-pointer group"
                            title="Click to edit item"
                          >
                            <span className="group-hover:underline underline-offset-2">{item.name}</span>
                          </button>
                          {item.notes && (
                            <p className="mt-0.5 text-[12px] text-muted line-clamp-1 font-normal">
                              {item.notes}
                            </p>
                          )}
                        </div>
                      </th>

                      {/* Priority (click to edit field) */}
                      <td className="px-4 py-3">
                        {editingCell?.itemId === item.id && editingCell?.field === "priority" ? (
                          <div className="flex items-center gap-2">
                            <PriorityRing priority={inlinePriority} size={32} stroke={3} />
                            <input
                              type="number"
                              min="0"
                              max="100"
                              autoFocus
                              value={inlinePriority}
                              onChange={(e) => {
                                const val = e.target.value === "" ? 0 : Math.min(100, Math.max(0, Number(e.target.value)));
                                setInlinePriority(val);
                              }}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") {
                                  saveInline(item.id, { priority: inlinePriority });
                                }
                                if (e.key === "Escape") setEditingCell(null);
                              }}
                              onBlur={() => {
                                saveInline(item.id, { priority: inlinePriority });
                              }}
                              className="input py-0.5 px-2 text-xs h-7 tabular text-center w-16"
                            />
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => {
                              setInlinePriority(item.priority);
                              setEditingCell({ itemId: item.id, field: "priority" });
                            }}
                            className="inline-flex items-center gap-2 rounded-lg py-1 px-1.5 -mx-1.5 hover:bg-wash transition-colors group cursor-pointer"
                            title="Click to edit priority (0–100)"
                          >
                            <PriorityRing priority={item.priority} size={32} stroke={3} />
                            <span className="text-xs text-muted font-medium tabular group-hover:text-ink">
                              /100
                            </span>
                          </button>
                        )}
                      </td>

                      {/* Category (click to edit field) */}
                      <td className="px-4 py-3">
                        {editingCell?.itemId === item.id && editingCell?.field === "category" ? (
                          <select
                            autoFocus
                            defaultValue={item.category}
                            onChange={(e) => saveInline(item.id, { category: e.target.value })}
                            onBlur={() => setEditingCell(null)}
                            className="input py-0.5 px-2 text-xs h-7"
                          >
                            {COMMON_CATEGORIES.map((c) => (
                              <option key={c} value={c}>
                                {formatCategory(c)}
                              </option>
                            ))}
                          </select>
                        ) : (
                          <span
                            onClick={() => setEditingCell({ itemId: item.id, field: "category" })}
                            className="inline-block cursor-pointer hover:opacity-80 transition-opacity"
                            title="Click to change category"
                          >
                            <CategoryTag category={item.category} />
                          </span>
                        )}
                      </td>

                      {/* Price (click to edit field) */}
                      <td className="tabular px-4 py-3 text-right text-[13px] font-medium text-ink">
                        {editingCell?.itemId === item.id && editingCell?.field === "price" ? (
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            autoFocus
                            defaultValue={item.price === null ? "" : String(item.price)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") {
                                const val = e.currentTarget.value.trim();
                                saveInline(item.id, { price: val === "" ? null : Number(val) });
                              }
                              if (e.key === "Escape") setEditingCell(null);
                            }}
                            onBlur={(e) => {
                              const val = e.currentTarget.value.trim();
                              saveInline(item.id, { price: val === "" ? null : Number(val) });
                            }}
                            className="input py-0.5 px-2 text-xs h-7 tabular text-right max-w-[90px]"
                          />
                        ) : (
                          <span
                            onClick={() => setEditingCell({ itemId: item.id, field: "price" })}
                            className="inline-block py-1 px-1.5 -mx-1.5 rounded hover:bg-wash cursor-pointer transition-colors"
                            title="Click to edit price"
                          >
                            {item.price !== null ? (
                              formatMoney(item.price)
                            ) : (
                              <span className="text-muted">—</span>
                            )}
                          </span>
                        )}
                      </td>

                      {/* Store / Shopping Link (click to add/edit field) */}
                      <td className="px-4 py-3 text-[13px]">
                        {editingCell?.itemId === item.id && editingCell?.field === "url" ? (
                          <input
                            type="url"
                            placeholder="https://..."
                            autoFocus
                            defaultValue={item.url}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") {
                                saveInline(item.id, { url: e.currentTarget.value.trim() });
                              }
                              if (e.key === "Escape") setEditingCell(null);
                            }}
                            onBlur={(e) => {
                              saveInline(item.id, { url: e.currentTarget.value.trim() });
                            }}
                            className="input py-0.5 px-2 text-xs h-7 max-w-[170px]"
                          />
                        ) : item.url ? (
                          <div className="flex items-center gap-1.5">
                            <a
                              href={item.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 rounded bg-accent-soft px-2 py-0.5 text-[11px] font-medium text-accent hover:opacity-80 transition-opacity"
                              title={`Visit ${item.url}`}
                            >
                              <IconExternalLink width={11} height={11} />
                              <span className="max-w-[100px] truncate">{getDomain(item.url)}</span>
                            </a>
                            <button
                              type="button"
                              onClick={() => setEditingCell({ itemId: item.id, field: "url" })}
                              className="text-[11px] text-muted hover:text-ink transition-colors"
                              title="Edit link"
                            >
                              Edit
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setEditingCell({ itemId: item.id, field: "url" })}
                            className="inline-flex items-center gap-1 rounded border border-dashed border-line px-2 py-0.5 text-[11px] text-muted hover:border-line-strong hover:text-ink transition-colors"
                            title="Add shopping link"
                          >
                            <IconPlus width={11} height={11} />
                            <span>Add link</span>
                          </button>
                        )}
                      </td>

                      {/* Cooldown */}
                      <td className="tabular px-4 py-3 text-right text-[13px]">
                        {cooldownPassed ? (
                          <span className="inline-flex items-center gap-1 rounded-md bg-accent-soft px-2 py-0.5 text-[11px] font-medium text-accent">
                            <IconCheck width={12} height={12} />
                            <span>30+ days (ready)</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded-md bg-wash px-2 py-0.5 text-[11px] text-muted">
                            <span>{daysWaiting}d waiting</span>
                            <span className="opacity-60">·</span>
                            <span>{30 - daysWaiting}d left</span>
                          </span>
                        )}
                      </td>

                      {/* Actions: Edit icon removed, only Bought and Delete */}
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => openConvert(item)}
                            className="btn bg-accent-soft text-accent hover:bg-accent hover:text-accent-fg border border-accent/20 px-2.5 py-1 text-xs font-semibold"
                            title="I bought this: move to owned inventory"
                          >
                            <IconCheck width={13} height={13} />
                            Bought
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDelete(item)}
                            className="btn border border-line p-1.5 text-muted hover:text-clay hover:bg-clay-soft"
                            title="Remove from wishlist"
                          >
                            <IconTrash width={13} height={13} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ---------------- Edit Modal ---------------- */}
      {editingItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm">
          <form
            onSubmit={handleEditSubmit}
            className="card animate-rise w-full max-w-lg space-y-4 p-6 shadow-xl"
          >
            <div className="flex items-center justify-between border-b border-line pb-3">
              <h2 className="display text-xl">Edit wishlist item</h2>
              <button
                type="button"
                onClick={() => setEditingItem(null)}
                className="text-xs text-muted hover:text-ink"
              >
                Close
              </button>
            </div>

            {editError && (
              <div className="rounded-lg border border-danger-line bg-danger-soft p-3 text-sm text-danger">
                {editError}
              </div>
            )}

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="label" htmlFor="edit-name">
                  Item name *
                </label>
                <input
                  id="edit-name"
                  className="input"
                  required
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  autoFocus
                />
              </div>

              <div>
                <label className="label" htmlFor="edit-price">
                  Price ($)
                </label>
                <input
                  id="edit-price"
                  type="number"
                  min="0"
                  step="0.01"
                  className="input"
                  placeholder="e.g. 120"
                  value={editPrice}
                  onChange={(e) => setEditPrice(e.target.value)}
                />
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="label" htmlFor="edit-cat">
                  Category
                </label>
                <input
                  id="edit-cat"
                  list="edit-category-suggestions"
                  className="input"
                  value={editCategory}
                  onChange={(e) => setEditCategory(e.target.value)}
                />
                <datalist id="edit-category-suggestions">
                  {COMMON_CATEGORIES.map((c) => (
                    <option key={c} value={c} />
                  ))}
                </datalist>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="label mb-0" htmlFor="edit-priority">Priority</label>
                  <span className="text-xs font-semibold tabular text-muted">{editPriority} / 100</span>
                </div>
                <div className="flex items-center gap-3">
                  <PriorityRing priority={editPriority} size={38} stroke={3.5} />
                  <input
                    id="edit-priority"
                    type="range"
                    min="0"
                    max="100"
                    value={editPriority}
                    onChange={(e) => setEditPriority(Number(e.target.value))}
                    className="flex-1 accent-brand h-2 bg-wash rounded-lg cursor-pointer"
                  />
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={editPriority}
                    onChange={(e) => {
                      const val = e.target.value === "" ? 0 : Math.min(100, Math.max(0, Number(e.target.value)));
                      setEditPriority(val);
                    }}
                    className="input w-16 py-1 px-2 text-center text-sm font-semibold tabular"
                  />
                </div>
              </div>
            </div>

            <div>
              <label className="label" htmlFor="edit-url">
                Store / Shopping Link
              </label>
              <input
                id="edit-url"
                type="url"
                className="input"
                placeholder="https://..."
                value={editUrl}
                onChange={(e) => setEditUrl(e.target.value)}
              />
            </div>

            <div>
              <label className="label" htmlFor="edit-notes">
                Notes
              </label>
              <textarea
                id="edit-notes"
                rows={2}
                className="input"
                placeholder="Why do you want this?"
                value={editNotes}
                onChange={(e) => setEditNotes(e.target.value)}
              />
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setEditingItem(null)}
                className="btn border border-line"
              >
                Cancel
              </button>
              <button type="submit" disabled={editBusy} className="btn-primary">
                {editBusy ? "Saving…" : "Save changes"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ---------------- Convert to Inventory Modal ---------------- */}
      {convertingItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm">
          <form
            onSubmit={handleConvertSubmit}
            className="card animate-rise w-full max-w-md space-y-4 p-6 shadow-xl"
          >
            <div className="flex items-center justify-between border-b border-line pb-3">
              <h2 className="display text-xl">Bought item</h2>
              <button
                type="button"
                onClick={() => setConvertingItem(null)}
                className="text-xs text-muted hover:text-ink"
              >
                Cancel
              </button>
            </div>

            <p className="text-sm text-ink-soft">
              Moving <strong>{convertingItem.name}</strong> to your owned inventory.
            </p>

            {convertError && (
              <div className="rounded-lg border border-danger-line bg-danger-soft p-3 text-sm text-danger">
                {convertError}
              </div>
            )}

            <div>
              <label className="label" htmlFor="convert-price">
                Actual purchase price ($)
              </label>
              <input
                id="convert-price"
                type="number"
                min="0"
                step="0.01"
                className="input"
                placeholder="What did you pay?"
                value={convertPrice}
                onChange={(e) => setConvertPrice(e.target.value)}
                autoFocus
              />
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setConvertingItem(null)}
                className="btn border border-line"
              >
                Cancel
              </button>
              <button type="submit" disabled={convertBusy} className="btn-primary">
                {convertBusy ? "Moving…" : "Confirm purchase"}
              </button>
            </div>
          </form>
        </div>
      )}
      {/* ---------------- Confirm Delete Modal ---------------- */}
      <ConfirmDialog
        open={!!deletingItem}
        title="Remove from wishlist?"
        message={
          deletingItem ? (
            <>
              Are you sure you want to remove <strong className="text-ink">{deletingItem.name}</strong> from your wishlist?
            </>
          ) : null
        }
        confirmLabel="Remove item"
        busy={deleteBusy}
        onConfirm={confirmDeleteWishlistItem}
        onCancel={() => setDeletingItem(null)}
      />
    </div>
  );
}
