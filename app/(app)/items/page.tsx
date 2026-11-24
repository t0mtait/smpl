"use client";

import { useEffect, useMemo, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import type { Item } from "@/lib/db";
import {
  CATEGORIES,
  formatCategory,
  formatMoney,
  formatQuarter,
  getItemStatusInfo,
  getYearStyle,
} from "@/lib/format";
import { CategoryTag, Pagination, QualityIcon, StatusTag } from "@/components/ui";
import { IconBox, IconFlame, IconPlus, IconSearch } from "@/components/icons";
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
  const params = useSearchParams();
  const [items, setItems] = useState<Item[] | null>(null);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState(params.get("status") ?? "all");
  const [category, setCategory] = useState("all");
  const [subcategory, setSubcategory] = useState("all");
  const [page, setPage] = useState(1);
  const [sort, setSort] = useState<SortState>(DEFAULT_SORT);
  const [error, setError] = useState<string | null>(null);

  // General edit popup state (opened from clicking on the item name)
  const [editingItem, setEditingItem] = useState<Item | null>(null);
  const [editName, setEditName] = useState("");
  const [editBrand, setEditBrand] = useState("");
  const [editCategory, setEditCategory] = useState("misc");
  const [editSubcategory, setEditSubcategory] = useState("");
  const [editQuality, setEditQuality] = useState("");
  const [editLocation, setEditLocation] = useState("");
  const [editUsage, setEditUsage] = useState("monthly");
  const [editValue, setEditValue] = useState("");
  const [editPrice, setEditPrice] = useState("");
  const [editPurchaseDate, setEditPurchaseDate] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editBusy, setEditBusy] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

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

  // Open general edit popup modal from item name
  const openEditModal = (item: Item) => {
    setEditingItem(item);
    setEditName(item.name);
    setEditBrand(item.brand || "");
    setEditCategory(item.category || "misc");
    setEditSubcategory(item.subcategory || "");
    setEditQuality(item.quality || "");
    setEditLocation(item.location || "");
    setEditUsage(
      item.useFrequency === "daily" || item.useFrequency === "weekly"
        ? "daily"
        : item.useFrequency === "rare" || item.useFrequency === "never"
        ? "rare"
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
          location: editLocation.trim(),
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
        {/* Search & filters */}
        <div className="flex w-full flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end xl:w-auto xl:flex-1 xl:justify-end">
          <div className="min-w-[180px] flex-1 xl:max-w-[260px]">
            <label className="label" htmlFor="q">
              Search
            </label>
            <div className="relative">
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
          <div className="sm:w-36">
            <label className="label" htmlFor="status">
              Usage
            </label>
            <select
              id="status"
              className="input"
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
            <label className="label" htmlFor="category">
              Category
            </label>
            <select
              id="category"
              className="input"
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
            <label className="label" htmlFor="subcategory">
              Subcategory
            </label>
            <select
              id="subcategory"
              className="input"
              disabled={category === "all"}
              value={subcategory}
              onChange={(e) => setSubcategory(e.target.value)}
            >
              <option value="all">
                {category === "all" ? "—" : "All subcategories"}
              </option>
              {subcategories.map((sub) => (
                <option key={sub} value={sub}>
                  {sub}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
        <Link href="/items/new" className="btn-primary">
          <IconPlus width={16} height={16} />
          Add item
        </Link>
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
            <table className="w-full min-w-[980px] border-collapse text-left">
              <caption className="sr-only">
                Your inventory: {sorted.length} item{sorted.length === 1 ? "" : "s"}. Choose a column
                heading to sort by that column.
              </caption>
              <thead>
                <tr className="border-b border-line">
                  {SORT_COLUMNS.map((col) => {
                    const active = sort.key === col.key;
                    return (
                      <th
                        key={col.key}
                        scope="col"
                        aria-sort={active ? (sort.direction === "asc" ? "ascending" : "descending") : "none"}
                        className={`whitespace-nowrap px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.12em] ${
                          col.numeric ? "text-right" : "text-left"
                        }`}
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
                    className="whitespace-nowrap px-4 py-3 text-right text-[11px] font-semibold uppercase tracking-[0.12em] text-muted"
                  >
                    Purgatory
                  </th>
                </tr>
              </thead>
              <tbody>
                {paginatedItems.map((item) => {
                  const statusInfo = getItemStatusInfo(item);
                  return (
                    <tr
                      key={item.id}
                      className="border-b border-line-soft transition-colors last:border-0 even:bg-wash/60 dark:even:bg-shell/70 hover:bg-wash dark:hover:bg-wash/40"
                    >
                      {/* Item Name: clicking opens general edit popup */}
                      <th scope="row" className="px-4 py-3 text-left font-normal">
                        <button
                          type="button"
                          onClick={() => openEditModal(item)}
                          className="min-w-0 text-left block group cursor-pointer"
                          title="Click to edit item"
                        >
                          <span className="block truncate font-medium text-ink group-hover:text-accent group-hover:underline underline-offset-2 transition-colors">
                            {item.name}
                          </span>
                          {item.location ? (
                            <span className="block truncate text-[12px] font-normal text-muted">
                              {item.location}
                            </span>
                          ) : null}
                        </button>
                      </th>

                      {/* Brand: clicking edits brand */}
                      <td className="px-4 py-3 text-[13px] text-ink-soft">
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
                            onClick={() => setEditingCell({ itemId: item.id, field: "brand" })}
                            className="inline-block py-1 px-1.5 -mx-1.5 rounded hover:bg-wash cursor-pointer transition-colors"
                            title="Click to edit brand"
                          >
                            {item.brand || <span className="text-muted/60">—</span>}
                          </span>
                        )}
                      </td>

                      {/* Category: clicking edits category */}
                      <td className="px-4 py-3">
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
                            onClick={() => setEditingCell({ itemId: item.id, field: "category" })}
                            className="inline-block cursor-pointer hover:opacity-80 transition-opacity"
                            title="Click to edit category"
                          >
                            <CategoryTag category={item.category} />
                          </span>
                        )}
                      </td>

                      {/* Subcategory: clicking edits subcategory */}
                      <td className="px-4 py-3 text-[13px] text-ink-soft">
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
                            onClick={() => setEditingCell({ itemId: item.id, field: "subcategory" })}
                            className="inline-block py-1 px-1.5 -mx-1.5 rounded hover:bg-wash cursor-pointer transition-colors"
                            title="Click to edit subcategory"
                          >
                            {item.subcategory || <span className="text-muted/60">—</span>}
                          </span>
                        )}
                      </td>

                      {/* Quality: clicking edits quality */}
                      <td className="px-4 py-3 text-[13px] text-ink-soft">
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
                            onClick={() => setEditingCell({ itemId: item.id, field: "quality" })}
                            className="inline-flex items-center gap-1.5 py-1 px-1.5 -mx-1.5 rounded hover:bg-wash cursor-pointer transition-colors"
                            title="Click to edit quality"
                          >
                            <QualityIcon quality={item.quality} />
                            {item.quality ? (
                              <span className="capitalize text-xs text-muted">({item.quality})</span>
                            ) : null}
                          </span>
                        )}
                      </td>

                      {/* Usage (was Status): clicking edits usage */}
                      <td className="px-4 py-3">
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
                            onClick={() => setEditingCell({ itemId: item.id, field: "status" })}
                            className="inline-block cursor-pointer hover:opacity-80 transition-opacity"
                            title="Click to edit usage"
                          >
                            <StatusTag status={statusInfo} />
                          </span>
                        )}
                      </td>

                      {/* Value: clicking edits value */}
                      <td className="tabular px-4 py-3 text-right text-[13px] font-medium text-ink">
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
                            onClick={() => setEditingCell({ itemId: item.id, field: "value" })}
                            className="inline-block py-1 px-1.5 -mx-1.5 rounded hover:bg-wash cursor-pointer transition-colors"
                            title="Click to edit value"
                          >
                            {formatMoney(item.currentValue)}
                          </span>
                        )}
                      </td>

                      {/* Acquired: clicking edits purchaseDate */}
                      <td className="tabular px-4 py-3 text-right text-[13px]">
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
                            onClick={() => setEditingCell({ itemId: item.id, field: "acquired" })}
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

                      {/* Purgatory: flame icon instead of X */}
                      <td className="px-4 py-3 text-right">
                        <button
                          type="button"
                          onClick={() => moveToPurgatory(item.id)}
                          title="Move to Purgatory"
                          className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-muted transition-colors hover:bg-clay-soft hover:text-clay"
                        >
                          <IconFlame width={16} height={16} />
                          <span className="sr-only">Move to Purgatory</span>
                        </button>
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
              <div className="sm:col-span-2">
                <label className="label" htmlFor="edit-item-name">
                  Name *
                </label>
                <input
                  id="edit-item-name"
                  className="input"
                  required
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  autoFocus
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

              <div>
                <label className="label" htmlFor="edit-item-location">
                  Location
                </label>
                <input
                  id="edit-item-location"
                  className="input"
                  placeholder="e.g. Closet, Living Room"
                  value={editLocation}
                  onChange={(e) => setEditLocation(e.target.value)}
                />
              </div>

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
                </select>
              </div>

              <div>
                <label className="label" htmlFor="edit-item-value">
                  Worth today ($)
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
                  Paid ($)
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
