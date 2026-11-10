import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";
import { inter, serif } from "./fonts";
import { NavLinks } from "@/components/NavLinks";
import {
  IconBell,
  IconBox,
  IconHouse,
  IconPlus,
  IconSparkles,
} from "@/components/icons";

export const metadata: Metadata = {
  title: "Declutter",
  description: "Track every possession. Know what to get rid of.",
};

// Icons are rendered here (server component) and passed as elements —
// component functions themselves cannot cross the client boundary.
const NAV = [
  { href: "/", label: "Dashboard", icon: <IconHouse width={17} height={17} /> },
  { href: "/items", label: "Inventory", icon: <IconBox width={17} height={17} /> },
  { href: "/suggestions", label: "Get Rid Of", icon: <IconSparkles width={17} height={17} /> },
  { href: "/alerts", label: "Alerts", icon: <IconBell width={17} height={17} /> },
];

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${serif.variable}`}>
      <body>
        <div className="flex min-h-screen flex-col lg:flex-row">
          {/* ---------------- Sidebar (desktop) ---------------- */}
          <aside className="hidden w-64 shrink-0 border-r border-line bg-card lg:flex lg:flex-col">
            <div className="flex items-center gap-2.5 px-6 py-6">
              <span className="display flex h-9 w-9 items-center justify-center rounded-xl bg-ink text-[19px] leading-none text-paper">
                D
              </span>
              <div>
                <div className="display text-[19px] leading-none">Declutter</div>
                <div className="mt-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted">
                  less, but better
                </div>
              </div>
            </div>

            <nav className="flex-1 space-y-0.5 px-3">
              {NAV.map((item) => (
                <NavLinks key={item.href} href={item.href} label={item.label} icon={item.icon} />
              ))}
            </nav>

            <div className="p-3">
              <Link href="/items/new" className="btn-primary w-full">
                <IconPlus width={16} height={16} />
                Add item
              </Link>
            </div>
          </aside>

          {/* ---------------- Mobile top bar ---------------- */}
          <header className="sticky top-0 z-30 flex items-center justify-between border-b border-line bg-card/90 px-4 py-3 backdrop-blur lg:hidden">
            <Link href="/" className="flex items-center gap-2">
              <span className="display flex h-8 w-8 items-center justify-center rounded-lg bg-ink text-[17px] leading-none text-paper">
                D
              </span>
              <span className="display text-[17px] leading-none">Declutter</span>
            </Link>
            <Link href="/items/new" className="btn-primary px-3 py-1.5 text-[13px]">
              <IconPlus width={15} height={15} />
              Add
            </Link>
          </header>

          {/* ---------------- Main ---------------- */}
          <main className="min-w-0 flex-1">
            <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-10 lg:py-12">{children}</div>
          </main>

          {/* ---------------- Mobile bottom nav ---------------- */}
          <nav className="fixed inset-x-0 bottom-0 z-30 flex border-t border-line bg-card/95 backdrop-blur lg:hidden">
            {NAV.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="flex flex-1 flex-col items-center gap-1 py-2.5 text-[10px] font-medium text-muted transition-colors hover:text-ink"
              >
                {item.icon}
                {item.label}
              </Link>
            ))}
          </nav>
        </div>
        <div className="h-16 lg:hidden" />
      </body>
    </html>
  );
}
