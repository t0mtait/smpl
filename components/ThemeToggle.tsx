"use client";

import { useEffect, useState } from "react";

/**
 * The theme toggle.
 *
 * The root layout's inline script has already decided the theme and
 * written it to <html> as both a `.dark` class and a `data-theme`
 * attribute, before the first paint. This button reads that decision
 * back rather than keeping a second copy of it, so the button and the
 * page can never disagree about which mode is active.
 *
 * The icon is swapped by CSS (`.dark` on <html>), not by React state.
 * That matters for the flash: the icons are correct in the very first
 * painted frame, because the class the script set is already on <html>.
 * React state is only used for the accessible name, which no one reads
 * until after hydration anyway.
 *
 * The same three sources the initializer uses are honoured here:
 * an explicit stored choice, then the OS preference, then light.
 */

type Theme = "light" | "dark";

const STORAGE_KEY = "smpl-theme";

/** The theme currently applied to the document. */
function readTheme(): Theme {
  if (typeof document === "undefined") return "light";
  return document.documentElement.dataset.theme === "dark" ? "dark" : "light";
}

/** Apply a theme to the document and remember the choice. */
function applyTheme(next: Theme) {
  const root = document.documentElement;
  root.classList.toggle("dark", next === "dark");
  root.dataset.theme = next;
  try {
    localStorage.setItem(STORAGE_KEY, next);
    localStorage.removeItem("declutter-theme");
  } catch {
    // Private mode or blocked storage: the theme still applies for this
    // page view, it just will not be remembered next time.
  }
}

/**
 * A button that switches between the light and dark palettes.
 *
 * `variant="icon"` is the compact form for the mobile header; the
 * default form carries a text label for the desktop sidebar.
 */
export function ThemeToggle({ variant = "full" }: { variant?: "full" | "icon" }) {
  // Starts at "light" so the server render and the first client render
  // agree; the effect corrects it to the real theme once mounted.
  const [theme, setTheme] = useState<Theme>("light");

  useEffect(() => {
    setTheme(readTheme());
  }, []);

  const toggle = () => {
    const next: Theme = readTheme() === "dark" ? "light" : "dark";
    applyTheme(next);
    setTheme(next);
  };

  const label = theme === "dark" ? "Switch to light mode" : "Switch to dark mode";

  if (variant === "icon") {
    return (
      <button
        type="button"
        onClick={toggle}
        aria-label={label}
        title={label}
        className="flex h-8 w-8 items-center justify-center rounded-lg border border-line text-muted transition-colors hover:bg-paper hover:text-ink"
      >
        {/* Moon in light mode (switch to dark), sun in dark mode. */}
        <svg
          width="15"
          height="15"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
          className="dark:hidden"
        >
          <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8Z" />
        </svg>
        <svg
          width="15"
          height="15"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
          className="hidden dark:block"
        >
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
        </svg>
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={label}
      className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium text-ink-soft transition-colors hover:bg-paper hover:text-ink"
    >
      <span className="text-muted">
        <svg
          width="17"
          height="17"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
          className="dark:hidden"
        >
          <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8Z" />
        </svg>
        <svg
          width="17"
          height="17"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
          className="hidden dark:block"
        >
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
        </svg>
      </span>
      {theme === "dark" ? "Light mode" : "Dark mode"}
    </button>
  );
}
