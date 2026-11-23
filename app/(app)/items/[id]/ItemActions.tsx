"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type { Disposition, Item } from "@/lib/db";
import { formatDate, formatMoney, STATUS_LABELS, STATUS_STYLES } from "@/lib/format";
import { StatusTag } from "@/components/ui";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { today } from "@/lib/dates";
import {
  IconArchive,
  IconCash,
  IconFlame,
  IconHeart,
  IconPencil,
  IconRecycle,
  IconTrash,
  IconUndo,
  IconX,
} from "@/components/icons";

const CHANNELS = ["eBay", "Facebook Marketplace", "Craigslist", "Poshmark", "OfferUp", "Buy Nothing", "Other"];

const OUTCOMES: { value: Disposition; label: string; icon: React.ReactNode }[] = [
  { value: "sold", label: "Sold", icon: <IconCash width={15} height={15} /> },
  { value: "donated", label: "Donated", icon: <IconHeart width={15} height={15} /> },
  { value: "disposed", label: "Disposed", icon: <IconRecycle width={15} height={15} /> },
  // "Closed" is for things that simply left without a recorded outcome.
  { value: "closed", label: "Closed", icon: <IconArchive width={15} height={15} /> },
];

export default function ItemActions({ item }: { item: Item }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [disposition, setDisposition] = useState<Disposition>("sold");
  const [amount, setAmount] = useState(item.currentValue === null ? "" : String(item.currentValue));
  const [channel, setChannel] = useState("");
  const [notes, setNotes] = useState("");
  const [disposedAt, setDisposedAt] = useState(today());
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

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
          // An empty amount means "never recorded" — never $0.
          amount: amount.trim() === "" ? null : Number(amount),
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
    setBusy(true);
    try {
      await fetch(`/api/items/${item.id}`, { method: "DELETE" });
      router.push("/items");
    } finally {
      setBusy(false);
      setConfirmDelete(false);
    }
  };

  const moveToPurgatory = async () => {
    setBusy(true);
    await fetch(`/api/items/${item.id}/purgatory`, { method: "POST" });
    router.refresh();
  };

  if (item.status === "purgatory") {
    return (
      <section className="card p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-md bg-clay-soft text-clay">
                <IconFlame width={15} height={15} />
              </span>
              <StatusTag status={{ label: "Purgatory", style: STATUS_STYLES.purgatory }} />
            </div>
            <p className="mt-2 text-[13px] text-muted">
              Staged in Purgatory to get rid of. You can restore it to inventory or offload it.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button className="btn-secondary" onClick={restore} disabled={busy}>
              <IconUndo width={15} height={15} />
              Restore to inventory
            </button>
            <Link href="/purgatory" className="btn-clay">
              <IconFlame width={15} height={15} />
              Offload in Purgatory
            </Link>
          </div>
        </div>
      </section>
    );
  }

  if (item.status !== "owned") {
    return (
      <section className="card p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <StatusTag status={{ label: STATUS_LABELS[item.status] ?? item.status, style: STATUS_STYLES[item.status] }} />
            <p className="mt-2 text-[13px] text-muted">
              Restoring returns this item to “owned” and removes the disposal record.
            </p>
          </div>
          <button className="btn-secondary" onClick={restore} disabled={busy}>
            <IconUndo width={15} height={15} />
            Put back in my inventory
          </button>
        </div>
      </section>
    );
  }

  return (
    <section className="card overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-6 py-4">
        <h2 className="display text-lg">Offload or Stage</h2>
        <div className="flex items-center gap-2">
          <button className="btn-secondary" onClick={moveToPurgatory} disabled={busy}>
            <IconX width={15} height={15} />
            Move to Purgatory
          </button>
          {!open ? (
            <button className="btn-clay" onClick={() => setOpen(true)}>
              <IconRecycle width={15} height={15} />
              Offload now
            </button>
          ) : null}
        </div>
      </div>

      {open ? (
        <form onSubmit={submit} className="space-y-5 p-6">
          {error ? (
            <div className="rounded-lg border border-danger-line bg-danger-soft p-3 text-sm text-danger">
              {error}
            </div>
          ) : null}

          <div>
            <span className="label">Outcome</span>
            <div className="flex flex-wrap gap-2">
              {OUTCOMES.map((o) => (
                <button
                  key={o.value}
                  type="button"
                  onClick={() => setDisposition(o.value)}
                  aria-pressed={disposition === o.value}
                  className={`btn border ${
                    disposition === o.value
                      ? "border-brand bg-brand text-brand-fg"
                      : "border-line bg-card text-ink-soft hover:border-line-strong"
                  }`}
                >
                  {o.icon}
                  {o.label}
                </button>
              ))}
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <label className="label" htmlFor="amount">
                Amount ($)
                {disposition === "sold" ? (
                  <span className="ml-1 font-normal text-muted">optional</span>
                ) : null}
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
            <div className="sm:col-span-3">
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

          <div className="flex gap-2">
            <button type="submit" className="btn-moss" disabled={busy}>
              {busy ? "Saving…" : "Record it"}
            </button>
            <button type="button" className="btn-secondary" onClick={() => setOpen(false)}>
              Cancel
            </button>
          </div>
        </form>
      ) : null}

      <div className="flex items-center justify-between gap-3 border-t border-line px-6 py-4">
        <Link href={`/items/${item.id}/edit`} className="btn-secondary">
          <IconPencil width={15} height={15} />
          Edit details
        </Link>
        <button className="btn-danger" onClick={() => setConfirmDelete(true)} disabled={busy}>
          <IconTrash width={15} height={15} />
          Delete permanently
        </button>
      </div>

      <ConfirmDialog
        open={confirmDelete}
        title="Delete item permanently?"
        message={
          <>
            Are you sure you want to permanently delete <strong className="text-ink">{item.name}</strong> and all of its recorded history? This action cannot be undone.
          </>
        }
        confirmLabel="Delete permanently"
        busy={busy}
        onConfirm={remove}
        onCancel={() => setConfirmDelete(false)}
      />
    </section>
  );
}
