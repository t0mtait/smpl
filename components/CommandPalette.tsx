"use client";

import { useEffect, useState, useRef, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  IconArchive,
  IconBox,
  IconFlame,
  IconHeart,
  IconHouse,
  IconPlus,
  IconRobot,
  IconSearch,
  IconSparkles,
  IconTag,
} from "@/components/icons";
import { formatCategory, formatMoney } from "@/lib/format";

interface PaletteItem {
  id: string;
  title: string;
  subtitle?: string;
  badge?: string;
  icon: React.ReactNode;
  category: "Actions" | "Navigation" | "Items";
  onSelect: () => void;
}

interface InventorySearchItem {
  id: number;
  name: string;
  brand: string;
  category: string;
  currentValue: number | null;
  location: string;
}

export function CommandPalette() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [inventoryItems, setInventoryItems] = useState<InventorySearchItem[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Global keydown listeners for Cmd+K and /
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Toggle on Cmd+K or Ctrl+K
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((prev) => !prev);
        return;
      }

      // Open on / when not focused in an input/textarea/editable
      if (
        e.key === "/" &&
        !open &&
        !(
          document.activeElement instanceof HTMLInputElement ||
          document.activeElement instanceof HTMLTextAreaElement ||
          document.activeElement instanceof HTMLSelectElement ||
          (document.activeElement as HTMLElement)?.isContentEditable
        )
      ) {
        e.preventDefault();
        setOpen(true);
        return;
      }

      // Close on Escape
      if (e.key === "Escape" && open) {
        e.preventDefault();
        setOpen(false);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open]);

  // Listen to custom trigger event so buttons anywhere in the app can open it
  useEffect(() => {
    const handleTrigger = () => setOpen(true);
    window.addEventListener("open-command-palette", handleTrigger);
    return () => window.removeEventListener("open-command-palette", handleTrigger);
  }, []);

  // Fetch user inventory once when opened
  useEffect(() => {
    if (open) {
      setQuery("");
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 20);

      fetch("/api/items")
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => {
          if (data?.items) {
            setInventoryItems(
              data.items
                .filter((i: { status: string }) => i.status === "owned")
                .map((i: { id: number; name: string; brand: string; category: string; currentValue: number | null; location: string }) => ({
                  id: i.id,
                  name: i.name,
                  brand: i.brand,
                  category: i.category,
                  currentValue: i.currentValue,
                  location: i.location,
                }))
            );
          }
        })
        .catch(() => {});
    }
  }, [open]);

  const toggleTheme = () => {
    const root = document.documentElement;
    const isDark = root.classList.contains("dark");
    const next = isDark ? "light" : "dark";
    root.classList.toggle("dark", next === "dark");
    root.dataset.theme = next;
    try {
      localStorage.setItem("smpl-theme", next);
    } catch {}
  };

  const staticItems: PaletteItem[] = useMemo(
    () => [
      {
        id: "new-item",
        title: "Add new item",
        subtitle: "Catalog a new possession to your inventory",
        badge: "C",
        category: "Actions",
        icon: <IconPlus width={16} height={16} className="text-accent" />,
        onSelect: () => {
          setOpen(false);
          router.push("/items/new");
        },
      },
      {
        id: "advisor",
        title: "AI Declutter Advisor",
        subtitle: "View smart declutter heuristics & top offload suggestions",
        badge: "AI",
        category: "Actions",
        icon: <IconRobot width={16} height={16} className="text-accent" />,
        onSelect: () => {
          setOpen(false);
          router.push("/items/advisor");
        },
      },
      {
        id: "theme-toggle",
        title: "Toggle Light / Dark mode",
        subtitle: "Switch between warm paper and night palette",
        category: "Actions",
        icon: <IconSparkles width={16} height={16} className="text-warn" />,
        onSelect: () => {
          toggleTheme();
          setOpen(false);
        },
      },
      {
        id: "nav-dashboard",
        title: "Dashboard",
        subtitle: "Possessions summary, charts & net quarter stats",
        category: "Navigation",
        icon: <IconHouse width={16} height={16} />,
        onSelect: () => {
          setOpen(false);
          router.push("/");
        },
      },
      {
        id: "nav-inventory",
        title: "Inventory",
        subtitle: "Search, filter, and manage all owned possessions",
        category: "Navigation",
        icon: <IconBox width={16} height={16} />,
        onSelect: () => {
          setOpen(false);
          router.push("/items");
        },
      },
      {
        id: "nav-purgatory",
        title: "Purgatory",
        subtitle: "Staging area for items you are testing living without",
        category: "Navigation",
        icon: <IconFlame width={16} height={16} className="text-clay" />,
        onSelect: () => {
          setOpen(false);
          router.push("/purgatory");
        },
      },
      {
        id: "nav-offloaded",
        title: "Offloaded Archive",
        subtitle: "Historical record of sold, donated, and disposed items",
        category: "Navigation",
        icon: <IconArchive width={16} height={16} />,
        onSelect: () => {
          setOpen(false);
          router.push("/offloaded");
        },
      },
      {
        id: "nav-wishlist",
        title: "Wishlist",
        subtitle: "30-day impulse buffer & cooling-off tracker",
        category: "Navigation",
        icon: <IconHeart width={16} height={16} className="text-accent" />,
        onSelect: () => {
          setOpen(false);
          router.push("/wishlist");
        },
      },
      {
        id: "nav-account",
        title: "Account & Settings",
        subtitle: "Custom categories, profile, backup export & storage",
        category: "Navigation",
        icon: <IconTag width={16} height={16} />,
        onSelect: () => {
          setOpen(false);
          router.push("/account");
        },
      },
    ],
    [router]
  );

  // Filter items based on query
  const filteredItems: PaletteItem[] = useMemo(() => {
    const q = query.toLowerCase().trim();
    const staticMatches = staticItems.filter(
      (item) =>
        item.title.toLowerCase().includes(q) ||
        (item.subtitle && item.subtitle.toLowerCase().includes(q))
    );

    const itemMatches: PaletteItem[] = inventoryItems
      .filter((inv) => {
        if (!q) return false;
        const brand = inv.brand ? inv.brand.toLowerCase() : "";
        const name = inv.name.toLowerCase();
        const cat = inv.category.toLowerCase();
        const loc = inv.location ? inv.location.toLowerCase() : "";
        return name.includes(q) || brand.includes(q) || cat.includes(q) || loc.includes(q);
      })
      .slice(0, 8)
      .map((inv) => ({
        id: `item-${inv.id}`,
        title: inv.name,
        subtitle: [
          inv.brand,
          formatCategory(inv.category),
          inv.location ? `📍 ${inv.location}` : null,
          inv.currentValue !== null ? formatMoney(inv.currentValue) : null,
        ]
          .filter(Boolean)
          .join(" · "),
        badge: formatCategory(inv.category),
        category: "Items",
        icon: <IconBox width={15} height={15} className="text-muted" />,
        onSelect: () => {
          setOpen(false);
          router.push(`/items/${inv.id}`);
        },
      }));

    return [...staticMatches, ...itemMatches];
  }, [query, staticItems, inventoryItems, router]);

  // Adjust selectedIndex when list shrinks
  useEffect(() => {
    setSelectedIndex((prev) => (filteredItems.length === 0 ? 0 : Math.min(prev, filteredItems.length - 1)));
  }, [filteredItems.length]);

  // Arrow key navigation inside palette
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((prev) => (filteredItems.length ? (prev + 1) % filteredItems.length : 0));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((prev) =>
        filteredItems.length ? (prev - 1 + filteredItems.length) % filteredItems.length : 0
      );
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (filteredItems[selectedIndex]) {
        filteredItems[selectedIndex].onSelect();
      }
    }
  };

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Command palette"
      className="fixed inset-0 z-50 flex items-start justify-center p-3 pt-16 sm:pt-24 bg-black/50 backdrop-blur-sm animate-fade-in"
      onClick={() => setOpen(false)}
    >
      <div
        className="card w-full max-w-xl overflow-hidden border border-line bg-card shadow-2xl transition-all"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={handleKeyDown}
      >
        {/* Search Input Bar */}
        <div className="relative flex items-center border-b border-line px-4 py-3">
          <IconSearch width={18} height={18} className="shrink-0 text-muted" />
          <input
            ref={inputRef}
            type="text"
            className="w-full bg-transparent px-3 text-sm font-medium text-ink placeholder:text-muted focus:outline-none"
            placeholder="Search possessions, jump to page, or run action…"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelectedIndex(0);
            }}
          />
          <kbd className="hidden sm:inline-flex items-center gap-0.5 rounded border border-line bg-wash px-1.5 py-0.5 text-[10px] font-semibold text-muted">
            ESC
          </kbd>
        </div>

        {/* Results List */}
        <div ref={listRef} className="max-h-[380px] overflow-y-auto p-2 space-y-1">
          {filteredItems.length === 0 ? (
            <div className="py-8 text-center text-sm text-muted">
              No matching items or actions found for &ldquo;{query}&rdquo;
            </div>
          ) : (
            filteredItems.map((item, index) => {
              const selected = index === selectedIndex;
              return (
                <div
                  key={item.id}
                  onClick={item.onSelect}
                  onMouseEnter={() => setSelectedIndex(index)}
                  className={`flex cursor-pointer items-center justify-between gap-3 rounded-lg px-3 py-2.5 transition-colors ${
                    selected ? "bg-wash text-ink" : "text-ink-soft hover:bg-wash/60"
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span
                      className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-md ${
                        selected ? "bg-paper text-ink" : "bg-wash text-muted"
                      }`}
                    >
                      {item.icon}
                    </span>
                    <div className="min-w-0">
                      <div className="truncate text-xs font-semibold text-ink">{item.title}</div>
                      {item.subtitle && (
                        <div className="truncate text-[11px] text-muted">{item.subtitle}</div>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    {item.badge && (
                      <span className="rounded bg-paper px-1.5 py-0.5 text-[10px] font-medium text-muted border border-line-soft">
                        {item.badge}
                      </span>
                    )}
                    {selected && (
                      <kbd className="hidden sm:inline-block rounded bg-paper px-1.5 py-0.5 text-[10px] font-medium text-muted border border-line">
                        ↵
                      </kbd>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Palette Footer */}
        <div className="flex items-center justify-between border-t border-line/60 bg-paper/60 px-4 py-2 text-[11px] text-muted">
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1">
              <kbd className="rounded border border-line bg-wash px-1 text-[9px]">↑</kbd>
              <kbd className="rounded border border-line bg-wash px-1 text-[9px]">↓</kbd>
              <span>navigate</span>
            </span>
            <span className="inline-flex items-center gap-1">
              <kbd className="rounded border border-line bg-wash px-1 text-[9px]">↵</kbd>
              <span>select</span>
            </span>
          </div>
          <span>Tip: Press <kbd className="font-semibold text-ink">/</kbd> anywhere to search</span>
        </div>
      </div>
    </div>
  );
}

/** Trigger helper component to open command palette from any button */
export function openCommandPalette() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("open-command-palette"));
  }
}
