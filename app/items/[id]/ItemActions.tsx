"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type { Disposition, Item } from "@/lib/db";
import { formatDate, formatMoney, FREQUENCY_LABELS, STATUS_LABELS, STATUS_STYLES } from "@/lib/format";

const CHANNELS = ["eBay", "Facebook Marketplace", "Craigslist", "Poshmark", "OfferUp", "Buy Nothing", "Other"];

export default function ItemActions({ item }: { item: Item }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [disposition, setDisposition] = useState<Disposition>("sold");
  const [amount, setAmount] = useState(String(item.currentValue || ""));
  const [channel, setChannel] = useState("");
  const [notes, setNotes] = useState("");
  const [disposedAt, setDisposedAt] = useState(new Date().toISOString().slice(0, 10));
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/items/${item.id}/dispose`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          disposition,
          disposedAt,
          amount: Number(amount) || 0,
          channel,
          notes,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "Could not record disposal");
        setBusy(false);
        return;
      }
      setOpen(false);
      router.refresh();
    } catch {
      setError("Network error.");
      setBusy(false);
    }
  };

  const restore = async () => {
    setBusy(true);
    await fetch(`/api/items/${item.id}`, { method: "PUT" });
    router.refresh();
  };

  const remove = async () => {
    if (!confirm("Delete this item and its history permanently?")) return;
    setBusy(true);
    await fetch(`/api/items/${item.id}`, { method: "DELETE" });
    router.push("/items");
  };

  if (item.status !== "owned") {
    return (
      <div className="card space-y-3">
        <div className="flex items-center justify-between">
          <span className={`pill ${STATUS_STYLES[item.status]}`}>
            {STATUS_LABELS[item.status]} {formatDate(item.lastUsedAt)}
          </span>
          <button className="btn-secondary" onClick={restore} disabled={busy}>
            Put back in my inventory
          </button>
        </div>
        <p className="text-xs text-ink-400">
          Restoring returns this item to “owned” and removes the disposal record.
        </p>
      </div>
    );
  }

  return (
    <div className="card space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-semibold">Get rid of it</h2>
        {!open && (
          <button className="btn-clay" onClick={() => setOpen(true)}>
            Mark as sold / donated / disposed
          </button>
        )}
      </div>

      {open && (
        <form onSubmit={submit} className="space-y-4 border-t border-ink-100 pt-4">
          {error && <div className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</div>}
          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <label className="label" htmlFor="disposition">
                Outcome
              </label>
              <select
                id="disposition"
                className="input"
                value={disposition}
                onChange={(e) => setDisposition(e.target.value as Disposition)}
              >
                <option value="sold">Sold</option>
                <option value="donated">Donated</option>
                <option value="disposed">Disposed</option>
              </select>
            </div>
            <div>
              <label className="label" htmlFor="amount">
                Amount ($)
              </label>
              <input
                id="amount"
                type="number"
                min="0"
                step="0.01"
                className="input"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                disabled={disposition !== "sold"}
              />
            </div>
            <div>
              <label className="label" htmlFor="disposedAt">
                Date
              </label>
              <input
                id="disposedAt"
                type="date"
                className="input"
                value={disposedAt}
                onChange={(e) => setDisposedAt(e.target.value)}
              />
            </div>
            <div>
              <label className="label" htmlFor="channel">
                Where
              </label>
              <select
                id="channel"
                className="input"
                value={channel}
                onChange={(e) => setChannel(e.target.value)}
                disabled={disposition !== "sold"}
              >
                <option value="">—</option>
                {CHANNELS.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
            <div className="sm:col-span-2">
              <label className="label" htmlFor="notes">
                Notes
              </label>
              <input
                id="notes"
                className="input"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="who bought it, where it went…"
              />
            </div>
          </div>
          <div className="flex gap-3">
            <button type="submit" className="btn-moss" disabled={busy}>
              {busy ? "Saving…" : "Record it"}
            </button>
            <button type="button" className="btn-secondary" onClick={() => setOpen(false)}>
              Cancel
            </button>
          </div>
        </form>
      )}

      <div className="flex items-center justify-between border-t border-ink-100 pt-4">
        <Link href={`/items/${item.id}/edit`} className="btn-secondary">
          Edit details
        </Link>
        <button className="btn-danger" onClick={remove} disabled={busy}>
          Delete permanently
        </button>
      </div>
    </div>
  );
}
