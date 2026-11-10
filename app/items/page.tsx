"use client";

import { useEffect, useMemo, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import type { Item } from "@/lib/db";
import { formatMoney, STATUS_LABELS, STATUS_STYLES, relativeDays } from "@/lib/format";
import { daysSince } from "@/lib/scoring";
import { ItemPhoto } from "@/components/ui";
import { IconBox, IconPlus, IconSearch } from "@/components/icons";

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
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-400">
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
          <div className="sm:w-40">
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
          <div className="sm:w-44">
            <label className="label" htmlFor="sort">
              Sort by
            </label>
            <select id="sort" className="input" value={sort} onChange={(e) => setSort(e.target.value)}>
              <option value="recent">Newest first</option>
              <option value="name">Name</option>
              <option value="value">Value</option>
              <option value="idle">Longest unused</option>
            </select>
          </div>
        </div>
      </div>

      {error && (
        <div className="card border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>
      )}

      {/* ---------------- Grid ---------------- */}
      {items !== null && filtered.length === 0 ? (
        <div className="card">
          <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
            <span className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-paper text-ink-400">
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

      {filtered.length > 0 ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {filtered.map((item) => (
            <Link
              key={item.id}
              href={`/items/${item.id}`}
              className="card card-hover group overflow-hidden"
            >
              <div className="flex gap-4 p-4">
                <div className="h-20 w-20 shrink-0 overflow-hidden rounded-xl border border-line">
                  <ItemPhoto
                    src={item.photoPath ? `/api/photos/${item.photoPath}` : null}
                    alt={item.name}
                  />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium text-ink group-hover:text-moss-600">
                    {item.name}
                  </p>
                  <p className="mt-0.5 truncate text-[13px] capitalize text-muted">
                    {item.category}
                    {item.location ? ` · ${item.location}` : ""}
                  </p>
                  <div className="mt-2.5 flex flex-wrap items-center gap-2">
                    <span className={`pill ${STATUS_STYLES[item.status]}`}>{STATUS_LABELS[item.status]}</span>
                    <span className="tabular text-[13px] font-medium text-ink">
                      {formatMoney(item.currentValue)}
                    </span>
                  </div>
                  {item.status === "owned" ? (
                    <p className="mt-1.5 text-xs text-muted">
                      last used {relativeDays(daysSince(item.lastUsedAt ?? item.purchaseDate))}
                    </p>
                  ) : null}
                </div>
              </div>
            </Link>
          ))}
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
          <span className="inline-block h-5 w-5 animate-spin rounded-full border-2 border-ink-200 border-t-ink-600" />
          <p className="mt-3">Loading inventory…</p>
        </div>
      }
    >
      <InventoryInner />
    </Suspense>
  );
}
