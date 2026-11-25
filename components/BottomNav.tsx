"use client";

import Link from "next/link";
import { useActiveNav } from "@/components/NavigationContext";
import {
  IconArchive,
  IconBox,
  IconFlame,
  IconHeart,
  IconHouse,
} from "@/components/icons";

const NAV_ITEMS = [
  { href: "/", label: "Dashboard", icon: <IconHouse width={18} height={18} /> },
  { href: "/items", label: "Inventory", icon: <IconBox width={18} height={18} /> },
  { href: "/purgatory", label: "Purgatory", icon: <IconFlame width={18} height={18} /> },
  { href: "/offloaded", label: "Offloaded", icon: <IconArchive width={18} height={18} /> },
  { href: "/wishlist", label: "Wishlist", icon: <IconHeart width={18} height={18} /> },
];

export function BottomNav() {
  const { isNavActive } = useActiveNav();

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-30 flex border-t border-line bg-card/95 backdrop-blur lg:hidden shadow-lg"
      aria-label="Mobile navigation"
    >
      {NAV_ITEMS.map((item) => {
        const isActive = isNavActive(item.href);

        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={isActive ? "page" : undefined}
            className={`relative flex flex-1 flex-col items-center justify-center gap-1 py-2 text-[10px] sm:text-[11px] transition-all ${
              isActive
                ? "font-bold text-accent"
                : "font-medium text-muted hover:text-ink"
            }`}
          >
            {isActive && (
              <span
                aria-hidden="true"
                className="absolute top-0 h-0.5 w-8 rounded-full bg-accent animate-fade"
              />
            )}
            <span
              className={`transition-all duration-200 ${
                isActive ? "scale-110 text-accent" : "text-muted"
              }`}
            >
              {item.icon}
            </span>
            <span className={isActive ? "text-ink font-bold" : "text-muted"}>
              {item.label}
            </span>
          </Link>
        );
      })}
    </nav>
  );
}
