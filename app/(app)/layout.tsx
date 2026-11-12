import Link from "next/link";
import { NavLinks } from "@/components/NavLinks";
import { SignOutButton } from "@/components/SignOutButton";
import { SignOutIconButton } from "@/components/SignOutIconButton";
import {
  IconBell,
  IconBox,
  IconHouse,
  IconPlus,
  IconSparkles,
} from "@/components/icons";
import { requireUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

// Icons are rendered here (server component) and passed as elements —
// component functions themselves cannot cross the client boundary.
const NAV = [
  { href: "/", label: "Dashboard", icon: <IconHouse width={17} height={17} /> },
  { href: "/items", label: "Inventory", icon: <IconBox width={17} height={17} /> },
  { href: "/suggestions", label: "Get Rid Of", icon: <IconSparkles width={17} height={17} /> },
  { href: "/alerts", label: "Alerts", icon: <IconBell width={17} height={17} /> },
];

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  // Server-side gate: no account, no app. Every page in this group is
  // account-scoped, so this is the single choke point.
  const user = await requireUser();
  const accountName = user.name?.trim() || user.email;

  return (
    <div className="flex min-h-screen flex-col lg:flex-row">
      {/* ---------------- Sidebar (desktop) ---------------- */}
      <aside className="hidden w-64 shrink-0 border-r border-line bg-shell lg:sticky lg:top-0 lg:flex lg:h-screen lg:flex-col">
        <div className="flex items-center gap-3 px-6 pb-6 pt-7">
          <span className="display flex h-9 w-9 items-center justify-center rounded-xl bg-ink text-[19px] leading-none text-paper">
            D
          </span>
          <div>
            <div className="display text-[19px] leading-none tracking-[-0.01em]">Declutter</div>
            <div className="mt-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted">
              less, but better
            </div>
          </div>
        </div>

        <nav className="flex-1 space-y-0.5 px-3">
          {NAV.map((item) => (
            <NavLinks key={item.href} href={item.href} label={item.label} icon={item.icon} />
          ))}
        </nav>

        <div className="px-3 pb-3">
          <Link href="/items/new" className="btn-primary w-full">
            <IconPlus width={16} height={16} />
            Add item
          </Link>
        </div>

        <div className="border-t border-line p-3">
          <div className="mb-1 px-3 py-2">
            <div className="truncate text-[13px] font-semibold text-ink">{accountName}</div>
            <div className="truncate text-[11px] text-muted">{user.email}</div>
          </div>
          <SignOutButton />
        </div>
      </aside>

      {/* ---------------- Mobile top bar ---------------- */}
      <header className="sticky top-0 z-30 flex items-center justify-between border-b border-line bg-shell/90 px-4 py-3 backdrop-blur lg:hidden">
        <Link href="/" className="flex items-center gap-2">
          <span className="display flex h-8 w-8 items-center justify-center rounded-lg bg-ink text-[17px] leading-none text-paper">
            D
          </span>
          <span className="display text-[17px] leading-none tracking-[-0.01em]">Declutter</span>
        </Link>
        <div className="flex items-center gap-2">
          <span className="max-w-[9rem] truncate text-[12px] text-muted">{accountName}</span>
          <SignOutIconButton />
          <Link href="/items/new" className="btn-primary px-3 py-1.5 text-[13px]">
            <IconPlus width={15} height={15} />
            Add
          </Link>
        </div>
      </header>

      {/* ---------------- Main ---------------- */}
      <main className="min-w-0 flex-1">
        <div className="mx-auto max-w-5xl px-4 py-8 pb-24 sm:px-6 lg:px-10 lg:py-12">{children}</div>
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
  );
}
