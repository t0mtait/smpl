import localFont from "next/font/local";

/**
 * Self-hosted fonts. next/font/local fingerprints the files, emits the
 * @font-face rules with preload links, and gives us CSS variables to
 * hang the type scale off. No network fetch at build or runtime.
 */

export const inter = localFont({
  src: "../fonts/Inter-Variable.woff2",
  variable: "--font-inter",
  weight: "100 900",
  display: "swap",
  fallback: ["ui-sans-serif", "system-ui", "-apple-system", "Segoe UI", "sans-serif"],
});

export const serif = localFont({
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
  variable: "--font-serif",
  display: "swap",
  fallback: ["ui-serif", "Georgia", "serif"],
});
