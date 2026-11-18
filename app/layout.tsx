import type { Metadata } from "next";
import "./globals.css";
import { sansFont, sansFontExt, displayFont, displayFontExt } from "./fonts";

export const metadata: Metadata = {
  title: "smpl.",
  description: "liv_smply",
  icons: {
    icon: [
      { url: "/icon.svg", type: "image/svg+xml" },
      { url: "/favicon.ico" },
    ],
    apple: [
      { url: "/apple-touch-icon.png" },
    ],
  },
};

/**
 * The theme initializer.
 *
 * This runs in <head>, before the first paint, and is what stops the
 * light palette from flashing on a dark-mode reload. A `useEffect` in a
 * client component would be too late — the browser would already have
 * painted the light background — and a component inside the
 * authenticated shell would leave the login screen permanently light.
 *
 * So it lives here, in the root layout, and it reads three sources in
 * order: an explicit stored choice, then the OS preference, then light.
 * The value it writes is also what the toggle reads back, so the button
 * and the page never disagree about which mode is active.
 *
 * Inline and synchronous on purpose: an async or external script would
 * still let the first frame paint in the wrong palette.
 */
const THEME_SCRIPT = `
(function () {
  try {
    var stored = localStorage.getItem('smpl-theme') || localStorage.getItem('declutter-theme');
    var prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    var theme = stored === 'dark' || stored === 'light' ? stored : (prefersDark ? 'dark' : 'light');
    document.documentElement.classList.toggle('dark', theme === 'dark');
    document.documentElement.dataset.theme = theme;
  } catch (e) {
    /* Private mode or blocked storage: fall back to light. */
  }
})();
`.trim();

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      className={`${sansFont.variable} ${sansFontExt.variable} ${displayFont.variable} ${displayFontExt.variable}`}
      // The initializer mutates <html> before React hydrates, so the
      // class and data-theme it sets will not match the server render.
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
