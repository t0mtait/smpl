"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { Item, Priority, UseFrequency } from "@/lib/db";
import { CATEGORIES, FREQUENCY_LABELS } from "@/lib/format";
import { IconCamera } from "@/components/icons";

interface Props {
  item?: Item | null;
}

export default function ItemForm({ item }: Props) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [photoPath, setPhotoPath] = useState<string | null>(item?.photoPath ?? null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(
    item?.photoPath ? `/api/photos/${item.photoPath}` : null
  );
  const [priority, setPriority] = useState<Priority>(item?.priority ?? "auto");

  const [form, setForm] = useState({
    name: item?.name ?? "",
    category: item?.category ?? "uncategorized",
    description: item?.description ?? "",
    location: item?.location ?? "",
    purchaseDate: item?.purchaseDate ?? "",
    purchasePrice: String(item?.purchasePrice ?? 0),
    currentValue: String(item?.currentValue ?? 0),
    lastUsedAt: item?.lastUsedAt ?? "",
    useFrequency: item?.useFrequency ?? "unknown",
  });

  const set = (key: keyof typeof form) => (e: { target: { value: string } }) =>
    setForm((f) => ({ ...f, [key]: e.target.value }));

  const handleFile = async (file: File | undefined) => {
    if (!file || !item) return;
    setError(null);
    const fd = new FormData();
    fd.append("photo", file);
    const res = await fetch(`/api/items/${item.id}/photo`, { method: "POST", body: fd });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Photo upload failed");
      return;
    }
    const data = await res.json();
    setPhotoPath(data.photoPath);
    setPhotoPreview(URL.createObjectURL(file));
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    const payload = {
      name: form.name,
      category: form.category,
      description: form.description,
      location: form.location,
      purchaseDate: form.purchaseDate || null,
      purchasePrice: Number(form.purchasePrice) || 0,
      currentValue: Number(form.currentValue) || 0,
      lastUsedAt: form.lastUsedAt || null,
      useFrequency: form.useFrequency,
      priority,
      photoPath,
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
        <div className="card border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>
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
            <label className="label" htmlFor="category">
              Category
            </label>
            <select id="category" className="input" value={form.category} onChange={set("category")}>
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
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
        <h2 className="display text-lg">Money</h2>
        <div className="mt-5 grid gap-4 sm:grid-cols-3">
          <div>
            <label className="label" htmlFor="purchaseDate">
              Purchase date
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
            <label className="label" htmlFor="purchasePrice">
              Paid
            </label>
            <input
              id="purchasePrice"
              type="number"
              min="0"
              step="0.01"
              className="input"
              value={form.purchasePrice}
              onChange={set("purchasePrice")}
            />
          </div>
          <div>
            <label className="label" htmlFor="currentValue">
              Worth today
            </label>
            <input
              id="currentValue"
              type="number"
              min="0"
              step="0.01"
              className="input"
              value={form.currentValue}
              onChange={set("currentValue")}
            />
          </div>
        </div>
      </section>

      <section className="card p-6">
        <h2 className="display text-lg">Usage</h2>
        <div className="mt-5 grid gap-4 sm:grid-cols-3">
          <div>
            <label className="label" htmlFor="lastUsedAt">
              Last used
            </label>
            <input
              id="lastUsedAt"
              type="date"
              className="input"
              value={form.lastUsedAt ?? ""}
              onChange={set("lastUsedAt")}
            />
          </div>
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

      <section className="card p-6">
        <h2 className="display text-lg">Photo</h2>
        <div className="mt-5 flex flex-wrap items-center gap-4">
          <div className="h-28 w-28 overflow-hidden rounded-xl border border-line bg-paper">
            {photoPreview ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={photoPreview} alt="Item preview" className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-ink-400">
                <IconCamera width={22} height={22} />
              </div>
            )}
          </div>
          <div className="flex flex-col gap-2">
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => handleFile(e.target.files?.[0])}
            />
            <button
              type="button"
              className="btn-secondary"
              onClick={() => fileRef.current?.click()}
              disabled={!item}
              title={item ? undefined : "Save the item first, then add a photo"}
            >
              <IconCamera width={15} height={15} />
              {photoPreview ? "Replace photo" : "Upload photo"}
            </button>
            {!item ? (
              <span className="text-xs text-muted">Save the item first to attach a photo.</span>
            ) : null}
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
