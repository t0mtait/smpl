"use client";

import { useEffect, useMemo, useRef, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import type { Item } from "@/lib/db";
import { shouldAutoSelectInput } from "@/lib/device";
import {
  CATEGORIES,
  formatCategory,
  formatMoney,
  formatQuarter,
  getCurrencySymbol,
  getItemStatusInfo,
  getYearStyle,
} from "@/lib/format";
import { CategoryTag, Pagination, QualityIcon, StatusTag } from "@/components/ui";
import { IconBox, IconCopy, IconFlame, IconPlus, IconSearch, IconSparkles, IconTag, IconTrash } from "@/components/icons";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { handleFormQuickSave } from "@/lib/keyboard";
import {
  DEFAULT_SORT,
  SORT_COLUMNS,
  filterItems,
  sortItems,
  toggleSort,
  type SortKey,
  type SortState,
} from "@/lib/sort";

function InventoryInner() {
  const currencySymbol = getCurrencySymbol();
  const params = useSearchParams();
  const [items, setItems] = useState<Item[] | null>(null);
  const [query, setQuery] = useState("");
  const initialStatus = params.get("status");
  const [status, setStatus] = useState(initialStatus === "owned" ? "all" : (initialStatus ?? "all"));
  const [category, setCategory] = useState(params.get("category") ?? "all");
  const [subcategory, setSubcategory] = useState("all");
  const [page, setPage] = useState(1);
  const [sort, setSort] = useState<SortState>(DEFAULT_SORT);
  const [error, setError] = useState<string | null>(null);

  // General edit popup state (opened from clicking on the item name)
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
  const [editDescription, setEditDescription] = useState("");
  const [editBusy, setEditBusy] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  // Auto-select item name on desktop devices when the edit modal opens,
  // but avoid focusing on phones/ipads to prevent keyboard clutter.
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

  // Deletion state
  const [deletingItem, setDeletingItem] = useState<Item | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [duplicateBusy, setDuplicateBusy] = useState(false);

  // Bulk action state
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [bulkBusy, setBulkBusy] = useState(false);
  const [confirmBulkDelete, setConfirmBulkDelete] = useState(false);
  const [confirmBulkPurgatory, setConfirmBulkPurgatory] = useState(false);
  const [bulkCategory, setBulkCategory] = useState<string>("misc");
  const [showBulkCategoryModal, setShowBulkCategoryModal] = useState(false);

  // Inline cell edit state: clicking on individual column values
  const [editingCell, setEditingCell] = useState<{ itemId: number; field: string } | null>(null);
  const [userCategories, setUserCategories] = useState<{ category: string; subcategories: string[] }[]>([]);

  useEffect(() => {
    fetch("/api/user/categories")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.categories?.length) setUserCategories(data.categories);
      })
      .catch(() => {});
  }, []);

  const load = async () => {
    try {
      const res = await fetch("/api/items");
      if (res.status === 401) {
        window.location.href = "/auth/login?next=/items";
        return;
      }
      const data = await res.json();
      // Offloaded items or items in purgatory should not appear in the items table (inventory)
      const activeItems = (data.items ?? []).filter((item: Item) => {
        const isOffloaded =
          item.status === "sold" ||
          item.status === "donated" ||
          item.status === "disposed" ||
          item.status === "closed" ||
          item.status === "offloaded" ||
          Boolean(item.offloadedDate && item.status !== "owned");
        const isPurgatory =
          item.status === "purgatory" ||
          Boolean(item.purgatoryDate && item.status !== "owned");
        return !isOffloaded && !isPurgatory && item.status === "owned";
      });
      setItems(activeItems);
      setError(null);
    } catch {
      setError("Could not load items.");
    }
  };

  useEffect(() => {
    load();
  }, []);

  const categories = useMemo(() => {
    const set = new Set((items ?? []).map((i) => i.category));
    return [...set].sort();
  }, [items]);

  const subOptions = (cat: string, current?: string | null) => {
    const opts = userCategories.find((u) => u.category === cat)?.subcategories || [];
    return current && !opts.includes(current) ? [current, ...opts] : opts;
  };

  const subcategories = useMemo(() => {
    if (category === "all") return [];
    const set = new Set(
      (items ?? [])
        .filter((i) => i.category === category && i.subcategory?.trim())
        .map((i) => i.subcategory.trim())
    );
    return [...set].sort();
  }, [items, category]);

  const filtered = useMemo(
    () => filterItems(items ?? [], { query, status, category, subcategory }),
    [items, status, category, subcategory, query]
  );

  const sorted = useMemo(() => sortItems(filtered, sort), [filtered, sort]);

  useEffect(() => {
    setPage(1);
  }, [query, status, category, subcategory]);

  const totalPages = Math.max(1, Math.ceil(sorted.length / 10));
  const safePage = Math.min(page, totalPages);
  const paginatedItems = sorted.slice((safePage - 1) * 10, safePage * 10);

  const onSort = (key: SortKey) => setSort((current) => toggleSort(current, key));

  const toggleSelectOne = (id: number) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAllPage = () => {
    const pageIds = paginatedItems.map((i) => i.id);
    const allSelected = pageIds.length > 0 && pageIds.every((id) => selectedIds.has(id));
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (allSelected) {
        pageIds.forEach((id) => next.delete(id));
      } else {
        pageIds.forEach((id) => next.add(id));
      }
      return next;
    });
  };

  const clearSelection = () => setSelectedIds(new Set());

  const executeBulkAction = async (
    action: "purgatory" | "delete" | "category" | "priority",
    extra: Record<string, unknown> = {}
  ) => {
    if (selectedIds.size === 0) return;
    setBulkBusy(true);
    setError(null);
    try {
      const ids = Array.from(selectedIds);
      const res = await fetch("/api/items/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, itemIds: ids, ...extra }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Bulk action failed");
      }

      if (action === "purgatory" || action === "delete") {
        setItems((prev) => (prev ? prev.filter((i) => !selectedIds.has(i.id)) : null));
      } else if (action === "category" && typeof extra.category === "string") {
        setItems((prev) =>
          prev
            ? prev.map((i) =>
                selectedIds.has(i.id) ? { ...i, category: extra.category as string, subcategory: "" } : i
              )
            : null
        );
      } else if (action === "priority" && typeof extra.priority === "string") {
        setItems((prev) =>
          prev
            ? prev.map((i) =>
                selectedIds.has(i.id) ? { ...i, priority: extra.priority as any } : i
              )
            : null
        );
      }

      clearSelection();
      setConfirmBulkDelete(false);
      setConfirmBulkPurgatory(false);
      setShowBulkCategoryModal(false);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Bulk action failed");
    } finally {
      setBulkBusy(false);
    }
  };

  const moveToPurgatory = async (id: number) => {
    try {
      const res = await fetch(`/api/items/${id}/purgatory`, { method: "POST" });
      if (res.ok) {
        // Remove immediately from active inventory
        setItems((prev) => (prev ? prev.filter((item) => item.id !== id) : null));
      } else {
        setError("Failed to move item to Purgatory.");
      }
    } catch {
      setError("Failed to move item to Purgatory.");
    }
  };

  const deleteItemPermanently = async (id: number) => {
    setDeleteBusy(true);
    try {
      const res = await fetch(`/api/items/${id}`, { method: "DELETE" });
      if (res.ok) {
        setItems((prev) => (prev ? prev.filter((item) => item.id !== id) : null));
        setEditingItem(null);
        setDeletingItem(null);
      } else {
        setError("Failed to delete item.");
      }
    } catch {
      setError("Failed to delete item.");
    } finally {
      setDeleteBusy(false);
    }
  };

  const handleDuplicate = async (id: number) => {
    setDuplicateBusy(true);
    try {
      const res = await fetch(`/api/items/${id}/duplicate`, { method: "POST" });
      if (res.ok) {
        const data = await res.json();
        if (data.item) {
          setItems((prev) => (prev ? [data.item, ...prev] : [data.item]));
          setEditingItem(null);
        }
      } else {
        setError("Failed to duplicate item.");
      }
    } catch {
      setError("Failed to duplicate item.");
    } finally {
      setDuplicateBusy(false);
    }
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

  // Open general edit popup modal from item name
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
    setEditDescription(item.description || "");
    setEditError(null);
  };

  // Submit general edit modal
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
          status: "owned",
          currentValue: editValue.trim() === "" ? null : Number(editValue),
          purchasePrice: editPrice.trim() === "" ? null : Number(editPrice),
          purchaseDate: editPurchaseDate.trim() || null,
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
        prev
          ? prev.map((it) => (it.id === editingItem.id ? { ...it, ...data.item } : it))
          : null
      );
      setEditingItem(null);
      setEditBusy(false);
    } catch {
      setEditError("Network error. Try again.");
      setEditBusy(false);
    }
  };

  // Inline cell save helper
  const saveInline = async (id: number, patch: Record<string, unknown>) => {
    setEditingCell(null);
    try {
      const res = await fetch(`/api/items/${id}`, {
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
        setError("Failed to save changes.");
      }
    } catch {
      setError("Network error while saving.");
    }
  };

  return (
    <div className="space-y-7">
      <header className="animate-rise flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="flex h-6 w-6 items-center justify-center rounded-md bg-wash text-ink-soft">
              <IconBox width={15} height={15} />
            </span>
            <p className="eyebrow">Inventory</p>
          </div>
          <h1 className="display mt-2 text-4xl leading-[1.1] sm:text-5xl">Everything you own</h1>
        </div>
        {/* Controls: Search, filters & Add Item */}
        <div className="flex w-full flex-col gap-2.5 sm:flex-row sm:flex-wrap sm:items-end xl:w-auto xl:flex-1 xl:justify-end">
          {/* Mobile search row: Add item to the left of search bar on mobile */}
          <div className="flex items-center gap-2 flex-1 min-w-[200px] xl:max-w-[340px]">
            <Link
              href="/items/new"
              className="btn-primary sm:hidden px-3 py-2 text-xs font-semibold shrink-0"
              title="Add item"
            >
              <IconPlus width={15} height={15} />
              Add
            </Link>
            <div className="relative flex-1">
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-faint">
                <IconSearch width={15} height={15} />
              </span>
              <input
                id="q"
                className="input pl-9"
                placeholder="Search by name or brand…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </div>
          </div>

          {/* 3 Filters: consolidated into a single row on mobile devices side by side */}
          <div className="grid grid-cols-3 gap-1.5 sm:flex sm:items-end sm:gap-3">
            <div className="sm:w-32">
              <label className="label hidden sm:block" htmlFor="status">
                Usage
              </label>
              <select
                id="status"
                className="input text-xs sm:text-sm px-2 py-1.5 sm:py-2"
                value={status}
                onChange={(e) => setStatus(e.target.value)}
              >
                <option value="all">All</option>
                <option value="heavy_use">Heavy</option>
                <option value="occasional_use">Occasional</option>
                <option value="rare_use">Rare</option>
              </select>
            </div>
            <div className="sm:w-36">
              <label className="label hidden sm:block" htmlFor="category">
                Category
              </label>
              <select
                id="category"
                className="input text-xs sm:text-sm px-2 py-1.5 sm:py-2"
                value={category}
                onChange={(e) => {
                  setCategory(e.target.value);
                  setSubcategory("all");
                }}
              >
                <option value="all">All</option>
                {categories.map((c) => (
                  <option key={c} value={c}>
                    {formatCategory(c)}
                  </option>
                ))}
              </select>
            </div>
            <div className="sm:w-36">
              <label className="label hidden sm:block" htmlFor="subcategory">
                Subcategory
              </label>
              <select
                id="subcategory"
                className="input text-xs sm:text-sm px-2 py-1.5 sm:py-2"
                disabled={category === "all"}
                value={subcategory}
                onChange={(e) => setSubcategory(e.target.value)}
              >
                <option value="all">
                  {category === "all" ? "—" : "All"}
                </option>
                {subcategories.map((sub) => (
                  <option key={sub} value={sub}>
                    {sub}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Desktop Add item button */}
          <div className="hidden sm:flex items-center">
            <Link href="/items/new" className="btn-primary">
              <IconPlus width={16} height={16} />
              Add item
            </Link>
          </div>
        </div>
      </header>

      {error && (
        <div className="card border-danger-line bg-danger-soft p-4 text-sm text-danger">{error}</div>
      )}

      {/* ---------------- Empty state ---------------- */}
      {items !== null && filtered.length === 0 ? (
        <div className="card">
          <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
            <span className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-paper text-ink-faint">
              <IconBox width={22} height={22} />
            </span>
            <h3 className="display text-xl">
              {items.length === 0 ? "Nothing tracked yet" : "No matches"}
            </h3>
            <p className="mt-1.5 max-w-sm text-sm leading-relaxed text-muted">
              {items.length === 0
                ? "Start with the things you own most of. You can add photos and details later."
                : "Loosen the filters and they'll come back."}
            </p>
            {items.length === 0 ? (
              <Link href="/items/new" className="btn-primary mt-5">
                <IconPlus width={16} height={16} />
                Add your first item
              </Link>
            ) : null}
          </div>
        </div>
      ) : null}

      {/* ---------------- Table ---------------- */}
      {sorted.length > 0 ? (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-full sm:min-w-[960px] border-collapse text-left">
              <caption className="sr-only">
                Your inventory: {sorted.length} item{sorted.length === 1 ? "" : "s"}. Choose a column
                heading to sort by that column.
              </caption>
              <thead>
                <tr className="h-11 border-b border-line text-[11px] font-semibold uppercase tracking-[0.12em] text-muted">
                  <th
                    scope="col"
                    className="w-10 px-3 sm:px-4 py-2.5 align-middle text-center"
                  >
                    <input
                      type="checkbox"
                      aria-label="Select all items on this page"
                      checked={
                        paginatedItems.length > 0 &&
                        paginatedItems.every((i) => selectedIds.has(i.id))
                      }
                      onChange={toggleSelectAllPage}
                      className="h-4 w-4 rounded border-line text-brand focus:ring-accent cursor-pointer"
                    />
                  </th>
                  {SORT_COLUMNS.map((col) => {
                    const active = sort.key === col.key;
                    const isVisibleOnMobile = col.key === "name" || col.key === "quality" || col.key === "status";
                    const isQuality = col.key === "quality";
                    return (
                      <th
                        key={col.key}
                        scope="col"
                        aria-sort={active ? (sort.direction === "asc" ? "ascending" : "descending") : "none"}
                        className={`whitespace-nowrap px-3 sm:px-4 py-2.5 align-middle text-[11px] font-semibold uppercase tracking-[0.12em] ${
                          !isVisibleOnMobile ? "hidden sm:table-cell" : ""
                        } ${isQuality ? "w-10 sm:w-auto px-1.5 sm:px-4" : ""} ${col.numeric ? "text-right" : "text-left"}`}
                      >
                        <button
                          type="button"
                          onClick={() => onSort(col.key)}
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
                    className="hidden sm:table-cell whitespace-nowrap px-4 py-2.5 align-middle text-right text-[11px] font-semibold uppercase tracking-[0.12em] text-muted"
                  >
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {paginatedItems.map((item) => {
                  const statusInfo = getItemStatusInfo(item);
                  return (
                    <tr
                      key={item.id}
                      onClick={() => {
                        if (typeof window !== "undefined" && window.innerWidth < 640) {
                          openEditModal(item);
                        }
                      }}
                      className="h-[52px] sm:h-[54px] border-b border-line-soft transition-colors last:border-0 even:bg-wash/60 dark:even:bg-shell/70 hover:bg-wash dark:hover:bg-wash/40 cursor-pointer sm:cursor-default"
                    >
                      {/* Selection Checkbox */}
                      <td
                        className="w-10 px-3 sm:px-4 py-2 sm:py-2.5 align-middle text-center"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <input
                          type="checkbox"
                          aria-label={`Select ${item.name}`}
                          checked={selectedIds.has(item.id)}
                          onChange={() => toggleSelectOne(item.id)}
                          className="h-4 w-4 rounded border-line text-brand focus:ring-accent cursor-pointer"
                        />
                      </td>

                      {/* Item Name */}
                      <th scope="row" className="px-3 sm:px-4 py-2 sm:py-2.5 align-middle text-left font-normal">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            openEditModal(item);
                          }}
                          className="min-w-0 text-left block group cursor-pointer"
                          title="Click to edit item"
                        >
                          <span className="block truncate font-medium text-ink group-hover:text-accent group-hover:underline underline-offset-2 transition-colors">
                            {item.name}
                          </span>
                        </button>
                      </th>

                      {/* Brand: hidden on mobile */}
                      <td className="hidden sm:table-cell px-4 py-2 sm:py-2.5 align-middle text-[13px] text-ink-soft">
                        {editingCell?.itemId === item.id && editingCell?.field === "brand" ? (
                          <input
                            type="text"
                            autoFocus
                            defaultValue={item.brand}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") {
                                saveInline(item.id, { brand: e.currentTarget.value.trim() });
                              }
                              if (e.key === "Escape") setEditingCell(null);
                            }}
                            onBlur={(e) =>
                              saveInline(item.id, { brand: e.currentTarget.value.trim() })
                            }
                            className="input py-0.5 px-2 text-xs h-7 max-w-[120px]"
                          />
                        ) : (
                          <span
                            onClick={(e) => {
                              e.stopPropagation();
                              setEditingCell({ itemId: item.id, field: "brand" });
                            }}
                            className="inline-block py-1 px-1.5 -mx-1.5 rounded hover:bg-wash cursor-pointer transition-colors"
                            title="Click to edit brand"
                          >
                            {item.brand || <span className="text-muted/60">—</span>}
                          </span>
                        )}
                      </td>

                      {/* Category: hidden on mobile */}
                      <td className="hidden sm:table-cell px-4 py-2 sm:py-2.5 align-middle">
                        {editingCell?.itemId === item.id && editingCell?.field === "category" ? (
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
                            className="inline-block cursor-pointer hover:opacity-80 transition-opacity"
                            title="Click to edit category"
                          >
                            <CategoryTag category={item.category} />
                          </span>
                        )}
                      </td>

                      {/* Subcategory: hidden on mobile */}
                      <td className="hidden sm:table-cell px-4 py-2 sm:py-2.5 align-middle text-[13px] text-ink-soft">
                        {editingCell?.itemId === item.id && editingCell?.field === "subcategory" ? (
                          <select
                            autoFocus
                            defaultValue={item.subcategory || ""}
                            onChange={(e) => saveInline(item.id, { subcategory: e.target.value })}
                            onBlur={() => setEditingCell(null)}
                            className="input py-0.5 px-2 text-xs h-7 max-w-[140px]"
                          >
                            <option value="">None</option>
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

                      {/* Quality: shown on mobile (icon only on mobile, reduced col width) */}
                      <td className="px-1.5 sm:px-4 py-2 sm:py-2.5 align-middle text-[13px] text-ink-soft w-10 sm:w-auto">
                        {editingCell?.itemId === item.id && editingCell?.field === "quality" ? (
                          <select
                            autoFocus
                            defaultValue={item.quality || ""}
                            onChange={(e) => saveInline(item.id, { quality: e.target.value })}
                            onBlur={() => setEditingCell(null)}
                            className="input py-0.5 px-2 text-xs h-7"
                          >
                            <option value="">— None —</option>
                            <option value="high">High</option>
                            <option value="medium">Medium</option>
                            <option value="low">Low</option>
                          </select>
                        ) : (
                          <span
                            onClick={(e) => {
                              e.stopPropagation();
                              setEditingCell({ itemId: item.id, field: "quality" });
                            }}
                            className="inline-flex items-center gap-1.5 py-1 px-1 sm:px-1.5 -mx-1 sm:-mx-1.5 rounded hover:bg-wash cursor-pointer transition-colors"
                            title={item.quality ? `Quality: ${item.quality}` : "Click to edit quality"}
                          >
                            <QualityIcon quality={item.quality} />
                            {item.quality ? (
                              <span className="hidden sm:inline capitalize text-xs text-muted">({item.quality})</span>
                            ) : null}
                          </span>
                        )}
                      </td>

                      {/* Usage: shown on mobile */}
                      <td className="px-2.5 sm:px-4 py-2 sm:py-2.5 align-middle">
                        {editingCell?.itemId === item.id && editingCell?.field === "status" ? (
                          <select
                            autoFocus
                            defaultValue={
                              item.useFrequency === "daily" || item.useFrequency === "weekly"
                                ? "daily"
                                : item.useFrequency === "rare" || item.useFrequency === "never"
                                ? "rare"
                                : "monthly"
                            }
                            onChange={(e) =>
                              saveInline(item.id, { useFrequency: e.target.value, status: "owned" })
                            }
                            onBlur={() => setEditingCell(null)}
                            className="input py-0.5 px-2 text-xs h-7"
                          >
                            <option value="daily">Heavy</option>
                            <option value="monthly">Occasional</option>
                            <option value="rare">Rare</option>
                          </select>
                        ) : (
                          <span
                            onClick={(e) => {
                              e.stopPropagation();
                              setEditingCell({ itemId: item.id, field: "status" });
                            }}
                            className="inline-block cursor-pointer hover:opacity-80 transition-opacity"
                            title="Click to edit usage"
                          >
                            <StatusTag status={statusInfo} />
                          </span>
                        )}
                      </td>

                      {/* Value: hidden on mobile */}
                      <td className="hidden sm:table-cell tabular px-4 py-2 sm:py-2.5 align-middle text-right text-[13px] font-medium text-ink">
                        {editingCell?.itemId === item.id && editingCell?.field === "value" ? (
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            autoFocus
                            defaultValue={item.currentValue === null ? "" : String(item.currentValue)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") {
                                const val = e.currentTarget.value.trim();
                                saveInline(item.id, {
                                  currentValue: val === "" ? null : Number(val),
                                });
                              }
                              if (e.key === "Escape") setEditingCell(null);
                            }}
                            onBlur={(e) => {
                              const val = e.currentTarget.value.trim();
                              saveInline(item.id, {
                                currentValue: val === "" ? null : Number(val),
                              });
                            }}
                            className="input py-0.5 px-2 text-xs h-7 tabular text-right max-w-[90px]"
                          />
                        ) : (
                          <span
                            onClick={(e) => {
                              e.stopPropagation();
                              setEditingCell({ itemId: item.id, field: "value" });
                            }}
                            className="inline-block py-1 px-1.5 -mx-1.5 rounded hover:bg-wash cursor-pointer transition-colors"
                            title="Click to edit value"
                          >
                            {formatMoney(item.currentValue)}
                          </span>
                        )}
                      </td>

                      {/* Acquired: hidden on mobile */}
                      <td className="hidden sm:table-cell tabular px-4 py-2 sm:py-2.5 align-middle text-right text-[13px]">
                        {editingCell?.itemId === item.id && editingCell?.field === "acquired" ? (
                          <input
                            type="text"
                            placeholder="YYYY-MM-DD or Q1 2024"
                            autoFocus
                            defaultValue={item.purchaseDate || ""}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") {
                                saveInline(item.id, {
                                  purchaseDate: e.currentTarget.value.trim() || null,
                                });
                              }
                              if (e.key === "Escape") setEditingCell(null);
                            }}
                            onBlur={(e) =>
                              saveInline(item.id, {
                                purchaseDate: e.currentTarget.value.trim() || null,
                              })
                            }
                            className="input py-0.5 px-2 text-xs h-7 tabular text-right max-w-[120px]"
                          />
                        ) : (
                          <span
                            onClick={(e) => {
                              e.stopPropagation();
                              setEditingCell({ itemId: item.id, field: "acquired" });
                            }}
                            className="inline-block py-1 px-1.5 -mx-1.5 rounded hover:bg-wash cursor-pointer transition-colors"
                            title="Click to edit acquired date"
                          >
                            {item.purchaseDate ? (
                              <span
                                className={`inline-block rounded px-2 py-0.5 text-[11px] font-medium tabular ${getYearStyle(
                                  item.purchaseDate
                                )}`}
                              >
                                {formatQuarter(item.purchaseDate)}
                              </span>
                            ) : (
                              <span className="text-muted">—</span>
                            )}
                          </span>
                        )}
                      </td>

                      {/* Actions: hidden on mobile */}
                      <td className="hidden sm:table-cell px-4 py-2 sm:py-2.5 align-middle text-right">
                        <div className="inline-flex items-center justify-end gap-1">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDuplicate(item.id);
                            }}
                            title="Duplicate item"
                            disabled={duplicateBusy}
                            className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-muted transition-colors hover:bg-wash hover:text-ink disabled:opacity-50"
                          >
                            <IconCopy width={16} height={16} />
                            <span className="sr-only">Duplicate item</span>
                          </button>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              moveToPurgatory(item.id);
                            }}
                            title="Move to Purgatory"
                            className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-muted transition-colors hover:bg-clay-soft hover:text-clay"
                          >
                            <IconFlame width={16} height={16} />
                            <span className="sr-only">Move to Purgatory</span>
                          </button>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setDeletingItem(item);
                            }}
                            title="Delete item permanently"
                            className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-muted transition-colors hover:bg-danger-soft hover:text-danger"
                          >
                            <IconTrash width={16} height={16} />
                            <span className="sr-only">Delete item permanently</span>
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
            totalItems={sorted.length}
            pageSize={10}
            onPageChange={setPage}
          />
        </div>
      ) : null}

      {/* ---------------- General Edit Modal (opened from item name) ---------------- */}
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
                  href={`/items/${editingItem.id}`}
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

              {/* Category and Subcategory beside each other on mobile */}
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

              {/* Quality and Usage beside each other on mobile */}
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

              {/* Value and Paid beside each other on mobile */}
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

              <div className="sm:col-span-2">
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
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setDeletingItem(editingItem)}
                  className="btn-danger inline-flex items-center gap-1.5 text-xs py-1.5 px-3"
                >
                  <IconTrash width={14} height={14} />
                  Delete item
                </button>
                <button
                  type="button"
                  onClick={() => handleDuplicate(editingItem.id)}
                  disabled={duplicateBusy || editBusy}
                  className="btn border border-line inline-flex items-center gap-1.5 text-xs py-1.5 px-3 hover:bg-wash"
                >
                  <IconCopy width={14} height={14} />
                  {duplicateBusy ? "Duplicating…" : "Duplicate"}
                </button>
              </div>
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
              Are you sure you want to delete <strong className="text-ink">{deletingItem.name}</strong>? It will be completely removed as if it was made by mistake, and won&apos;t count as sold, offloaded, or kept.
            </>
          ) : ""
        }
        confirmLabel="Delete permanently"
        busy={deleteBusy}
        onConfirm={() => {
          if (deletingItem) deleteItemPermanently(deletingItem.id);
        }}
        onCancel={() => setDeletingItem(null)}
      />

      {/* ---------------- Floating Bulk Action Bar ---------------- */}
      {selectedIds.size > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 flex items-center gap-2 sm:gap-3 rounded-2xl border border-line bg-card/95 px-4 py-3 shadow-2xl backdrop-blur-md animate-rise max-w-[95vw] overflow-x-auto ring-1 ring-black/5 dark:ring-white/10">
          <div className="flex items-center gap-2 border-r border-line pr-3">
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-brand text-xs font-bold text-brand-fg">
              {selectedIds.size}
            </span>
            <span className="text-xs font-semibold text-ink whitespace-nowrap">
              {selectedIds.size === 1 ? "item" : "items"} selected
            </span>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2">
            <button
              type="button"
              onClick={() => setConfirmBulkPurgatory(true)}
              disabled={bulkBusy}
              className="btn-secondary text-xs py-1.5 px-2.5 sm:px-3 flex items-center gap-1.5 text-clay hover:bg-clay-soft whitespace-nowrap"
              title="Move selected items to Purgatory"
            >
              <IconFlame width={14} height={14} className="shrink-0" />
              <span>Purgatory</span>
            </button>

            <button
              type="button"
              onClick={() => setShowBulkCategoryModal(true)}
              disabled={bulkBusy}
              className="btn-secondary text-xs py-1.5 px-2.5 sm:px-3 flex items-center gap-1.5 whitespace-nowrap"
              title="Change category for selected items"
            >
              <IconTag width={14} height={14} className="shrink-0" />
              <span>Category</span>
            </button>

            <button
              type="button"
              onClick={() => executeBulkAction("priority", { priority: "keep" })}
              disabled={bulkBusy}
              className="btn-secondary text-xs py-1.5 px-2.5 sm:px-3 flex items-center gap-1.5 text-accent hover:bg-accent-soft whitespace-nowrap"
              title="Mark selected as keep"
            >
              <IconSparkles width={14} height={14} className="shrink-0" />
              <span>Mark Keep</span>
            </button>

            <button
              type="button"
              onClick={() => setConfirmBulkDelete(true)}
              disabled={bulkBusy}
              className="btn-danger text-xs py-1.5 px-2.5 sm:px-3 flex items-center gap-1.5 whitespace-nowrap"
              title="Delete selected items permanently"
            >
              <IconTrash width={14} height={14} className="shrink-0" />
              <span>Delete</span>
            </button>

            <button
              type="button"
              onClick={clearSelection}
              className="text-xs text-muted hover:text-ink px-2 py-1 ml-1 whitespace-nowrap transition-colors"
              title="Deselect all"
            >
              Clear
            </button>
          </div>
        </div>
      )}

      {/* Confirm Bulk Delete Dialog */}
      <ConfirmDialog
        open={confirmBulkDelete}
        title={`Delete ${selectedIds.size} item${selectedIds.size === 1 ? "" : "s"} permanently?`}
        message={
          <>
            Are you sure you want to permanently delete <strong>{selectedIds.size}</strong> selected item
            {selectedIds.size === 1 ? "" : "s"}? Their photos and histories will be permanently removed.
          </>
        }
        confirmLabel="Delete selected"
        busy={bulkBusy}
        onConfirm={() => executeBulkAction("delete")}
        onCancel={() => setConfirmBulkDelete(false)}
      />

      {/* Confirm Bulk Purgatory Dialog */}
      <ConfirmDialog
        open={confirmBulkPurgatory}
        title={`Move ${selectedIds.size} item${selectedIds.size === 1 ? "" : "s"} to Purgatory?`}
        message={
          <>
            Move <strong>{selectedIds.size}</strong> selected item{selectedIds.size === 1 ? "" : "s"} to Purgatory? They will be removed from active inventory to test living without them.
          </>
        }
        confirmLabel="Move to Purgatory"
        busy={bulkBusy}
        onConfirm={() => executeBulkAction("purgatory")}
        onCancel={() => setConfirmBulkPurgatory(false)}
      />

      {/* Bulk Category Change Modal */}
      {showBulkCategoryModal && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
          onClick={() => setShowBulkCategoryModal(false)}
        >
          <div
            className="card w-full max-w-sm border border-line bg-card p-5 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="display text-lg">Change Category</h3>
            <p className="mt-1 text-xs text-muted">
              Select a new category for the {selectedIds.size} selected item{selectedIds.size === 1 ? "" : "s"}.
            </p>

            <div className="mt-4">
              <label className="label" htmlFor="bulk-cat-select">
                New Category
              </label>
              <select
                id="bulk-cat-select"
                value={bulkCategory}
                onChange={(e) => setBulkCategory(e.target.value)}
                className="input text-sm"
              >
                {(userCategories.length > 0 ? userCategories.map((u) => u.category) : CATEGORIES).map((c) => (
                  <option key={c} value={c}>
                    {formatCategory(c)}
                  </option>
                ))}
              </select>
            </div>

            <div className="mt-5 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowBulkCategoryModal(false)}
                className="btn border border-line text-xs"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={bulkBusy}
                onClick={() => executeBulkAction("category", { category: bulkCategory })}
                className="btn-primary text-xs"
              >
                {bulkBusy ? "Updating…" : "Apply Category"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function InventoryPage() {
  return (
    <Suspense
      fallback={
        <div className="py-20 text-center text-sm text-muted">
          <span className="inline-block h-5 w-5 animate-spin rounded-full border-2 border-line border-t-ink-soft" />
          <p className="mt-3">Loading inventory…</p>
        </div>
      }
    >
      <InventoryInner />
    </Suspense>
  );
}
