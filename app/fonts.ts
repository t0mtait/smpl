import localFont from "next/font/local";

/**
 * Self-hosted fonts. next/font/local fingerprints the files, emits the
 * @font-face rules with preload links, and gives us CSS variables to
 * hang the type scale off. No network fetch at build or runtime.
 *
 * The exported names double as the @font-face family names, so they are
 * deliberately not "serif" or "sans" — those are CSS generic keywords and
 * would collide with the generic families in the fallback stacks.
 *
 * Two families, four files:
 *
 *   Fraunces        display / headings. A high-contrast serif with an
 *                   optical-size axis, so the letterforms get more
 *                   sculpted as the type gets larger.
 *   Instrument Sans body / UI. A neutral, slightly condensed grotesk that
 *                   holds up at small sizes.
 *
 * Each family ships in two subsets. The browser walks the font stack one
 * character at a time, so the latin file is listed first and the latin-ext
 * file picks up the handful of characters it lacks (ā, ł, ş, ő and
 * friends). The ext files are not preloaded — they are rarely needed, and
 * a preload is a request the visitor pays for on every page.
 */

export const sansFont = localFont({
  src: "../fonts/InstrumentSans-latin.woff2",
  variable: "--font-sans",
  weight: "400 700",
  display: "swap",
  preload: true,
  fallback: ["ui-sans-serif", "system-ui", "-apple-system", "Segoe UI", "sans-serif"],
});

export const sansFontExt = localFont({
  src: "../fonts/InstrumentSans-latin-ext.woff2",
  variable: "--font-sans-ext",
  weight: "400 700",
  display: "swap",
  preload: false,
  fallback: ["ui-sans-serif", "system-ui", "-apple-system", "Segoe UI", "sans-serif"],
});

export const displayFont = localFont({
  src: "../fonts/Fraunces-latin.woff2",
  variable: "--font-display",
  weight: "100 900",
  display: "swap",
  preload: true,
  fallback: ["ui-serif", "Georgia", "serif"],
});

export const displayFontExt = localFont({
  src: "../fonts/Fraunces-latin-ext.woff2",
  variable: "--font-display-ext",
  weight: "100 900",
  display: "swap",
  preload: false,
  fallback: ["ui-serif", "Georgia", "serif"],
});
