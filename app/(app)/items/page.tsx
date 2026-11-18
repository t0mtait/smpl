"use client";

import { useEffect, useMemo, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import type { Item } from "@/lib/db";
import { formatDate, formatMoney, formatQuarter, getItemStatusInfo } from "@/lib/format";
import { StatusTag } from "@/components/ui";
import { IconBox, IconPlus, IconSearch } from "@/components/icons";
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
  const [sort, setSort] = useState<SortState>(DEFAULT_SORT);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    try {
      const res = await fetch("/api/items");
      if (res.status === 401) {
        window.location.href = "/auth/login?next=/items";
        return;
      }
      const data = await res.json();
      setItems(data.items ?? []);
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

  const filtered = useMemo(
    () => filterItems(items ?? [], { query, status, category }),
    [items, status, category, query]
  );

  const sorted = useMemo(() => sortItems(filtered, sort), [filtered, sort]);

  const onSort = (key: SortKey) => setSort((current) => toggleSort(current, key));

  return (
    <div className="space-y-7">
      <header className="animate-rise flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow">Inventory</p>
          <h1 className="display mt-2 text-4xl leading-[1.1] sm:text-5xl">Everything you own</h1>
          <p className="mt-2 text-[15px] text-muted">
            {items === null
              ? "Loading…"
              : `${filtered.length} of ${items.length} item${items.length === 1 ? "" : "s"}`}
          </p>
        </div>
        <Link href="/items/new" className="btn-primary">
          <IconPlus width={16} height={16} />
          Add item
        </Link>
      </header>

      {/* ---------------- Filters ---------------- */}
      <div className="card p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
          <div className="min-w-[200px] flex-1">
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
                placeholder="name, category, location…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </div>
          </div>
          <div className="sm:w-44">
            <label className="label" htmlFor="status">
              Status
            </label>
            <select
              id="status"
              className="input"
              value={status}
              onChange={(e) => setStatus(e.target.value)}
            >
              <option value="all">All</option>
              <option value="heavy_use">Heavy Use</option>
              <option value="occasional_use">Occasional Use</option>
              <option value="rare_use">Rare Use</option>
              <option value="listed">Listed</option>
              <option value="owned">Owned</option>
              <option value="sold">Sold</option>
              <option value="donated">Donated</option>
              <option value="disposed">Thrown Out</option>
              <option value="closed">Closed</option>
            </select>
          </div>
          <div className="sm:w-44">
            <label className="label" htmlFor="category">
              Category
            </label>
            <select
              id="category"
              className="input"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
            >
              <option value="all">All</option>
              {categories.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

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

      {/* ---------------- Table ----------------
          The sort control is the column heading itself: a button inside
          a th, with aria-sort on the th so a screen reader announces
          which column is sorted and which way it is pointing. */}
      {sorted.length > 0 ? (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] border-collapse text-left">
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
                </tr>
              </thead>
              <tbody>
                {sorted.map((item) => {
                  const statusInfo = getItemStatusInfo(item);
                  return (
                    <tr
                      key={item.id}
                      className="border-b border-line-soft transition-colors last:border-0 hover:bg-paper"
                    >
                      <th scope="row" className="px-4 py-3 text-left font-normal">
                        <Link
                          href={`/items/${item.id}`}
                          className="min-w-0 block font-medium text-ink hover:text-accent"
                        >
                          <span className="block truncate">{item.name}</span>
                          {item.location ? (
                            <span className="block truncate text-[12px] font-normal text-muted">
                              {item.location}
                            </span>
                          ) : null}
                        </Link>
                      </th>
                      <td className="px-4 py-3 text-[13px] capitalize text-ink-soft">{item.category}</td>
                      <td className="px-4 py-3">
                        <StatusTag status={statusInfo} />
                      </td>
                      <td className="tabular px-4 py-3 text-right text-[13px] font-medium text-ink">
                        {formatMoney(item.currentValue)}
                      </td>
                      <td className="tabular px-4 py-3 text-right text-[13px] text-muted">
                        {formatQuarter(item.purchaseDate)}
                      </td>
                      <td className="tabular px-4 py-3 text-right text-[13px] text-muted">
                        {formatQuarter(item.offloadedDate)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}
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
