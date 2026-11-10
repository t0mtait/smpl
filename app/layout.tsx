import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "Declutter",
  description: "Track every possession. Know what to get rid of.",
};

const NAV = [
  { href: "/", label: "Dashboard" },
  { href: "/items", label: "Inventory" },
  { href: "/suggestions", label: "Get Rid Of" },
  { href: "/alerts", label: "Alerts" },
];

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <div className="min-h-screen">
          <header className="border-b border-ink-200 bg-white">
            <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-8 gap-y-2 px-4 py-4">
              <Link href="/" className="flex items-center gap-2">
                <span className="flex h-7 w-7 items-center justify-center rounded-md bg-moss-600 text-sm font-bold text-white">
                  D
                </span>
                <span className="text-lg font-semibold tracking-tight">Declutter</span>
              </Link>
              <nav className="flex flex-wrap gap-1">
                {NAV.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    className="rounded-lg px-3 py-1.5 text-sm font-medium text-ink-600 transition-colors hover:bg-ink-100 hover:text-ink-900"
                  >
                    {item.label}
                  </Link>
                ))}
              </nav>
              <div className="ml-auto">
                <Link href="/items/new" className="btn-primary">
                  + Add item
                </Link>
              </div>
            </div>
          </header>
          <main className="mx-auto max-w-6xl px-4 py-8">{children}</main>
        </div>
      </body>
    </html>
  );
}
