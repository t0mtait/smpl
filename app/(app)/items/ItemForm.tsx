"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Item, Priority, UseFrequency } from "@/lib/db";
import { CATEGORIES, FREQUENCY_LABELS, formatCategory } from "@/lib/format";

interface Props {
  item?: Item | null;
}

export default function ItemForm({ item }: Props) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [priority, setPriority] = useState<Priority>(item?.priority ?? "auto");

  const [form, setForm] = useState({
    name: item?.name ?? "",
    brand: item?.brand ?? "",
    category: item?.category ?? "uncategorized",
    quality: item?.quality ?? "",
    description: item?.description ?? "",
    location: item?.location ?? "",
    purchaseDate: item?.purchaseDate ?? "",
    offloadedDate: item?.offloadedDate ?? "",
    // An empty money field means "never recorded" — it must not become $0.
    purchasePrice:
      item?.purchasePrice === null || item?.purchasePrice === undefined
        ? ""
        : String(item.purchasePrice),
    currentValue:
      item?.currentValue === null || item?.currentValue === undefined
        ? ""
        : String(item.currentValue),
    useFrequency: item?.useFrequency ?? "unknown",
  });

  const set = (key: keyof typeof form) => (e: { target: { value: string } }) =>
    setForm((f) => ({ ...f, [key]: e.target.value }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    const payload = {
      name: form.name,
      brand: form.brand,
      category: form.category,
      quality: form.quality,
      description: form.description,
      location: form.location,
      purchaseDate: form.purchaseDate || null,
      offloadedDate: form.offloadedDate || null,
      purchasePrice: form.purchasePrice.trim() === "" ? null : Number(form.purchasePrice),
      currentValue: form.currentValue.trim() === "" ? null : Number(form.currentValue),
      lastUsedAt: null,
      useFrequency: form.useFrequency,
      priority,
      photoPath: null,
    };
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
          <div className="sm:col-span-2">
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
            <select id="category" className="input" value={form.category} onChange={set("category")}>
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {formatCategory(c)}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label" htmlFor="quality">
              Quality
            </label>
            <input
              id="quality"
              className="input"
              value={form.quality}
              onChange={set("quality")}
              placeholder="e.g. High, Medium, Budget"
            />
          </div>
          <div>
            <label className="label" htmlFor="location">
              Where is it
            </label>
            <input
              id="location"
              className="input"
              value={form.location}
              onChange={set("location")}
              placeholder="e.g. garage shelf 2"
            />
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
        <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <label className="label" htmlFor="purchaseDate">
              Date acquired
            </label>
            <input
              id="purchaseDate"
              type="date"
              className="input"
              value={form.purchaseDate ?? ""}
              onChange={set("purchaseDate")}
            />
          </div>
          <div>
            <label className="label" htmlFor="offloadedDate">
              Date offloaded
            </label>
            <input
              id="offloadedDate"
              type="date"
              className="input"
              value={form.offloadedDate ?? ""}
              onChange={set("offloadedDate")}
            />
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
              Worth today
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

      <section className="card p-6">
        <h2 className="display text-lg">Usage</h2>
        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label" htmlFor="useFrequency">
              How often
            </label>
            <select
              id="useFrequency"
              className="input"
              value={form.useFrequency}
              onChange={set("useFrequency")}
            >
              {Object.entries(FREQUENCY_LABELS).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label" htmlFor="priority">
              Your call
            </label>
            <select
              id="priority"
              className="input"
              value={priority}
              onChange={(e) => setPriority(e.target.value as Priority)}
            >
              <option value="auto">Let the app decide</option>
              <option value="keep">Keep it</option>
              <option value="get_rid">Get rid of it</option>
            </select>
          </div>
        </div>
      </section>

      <div className="flex gap-2">
        <button type="submit" className="btn-primary" disabled={saving}>
          {saving ? "Saving…" : item ? "Save changes" : "Add item"}
        </button>
        <button type="button" className="btn-secondary" onClick={() => router.back()}>
          Cancel
        </button>
      </div>
    </form>
  );
}
