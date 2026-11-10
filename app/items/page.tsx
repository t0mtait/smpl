"use client";

import { useEffect, useMemo, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import type { Item } from "@/lib/db";
import { formatMoney, STATUS_LABELS, STATUS_STYLES, relativeDays } from "@/lib/format";
import { daysSince } from "@/lib/scoring";

function InventoryInner() {
  const params = useSearchParams();
  const [items, setItems] = useState<Item[] | null>(null);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState(params.get("status") ?? "all");
  const [category, setCategory] = useState("all");
  const [sort, setSort] = useState("recent");
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    try {
      const res = await fetch("/api/items");
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

  const filtered = useMemo(() => {
    let list = items ?? [];
    if (status !== "all") list = list.filter((i) => i.status === status);
    if (category !== "all") list = list.filter((i) => i.category === category);
    if (query.trim()) {
      const q = query.trim().toLowerCase();
      list = list.filter(
        (i) =>
          i.name.toLowerCase().includes(q) ||
          i.category.toLowerCase().includes(q) ||
          i.location.toLowerCase().includes(q) ||
          i.description.toLowerCase().includes(q)
      );
    }
    const sorted = [...list];
    if (sort === "recent") {
      sorted.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    } else if (sort === "value") {
      sorted.sort((a, b) => b.currentValue - a.currentValue);
    } else if (sort === "idle") {
      const idle = (i: Item) => daysSince(i.lastUsedAt ?? i.purchaseDate) ?? -1;
      sorted.sort((a, b) => idle(b) - idle(a));
    } else if (sort === "name") {
      sorted.sort((a, b) => a.name.localeCompare(b.name));
    }
    return sorted;
  }, [items, status, category, query, sort]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Inventory</h1>
          <p className="mt-1 text-sm text-ink-500">
            {items === null
              ? "Loading…"
              : `${filtered.length} of ${items.length} item${items.length === 1 ? "" : "s"}`}
          </p>
        </div>
        <Link href="/items/new" className="btn-primary">
          + Add item
        </Link>
      </div>

      <div className="card flex flex-wrap gap-3">
        <div className="min-w-[200px] flex-1">
          <label className="label" htmlFor="q">
            Search
          </label>
          <input
            id="q"
            className="input"
            placeholder="name, category, location…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <div>
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
            <option value="owned">Owned</option>
            <option value="sold">Sold</option>
            <option value="donated">Donated</option>
            <option value="disposed">Disposed</option>
          </select>
        </div>
        <div>
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
        <div>
          <label className="label" htmlFor="sort">
            Sort
          </label>
          <select id="sort" className="input" value={sort} onChange={(e) => setSort(e.target.value)}>
            <option value="recent">Newest first</option>
            <option value="name">Name</option>
            <option value="value">Value</option>
            <option value="idle">Longest unused</option>
          </select>
        </div>
      </div>

      {error && (
        <div className="card border-red-200 bg-red-50 text-sm text-red-700">{error}</div>
      )}

      {items !== null && filtered.length === 0 && (
        <div className="card py-16 text-center">
          <p className="text-ink-500">
            {items.length === 0
              ? "No items tracked yet. Start with the things you own most of."
              : "Nothing matches those filters."}
          </p>
        </div>
      )}

      {filtered.length > 0 && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((item) => (
            <Link
              key={item.id}
              href={`/items/${item.id}`}
              className="card flex gap-3 transition-shadow hover:shadow-md"
            >
              <div className="h-16 w-16 shrink-0 overflow-hidden rounded-lg bg-ink-100">
                {item.photoPath ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={`/api/photos/${item.photoPath}`}
                    alt={item.name}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-xs text-ink-400">
                    no photo
                  </div>
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{item.name}</p>
                <p className="mt-0.5 truncate text-xs capitalize text-ink-500">
                  {item.category}
                  {item.location ? ` · ${item.location}` : ""}
                </p>
                <div className="mt-2 flex items-center gap-2">
                  <span className={`pill ${STATUS_STYLES[item.status]}`}>{STATUS_LABELS[item.status]}</span>
                  <span className="text-xs tabular-nums text-ink-500">
                    {formatMoney(item.currentValue)}
                  </span>
                </div>
                {item.status === "owned" && (
                  <p className="mt-1 text-xs text-ink-400">
                    last used {relativeDays(daysSince(item.lastUsedAt ?? item.purchaseDate))}
                  </p>
                )}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

export default function InventoryPage() {
  return (
    <Suspense fallback={<div className="text-sm text-ink-400">Loading…</div>}>
      <InventoryInner />
    </Suspense>
  );
}
