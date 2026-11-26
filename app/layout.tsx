import type { Metadata } from "next";
import "./globals.css";
import { lora } from "./fonts";

export const metadata: Metadata = {
  metadataBase: new URL("https://gosmpl.app"),
  title: {
    default: "smpl. — know what you own, let go of what you don't",
    template: "%s | smpl.",
  },
  description:
    "smpl. is a calm, simple place to keep track of your things. See what's quietly sitting unused, and decide what to sell, donate, or keep. Less clutter, clearer numbers.",
  openGraph: {
    title: "smpl. — Know what you own. Let go of what you don't.",
    description:
      "smpl. is a calm, simple place to keep track of your things. See what's quietly sitting unused, and decide what to sell, donate, or keep. Less clutter, clearer numbers.",
    url: "https://gosmpl.app",
    siteName: "smpl.",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "smpl. — Mindful inventory & decluttering. Know what you own. Let go of what you don't.",
      },
    ],
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "smpl. — Know what you own. Let go of what you don't.",
    description:
      "smpl. is a calm, simple place to keep track of your things. See what's quietly sitting unused, and decide what to sell, donate, or keep. Less clutter, clearer numbers.",
    images: ["/og-image.png"],
  },
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
 * order: an explicit stored choice, then light. The OS preference is deliberately ignored so the UI never switches on its own.
 * The value it writes is also what the toggle reads back, so the button
 * and the page never disagree about which mode is active.
 *
 * Inline and synchronous on purpose: an async or external script would
 * still let the first frame paint in the wrong palette.
 */
const THEME_SCRIPT = `
(function () {
  try {
    var stored = localStorage.getItem('smpl-theme');
    if (!stored) {
      stored = localStorage.getItem('declutter-theme');
      if (stored) {
        localStorage.setItem('smpl-theme', stored);
        localStorage.removeItem('declutter-theme');
      }
    }
        var theme = stored === 'dark' || stored === 'light' ? stored : 'light';
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
      className={lora.variable}
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
