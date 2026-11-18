"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import type { WishlistItem } from "@/lib/db";
import { formatMoney } from "@/lib/format";
import { daysSinceDate } from "@/lib/dates";
import {
  IconCheck,
  IconExternalLink,
  IconHeart,
  IconPencil,
  IconPlus,
  IconSearch,
  IconTag,
  IconTrash,
} from "@/components/icons";

type Priority = "high" | "medium" | "low";

const PRIORITIES: { value: Priority; label: string; tone: string; dot: string }[] = [
  { value: "high", label: "High priority", tone: "bg-clay-soft text-clay border-clay-line", dot: "bg-clay" },
  { value: "medium", label: "Medium priority", tone: "bg-warn-soft text-warn border-warn", dot: "bg-warn-mark" },
  { value: "low", label: "Low priority", tone: "bg-wash text-ink-soft border-line", dot: "bg-ink-faint" },
];

const COMMON_CATEGORIES = [
  "clothing",
  "electronics",
  "home",
  "kitchen",
  "tools",
  "entertainment",
  "health",
  "books",
  "misc",
];

export default function WishlistClient() {
  const [items, setItems] = useState<WishlistItem[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters & search
  const [query, setQuery] = useState("");
  const [priorityFilter, setPriorityFilter] = useState<string>("all");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [sortBy, setSortBy] = useState<"newest" | "oldest" | "price_desc" | "price_asc" | "priority">("newest");

  // Add form toggle
  const [showAddForm, setShowAddForm] = useState(false);
  const [addName, setAddName] = useState("");
  const [addCategory, setAddCategory] = useState("misc");
  const [addPrice, setAddPrice] = useState("");
  const [addUrl, setAddUrl] = useState("");
  const [addNotes, setAddNotes] = useState("");
  const [addPriority, setAddPriority] = useState<Priority>("medium");
  const [addBusy, setAddBusy] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);

  // Edit item state
  const [editingItem, setEditingItem] = useState<WishlistItem | null>(null);
  const [editName, setEditName] = useState("");
  const [editCategory, setEditCategory] = useState("");
  const [editPrice, setEditPrice] = useState("");
  const [editUrl, setEditUrl] = useState("");
  const [editNotes, setEditNotes] = useState("");
  const [editPriority, setEditPriority] = useState<Priority>("medium");
  const [editBusy, setEditBusy] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

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
    if (priorityFilter !== "all") {
      list = list.filter((i) => i.priority === priorityFilter);
    }
    if (categoryFilter !== "all") {
      list = list.filter((i) => i.category === categoryFilter);
    }

    return [...list].sort((a, b) => {
      if (sortBy === "newest") {
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      }
      if (sortBy === "oldest") {
        return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      }
      if (sortBy === "price_desc") {
        return (b.price ?? -1) - (a.price ?? -1);
      }
      if (sortBy === "price_asc") {
        return (a.price ?? 999999) - (b.price ?? 999999);
      }
      if (sortBy === "priority") {
        const rank = { high: 3, medium: 2, low: 1 };
        return rank[b.priority] - rank[a.priority];
      }
      return 0;
    });
  }, [items, query, priorityFilter, categoryFilter, sortBy]);

  const stats = useMemo(() => {
    const list = items ?? [];
    const totalCount = list.length;
    const totalEstCost = list.reduce((sum, item) => sum + (item.price ?? 0), 0);
    const highPriorityCount = list.filter((i) => i.priority === "high").length;
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
      setAddPriority("medium");
      setShowAddForm(false);
      setAddBusy(false);
      load();
    } catch {
      setAddError("Network error. Try again.");
      setAddBusy(false);
    }
  };

  // Start edit
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

  // Delete
  const handleDelete = async (item: WishlistItem) => {
    if (!confirm(`Remove "${item.name}" from your wishlist?`)) return;
    try {
      const res = await fetch(`/api/wishlist/${item.id}`, { method: "DELETE" });
      if (res.ok) {
        load();
      }
    } catch {
      alert("Could not remove item.");
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
                Estimated price ($)
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
              <label className="label">Priority</label>
              <div className="flex gap-2">
                {PRIORITIES.map((p) => (
                  <button
                    key={p.value}
                    type="button"
                    onClick={() => setAddPriority(p.value)}
                    className={`btn flex-1 text-xs border ${
                      addPriority === p.value
                        ? "border-brand bg-brand text-brand-fg font-medium"
                        : "border-line bg-card text-ink-soft hover:border-line-strong"
                    }`}
                  >
                    {p.label.split(" ")[0]}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div>
            <label className="label" htmlFor="add-url">
              Product URL / Link <span className="font-normal text-muted">(optional)</span>
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
          <p className="text-[12px] font-medium uppercase tracking-wider text-muted">Estimated Total</p>
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
              <option value="high">High priority</option>
              <option value="medium">Medium priority</option>
              <option value="low">Low priority</option>
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
                  {c}
                </option>
              ))}
            </select>

            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="input w-auto text-sm"
              aria-label="Sort by"
            >
              <option value="newest">Added: newest first</option>
              <option value="oldest">Added: oldest first</option>
              <option value="price_desc">Price: highest first</option>
              <option value="price_asc">Price: lowest first</option>
              <option value="priority">Priority: high to low</option>
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
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filteredItems.map((item) => {
            const daysWaiting = daysSinceDate(item.createdAt.slice(0, 10)) ?? 0;
            const cooldownPassed = daysWaiting >= 30;
            const priorityMeta = PRIORITIES.find((p) => p.value === item.priority) ?? PRIORITIES[1];

            return (
              <div
                key={item.id}
                className="card flex flex-col justify-between overflow-hidden p-5 transition-shadow hover:shadow-sm"
              >
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <span
                      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-medium ${priorityMeta.tone}`}
                    >
                      <span className={`h-1.5 w-1.5 rounded-full ${priorityMeta.dot}`} />
                      {priorityMeta.label.split(" ")[0]}
                    </span>

                    <span className="pill bg-wash text-ink-soft text-[11px]">
                      {item.category}
                    </span>
                  </div>

                  <h3 className="display mt-3 text-xl font-medium leading-snug text-ink">
                    {item.name}
                  </h3>

                  <div className="mt-2 flex items-baseline gap-2">
                    <span className="text-2xl font-semibold tabular text-ink">
                      {formatMoney(item.price)}
                    </span>
                    {item.price === null && (
                      <span className="text-xs text-muted">price not set</span>
                    )}
                  </div>

                  {/* Cooldown indicator */}
                  <div className="mt-3">
                    {cooldownPassed ? (
                      <div className="inline-flex items-center gap-1.5 rounded-md bg-accent-soft px-2 py-1 text-xs font-medium text-accent">
                        <IconCheck width={13} height={13} />
                        <span>30+ day cooldown passed</span>
                      </div>
                    ) : (
                      <div className="inline-flex items-center gap-1.5 rounded-md bg-wash px-2 py-1 text-xs text-muted">
                        <span>Waiting {daysWaiting}d</span>
                        <span>·</span>
                        <span>{30 - daysWaiting}d cooldown left</span>
                      </div>
                    )}
                  </div>

                  {item.notes && (
                    <p className="mt-3 text-[13px] leading-relaxed text-ink-soft line-clamp-3">
                      {item.notes}
                    </p>
                  )}

                  {item.url && (
                    <div className="mt-3">
                      <a
                        href={item.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-xs text-muted hover:text-ink underline"
                      >
                        <IconExternalLink width={13} height={13} />
                        View product page
                      </a>
                    </div>
                  )}
                </div>

                {/* Card actions */}
                <div className="mt-5 border-t border-line pt-3 flex items-center justify-between gap-2">
                  <button
                    type="button"
                    onClick={() => openConvert(item)}
                    className="btn bg-accent-soft text-accent hover:bg-accent hover:text-accent-fg border border-accent/20 px-3 py-1.5 text-xs font-semibold"
                    title="I bought this: move to owned inventory"
                  >
                    <IconCheck width={14} height={14} />
                    Bought this
                  </button>

                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => openEdit(item)}
                      className="btn border border-line p-1.5 text-muted hover:text-ink hover:bg-paper"
                      title="Edit item"
                    >
                      <IconPencil width={14} height={14} />
                    </button>

                    <button
                      type="button"
                      onClick={() => handleDelete(item)}
                      className="btn border border-line p-1.5 text-muted hover:text-clay hover:bg-clay-soft"
                      title="Remove from wishlist"
                    >
                      <IconTrash width={14} height={14} />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
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
                />
              </div>

              <div>
                <label className="label" htmlFor="edit-price">
                  Estimated price ($)
                </label>
                <input
                  id="edit-price"
                  type="number"
                  min="0"
                  step="0.01"
                  className="input"
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
                  list="category-suggestions"
                  className="input"
                  value={editCategory}
                  onChange={(e) => setEditCategory(e.target.value)}
                />
              </div>

              <div>
                <label className="label">Priority</label>
                <div className="flex gap-2">
                  {PRIORITIES.map((p) => (
                    <button
                      key={p.value}
                      type="button"
                      onClick={() => setEditPriority(p.value)}
                      className={`btn flex-1 text-xs border ${
                        editPriority === p.value
                          ? "border-brand bg-brand text-brand-fg font-medium"
                          : "border-line bg-card text-ink-soft hover:border-line-strong"
                      }`}
                    >
                      {p.label.split(" ")[0]}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div>
              <label className="label" htmlFor="edit-url">
                Product URL / Link
              </label>
              <input
                id="edit-url"
                type="url"
                className="input"
                value={editUrl}
                onChange={(e) => setEditUrl(e.target.value)}
              />
            </div>

            <div>
              <label className="label" htmlFor="edit-notes">
                Notes / Reason
              </label>
              <textarea
                id="edit-notes"
                rows={3}
                className="input"
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
              <h2 className="display text-xl">Move to inventory</h2>
              <button
                type="button"
                onClick={() => setConvertingItem(null)}
                className="text-xs text-muted hover:text-ink"
              >
                Close
              </button>
            </div>

            <p className="text-sm text-ink-soft">
              Did you acquire <strong>{convertingItem.name}</strong>? This will create an owned item in your inventory and remove it from your wishlist.
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
                placeholder="Leave blank if unknown"
                value={convertPrice}
                onChange={(e) => setConvertPrice(e.target.value)}
                autoFocus
              />
              <p className="mt-1 text-xs text-muted">
                Defaults to the estimated price of {formatMoney(convertingItem.price)}.
              </p>
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setConvertingItem(null)}
                className="btn border border-line"
              >
                Cancel
              </button>
              <button type="submit" disabled={convertBusy} className="btn bg-accent text-accent-fg hover:bg-accent-solid font-medium">
                {convertBusy ? "Adding…" : "Add to Inventory"}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
