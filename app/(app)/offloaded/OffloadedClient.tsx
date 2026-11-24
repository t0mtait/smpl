"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { Item } from "@/lib/db";
import { formatCategory, formatMoney, formatQuarter, getItemStatusInfo } from "@/lib/format";
import { CategoryTag, Pagination, StatusTag } from "@/components/ui";
import {
  IconArchive,
  IconBox,
  IconCash,
  IconRecycle,
  IconSearch,
  IconUndo,
} from "@/components/icons";

export default function OffloadedClient({
  initialItems,
  saleAmounts,
}: {
  initialItems: Item[];
  saleAmounts: Record<number, number>;
}) {
  const router = useRouter();
  const [items, setItems] = useState<Item[]>(initialItems);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [page, setPage] = useState(1);
  const [busyId, setBusyId] = useState<number | null>(null);

  const categories = useMemo(() => {
    const set = new Set(items.map((i) => i.category));
    return [...set].sort();
  }, [items]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return items.filter((item) => {
      if (statusFilter !== "all" && item.status !== statusFilter) return false;
      if (categoryFilter !== "all" && item.category !== categoryFilter) return false;
      if (!q) return true;
      return (
        item.name.toLowerCase().includes(q) ||
        (item.brand && item.brand.toLowerCase().includes(q)) ||
        item.category.toLowerCase().includes(q) ||
        (item.subcategory && item.subcategory.toLowerCase().includes(q)) ||
        item.description.toLowerCase().includes(q) ||
        item.location.toLowerCase().includes(q)
      );
    });
  }, [items, query, statusFilter, categoryFilter]);

  useEffect(() => {
    setPage(1);
  }, [query, statusFilter, categoryFilter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / 10));
  const safePage = Math.min(page, totalPages);
  const paginated = filtered.slice((safePage - 1) * 10, safePage * 10);

  const soldItems = useMemo(
    () => items.filter((i) => i.status === "sold" && (saleAmounts[i.id] ?? 0) > 0),
    [items]
  );
  const soldTotal = useMemo(
    () => soldItems.reduce((sum, i) => sum + (saleAmounts[i.id] ?? 0), 0),
    [soldItems, saleAmounts]
  );
  const noReturnCount = items.length - soldItems.length;

  const restore = async (item: Item) => {
    setBusyId(item.id);
    try {
      const res = await fetch(`/api/items/${item.id}`, { method: "PUT" });
      if (res.ok) {
        setItems((prev) => prev.filter((i) => i.id !== item.id));
        router.refresh();
      }
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="space-y-7">
      <header className="animate-rise flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="flex h-6 w-6 items-center justify-center rounded-md bg-wash text-ink-soft">
              <IconArchive width={15} height={15} />
            </span>
            <p className="eyebrow">Offloaded</p>
          </div>
          <h1 className="display mt-2 text-4xl leading-[1.1] sm:text-5xl">Past possessions</h1>
        </div>

        {/* Search & filters beside header */}
        <div className="flex w-full flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end xl:w-auto xl:flex-1 xl:justify-end">
          <div className="min-w-[180px] flex-1 xl:max-w-[260px]">
            <label className="label" htmlFor="offload-q">
              Search
            </label>
            <div className="relative">
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-faint">
                <IconSearch width={15} height={15} />
              </span>
              <input
                id="offload-q"
                className="input pl-9"
                placeholder="Search offloaded items…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </div>
          </div>

          <div className="sm:w-36">
            <label className="label" htmlFor="offload-status">
              Status
            </label>
            <select
              id="offload-status"
              className="input"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="all">All statuses</option>
              <option value="sold">Sold</option>
              <option value="donated">Donated</option>
              <option value="disposed">Thrown out</option>
              <option value="closed">Closed</option>
            </select>
          </div>

          <div className="sm:w-40">
            <label className="label" htmlFor="offload-cat">
              Category
            </label>
            <select
              id="offload-cat"
              className="input"
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

      {/* Items table */}
      {filtered.length === 0 ? (
        <div className="card">
          <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
            <span className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-paper text-ink-faint">
              <IconBox width={22} height={22} />
            </span>
            <h3 className="display text-xl">
              {items.length === 0 ? "No offloaded items yet" : "No matches found"}
            </h3>
            <p className="mt-1.5 max-w-sm text-sm leading-relaxed text-muted">
              {items.length === 0
                ? "When items leave your life through sale, donation, or disposal, they appear here."
                : "Try adjusting your search or filters."}
            </p>
          </div>
        </div>
      ) : (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[960px] border-collapse text-left">
              <thead>
                <tr className="border-b border-line text-[11px] font-semibold uppercase tracking-[0.12em] text-muted">
                  <th scope="col" className="px-4 py-3">Item</th>
                  <th scope="col" className="px-4 py-3">Brand</th>
                  <th scope="col" className="px-4 py-3">Category</th>
                  <th scope="col" className="px-4 py-3">Status</th>
                  <th scope="col" className="px-4 py-3 text-right">Return ($)</th>
                  <th scope="col" className="px-4 py-3 text-right">Acquired</th>
                  <th scope="col" className="px-4 py-3 text-right">Offloaded</th>
                  <th scope="col" className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {paginated.map((item) => {
                  const statusInfo = getItemStatusInfo(item);
                  return (
                    <tr
                      key={item.id}
                      className="border-b border-line-soft transition-colors last:border-0 even:bg-wash/60 dark:even:bg-shell/70 hover:bg-wash dark:hover:bg-wash/40"
                    >
                      <th scope="row" className="px-4 py-3 text-left font-normal">
                        <Link
                          href={`/items/${item.id}`}
                          className="font-medium text-ink hover:text-accent"
                        >
                          {item.name}
                        </Link>
                      </th>
                      <td className="px-4 py-3 text-[13px] text-ink-soft">{item.brand || "—"}</td>
                      <td className="px-4 py-3">
                        <CategoryTag category={item.category} />
                      </td>
                      <td className="px-4 py-3">
                        <StatusTag status={statusInfo} />
                      </td>
                      <td className="tabular px-4 py-3 text-right text-[13px] font-medium text-ink">
                        {item.status === "sold" ? formatMoney(saleAmounts[item.id] ?? null) : "—"}
                      </td>
                      <td className="tabular px-4 py-3 text-right text-[13px] text-muted">
                        {formatQuarter(item.purchaseDate)}
                      </td>
                      <td className="tabular px-4 py-3 text-right text-[13px] text-muted">
                        {formatQuarter(item.offloadedDate)}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          type="button"
                          className="btn-secondary px-2.5 py-1 text-[12px]"
                          onClick={() => restore(item)}
                          disabled={busyId === item.id}
                          title="Restore back to inventory"
                        >
                          <IconUndo width={13} height={13} />
                          Restore
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
            totalItems={filtered.length}
            pageSize={10}
            onPageChange={setPage}
          />
        </div>
      )}
    </div>
  );
}
