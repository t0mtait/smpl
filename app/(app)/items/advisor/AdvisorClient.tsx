"use client";

import { useState } from "react";
import Link from "next/link";
import { formatCategory, formatMoney } from "@/lib/format";
import { CategoryTag } from "@/components/ui";
import {
  IconCheck,
  IconFlame,
  IconHeart,
  IconSparkles,
} from "@/components/icons";

export interface AdvisorItem {
  id: number;
  name: string;
  brand: string;
  category: string;
  location: string;
  currentValue: number | null;
  purchasePrice: number | null;
  photoPath: string | null;
  score: number;
  reasons: { label: string; weight: number }[];
  idleDays: number | null;
}

interface Props {
  initialSuggestions: AdvisorItem[];
  isPro: boolean;
}

export default function AdvisorClient({ initialSuggestions, isPro }: Props) {
  const [items, setItems] = useState<AdvisorItem[]>(initialSuggestions);
  const [actionBusy, setActionBusy] = useState<number | null>(null);
  const [msg, setMsg] = useState<{ text: string; type: "success" | "error" } | null>(null);

  const handleAddToPurgatory = async (item: AdvisorItem) => {
    setActionBusy(item.id);
    setMsg(null);
    try {
      const res = await fetch(`/api/items/${item.id}/purgatory`, { method: "POST" });
      if (!res.ok) throw new Error("Failed to move item to purgatory");
      setItems((prev) => prev.filter((i) => i.id !== item.id));
      setMsg({ type: "success", text: `"${item.name}" has been moved to purgatory.` });
    } catch (err: unknown) {
      setMsg({
        type: "error",
        text: err instanceof Error ? err.message : "Failed to move item to purgatory",
      });
    } finally {
      setActionBusy(null);
    }
  };

  const handleKeepForNow = async (item: AdvisorItem) => {
    setActionBusy(item.id);
    setMsg(null);
    try {
      const res = await fetch(`/api/items/${item.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ priority: "keep" }),
      });
      if (!res.ok) throw new Error("Failed to mark item as keep");
      setItems((prev) => prev.filter((i) => i.id !== item.id));
      setMsg({ type: "success", text: `"${item.name}" marked as keep for now.` });
    } catch (err: unknown) {
      setMsg({
        type: "error",
        text: err instanceof Error ? err.message : "Failed to update item",
      });
    } finally {
      setActionBusy(null);
    }
  };

  return (
    <div className="space-y-8">
      <header className="animate-rise flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <p className="eyebrow">Declutter Intelligence</p>
            <span className="inline-flex items-center gap-1 rounded-full bg-accent-soft px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-accent">
              <IconSparkles width={10} height={10} />
              AI Advisor
            </span>
          </div>
          <h1 className="display mt-1 text-3xl leading-[1.1] tracking-[-0.02em] sm:text-5xl">
            Top 10 recommended offloads
          </h1>
          <p className="mt-2 text-[15px] text-muted max-w-2xl">
            Heuristic intelligence analyzes idle time, expected usage frequency, seasonal timing, depreciation,
            and duplicates to highlight the top items you should consider parting with.
          </p>
        </div>
      </header>

      {msg && (
        <div
          className={`rounded-lg p-3.5 text-sm transition-all ${
            msg.type === "success"
              ? "border border-accent-line bg-accent-soft text-accent"
              : "border border-danger-line bg-danger-soft text-danger"
          }`}
        >
          {msg.text}
        </div>
      )}

      {!isPro ? (
        <div className="card border-accent/40 bg-paper p-8 sm:p-12 text-center">
          <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-accent-soft text-accent mb-4">
            <IconSparkles width={28} height={28} />
          </span>
          <h2 className="display text-2xl sm:text-3xl">AI Advisor is a Pro Feature</h2>
          <p className="mt-2 text-[14px] text-muted max-w-lg mx-auto">
            Upgrade to smpl. Pro to unlock intelligent declutter recommendations. Our heuristic engine analyzes expected usage frequency, seasonal timing, depreciation, and duplicates to recommend the top items to offload.
          </p>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
            <Link href="/account#subscription" className="btn-primary">
              <IconSparkles width={16} height={16} />
              Upgrade to Pro for $3.49/mo
            </Link>
            <Link href="/items" className="btn-secondary">
              Back to Inventory
            </Link>
          </div>
        </div>
      ) : items.length === 0 ? (
        <div className="card p-12 text-center">
          <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-accent-soft text-accent mb-4">
            <IconCheck width={24} height={24} />
          </span>
          <h3 className="display text-xl">All clear!</h3>
          <p className="mt-1 text-sm text-muted max-w-md mx-auto">
            You don't have any items flagged for decluttering right now. Either you have marked them as kept or your inventory is lean.
          </p>
          <Link href="/items" className="btn-secondary mt-5 inline-flex">
            View Inventory
          </Link>
        </div>
      ) : (
        <div className="grid gap-4">
          {items.map((item, idx) => {
            const isBusy = actionBusy === item.id;
            const scoreColor =
              item.score >= 70
                ? "text-clay border-clay/30 bg-clay-soft"
                : item.score >= 40
                ? "text-warn border-warn/30 bg-warn-soft"
                : "text-ink-soft border-line bg-wash";

            return (
              <div
                key={item.id}
                className="card p-5 sm:p-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-5 transition-all hover:border-line-strong"
              >
                <div className="flex items-start gap-4 min-w-0 flex-1">
                  <div
                    className={`flex h-12 w-12 shrink-0 flex-col items-center justify-center rounded-xl border text-center ${scoreColor}`}
                  >
                    <span className="text-base font-bold leading-none">{item.score}</span>
                    <span className="text-[9px] uppercase font-semibold tracking-wider mt-0.5">score</span>
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-xs font-semibold text-muted">#{idx + 1}</span>
                      <Link
                        href={`/items/${item.id}`}
                        className="font-medium text-lg text-ink hover:text-accent transition-colors truncate"
                      >
                        {item.name}
                      </Link>
                      {item.brand && (
                        <span className="text-xs text-muted">({item.brand})</span>
                      )}
                      <CategoryTag category={item.category} />
                    </div>

                    <div className="mt-1.5 flex flex-wrap items-center gap-3 text-xs text-muted">
                      {item.currentValue !== null && (
                        <span className="tabular font-medium text-ink">
                          Valued at {formatMoney(item.currentValue)}
                        </span>
                      )}
                      {item.idleDays !== null && item.idleDays > 0 && (
                        <span>Idle for {item.idleDays} days</span>
                      )}
                    </div>

                    {/* Explanatory Reasons */}
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {item.reasons.map((r, rIdx) => (
                        <span
                          key={rIdx}
                          className="inline-flex items-center rounded-md border border-line bg-paper px-2 py-0.5 text-[11px] font-medium text-ink-soft"
                        >
                          {r.label}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2.5 w-full md:w-auto shrink-0 justify-end pt-3 md:pt-0 border-t md:border-t-0 border-line-soft">
                  <button
                    type="button"
                    onClick={() => handleKeepForNow(item)}
                    disabled={isBusy}
                    className="btn-secondary text-xs py-2 px-3 flex-1 md:flex-initial"
                  >
                    Keep for now
                  </button>
                  <button
                    type="button"
                    onClick={() => handleAddToPurgatory(item)}
                    disabled={isBusy}
                    className="btn-clay text-xs py-2 px-3 flex items-center justify-center gap-1.5 flex-1 md:flex-initial"
                  >
                    <IconFlame width={14} height={14} />
                    Add to Purgatory
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
