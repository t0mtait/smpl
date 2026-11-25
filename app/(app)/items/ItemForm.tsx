"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import type { Item, Priority, UseFrequency } from "@/lib/db";
import { CATEGORIES, FREQUENCY_LABELS, formatCategory } from "@/lib/format";
import { quarterToIso, today } from "@/lib/dates";
import { IconTrash } from "@/components/icons";
import { ConfirmDialog } from "@/components/ConfirmDialog";

const CURRENT_YEAR = new Date().getFullYear();

function parseQuarterYear(value: string | null | undefined): { quarter: string; year: string } {
  if (!value) return { quarter: "", year: "" };
  const trimmed = value.trim();
  if (!trimmed) return { quarter: "", year: "" };

  const qy = /^Q([1-4])\s*(\d{4})$/i.exec(trimmed);
  if (qy) return { quarter: `Q${qy[1]}`, year: qy[2] };

  const yq = /^(\d{4})[-\s]*Q([1-4])$/i.exec(trimmed);
  if (yq) return { quarter: `Q${yq[2]}`, year: yq[1] };

  const iso = /^(\d{4})-(\d{2})(?:-\d{2})?/.exec(trimmed);
  if (iso) {
    const y = iso[1];
    const m = parseInt(iso[2], 10);
    if (m >= 1 && m <= 12) {
      return { quarter: `Q${Math.ceil(m / 3)}`, year: y };
    }
  }

  const d = new Date(trimmed.includes("T") ? trimmed : `${trimmed}T00:00:00`);
  if (!Number.isNaN(d.getTime())) {
    return { quarter: `Q${Math.ceil((d.getMonth() + 1) / 3)}`, year: String(d.getFullYear()) };
  }

  return { quarter: "", year: "" };
}

function normalizeUsage(val: string | null | undefined): string {
  if (!val) return "monthly";
  const v = val.toLowerCase();
  if (v === "heavy" || v === "daily" || v === "weekly") return "daily";
  if (v === "occasional" || v === "monthly") return "monthly";
  if (v === "rare" || v === "never") return "rare";
  if (v === "seasonal") return "seasonal";
  return "monthly";
}

interface Props {
  item?: Item | null;
}

export default function ItemForm({ item }: Props) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [userCategories, setUserCategories] = useState<{ category: string; subcategories: string[] }[]>([]);

  const initialAcq = parseQuarterYear(item?.purchaseDate);
  const initialOff = parseQuarterYear(item?.offloadedDate);
  const isPurgatory = item?.status === "purgatory";
  const [purgatoryDate, setPurgatoryDate] = useState(
    item?.purgatoryDate ? item.purgatoryDate.slice(0, 10) : today()
  );
  const [purchaseQuarter, setPurchaseQuarter] = useState(initialAcq.quarter);
  const [purchaseYear, setPurchaseYear] = useState(initialAcq.year);
  const [offloadedQuarter, setOffloadedQuarter] = useState(initialOff.quarter);
  const [offloadedYear, setOffloadedYear] = useState(initialOff.year);

  const years = useMemo(() => {
    const list: number[] = [];
    for (let y = CURRENT_YEAR + 1; y >= 1950; y--) {
      list.push(y);
    }
    const acqY = Number(purchaseYear);
    if (acqY && !list.includes(acqY)) list.push(acqY);
    const offY = Number(offloadedYear);
    if (offY && !list.includes(offY)) list.push(offY);
    return list.sort((a, b) => b - a);
  }, [purchaseYear, offloadedYear]);

  const handleAcquiredQuarterChange = (q: string) => {
    setPurchaseQuarter(q);
    if (!q) {
      setPurchaseYear("");
    } else if (!purchaseYear) {
      setPurchaseYear(String(CURRENT_YEAR));
    }
  };

  const handleOffloadedQuarterChange = (q: string) => {
    setOffloadedQuarter(q);
    if (!q) {
      setOffloadedYear("");
    } else if (!offloadedYear) {
      setOffloadedYear(String(CURRENT_YEAR));
    }
  };

  const remove = async () => {
    if (!item) return;
    setDeleteBusy(true);
    try {
      await fetch(`/api/items/${item.id}`, { method: "DELETE" });
      router.push("/items");
    } finally {
      setDeleteBusy(false);
      setConfirmDelete(false);
    }
  };

  useEffect(() => {
    fetch("/api/user/categories")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.categories) setUserCategories(data.categories);
      })
      .catch(() => {});
  }, []);

  const [form, setForm] = useState({
    name: item?.name ?? "",
    brand: item?.brand ?? "",
    category: item?.category ?? "uncategorized",
    subcategory: item?.subcategory ?? "",
    quality: item?.quality ?? "",
    description: item?.description ?? "",
    // An empty money field means "never recorded" — it must not become $0.
    purchasePrice:
      item?.purchasePrice === null || item?.purchasePrice === undefined
        ? ""
        : String(item.purchasePrice),
    currentValue:
      item?.currentValue === null || item?.currentValue === undefined
        ? ""
        : String(item.currentValue),
    useFrequency: normalizeUsage(item?.useFrequency),
  });

  const set = (key: keyof typeof form) => (e: { target: { value: string } }) =>
    setForm((f) => ({ ...f, [key]: e.target.value }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);

    const purchaseDate =
      purchaseQuarter && purchaseYear
        ? quarterToIso(`${purchaseQuarter} ${purchaseYear}`)
        : purchaseYear
        ? `${purchaseYear}-01-01`
        : null;

    const offloadedDate =
      offloadedQuarter && offloadedYear
        ? quarterToIso(`${offloadedQuarter} ${offloadedYear}`)
        : offloadedYear
        ? `${offloadedYear}-01-01`
        : null;

    const payload: Record<string, unknown> = {
      name: form.name,
      brand: form.brand,
      category: form.category,
      subcategory: form.subcategory,
      quality: form.quality,
      description: form.description,
      location: "",
      purchaseDate,
      offloadedDate,
      purchasePrice: form.purchasePrice.trim() === "" ? null : Number(form.purchasePrice),
      currentValue: form.currentValue.trim() === "" ? null : Number(form.currentValue),
      lastUsedAt: null,
      useFrequency: form.useFrequency,
      priority: item?.priority ?? "auto",
      photoPath: null,
    };
    if (isPurgatory) {
      payload.purgatoryDate = purgatoryDate.trim() || null;
    }
    try {
      const res = await fetch(item ? `/api/items/${item.id}` : "/api/items", {
        method: item ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "Save failed");
        setSaving(false);
        return;
      }
      const data = await res.json();
      router.push(`/items/${data.item.id}`);
      router.refresh();
    } catch {
      setError("Network error while saving.");
      setSaving(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-5">
      {error ? (
        <div className="card border-danger-line bg-danger-soft p-4 text-sm text-danger">{error}</div>
      ) : null}

      <section className="card p-6">
        <h2 className="display text-lg">The basics</h2>
        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label" htmlFor="name">
              Name *
            </label>
            <input
              id="name"
              className="input"
              required
              value={form.name}
              onChange={set("name")}
              placeholder="e.g. Cast iron skillet"
            />
          </div>
          <div>
            <label className="label" htmlFor="brand">
              Brand
            </label>
            <input
              id="brand"
              className="input"
              value={form.brand}
              onChange={set("brand")}
              placeholder="e.g. Lodge, Apple, Sony"
            />
          </div>
          <div>
            <label className="label" htmlFor="category">
              Category
            </label>
            <select
              id="category"
              className="input"
              value={form.category}
              onChange={(e) => setForm((f) => ({ ...f, category: e.target.value, subcategory: "" }))}
            >
              {(userCategories.length > 0 ? userCategories.map((u) => u.category) : CATEGORIES).map((c) => (
                <option key={c} value={c}>
                  {formatCategory(c)}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label" htmlFor="subcategory">
              Subcategory
            </label>
            <select id="subcategory" className="input" value={form.subcategory} onChange={set("subcategory")}>
              <option value="">None</option>
              {(() => {
                const opts = userCategories.find((u) => u.category === form.category)?.subcategories || [];
                const all = form.subcategory && !opts.includes(form.subcategory) ? [form.subcategory, ...opts] : opts;
                return all.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ));
              })()}
            </select>
          </div>
          <div>
            <label className="label" htmlFor="quality">
              Quality
            </label>
            <select
              id="quality"
              className="input"
              value={form.quality ? form.quality.toLowerCase() : ""}
              onChange={(e) => setForm((f) => ({ ...f, quality: e.target.value }))}
            >
              <option value="">— None —</option>
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </select>
          </div>
          <div>
            <label className="label" htmlFor="useFrequency">
              Usage
            </label>
            <select
              id="useFrequency"
              className="input"
              value={form.useFrequency}
              onChange={set("useFrequency")}
            >
              <option value="daily">Heavy</option>
              <option value="monthly">Occasional</option>
              <option value="rare">Rare</option>
              <option value="seasonal">Seasonal</option>
            </select>
          </div>
          <div className="sm:col-span-2">
            <label className="label" htmlFor="description">
              Notes
            </label>
            <textarea
              id="description"
              className="input"
              rows={2}
              value={form.description}
              onChange={set("description")}
              placeholder="why you own it, what replaced it, who gave it to you…"
            />
          </div>
        </div>
      </section>

      <section className="card p-6">
        <h2 className="display text-lg">Money & Dates</h2>
        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label" htmlFor="purchaseQuarter">
              Date acquired
              <span className="ml-1 font-normal text-muted">optional</span>
            </label>
            <div className="grid grid-cols-2 gap-2">
              <select
                id="purchaseQuarter"
                className="input"
                value={purchaseQuarter}
                onChange={(e) => handleAcquiredQuarterChange(e.target.value)}
              >
                <option value="">Quarter</option>
                <option value="Q1">Q1 (Jan–Mar)</option>
                <option value="Q2">Q2 (Apr–Jun)</option>
                <option value="Q3">Q3 (Jul–Sep)</option>
                <option value="Q4">Q4 (Oct–Dec)</option>
              </select>
              <select
                id="purchaseYear"
                className="input"
                value={purchaseYear}
                onChange={(e) => setPurchaseYear(e.target.value)}
              >
                <option value="">Year</option>
                {years.map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </select>
            </div>
          </div>
          {isPurgatory && (
            <div>
              <label className="label" htmlFor="purgatoryDate">
                Added to purgatory
              </label>
              <input
                id="purgatoryDate"
                type="date"
                className="input"
                value={purgatoryDate}
                onChange={(e) => setPurgatoryDate(e.target.value)}
              />
              <p className="mt-1 text-[11px] text-muted">
                Date this item entered purgatory (used to calculate age).
              </p>
            </div>
          )}
          <div>
            <label className="label" htmlFor="offloadedQuarter">
              Date offloaded
              <span className="ml-1 font-normal text-muted">optional</span>
            </label>
            <div className="grid grid-cols-2 gap-2">
              <select
                id="offloadedQuarter"
                className="input"
                value={offloadedQuarter}
                onChange={(e) => handleOffloadedQuarterChange(e.target.value)}
              >
                <option value="">Quarter</option>
                <option value="Q1">Q1 (Jan–Mar)</option>
                <option value="Q2">Q2 (Apr–Jun)</option>
                <option value="Q3">Q3 (Jul–Sep)</option>
                <option value="Q4">Q4 (Oct–Dec)</option>
              </select>
              <select
                id="offloadedYear"
                className="input"
                value={offloadedYear}
                onChange={(e) => setOffloadedYear(e.target.value)}
              >
                <option value="">Year</option>
                {years.map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <label className="label" htmlFor="purchasePrice">
              Paid
              <span className="ml-1 font-normal text-muted">optional</span>
            </label>
            <input
              id="purchasePrice"
              type="number"
              min="0"
              step="0.01"
              className="input"
              value={form.purchasePrice}
              onChange={set("purchasePrice")}
              placeholder="not recorded"
            />
          </div>
          <div>
            <label className="label" htmlFor="currentValue">
              Value
              <span className="ml-1 font-normal text-muted">optional</span>
            </label>
            <input
              id="currentValue"
              type="number"
              min="0"
              step="0.01"
              className="input"
              value={form.currentValue}
              onChange={set("currentValue")}
              placeholder="not recorded"
            />
          </div>
        </div>
      </section>

      <div className="flex items-center justify-between gap-2">
        <div className="flex gap-2">
          <button type="submit" className="btn-primary" disabled={saving}>
            {saving ? "Saving…" : item ? "Save changes" : "Add item"}
          </button>
          <button type="button" className="btn-secondary" onClick={() => router.back()}>
            Cancel
          </button>
        </div>
        {item ? (
          <button
            type="button"
            className="btn-danger inline-flex items-center gap-1.5"
            onClick={() => setConfirmDelete(true)}
            disabled={saving || deleteBusy}
          >
            <IconTrash width={15} height={15} />
            Delete permanently
          </button>
        ) : null}
      </div>

      {item ? (
        <ConfirmDialog
          open={confirmDelete}
          title="Delete item permanently?"
          message={
            <>
              Are you sure you want to delete <strong className="text-ink">{item.name}</strong>? It will be completely removed as if it was made by mistake, and won&apos;t count as sold, offloaded, or kept.
            </>
          }
          confirmLabel="Delete permanently"
          busy={deleteBusy}
          onConfirm={remove}
          onCancel={() => setConfirmDelete(false)}
        />
      ) : null}
    </form>
  );
}
