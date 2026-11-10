import localFont from "next/font/local";

/**
 * Self-hosted fonts. next/font/local fingerprints the files, emits the
 * @font-face rules with preload links, and gives us CSS variables to
 * hang the type scale off. No network fetch at build or runtime.
 *
 * The exported names double as the @font-face family names, so they are
 * deliberately not "serif" or "sans" — those are CSS generic keywords and
 * would collide with the generic families in the fallback stacks.
 */

export const sansFont = localFont({
  src: "../fonts/Inter-Variable.woff2",
  variable: "--font-sans",
  weight: "100 900",
  display: "swap",
  fallback: ["ui-sans-serif", "system-ui", "-apple-system", "Segoe UI", "sans-serif"],
});

export const displayFont = localFont({
  src: [
    {
      path: "../fonts/InstrumentSerif-Regular.woff2",
      weight: "400",
      style: "normal",
    },
    {
      path: "../fonts/InstrumentSerif-Italic.woff2",
      weight: "400",
      style: "italic",
    },
  ],
  variable: "--font-display",
  display: "swap",
  fallback: ["ui-serif", "Georgia", "serif"],
});
