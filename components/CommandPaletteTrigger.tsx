"use client";

import { IconSearch } from "@/components/icons";
import { openCommandPalette } from "@/components/CommandPalette";

export function CommandPaletteTrigger({ className = "" }: { className?: string }) {
  return (
    <button
      type="button"
      onClick={openCommandPalette}
      className={`flex w-full items-center justify-between rounded-xl border border-line bg-card px-3 py-2 text-xs font-medium text-muted transition-colors hover:border-line-strong hover:text-ink shadow-sm ${className}`}
      title="Search or jump to... (⌘K)"
    >
      <div className="flex items-center gap-2">
        <IconSearch width={14} height={14} className="text-muted shrink-0" />
        <span className="truncate">Search possessions…</span>
      </div>
      <kbd className="hidden sm:inline-flex rounded border border-line bg-wash px-1.5 py-0.5 text-[10px] font-semibold text-muted">
        ⌘K
      </kbd>
    </button>
  );
}

export function CommandPaletteIconButton() {
  return (
    <button
      type="button"
      onClick={openCommandPalette}
      className="flex h-8 w-8 items-center justify-center rounded-lg border border-line bg-card text-muted hover:text-ink transition-colors"
      title="Search (⌘K)"
      aria-label="Search"
    >
      <IconSearch width={16} height={16} />
    </button>
  );
}
