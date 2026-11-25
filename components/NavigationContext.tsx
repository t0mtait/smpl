"use client";

import React, { createContext, useContext, useState, useEffect } from "react";
import { usePathname, useSearchParams } from "next/navigation";

export type NavSection = "dashboard" | "items" | "purgatory" | "offloaded" | "wishlist" | null;

interface NavigationContextType {
  activeSectionOverride: NavSection;
  setActiveSectionOverride: (section: NavSection) => void;
}

const NavigationContext = createContext<NavigationContextType>({
  activeSectionOverride: null,
  setActiveSectionOverride: () => {},
});

export function NavigationProvider({ children }: { children: React.ReactNode }) {
  const [activeSectionOverride, setActiveSectionOverride] = useState<NavSection>(null);
  const pathname = usePathname();

  useEffect(() => {
    if (!pathname.startsWith("/items/")) {
      setActiveSectionOverride(null);
    }
  }, [pathname]);

  return (
    <NavigationContext.Provider value={{ activeSectionOverride, setActiveSectionOverride }}>
      {children}
    </NavigationContext.Provider>
  );
}

export function useActiveNav() {
  const { activeSectionOverride } = useContext(NavigationContext);
  const pathname = usePathname();
  const searchParams = useSearchParams();

  let returnTo: string | null = null;
  try {
    returnTo = searchParams?.get("returnTo") ?? null;
  } catch {}

  const isNavActive = (href: string) => {
    if (activeSectionOverride) {
      if (href === "/purgatory") return activeSectionOverride === "purgatory";
      if (href === "/offloaded") return activeSectionOverride === "offloaded";
      if (href === "/items") return activeSectionOverride === "items";
      if (href === "/wishlist") return activeSectionOverride === "wishlist";
      if (href === "/") return activeSectionOverride === "dashboard";
    }

    if (pathname.startsWith("/items/")) {
      if (returnTo?.startsWith("/purgatory")) return href === "/purgatory";
      if (returnTo?.startsWith("/offloaded")) return href === "/offloaded";
      if (returnTo?.startsWith("/wishlist")) return href === "/wishlist";
      return href === "/items";
    }

    if (href === "/") return pathname === "/";
    return pathname.startsWith(href);
  };

  return { isNavActive };
}

export function ActiveSectionSync({ section }: { section: NavSection }) {
  const { setActiveSectionOverride } = useContext(NavigationContext);
  useEffect(() => {
    setActiveSectionOverride(section);
    return () => setActiveSectionOverride(null);
  }, [section, setActiveSectionOverride]);

  return null;
}
