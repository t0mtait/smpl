"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import type { WishlistItem } from "@/lib/db";
import { formatMoney, formatCategory, CATEGORIES } from "@/lib/format";
import { daysSinceDate } from "@/lib/dates";
import { CategoryTag, Pagination, PriorityRing } from "@/components/ui";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import {
  IconCheck,
  IconExternalLink,
  IconHeart,
  IconPlus,
  IconSearch,
  IconSparkles,
  IconTrash,
} from "@/components/icons";

type WishlistSortKey = "name" | "priority" | "category" | "subcategory" | "price" | "url" | "waiting";
type SortDirection = "asc" | "desc";

interface WishlistSortState {
  key: WishlistSortKey;
  direction: SortDirection;
}

const WISHLIST_COLUMNS: { key: WishlistSortKey; label: string; numeric?: boolean }[] = [
  { key: "name", label: "Item" },
  { key: "priority", label: "Priority" },
  { key: "category", label: "Category" },
  { key: "subcategory", label: "Subcategory" },
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

const WISHLIST_COOLDOWN_DAYS = 30;

function CooldownRing({ days }: { days: number }) {
  const d = Math.max(0, days);
  const pct = Math.min(d / WISHLIST_COOLDOWN_DAYS, 1);
  const r = 14;
  const c = 2 * Math.PI * r;
  const ready = d >= WISHLIST_COOLDOWN_DAYS;

  return (
    <span
      className="inline-flex items-center justify-end"
      title={`${d} ${d === 1 ? "day" : "days"} waiting${ready ? " — cooldown passed (ready to purchase)" : ` · ${WISHLIST_COOLDOWN_DAYS - d}d remaining`}`}
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
            className={ready ? "stroke-accent" : "stroke-accent/70"}
          />
        </svg>
        <span className={`tabular relative text-[11px] font-semibold ${ready ? "text-accent" : "text-ink"}`}>
          {d}
        </span>
      </span>
    </span>
  );
}

export default function WishlistClient({ isPro = true }: { isPro?: boolean }) {
  const [items, setItems] = useState<WishlistItem[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters & search
  const [query, setQuery] = useState("");
  const [priorityFilter, setPriorityFilter] = useState<string>("all");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [subcategoryFilter, setSubcategoryFilter] = useState<string>("all");
  const [page, setPage] = useState(1);
  const [sort, setSort] = useState<WishlistSortState>({ key: "waiting", direction: "desc" });

  // Add form toggle
  const [showAddForm, setShowAddForm] = useState(false);
  const [addName, setAddName] = useState("");
  const [addCategory, setAddCategory] = useState("misc");
  const [addSubcategory, setAddSubcategory] = useState("");
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
  const [editSubcategory, setEditSubcategory] = useState("");
  const [editPrice, setEditPrice] = useState("");
  const [editUrl, setEditUrl] = useState("");
  const [editNotes, setEditNotes] = useState("");
  const [editPriority, setEditPriority] = useState<number>(50);
  const [editBusy, setEditBusy] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  // Inline cell edit state
  const [editingCell, setEditingCell] = useState<{ itemId: number; field: string } | null>(null);
  const [inlinePriority, setInlinePriority] = useState<number>(50);
  const [userCategories, setUserCategories] = useState<{ category: string; subcategories: string[] }[]>([]);

  useEffect(() => {
    fetch("/api/user/categories")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.categories?.length) {
          setUserCategories(data.categories);
        }
      })
      .catch(() => {});
  }, []);

  const subOptions = (cat: string, current?: string) => {
    const opts = userCategories.find((u) => u.category === cat)?.subcategories || [];
    return current && !opts.includes(current) ? [current, ...opts] : opts;
  };

  const categoryNames = useMemo(() => {
    const set = new Set((items ?? []).map((i) => i.category || "misc"));
    for (const u of userCategories) set.add(u.category);
    for (const c of COMMON_CATEGORIES) set.add(c);
    return [...set].sort();
  }, [items, userCategories]);

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

  const subcategories = useMemo(() => {
    if (categoryFilter === "all") return [];
    const set = new Set(
      (items ?? [])
        .filter((i) => i.category === categoryFilter && i.subcategory?.trim())
        .map((i) => i.subcategory.trim())
    );
    const userSubs = userCategories.find((u) => u.category === categoryFilter)?.subcategories || [];
    for (const s of userSubs) set.add(s);
    return [...set].sort();
  }, [items, categoryFilter, userCategories]);

  const filteredItems = useMemo(() => {
    let list = items ?? [];
    if (query.trim()) {
      const q = query.toLowerCase().trim();
      list = list.filter(
        (i) =>
          i.name.toLowerCase().includes(q) ||
          i.category.toLowerCase().includes(q) ||
          (i.subcategory && i.subcategory.toLowerCase().includes(q)) ||
          i.notes.toLowerCase().includes(q) ||
          i.url.toLowerCase().includes(q)
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
      if (subcategoryFilter !== "all") {
        list = list.filter((i) => (i.subcategory || "") === subcategoryFilter);
      }
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
      if (sort.key === "subcategory") {
        return (a.subcategory || "").localeCompare(b.subcategory || "") * dir;
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
        const daysA = daysSinceDate(a.createdAt.slice(0, 10)) ?? 0;
        const daysB = daysSinceDate(b.createdAt.slice(0, 10)) ?? 0;
        if (daysA !== daysB) {
          return (daysA - daysB) * dir;
        }
        return (new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()) * dir;
      }
      return 0;
    });
  }, [items, query, priorityFilter, categoryFilter, subcategoryFilter, sort]);

  useEffect(() => {
    setPage(1);
  }, [query, priorityFilter, categoryFilter, subcategoryFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredItems.length / 10));
  const safePage = Math.min(page, totalPages);
  const paginatedItems = filteredItems.slice((safePage - 1) * 10, safePage * 10);

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
          subcategory: addSubcategory.trim(),
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
      setAddSubcategory("");
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
    setEditSubcategory(item.subcategory || "");
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
          subcategory: editSubcategory.trim(),
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
      <header className="animate-rise flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <span className="flex h-6 w-6 items-center justify-center rounded-md bg-accent-soft text-accent">
              <IconHeart width={15} height={15} />
            </span>
            <p className="eyebrow">Intentional Living</p>
          </div>
          <h1 className="display mt-2 text-4xl leading-[1.1] sm:text-5xl">Wishlist</h1>
        </div>

        {isPro && (
          <div className="flex w-full flex-col gap-2.5 sm:flex-row sm:flex-wrap sm:items-center lg:w-auto lg:flex-1 lg:justify-end">
            {/* Mobile search row: Add to wishlist beside the searchbar */}
            <div className="flex items-center gap-2 flex-1 min-w-[200px] sm:max-w-xs">
              <div className="relative flex-1">
                <IconSearch
                  width={15}
                  height={15}
                  className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted"
                />
                <input
                  type="search"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search wishlist…"
                  className="input pl-9 text-xs sm:text-sm py-1.5 sm:py-2"
                />
              </div>

              <button
                type="button"
                onClick={() => setShowAddForm(!showAddForm)}
                className="btn-primary sm:hidden px-3 py-1.5 text-xs font-semibold shrink-0"
              >
                <IconPlus width={15} height={15} />
                {showAddForm ? "Close" : "Add"}
              </button>
            </div>

            {/* Priorities and categories filter next to one another on mobile */}
            <div className="grid grid-cols-2 gap-2 sm:flex sm:items-center sm:gap-2.5">
              <select
                value={priorityFilter}
                onChange={(e) => setPriorityFilter(e.target.value)}
                className="input w-auto text-xs sm:text-sm px-2 py-1.5 sm:py-2"
                aria-label="Filter by priority"
              >
                <option value="all">All priorities</option>
                <option value="high">High (70–100)</option>
                <option value="medium">Medium (40–69)</option>
                <option value="low">Low (0–39)</option>
              </select>

              <select
                value={categoryFilter}
                onChange={(e) => {
                  setCategoryFilter(e.target.value);
                  setSubcategoryFilter("all");
                }}
                className="input w-auto text-xs sm:text-sm px-2 py-1.5 sm:py-2"
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

            {categoryFilter !== "all" && (
              <select
                value={subcategoryFilter}
                onChange={(e) => setSubcategoryFilter(e.target.value)}
                className="input w-full sm:w-auto text-xs sm:text-sm px-2 py-1.5 sm:py-2"
                aria-label="Filter by subcategory"
              >
                <option value="all">All subcategories</option>
                {subcategories.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            )}

            <button
              type="button"
              onClick={() => setShowAddForm(!showAddForm)}
              className="btn-primary hidden sm:inline-flex"
            >
              <IconPlus width={16} height={16} />
              {showAddForm ? "Close form" : "Add to wishlist"}
            </button>
          </div>
        )}
      </header>

      {!isPro ? (
        <div className="card border-accent/40 bg-paper p-8 sm:p-12 text-center">
          <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-accent-soft text-accent mb-4">
            <IconHeart width={28} height={28} />
          </span>
          <h2 className="display text-2xl sm:text-3xl">Wishlist is a Pro Feature</h2>
          <p className="mt-2 text-[14px] text-muted max-w-lg mx-auto">
            Upgrade to smpl. Pro to unlock intentional purchasing and cooldown tracking. Give potential buys a 30-day cooling-off period, prioritize candidates from 0 to 100, and convert them seamlessly into owned inventory when ready.
          </p>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
            <Link href="/account#subscription" className="btn-primary">
              <IconSparkles width={16} height={16} />
              Upgrade to Pro for $4.29/mo
            </Link>
            <Link href="/items" className="btn-secondary">
              Back to Inventory
            </Link>
          </div>
        </div>
      ) : (
        <>
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

          <div className="grid gap-4 sm:grid-cols-3">
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
                onChange={(e) => {
                  setAddCategory(e.target.value);
                  setAddSubcategory("");
                }}
              />
              <datalist id="category-suggestions">
                {categoryNames.map((c) => (
                  <option key={c} value={c} />
                ))}
              </datalist>
            </div>

            <div>
              <label className="label" htmlFor="add-subcat">
                Subcategory <span className="font-normal text-muted">(optional)</span>
              </label>
              <input
                id="add-subcat"
                list="subcategory-suggestions"
                className="input"
                placeholder="e.g. accessories"
                value={addSubcategory}
                onChange={(e) => setAddSubcategory(e.target.value)}
              />
              <datalist id="subcategory-suggestions">
                {subOptions(addCategory).map((s) => (
                  <option key={s} value={s} />
                ))}
              </datalist>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="label mb-0" htmlFor="add-priority">Priority</label>
                <span className="text-xs font-semibold tabular text-muted">{addPriority}</span>
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
            <table className="w-full min-w-full sm:min-w-[960px] border-collapse text-left">
              <thead>
                <tr className="h-11 border-b border-line text-[11px] font-semibold uppercase tracking-[0.12em] text-muted">
                  {WISHLIST_COLUMNS.map((col) => {
                    const active = sort.key === col.key;
                    const isVisibleOnMobile =
                      col.key === "name" || col.key === "priority" || col.key === "waiting" || col.key === "url";
                    const isPriority = col.key === "priority";
                    const isUrl = col.key === "url";

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
                        className={`whitespace-nowrap px-3 sm:px-4 py-2.5 align-middle text-[11px] font-semibold uppercase tracking-[0.12em] ${
                          !isVisibleOnMobile ? "hidden sm:table-cell" : ""
                        } ${isPriority ? "w-11 sm:w-auto px-1 sm:px-4" : ""} ${
                          isUrl ? "w-16 sm:w-auto px-1 sm:px-4" : ""
                        } ${col.numeric ? "text-right" : "text-left"}`}
                      >
                        <button
                          type="button"
                          onClick={() => toggleSort(col.key)}
                          className={`inline-flex items-center gap-1.5 rounded transition-colors hover:text-ink ${
                            active ? "text-ink" : "text-muted"
                          }`}
                        >
                          {col.key === "url" ? (
                            <>
                              <span className="hidden sm:inline">Store </span>Link
                            </>
                          ) : (
                            col.label
                          )}
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
                    className="hidden sm:table-cell whitespace-nowrap px-4 py-2.5 align-middle text-right text-[11px] font-semibold uppercase tracking-[0.12em] text-muted"
                  >
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {paginatedItems.map((item) => {
                  const daysWaiting = daysSinceDate(item.createdAt.slice(0, 10)) ?? 0;
                  const cooldownPassed = daysWaiting >= 30;

                  return (
                    <tr
                      key={item.id}
                      onClick={() => {
                        if (typeof window !== "undefined" && window.innerWidth < 640) {
                          openEdit(item);
                        }
                      }}
                      className="h-[52px] sm:h-[54px] border-b border-line-soft transition-colors last:border-0 even:bg-wash/60 dark:even:bg-shell/70 hover:bg-wash dark:hover:bg-wash/40 cursor-pointer sm:cursor-default"
                    >
                      {/* Item Name (click to open general edit popup) */}
                      <th scope="row" className="px-3 sm:px-4 py-2 sm:py-2.5 align-middle text-left font-normal">
                        <div className="min-w-0">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              openEdit(item);
                            }}
                            className="text-left font-medium text-ink hover:text-accent transition-colors block cursor-pointer group truncate max-w-[180px] sm:max-w-[240px]"
                            title="Click to edit item"
                          >
                            <span className="group-hover:underline underline-offset-2">{item.name}</span>
                          </button>
                          {item.notes && (
                            <p className="text-[11px] text-muted truncate max-w-[180px] sm:max-w-[240px] font-normal" title={item.notes}>
                              {item.notes}
                            </p>
                          )}
                        </div>
                      </th>

                      {/* Priority (click to edit field) */}
                      <td className="px-1 sm:px-4 py-2 sm:py-2.5 align-middle w-11 sm:w-auto">
                        {editingCell?.itemId === item.id && editingCell?.field === "priority" ? (
                          <div className="flex items-center gap-2">
                            <PriorityRing priority={inlinePriority} size={28} stroke={3} />
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
                            onClick={(e) => {
                              e.stopPropagation();
                              setInlinePriority(item.priority);
                              setEditingCell({ itemId: item.id, field: "priority" });
                            }}
                            className="inline-flex items-center gap-2 rounded-lg py-1 px-1.5 -mx-1.5 hover:bg-wash transition-colors group cursor-pointer"
                            title="Click to edit priority (0–100)"
                          >
                            <PriorityRing priority={item.priority} size={28} stroke={3} />
                          </button>
                        )}
                      </td>

                      {/* Category (click to edit field) */}
                      <td className="hidden sm:table-cell px-4 py-2 sm:py-2.5 align-middle">
                        {editingCell?.itemId === item.id && editingCell?.field === "category" ? (
                          <select
                            autoFocus
                            defaultValue={item.category}
                            onChange={(e) => saveInline(item.id, { category: e.target.value })}
                            onBlur={() => setEditingCell(null)}
                            className="input py-0.5 px-2 text-xs h-7"
                          >
                            {categoryNames.map((c) => (
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
                            className="inline-block cursor-pointer hover:opacity-80 transition-opacity"
                            title="Click to change category"
                          >
                            <CategoryTag category={item.category} />
                          </span>
                        )}
                      </td>

                      {/* Subcategory (click to edit field) */}
                      <td className="hidden sm:table-cell px-4 py-2 sm:py-2.5 align-middle text-[13px] text-muted">
                        {editingCell?.itemId === item.id && editingCell?.field === "subcategory" ? (
                          <select
                            autoFocus
                            defaultValue={item.subcategory || ""}
                            onChange={(e) => saveInline(item.id, { subcategory: e.target.value })}
                            onBlur={() => setEditingCell(null)}
                            className="input py-0.5 px-2 text-xs h-7"
                          >
                            <option value="">—</option>
                            {subOptions(item.category, item.subcategory).map((s) => (
                              <option key={s} value={s}>
                                {s}
                              </option>
                            ))}
                          </select>
                        ) : (
                          <span
                            onClick={(e) => {
                              e.stopPropagation();
                              setEditingCell({ itemId: item.id, field: "subcategory" });
                            }}
                            className="inline-block py-1 px-1.5 -mx-1.5 rounded hover:bg-wash cursor-pointer transition-colors"
                            title="Click to edit subcategory"
                          >
                            {item.subcategory || <span className="text-muted/60">—</span>}
                          </span>
                        )}
                      </td>

                      {/* Price (click to edit field) */}
                      <td className="hidden sm:table-cell tabular px-4 py-2 sm:py-2.5 align-middle text-right text-[13px] font-medium text-ink">
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
                            onClick={(e) => {
                              e.stopPropagation();
                              setEditingCell({ itemId: item.id, field: "price" });
                            }}
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
                      <td className="px-1 sm:px-4 py-2 sm:py-2.5 align-middle text-[13px] w-16 sm:w-auto">
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
                              onClick={(e) => e.stopPropagation()}
                              className="inline-flex items-center gap-1 rounded bg-accent-soft px-1.5 sm:px-2 py-0.5 text-[11px] font-medium text-accent hover:opacity-80 transition-opacity"
                              title={`Visit ${item.url}`}
                            >
                              <IconExternalLink width={11} height={11} />
                              <span className="max-w-[48px] sm:max-w-[100px] truncate">{getDomain(item.url)}</span>
                            </a>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setEditingCell({ itemId: item.id, field: "url" });
                              }}
                              className="hidden sm:inline text-[11px] text-muted hover:text-ink transition-colors"
                              title="Edit link"
                            >
                              Edit
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setEditingCell({ itemId: item.id, field: "url" });
                            }}
                            className="inline-flex items-center gap-1 rounded border border-dashed border-line px-1.5 sm:px-2 py-0.5 text-[11px] text-muted hover:border-line-strong hover:text-ink transition-colors"
                            title="Add shopping link"
                          >
                            <IconPlus width={11} height={11} />
                            <span><span className="hidden sm:inline">Add </span>link</span>
                          </button>
                        )}
                      </td>

                      {/* Cooldown */}
                      <td className="tabular px-2 sm:px-4 py-2 sm:py-2.5 align-middle text-right text-[13px]">
                        <CooldownRing days={daysWaiting} />
                      </td>

                      {/* Actions: Edit icon removed, only Bought and Delete */}
                      <td className="hidden sm:table-cell px-4 py-2 sm:py-2.5 align-middle text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              openConvert(item);
                            }}
                            className="btn bg-accent-soft text-accent hover:bg-accent hover:text-accent-fg border border-accent/20 px-2.5 py-1 text-xs font-semibold"
                            title="I bought this: move to owned inventory"
                          >
                            <IconCheck width={13} height={13} />
                            Bought
                          </button>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDelete(item);
                            }}
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
          <Pagination
            currentPage={safePage}
            totalItems={filteredItems.length}
            pageSize={10}
            onPageChange={setPage}
          />
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

            <div className="grid gap-4 sm:grid-cols-3">
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
                  {categoryNames.map((c) => (
                    <option key={c} value={c} />
                  ))}
                </datalist>
              </div>

              <div>
                <label className="label" htmlFor="edit-subcat">
                  Subcategory
                </label>
                <input
                  id="edit-subcat"
                  list="edit-subcategory-suggestions"
                  className="input"
                  value={editSubcategory}
                  onChange={(e) => setEditSubcategory(e.target.value)}
                />
                <datalist id="edit-subcategory-suggestions">
                  {subOptions(editCategory).map((s) => (
                    <option key={s} value={s} />
                  ))}
                </datalist>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="label mb-0" htmlFor="edit-priority">Priority</label>
                  <span className="text-xs font-semibold tabular text-muted">{editPriority}</span>
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
        </>
      )}
    </div>
  );
}
