"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import type { Item } from "@/lib/db";
import { CATEGORIES, formatCategory, formatMoney, formatQuarter, getCurrencySymbol } from "@/lib/format";
import { currentQuarter, daysSinceDate } from "@/lib/dates";
import { shouldAutoSelectInput } from "@/lib/device";
import { CategoryTag, Pagination } from "@/components/ui";
import { IconArrowLeft, IconBox, IconCheck,
  IconSearch, IconFlame, IconTrash, IconUndo } from "@/components/icons";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { handleFormQuickSave } from "@/lib/keyboard";

interface OffloadModalProps {
  item: Item;
  onClose: () => void;
  onSuccess: (updatedItem: Item) => void;
}

function OffloadModal({ item, onClose, onSuccess }: OffloadModalProps) {
  const currencySymbol = getCurrencySymbol();
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

        <form onSubmit={handleSubmit} onKeyDown={handleFormQuickSave} className="mt-5 space-y-4">
          <div>
            <label className="label" htmlFor="offload-amount">
              {currencySymbol} Returned on offload
            </label>
            <div className="relative">
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted">
                {currencySymbol}
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
            <p className="mt-1 text-[11px] text-muted">Default is {currencySymbol}0 (disposed / donated / no return).</p>
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
              title="Confirm offload (⌘+Enter / Ctrl+Enter)"
            >
              <IconCheck width={15} height={15} />
              {busy ? "Offloading…" : "Confirm Offload"}
              <kbd className="ml-1.5 hidden sm:inline-flex items-center rounded border border-clay-fg/25 bg-clay-fg/10 px-1 py-0.5 text-[10px] font-sans opacity-90">
                ⌘↵
              </kbd>
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

type PurgatorySortKey = "name" | "brand" | "category" | "value" | "acquired" | "purgatoryDate";
type SortDirection = "asc" | "desc";

export default function PurgatoryClient({ initialItems }: { initialItems: Item[] }) {
  const currencySymbol = getCurrencySymbol();
  const router = useRouter();
  const searchParams = useSearchParams();

  const initialQuery = searchParams.get("q") ?? "";
  const initialCategory = searchParams.get("category") ?? "all";
  const initialPage = parseInt(searchParams.get("page") ?? "1", 10) || 1;
  const rawSortKey = searchParams.get("sortKey") as PurgatorySortKey | null;
  const initialSortKey: PurgatorySortKey =
    rawSortKey && ["name", "brand", "category", "value", "acquired", "purgatoryDate"].includes(rawSortKey)
      ? rawSortKey
      : "purgatoryDate";
  const rawSortDir = searchParams.get("sortDir") as SortDirection | null;
  const initialSortDir: SortDirection = rawSortDir === "asc" ? "asc" : "desc";

  const [items, setItems] = useState<Item[]>(initialItems);
  const categories = useMemo(() => {
    const set = new Set(items.map((i) => i.category));
    return [...set].sort();
  }, [items]);

  const [query, setQuery] = useState(initialQuery);
  const [categoryFilter, setCategoryFilter] = useState(initialCategory);
  const [page, setPage] = useState(initialPage);
  const [sort, setSort] = useState<{ key: PurgatorySortKey; direction: SortDirection }>({
    key: initialSortKey,
    direction: initialSortDir,
  });

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
  const [deletingItem, setDeletingItem] = useState<Item | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);

  // General edit popup state (opened from clicking on the item name, matching Inventory)
  const [editingItem, setEditingItem] = useState<Item | null>(null);
  const editNameInputRef = useRef<HTMLInputElement>(null);
  const [editName, setEditName] = useState("");
  const [editBrand, setEditBrand] = useState("");
  const [editCategory, setEditCategory] = useState("misc");
  const [editSubcategory, setEditSubcategory] = useState("");
  const [editQuality, setEditQuality] = useState("");
  const [editUsage, setEditUsage] = useState("monthly");
  const [editValue, setEditValue] = useState("");
  const [editPrice, setEditPrice] = useState("");
  const [editPurchaseDate, setEditPurchaseDate] = useState("");
  const [editPurgatoryDate, setEditPurgatoryDate] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editBusy, setEditBusy] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  useEffect(() => {
    if (editingItem) {
      const timer = setTimeout(() => {
        if (editNameInputRef.current && shouldAutoSelectInput()) {
          editNameInputRef.current.focus();
          editNameInputRef.current.select();
        }
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [editingItem]);

  const [userCategories, setUserCategories] = useState<{ category: string; subcategories: string[] }[]>([]);

  useEffect(() => {
    fetch("/api/user/categories")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.categories) setUserCategories(data.categories);
      })
      .catch(() => {});
  }, []);

  const subOptions = (cat: string, currentSub?: string) => {
    const found = userCategories.find((u) => u.category === cat);
    const list = found ? found.subcategories : [];
    if (currentSub && !list.includes(currentSub)) {
      return [currentSub, ...list];
    }
    return list;
  };

  useEffect(() => {
    if (!editingItem) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (deletingItem) return;
        setEditingItem(null);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [editingItem, deletingItem]);

  const openEditModal = (item: Item) => {
    setEditingItem(item);
    setEditName(item.name);
    setEditBrand(item.brand || "");
    setEditCategory(item.category || "misc");
    setEditSubcategory(item.subcategory || "");
    setEditQuality(item.quality || "");
    setEditUsage(
      item.useFrequency === "daily" || item.useFrequency === "weekly"
        ? "daily"
        : item.useFrequency === "rare" || item.useFrequency === "never"
        ? "rare"
        : item.useFrequency === "seasonal"
        ? "seasonal"
        : "monthly"
    );
    setEditValue(item.currentValue === null ? "" : String(item.currentValue));
    setEditPrice(item.purchasePrice === null ? "" : String(item.purchasePrice));
    setEditPurchaseDate(item.purchaseDate || "");
    setEditPurgatoryDate(item.purgatoryDate ? item.purgatoryDate.slice(0, 10) : "");
    setEditDescription(item.description || "");
    setEditError(null);
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingItem || !editName.trim()) return;
    setEditBusy(true);
    setEditError(null);

    try {
      const res = await fetch(`/api/items/${editingItem.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: editName.trim(),
          brand: editBrand.trim(),
          category: editCategory.trim() || "uncategorized",
          subcategory: editSubcategory.trim(),
          quality: editQuality.trim(),
          location: "",
          useFrequency: editUsage,
          status: "purgatory",
          currentValue: editValue.trim() === "" ? null : Number(editValue),
          purchasePrice: editPrice.trim() === "" ? null : Number(editPrice),
          purchaseDate: editPurchaseDate.trim() || null,
          purgatoryDate: editPurgatoryDate.trim() || null,
          description: editDescription.trim(),
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setEditError(data.error ?? "Failed to update item.");
        setEditBusy(false);
        return;
      }

      const data = await res.json();
      setItems((prev) =>
        prev.map((it) => (it.id === editingItem.id ? { ...it, ...data.item } : it))
      );
      setEditingItem(null);
      setEditBusy(false);
    } catch {
      setEditError("Network error. Try again.");
      setEditBusy(false);
    }
  };

  const deleteItemPermanently = async (item: Item) => {
    setDeleteBusy(true);
    try {
      const res = await fetch(`/api/items/${item.id}`, { method: "DELETE" });
      if (res.ok) {
        setItems((prev) => prev.filter((i) => i.id !== item.id));
        setDeletingItem(null);
      }
    } finally {
      setDeleteBusy(false);
    }
  };


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

  const toggleSort = (key: PurgatorySortKey) => {
    setSort((curr) => {
      if (curr.key === key) {
        return { key, direction: curr.direction === "asc" ? "desc" : "asc" };
      }
      return { key, direction: key === "purgatoryDate" || key === "value" ? "desc" : "asc" };
    });
  };

  const buildPurgatoryQuery = (p = page, q = query, cat = categoryFilter, s = sort) => {
    const sp = new URLSearchParams();
    if (p > 1) sp.set("page", String(p));
    if (q.trim()) sp.set("q", q.trim());
    if (cat && cat !== "all") sp.set("category", cat);
    if (s.key !== "purgatoryDate") sp.set("sortKey", s.key);
    if (s.direction !== "desc") sp.set("sortDir", s.direction);
    const qs = sp.toString();
    return qs ? `?${qs}` : "";
  };

  useEffect(() => {
    const qs = buildPurgatoryQuery(page, query, categoryFilter, sort);
    const newUrl = `/purgatory${qs}`;
    window.history.replaceState(null, "", newUrl);
  }, [page, query, categoryFilter, sort]);

  const isInitialMount = useRef(true);
  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false;
      return;
    }
    setPage(1);
  }, [query, categoryFilter]);

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
                        openEditModal(item);
                      }
                    }}
                    className="h-[52px] sm:h-[54px] border-b border-line-soft transition-colors last:border-0 even:bg-wash/60 dark:even:bg-shell/70 hover:bg-wash dark:hover:bg-wash/40 cursor-pointer sm:cursor-default"
                  >
                    <th scope="row" className="px-3 sm:px-4 py-2 sm:py-2.5 align-middle text-left font-normal">
                      <span
                        onClick={(e) => {
                          e.stopPropagation();
                          openEditModal(item);
                        }}
                        className="font-medium text-ink hover:text-accent transition-colors inline-block cursor-pointer"
                      >
                        {item.name}
                      </span>
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
                          {(userCategories.length > 0 ? userCategories.map((u) => u.category) : CATEGORIES).map((c) => (
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
                        <button
                          type="button"
                          className="btn border border-line text-muted hover:border-danger hover:bg-danger-soft hover:text-danger px-2 py-1 text-[12px]"
                          onClick={(e) => {
                            e.stopPropagation();
                            setDeletingItem(item);
                          }}
                          disabled={busyId === item.id}
                          title="Delete item permanently"
                        >
                          <IconTrash width={13} height={13} />
                          <span className="sr-only">Delete item permanently</span>
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

      {/* ---------------- General Edit Modal (matching Inventory) ---------------- */}
      {editingItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm">
          <form
            onSubmit={handleEditSubmit}
            onKeyDown={handleFormQuickSave}
            className="card animate-rise w-full max-w-lg space-y-4 p-6 shadow-xl max-h-[90vh] overflow-y-auto"
          >
            <div className="flex items-center justify-between border-b border-line pb-3">
              <div>
                <h2 className="display text-xl">Edit item</h2>
                <Link
                  href={`/items/${editingItem.id}?returnTo=${encodeURIComponent(`/purgatory${buildPurgatoryQuery()}`)}`}
                  className="text-xs text-muted hover:text-accent underline transition-colors"
                >
                  View full item page &rarr;
                </Link>
              </div>
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
              <div className="grid grid-cols-2 gap-3 sm:col-span-2">
                <div>
                  <label className="label" htmlFor="edit-item-name">
                    Name *
                  </label>
                  <input
                    ref={editNameInputRef}
                    id="edit-item-name"
                    className="input"
                    required
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                  />
                </div>

                <div>
                  <label className="label" htmlFor="edit-item-brand">
                    Brand
                  </label>
                  <input
                    id="edit-item-brand"
                    className="input"
                    value={editBrand}
                    onChange={(e) => setEditBrand(e.target.value)}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 sm:col-span-2">
                <div>
                  <label className="label" htmlFor="edit-item-cat">
                    Category
                  </label>
                  <select
                    id="edit-item-cat"
                    className="input"
                    value={editCategory}
                    onChange={(e) => {
                      setEditCategory(e.target.value);
                      setEditSubcategory("");
                    }}
                  >
                    {(userCategories.length > 0 ? userCategories.map((u) => u.category) : CATEGORIES).map((c) => (
                      <option key={c} value={c}>
                        {formatCategory(c)}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="label" htmlFor="edit-item-subcat">
                    Subcategory
                  </label>
                  <select
                    id="edit-item-subcat"
                    className="input"
                    value={editSubcategory}
                    onChange={(e) => setEditSubcategory(e.target.value)}
                  >
                    <option value="">None</option>
                    {subOptions(editCategory, editSubcategory).map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 sm:col-span-2">
                <div>
                  <label className="label" htmlFor="edit-item-quality">
                    Quality
                  </label>
                  <select
                    id="edit-item-quality"
                    className="input"
                    value={editQuality}
                    onChange={(e) => setEditQuality(e.target.value)}
                  >
                    <option value="">— None —</option>
                    <option value="high">High</option>
                    <option value="medium">Medium</option>
                    <option value="low">Low</option>
                  </select>
                </div>

                <div>
                  <label className="label" htmlFor="edit-item-usage">
                    Usage
                  </label>
                  <select
                    id="edit-item-usage"
                    className="input"
                    value={editUsage}
                    onChange={(e) => setEditUsage(e.target.value)}
                  >
                    <option value="daily">Heavy</option>
                    <option value="monthly">Occasional</option>
                    <option value="rare">Rare</option>
                    <option value="seasonal">Seasonal</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 sm:col-span-2">
                <div>
                  <label className="label" htmlFor="edit-item-value">
                    Value ({currencySymbol})
                  </label>
                  <input
                    id="edit-item-value"
                    type="number"
                    min="0"
                    step="0.01"
                    className="input"
                    value={editValue}
                    onChange={(e) => setEditValue(e.target.value)}
                  />
                </div>

                <div>
                  <label className="label" htmlFor="edit-item-price">
                    Paid ({currencySymbol})
                  </label>
                  <input
                    id="edit-item-price"
                    type="number"
                    min="0"
                    step="0.01"
                    className="input"
                    value={editPrice}
                    onChange={(e) => setEditPrice(e.target.value)}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 sm:col-span-2">
                <div>
                  <label className="label" htmlFor="edit-item-date">
                    Acquisition date
                  </label>
                  <input
                    id="edit-item-date"
                    className="input"
                    placeholder="YYYY-MM-DD or Q1 2024"
                    value={editPurchaseDate}
                    onChange={(e) => setEditPurchaseDate(e.target.value)}
                  />
                </div>

                <div>
                  <label className="label" htmlFor="edit-item-purgatory-date">
                    Added to purgatory
                  </label>
                  <input
                    id="edit-item-purgatory-date"
                    type="date"
                    className="input"
                    value={editPurgatoryDate}
                    onChange={(e) => setEditPurgatoryDate(e.target.value)}
                  />
                  <p className="mt-1 text-[11px] text-muted">
                    Date item entered purgatory (used to calculate age).
                  </p>
                </div>
              </div>

              <div className="sm:col-span-2">
                <label className="label" htmlFor="edit-item-desc">
                  Notes / Description
                </label>
                <textarea
                  id="edit-item-desc"
                  rows={2}
                  className="input"
                  value={editDescription}
                  onChange={(e) => setEditDescription(e.target.value)}
                />
              </div>
            </div>

            <div className="flex items-center justify-between gap-3 pt-2">
              <button
                type="button"
                onClick={() => setDeletingItem(editingItem)}
                className="btn-danger inline-flex items-center gap-1.5 text-xs py-1.5 px-3"
              >
                <IconTrash width={14} height={14} />
                Delete item
              </button>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setEditingItem(null)}
                  className="btn border border-line"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={editBusy}
                  className="btn-primary"
                  title="Save changes (⌘+Enter / Ctrl+Enter)"
                >
                  {editBusy ? "Saving…" : "Save changes"}
                  <kbd className="ml-1.5 hidden sm:inline-flex items-center rounded border border-brand-fg/25 bg-brand-fg/10 px-1 py-0.5 text-[10px] font-sans opacity-90">
                    ⌘↵
                  </kbd>
                </button>
              </div>
            </div>
          </form>
        </div>
      )}

      <ConfirmDialog
        open={Boolean(deletingItem)}
        title="Delete item permanently?"
        message={
          deletingItem ? (
            <>
              Are you sure you want to delete <strong className="text-ink">{deletingItem.name}</strong>? It will be completely removed as if it was made by mistake, and won&apos;t count as offloaded or kept.
            </>
          ) : ""
        }
        confirmLabel="Delete permanently"
        busy={deleteBusy}
        onConfirm={() => {
          if (deletingItem) deleteItemPermanently(deletingItem);
        }}
        onCancel={() => setDeletingItem(null)}
      />
    </div>
  );
}
