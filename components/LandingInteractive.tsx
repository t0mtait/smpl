"use client";

import { useState } from "react";
import Link from "next/link";
import {
  IconArchive,
  IconBox,
  IconCheck,
  IconChevronDown,
  IconFlame,
  IconHeart,
  IconPlus,
  IconRecycle,
  IconRobot,
  IconSearch,
  IconSparkles,
  IconUndo,
} from "@/components/icons";

/* =====================================================================
   1. Interactive Preview Widget (Hero / Feature Deep-Dive)
   ===================================================================== */

type PreviewTab = "inventory" | "purgatory" | "wishlist" | "advisor";

interface SampleItem {
  id: number;
  name: string;
  category: string;
  price: number;
  usage: "Heavy" | "Occasional" | "Rare";
  inPurgatory?: boolean;
  purgatoryDays?: number;
}

const INITIAL_ITEMS: SampleItem[] = [
  { id: 1, name: "Le Creuset Dutch Oven", category: "kitchen", price: 340, usage: "Heavy" },
  { id: 2, name: "Sony WH-1000XM5 Headphones", category: "electronics", price: 380, usage: "Heavy" },
  { id: 3, name: "De'Longhi Espresso Maker", category: "kitchen", price: 260, usage: "Occasional" },
  { id: 4, name: "3-Person Camping Tent", category: "misc", price: 195, usage: "Rare" },
];

export function InteractivePreviewWidget() {
  const [tab, setTab] = useState<PreviewTab>("inventory");

  // Tab 1: Inventory state
  const [items, setItems] = useState<SampleItem[]>(INITIAL_ITEMS);
  const [search, setSearch] = useState("");
  const [toast, setToast] = useState<string | null>(null);

  // Tab 2: Purgatory state
  const [purgatoryItems, setPurgatoryItems] = useState([
    { id: 101, name: "Vintage Road Bike", category: "misc", days: 28, value: 220 },
    { id: 102, name: "Secondary Monitor", category: "electronics", days: 14, value: 160 },
  ]);
  const [proceeds, setProceeds] = useState<number>(0);

  // Tab 3: Wishlist state
  const [wishPriority, setWishPriority] = useState<number>(75);
  const [simulatedDays, setSimulatedDays] = useState<number>(12);
  const [wishConverted, setWishConverted] = useState(false);

  // Tab 4: AI Advisor state
  const [aiAnalyzed, setAiAnalyzed] = useState(false);
  const [aiApplied, setAiApplied] = useState(false);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  };

  const cycleUsage = (id: number) => {
    setItems((prev) =>
      prev.map((it) => {
        if (it.id !== id) return it;
        const next: SampleItem["usage"] =
          it.usage === "Heavy" ? "Occasional" : it.usage === "Occasional" ? "Rare" : "Heavy";
        showToast(`Updated usage for ${it.name} to "${next}"`);
        return { ...it, usage: next };
      })
    );
  };

  const stageToPurgatory = (id: number) => {
    const it = items.find((i) => i.id === id);
    if (!it) return;
    setItems((prev) => prev.filter((i) => i.id !== id));
    setPurgatoryItems((prev) => [{ id: it.id, name: it.name, category: it.category, days: 1, value: it.price }, ...prev]);
    showToast(`Staged "${it.name}" to 30-Day Purgatory!`);
  };

  const restoreFromPurgatory = (id: number) => {
    const it = purgatoryItems.find((i) => i.id === id);
    if (!it) return;
    setPurgatoryItems((prev) => prev.filter((i) => i.id !== id));
    setItems((prev) => [
      ...prev,
      { id: it.id, name: it.name, category: it.category, price: it.value, usage: "Occasional" },
    ]);
    showToast(`Restored "${it.name}" back to Inventory!`);
  };

  const offloadFromPurgatory = (id: number) => {
    const it = purgatoryItems.find((i) => i.id === id);
    if (!it) return;
    setPurgatoryItems((prev) => prev.filter((i) => i.id !== id));
    setProceeds((prev) => prev + it.value);
    showToast(`Offloaded "${it.name}" for $${it.value} proceeds!`);
  };

  const filteredItems = items.filter(
    (it) =>
      it.name.toLowerCase().includes(search.toLowerCase()) ||
      it.category.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="card overflow-hidden shadow-xl border-line transition-all">
      {/* Top Window Bar */}
      <div className="flex flex-wrap items-center justify-between border-b border-line bg-shell/80 px-4 py-3 sm:px-5">
        <div className="flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-full bg-red-400/80" />
          <span className="h-2.5 w-2.5 rounded-full bg-amber-400/80" />
          <span className="h-2.5 w-2.5 rounded-full bg-emerald-400/80" />
          <span className="ml-2 font-mono text-[11px] text-muted">interactive sandbox</span>
        </div>

        {/* Tab Switchers */}
        <div className="flex flex-wrap items-center gap-1 rounded-lg border border-line bg-paper p-1 text-xs">
          <button
            type="button"
            onClick={() => setTab("inventory")}
            className={`flex items-center gap-1.5 rounded-md px-2.5 py-1 font-medium transition-colors ${
              tab === "inventory" ? "bg-brand text-brand-fg shadow-sm" : "text-muted hover:text-ink"
            }`}
          >
            <IconBox width={13} height={13} />
            <span>Inventory</span>
          </button>
          <button
            type="button"
            onClick={() => setTab("purgatory")}
            className={`flex items-center gap-1.5 rounded-md px-2.5 py-1 font-medium transition-colors ${
              tab === "purgatory" ? "bg-brand text-brand-fg shadow-sm" : "text-muted hover:text-ink"
            }`}
          >
            <IconFlame width={13} height={13} />
            <span>Purgatory</span>
          </button>
          <button
            type="button"
            onClick={() => setTab("wishlist")}
            className={`flex items-center gap-1.5 rounded-md px-2.5 py-1 font-medium transition-colors ${
              tab === "wishlist" ? "bg-brand text-brand-fg shadow-sm" : "text-muted hover:text-ink"
            }`}
          >
            <IconHeart width={13} height={13} />
            <span>Wishlist</span>
          </button>
          <button
            type="button"
            onClick={() => setTab("advisor")}
            className={`flex items-center gap-1.5 rounded-md px-2.5 py-1 font-medium transition-colors ${
              tab === "advisor" ? "bg-brand text-brand-fg shadow-sm" : "text-muted hover:text-ink"
            }`}
          >
            <IconRobot width={13} height={13} />
            <span>AI Advisor</span>
          </button>
        </div>
      </div>

      {/* Main Interactive Tab Content */}
      <div className="p-4 sm:p-6 min-h-[360px] flex flex-col justify-between">
        {/* TAB 1: INVENTORY TRACKER */}
        {tab === "inventory" && (
          <div className="space-y-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="eyebrow text-[10px]">Everything you own</p>
                <h3 className="display text-xl sm:text-2xl mt-0.5">Active Inventory</h3>
              </div>
              <div className="relative min-w-[200px]">
                <IconSearch
                  width={14}
                  height={14}
                  className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted"
                />
                <input
                  type="text"
                  placeholder="Filter sample items…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="input pl-8 py-1 text-xs h-8"
                />
              </div>
            </div>

            <div className="overflow-x-auto rounded-lg border border-line">
              <table className="w-full text-left text-xs">
                <thead className="bg-wash/60 text-[10px] font-semibold uppercase tracking-wider text-muted border-b border-line">
                  <tr>
                    <th className="px-3 py-2">Item</th>
                    <th className="px-3 py-2">Category</th>
                    <th className="px-3 py-2 text-right">Value</th>
                    <th className="px-3 py-2">Usage</th>
                    <th className="px-3 py-2 text-right">Purgatory</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line-soft">
                  {filteredItems.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="p-4 text-center text-muted">
                        No matches found.
                      </td>
                    </tr>
                  ) : (
                    filteredItems.map((it) => (
                      <tr key={it.id} className="hover:bg-wash/40 transition-colors">
                        <td className="px-3 py-2.5 font-medium text-ink">{it.name}</td>
                        <td className="px-3 py-2.5">
                          <span className="capitalize text-muted">{it.category}</span>
                        </td>
                        <td className="px-3 py-2.5 text-right tabular text-ink font-semibold">
                          ${it.price}
                        </td>
                        <td className="px-3 py-2.5">
                          <span
                            className={`inline-block rounded px-2 py-0.5 text-[11px] font-medium ${
                              it.usage === "Heavy"
                                ? "bg-accent-soft text-accent"
                                : it.usage === "Occasional"
                                ? "bg-wash text-ink"
                                : "bg-clay-soft text-clay"
                            }`}
                          >
                            {it.usage}
                          </span>
                        </td>
                        <td className="px-3 py-2.5 text-right">
                          <button
                            type="button"
                            onClick={() => stageToPurgatory(it.id)}
                            className="inline-flex h-7 w-7 items-center justify-center rounded text-muted hover:bg-clay-soft hover:text-clay transition-colors"
                            title="Stage to Purgatory"
                          >
                            <IconFlame width={15} height={15} />
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            <p className="text-[11px] text-muted text-center pt-1">
              💡 <em>Try typing in the search box or clicking the flame icon to stage an item to Purgatory.</em>
            </p>
          </div>
        )}

        {/* TAB 2: PURGATORY */}
        {tab === "purgatory" && (
          <div className="space-y-4">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div className="flex items-center gap-1.5">
                  <span className="flex h-5 w-5 items-center justify-center rounded bg-clay-soft text-clay">
                    <IconFlame width={12} height={12} />
                  </span>
                  <p className="eyebrow text-[10px]">30-Day Decision Clock</p>
                </div>
                <h3 className="display text-xl sm:text-2xl mt-0.5">Items in Purgatory</h3>
              </div>

              {proceeds > 0 && (
                <div className="rounded-lg bg-emerald-500/10 border border-emerald-500/20 px-3 py-1.5 text-xs text-emerald-600 dark:text-emerald-400 font-semibold">
                  💰 Total Offload Proceeds: +${proceeds}
                </div>
              )}
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              {purgatoryItems.length === 0 ? (
                <div className="sm:col-span-2 card p-8 text-center text-muted">
                  <IconCheck width={28} height={28} className="mx-auto text-accent mb-2" />
                  <p className="font-semibold text-ink">Purgatory is clear!</p>
                  <p className="text-xs mt-1">Switch to the Inventory tab and click any item's flame to stage it here.</p>
                </div>
              ) : (
                purgatoryItems.map((it) => {
                  const pct = Math.min(100, Math.round((it.days / 30) * 100));
                  const mature = it.days >= 30;

                  return (
                    <div key={it.id} className="card p-3.5 space-y-3 border-line bg-paper">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <h4 className="font-semibold text-sm text-ink">{it.name}</h4>
                          <span className="text-[11px] text-muted capitalize">{it.category} · Est. ${it.value}</span>
                        </div>

                        {/* Circular Day Counter Ring */}
                        <div className="flex items-center gap-1.5 text-right">
                          <div className="relative h-10 w-10 shrink-0">
                            <svg width={40} height={40} className="-rotate-90">
                              <circle cx={20} cy={20} r={16} fill="none" strokeWidth={3} className="stroke-line" />
                              <circle
                                cx={20}
                                cy={20}
                                r={16}
                                fill="none"
                                strokeWidth={3}
                                strokeLinecap="round"
                                strokeDasharray={100}
                                strokeDashoffset={100 - pct}
                                className={mature ? "stroke-clay" : "stroke-accent"}
                              />
                            </svg>
                            <span className="absolute inset-0 flex items-center justify-center text-[10px] font-bold text-ink">
                              {it.days}d
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center justify-between pt-1 border-t border-line-soft">
                        <span className="text-[11px] text-muted">
                          {mature ? "30 days reached — time to decide" : `${30 - it.days} days remaining`}
                        </span>
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => restoreFromPurgatory(it.id)}
                            className="btn-secondary text-[11px] py-1 px-2 h-7"
                          >
                            <IconUndo width={11} height={11} />
                            Keep
                          </button>
                          <button
                            type="button"
                            onClick={() => offloadFromPurgatory(it.id)}
                            className="btn-clay text-[11px] py-1 px-2 h-7"
                          >
                            Offload (${it.value})
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            <p className="text-[11px] text-muted text-center pt-1">
              💡 <em>No regret, no pressure. Put questionable items in a box. If you don't touch them in 30 days, offload with certainty.</em>
            </p>
          </div>
        )}

        {/* TAB 3: WISHLIST & COOLDOWN */}
        {tab === "wishlist" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="flex items-center gap-1.5">
                  <span className="flex h-5 w-5 items-center justify-center rounded bg-accent-soft text-accent">
                    <IconHeart width={12} height={12} />
                  </span>
                  <p className="eyebrow text-[10px]">Intentional Living</p>
                </div>
                <h3 className="display text-xl sm:text-2xl mt-0.5">Wishlist & Impulse Cooldown</h3>
              </div>

              <button
                type="button"
                onClick={() => setSimulatedDays(simulatedDays >= 30 ? 12 : 30)}
                className="btn-secondary text-xs py-1 px-2.5"
              >
                {simulatedDays >= 30 ? "Reset clock to 12d" : "Fast-forward 30 days ⏩"}
              </button>
            </div>

            <div className="card p-4 sm:p-5 border-line bg-paper space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-accent bg-accent-soft px-2 py-0.5 rounded">
                    Candidate Item
                  </span>
                  <h4 className="display text-lg sm:text-xl mt-1 text-ink">Breville Barista Touch Espresso Machine</h4>
                  <p className="text-xs text-muted mt-0.5">Estimated Price: <strong className="text-ink font-semibold">$999.00</strong></p>
                </div>

                <div className="flex items-center gap-4">
                  {/* Cooldown Ring */}
                  <div className="text-center">
                    <div className="relative h-12 w-12 mx-auto">
                      <svg width={48} height={48} className="-rotate-90">
                        <circle cx={24} cy={24} r={20} fill="none" strokeWidth={3.5} className="stroke-line" />
                        <circle
                          cx={24}
                          cy={24}
                          r={20}
                          fill="none"
                          strokeWidth={3.5}
                          strokeLinecap="round"
                          strokeDasharray={125}
                          strokeDashoffset={125 - Math.min(125, (simulatedDays / 30) * 125)}
                          className={simulatedDays >= 30 ? "stroke-emerald-500" : "stroke-accent"}
                        />
                      </svg>
                      <span className="absolute inset-0 flex items-center justify-center text-xs font-bold text-ink">
                        {simulatedDays}d
                      </span>
                    </div>
                    <span className="text-[10px] text-muted font-medium mt-1 block">
                      {simulatedDays >= 30 ? "Ready to buy" : "Cooling off"}
                    </span>
                  </div>
                </div>
              </div>

              {/* Priority slider */}
              <div className="rounded-xl border border-line bg-shell/50 p-3 space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-ink">Priority Score (0–100):</span>
                  <span className={`font-bold tabular px-2 py-0.5 rounded text-[11px] ${
                    wishPriority >= 70 ? "bg-clay-soft text-clay" : wishPriority >= 40 ? "bg-amber-500/10 text-amber-600 dark:text-amber-400" : "bg-wash text-ink"
                  }`}>
                    {wishPriority} / 100 ({wishPriority >= 70 ? "Essential Need" : wishPriority >= 40 ? "Thoughtful Want" : "Impulse Risk"})
                  </span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={wishPriority}
                  onChange={(e) => setWishPriority(Number(e.target.value))}
                  className="w-full accent-brand h-2 bg-wash rounded-lg cursor-pointer"
                />
              </div>

              {/* Convert action */}
              <div className="flex items-center justify-between pt-2 border-t border-line-soft">
                <p className="text-xs text-muted">
                  {simulatedDays >= 30
                    ? "✓ 30-day cooldown passed. Still love it? Convert it to your inventory."
                    : "🔒 18 days left in impulse cooling-off period."}
                </p>

                {wishConverted ? (
                  <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-accent">
                    <IconCheck width={14} height={14} /> Added to Inventory!
                  </span>
                ) : (
                  <button
                    type="button"
                    disabled={simulatedDays < 30}
                    onClick={() => {
                      setWishConverted(true);
                      showToast("Converted Breville Barista to active inventory!");
                    }}
                    className={`btn-primary text-xs py-1.5 px-3 ${simulatedDays < 30 ? "opacity-40 cursor-not-allowed" : ""}`}
                  >
                    Convert into Owned Inventory
                  </button>
                )}
              </div>
            </div>

            <p className="text-[11px] text-muted text-center pt-1">
              💡 <em>Try dragging the priority slider or fast-forwarding 30 days to see the cooldown gate unlock.</em>
            </p>
          </div>
        )}

        {/* TAB 4: AI ADVISOR */}
        {tab === "advisor" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="flex items-center gap-1.5">
                  <span className="flex h-5 w-5 items-center justify-center rounded bg-brand/10 text-brand">
                    <IconRobot width={13} height={13} />
                  </span>
                  <p className="eyebrow text-[10px]">Pro Feature Preview</p>
                </div>
                <h3 className="display text-xl sm:text-2xl mt-0.5">AI Declutter Advisor</h3>
              </div>

              {!aiAnalyzed && (
                <button
                  type="button"
                  onClick={() => {
                    setAiAnalyzed(true);
                    showToast("AI analyzed 4 items and found 1 declutter candidate!");
                  }}
                  className="btn-primary text-xs py-1.5 px-3 flex items-center gap-1.5"
                >
                  <IconSparkles width={13} height={13} />
                  Run AI Possession Audit
                </button>
              )}
            </div>

            {!aiAnalyzed ? (
              <div className="card p-8 border-line border-dashed text-center space-y-3 bg-shell/30">
                <div className="flex h-12 w-12 mx-auto items-center justify-center rounded-2xl bg-brand/10 text-brand">
                  <IconRobot width={24} height={24} />
                </div>
                <h4 className="font-semibold text-ink text-base">Audit your possession clutter</h4>
                <p className="text-xs text-muted max-w-md mx-auto">
                  smpl. analyzes days since acquisition, logged usage frequency, category density, and estimated depreciation to nudge you when an item is sitting idle.
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setAiAnalyzed(true);
                    showToast("AI analysis complete!");
                  }}
                  className="btn-secondary text-xs py-1.5 px-4"
                >
                  Click to simulate AI Audit
                </button>
              </div>
            ) : (
              <div className="card p-4 sm:p-5 border-accent/40 bg-accent-soft/10 space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-1">
                    <span className="rounded bg-accent-soft px-2 py-0.5 text-[10px] font-bold text-accent uppercase tracking-wider">
                      Recommended to Stage: 3-Person Camping Tent
                    </span>
                    <h4 className="font-semibold text-ink text-base">You haven&apos;t used your camping tent in 314 days</h4>
                    <p className="text-xs text-muted leading-relaxed">
                      Logged with <strong>Rare usage</strong>. Second-hand market value is currently <strong>$140–$160</strong>. Staging to 30-Day Purgatory will confirm whether you truly need it before peak season resale.
                    </p>
                  </div>
                  <span className="rounded-full bg-accent-soft text-accent text-xs font-bold px-2.5 py-1 shrink-0">
                    94% confidence
                  </span>
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-line-soft">
                  <span className="text-[11px] text-muted">Estimated resale return: +$140</span>
                  {aiApplied ? (
                    <span className="text-xs text-accent font-semibold flex items-center gap-1">
                      <IconCheck width={14} height={14} /> Staged to Purgatory
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => {
                        setAiApplied(true);
                        stageToPurgatory(4);
                      }}
                      className="btn-primary text-xs py-1 px-3"
                    >
                      Stage Tent to Purgatory
                    </button>
                  )}
                </div>
              </div>
            )}

            <p className="text-[11px] text-muted text-center pt-1">
              💡 <em>The AI Advisor helps you see the invisible dead weight in your home without pressure or guilt.</em>
            </p>
          </div>
        )}

        {/* Global Toast */}
        {toast && (
          <div className="mt-3 rounded-lg bg-brand text-brand-fg px-3 py-1.5 text-xs text-center font-medium animate-rise shadow-md">
            {toast}
          </div>
        )}
      </div>
    </div>
  );
}

/* =====================================================================
   2. Mobile Showcase (CSS Smartphone UI illustration)
   ===================================================================== */

export function MobileAppShowcase() {
  return (
    <section className="border-t border-line bg-shell/50 py-16 sm:py-24">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 grid items-center gap-12 lg:grid-cols-2">
        {/* Left: Mobile Illustration */}
        <div className="flex justify-center order-2 lg:order-1">
          <div className="relative w-[280px] sm:w-[310px] rounded-[44px] border-[6px] border-line-strong bg-card p-3 shadow-2xl ring-1 ring-black/10 dark:ring-white/10">
            {/* Dynamic island / top speaker */}
            <div className="mx-auto mb-2 h-4 w-24 rounded-full bg-line-strong/80" />

            {/* Simulated Phone Screen */}
            <div className="rounded-[32px] border border-line bg-paper p-3.5 space-y-3.5 text-left select-none overflow-hidden">
              {/* App Bar */}
              <div className="flex items-center justify-between border-b border-line-soft pb-2.5">
                <div className="flex items-center gap-2">
                  <span className="display flex h-6 w-6 items-center justify-center rounded-lg bg-brand text-xs text-brand-fg font-bold">
                    S
                  </span>
                  <span className="display text-sm font-semibold tracking-tight">smpl.</span>
                </div>
                <span className="h-6 w-6 rounded-full bg-accent-soft text-[10px] font-bold text-accent flex items-center justify-center">
                  TT
                </span>
              </div>

              {/* Mobile Quick Stats */}
              <div className="grid grid-cols-2 gap-2">
                <div className="rounded-xl border border-line bg-shell p-2.5">
                  <span className="text-[9px] font-semibold uppercase tracking-wider text-muted">Owned</span>
                  <div className="text-lg font-bold tabular text-ink mt-0.5">124</div>
                  <span className="text-[10px] text-accent font-medium">$14,820 value</span>
                </div>
                <div className="rounded-xl border border-line bg-shell p-2.5">
                  <span className="text-[9px] font-semibold uppercase tracking-wider text-muted">Purgatory</span>
                  <div className="text-lg font-bold tabular text-clay mt-0.5">4</div>
                  <span className="text-[10px] text-muted">30d clock ticking</span>
                </div>
              </div>

              {/* Mini Status Donut Visual */}
              <div className="rounded-xl border border-line bg-shell p-3 space-y-2">
                <div className="flex items-center justify-between text-[11px] font-semibold">
                  <span>Possessions Split</span>
                  <span className="text-accent text-[10px]">82% Kept</span>
                </div>
                <div className="h-2 w-full rounded-full bg-wash flex overflow-hidden">
                  <div className="bg-accent h-full w-[82%]" title="Kept" />
                  <div className="bg-clay h-full w-[6%]" title="Purgatory" />
                  <div className="bg-ink h-full w-[12%]" title="Offloaded" />
                </div>
                <div className="flex justify-between text-[9px] text-muted">
                  <span>102 kept</span>
                  <span>4 parked</span>
                  <span>18 offloaded</span>
                </div>
              </div>

              {/* Mobile List Items */}
              <div className="space-y-1.5">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-muted block">
                  Recent Inventory
                </span>
                {[
                  ["Cast Iron Skillet", "Kitchen", "$85", "Daily"],
                  ["Fujifilm X100V", "Electronics", "$1,400", "Monthly"],
                  ["Wool Trench Coat", "Clothing", "$240", "Rare"],
                ].map(([title, cat, pr, freq]) => (
                  <div key={title} className="flex items-center justify-between rounded-lg border border-line bg-card p-2 text-xs">
                    <div>
                      <div className="font-medium text-ink text-[12px]">{title}</div>
                      <div className="text-[10px] text-muted">{cat} · {freq} use</div>
                    </div>
                    <span className="font-semibold text-ink text-[11px] tabular">{pr}</span>
                  </div>
                ))}
              </div>

              {/* Mobile Bottom Quick Button */}
              <div className="pt-1">
                <div className="rounded-xl bg-brand text-brand-fg py-2 text-center text-xs font-semibold flex items-center justify-center gap-1.5 shadow-sm">
                  <IconPlus width={13} height={13} />
                  <span>Log new possession</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right: Copy & Value Proposition */}
        <div className="order-1 lg:order-2 space-y-6">
          <p className="eyebrow">Inventory in your pocket</p>
          <h2 className="display text-3xl sm:text-4xl leading-tight">
            Stop needless buys <br className="hidden sm:inline" />
            <span className="text-accent">before you reach the checkout.</span>
          </h2>
          <p className="text-[16px] text-muted leading-relaxed">
            Ever stood in a home improvement store wondering if you already have the right cord, drill bit, or winter blanket at home? smpl. lets you check what you own in two seconds.
          </p>

          <div className="space-y-4 pt-2">
            <div className="flex items-start gap-3">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-accent-soft text-accent mt-0.5">
                <IconSearch width={18} height={18} />
              </span>
              <div>
                <h3 className="font-semibold text-ink text-sm">Instant search anywhere</h3>
                <p className="text-xs text-muted mt-0.5">Filter by brand, category, or subcategory while standing right in the store aisle.</p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-clay-soft text-clay mt-0.5">
                <IconFlame width={18} height={18} />
              </span>
              <div>
                <h3 className="font-semibold text-ink text-sm">30-day box method on autopilot</h3>
                <p className="text-xs text-muted mt-0.5">No more wondering how long a cardboard box has been sitting in your garage attic.</p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand/10 text-brand mt-0.5">
                <IconRecycle width={18} height={18} />
              </span>
              <div>
                <h3 className="font-semibold text-ink text-sm">Fast PWA installation</h3>
                <p className="text-xs text-muted mt-0.5">Works smoothly as an app on your iOS or Android phone with zero clutter or ads.</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/* =====================================================================
   3. Testimonials (Social Proof / Mindful Living)
   ===================================================================== */

const TESTIMONIALS = [
  {
    quote:
      "I used to feel paralyzed by guilt whenever I thought about getting rid of gifts or expensive things. Purgatory gave me the psychological safety net I needed. Put it away for 30 days — if I never missed it, the guilt vanished.",
    author: "Elena Rostova",
    role: "Architect & Downsizing Homeowner",
    location: "Stockholm",
  },
  {
    quote:
      "The 30-day wishlist cooldown completely cured my impulse buying on Amazon. Watching that cooldown ring tick down stripped away all the artificial urgency. I’ve saved over $2,100 this year alone.",
    author: "Marcus Chen",
    role: "Software Engineer",
    location: "Seattle",
  },
  {
    quote:
      "Most inventory apps feel like clunky Excel spreadsheets from 2004. smpl. is the first tool that feels calm, elegant, and genuinely enjoyable to maintain every weekend.",
    author: "Sophie Laurent",
    role: "Interior Stylist",
    location: "Montreal",
  },
];

export function TestimonialsSection() {
  return (
    <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6 lg:py-24">
      <div className="mx-auto max-w-2xl text-center mb-12">
        <p className="eyebrow">Real stories</p>
        <h2 className="display text-3xl sm:text-4xl mt-2">Loved by people living with intention</h2>
        <p className="mt-3 text-[16px] text-muted">
          From apartment minimalists to families downsizing a lifetime of possessions.
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        {TESTIMONIALS.map((t) => (
          <div key={t.author} className="card p-6 flex flex-col justify-between border-line bg-paper shadow-sm hover:shadow-md transition-shadow">
            <div>
              <div className="text-accent text-2xl font-serif">“</div>
              <p className="mt-1 text-sm leading-relaxed text-ink-soft italic">
                {t.quote}
              </p>
            </div>

            <div className="mt-6 pt-4 border-t border-line-soft">
              <div className="font-semibold text-sm text-ink">{t.author}</div>
              <div className="text-xs text-muted">{t.role} · {t.location}</div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

/* =====================================================================
   4. FAQ Accordion
   ===================================================================== */

const FAQS = [
  {
    q: "How is smpl. different from a spreadsheet or Notion template?",
    a: "Spreadsheets don't nudge you when an item has sat unused in a closet for 11 months. smpl. is purpose-built for possession lifecycle: tracking usage frequency, calculating item depreciation, enforcing a 30-day purgatory decision clock, and providing an impulse-buy wishlist with cooldown tracking.",
  },
  {
    q: "How does the 30-day Purgatory work?",
    a: "When you're hesitant to part with an item, you move it to Purgatory and put it away in a closet or box. A 30-day countdown starts. If you never needed or missed it during those 30 days, you can let it go with complete peace of mind. If you do miss it, restore it back to inventory with a single click.",
  },
  {
    q: "What is the Wishlist impulse cooldown?",
    a: "Instead of checking out immediately when you see something online, you add it to your smpl. wishlist and score its priority from 0 to 100. It enters a 30-day cooling-off period. After 30 days, if you still genuinely need it, you can convert it straight into your active inventory.",
  },
  {
    q: "Is my personal inventory data private?",
    a: "Completely. We do not sell data, track you with advertising scripts, or share your inventory. Everything is strictly scoped to your private account. You can also export your entire inventory, wishlist, and history as CSV spreadsheets or raw JSON archives anytime.",
  },
  {
    q: "What is included in the Free tier vs. Pro?",
    a: "The Free tier is free forever and includes unlimited items tracking, possession analytics, 30-day purgatory, and limited custom categories. Pro ($4.29/mo or $34.99/yr, including a 14-day free trial) unlocks the AI Declutter Advisor, Wishlist cooldown tracker, unlimited custom categories, and complete CSV/JSON data exports.",
  },
  {
    q: "What is your refund policy?",
    a: "We offer a 14-day, 100% money-back guarantee on all Pro memberships. If smpl. isn't right for you, simply email support@gosmpl.app within 14 days of upgrade or renewal for a full refund with no questions asked. You can also cancel your subscription anytime with a single click.",
  },
  {
    q: "How do I install smpl. on my phone?",
    a: "smpl. is built as a Progressive Web App (PWA). Open gosmpl.app in Safari on iOS and tap 'Share → Add to Home Screen', or tap the menu in Chrome on Android and select 'Install app'. It opens full-screen like a native app.",
  },
];

export function FaqAccordion() {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  const toggle = (idx: number) => {
    setOpenIndex((curr) => (curr === idx ? null : idx));
  };

  return (
    <section className="border-t border-line bg-shell/50 py-16 sm:py-24">
      <div className="mx-auto max-w-3xl px-4 sm:px-6">
        <div className="text-center mb-10">
          <p className="eyebrow">Frequently asked questions</p>
          <h2 className="display text-3xl sm:text-4xl mt-2">Everything you need to know</h2>
        </div>

        <div className="divide-y divide-line rounded-2xl border border-line bg-paper overflow-hidden shadow-sm">
          {FAQS.map((faq, idx) => {
            const isOpen = openIndex === idx;

            return (
              <div key={faq.q} className="transition-colors">
                <button
                  type="button"
                  onClick={() => toggle(idx)}
                  className="flex w-full items-center justify-between gap-4 p-5 text-left transition-colors hover:bg-wash/50"
                  aria-expanded={isOpen}
                >
                  <span className="text-sm sm:text-base font-semibold text-ink">{faq.q}</span>
                  <span
                    className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-line bg-wash text-ink transition-transform duration-200 ${
                      isOpen ? "rotate-180" : ""
                    }`}
                  >
                    <IconChevronDown width={15} height={15} />
                  </span>
                </button>

                {isOpen && (
                  <div className="px-5 pb-5 pt-1 text-xs sm:text-sm text-muted leading-relaxed animate-rise">
                    {faq.a}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
