import Link from "next/link";
import { NavLinks } from "@/components/NavLinks";
import { SignOutButton } from "@/components/SignOutButton";
import { SignOutIconButton } from "@/components/SignOutIconButton";
import { ThemeToggle } from "@/components/ThemeToggle";
import { UserAvatar } from "@/components/UserAvatar";
import {
  IconArchive,
  IconBox,
  IconFlame,
  IconHeart,
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
  {
    href: "/items",
    label: "Inventory",
    icon: <IconBox width={17} height={17} />,
  },
  { href: "/purgatory", label: "Purgatory", icon: <IconFlame width={17} height={17} /> },
  { href: "/offloaded", label: "Offloaded", icon: <IconArchive width={17} height={17} /> },
  { href: "/wishlist", label: "Wishlist", icon: <IconHeart width={17} height={17} />, proOnly: true },
];

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  // Server-side gate: no account, no app. Every page in this group is
  // account-scoped, so this is the single choke point.
  const user = await requireUser();
  const accountName = user.name?.trim() || user.email;
  const isPro = user.plan === "premium";

  return (
    <div className="flex min-h-screen flex-col lg:flex-row">
      {/* ---------------- Sidebar (desktop) ---------------- */}
      <aside className="hidden w-64 shrink-0 border-r border-line bg-shell lg:sticky lg:top-0 lg:flex lg:h-screen lg:flex-col">
        <div className="flex items-center gap-3 px-6 pb-6 pt-7">
          <span className="display flex h-9 w-9 items-center justify-center rounded-xl bg-brand text-[19px] leading-none text-brand-fg">
            S
          </span>
          <div>
            <div className="display text-[19px] leading-none tracking-[-0.01em]">smpl.</div>
            <div className="mt-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted">
              go_smpl
            </div>
          </div>
        </div>

        <nav className="flex-1 space-y-0.5 px-3">
          {NAV.map((item) => (
            <div key={item.href}>
              <NavLinks
                href={item.href}
                label={item.label}
                icon={item.icon}
                badge={
                  item.proOnly && !isPro ? (
                    <span className="rounded bg-accent-soft px-1.5 py-0.5 text-[9px] font-bold text-accent">
                      PRO
                    </span>
                  ) : undefined
                }
              />
            </div>
          ))}
        </nav>

        <div className="px-3 pb-3">
          <Link href="/items/new" className="btn-primary w-full">
            <IconPlus width={16} height={16} />
            Add item
          </Link>
        </div>

        {user.plan !== "premium" && (
          <div className="px-3 pb-2">
            <Link
              href="/account#subscription"
              className="flex items-center justify-between gap-2 rounded-xl border border-accent/25 bg-accent-soft/40 p-2.5 text-[12px] text-accent transition-all hover:bg-accent-soft hover:shadow-sm"
              title="Unlock premium features"
            >
              <div className="flex items-center gap-1.5 min-w-0">
                <IconSparkles width={13} height={13} className="shrink-0 text-accent" />
                <span className="truncate font-semibold text-accent">Upgrade to Pro</span>
              </div>
              <span className="shrink-0 text-[11px] font-medium text-ink-soft">$3.49/mo</span>
            </Link>
          </div>
        )}

        <p className="px-6 pb-3 text-[11px] leading-snug text-muted">
          <span className="font-semibold text-ink-soft">iOS &amp; Android</span> apps coming soon
        </p>

        <div className="border-t border-line p-3">
          <Link
            href="/account"
            className="group mb-2 flex items-center gap-3 rounded-xl p-2 transition-colors hover:bg-paper"
            title="Account options"
          >
            <UserAvatar name={accountName} email={user.email} avatarPath={user.avatarPath} size={36} />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <span className="truncate text-[13px] font-semibold text-ink group-hover:text-accent">
                  {accountName}
                </span>
                {user.plan === "premium" ? (
                  <span className="rounded bg-accent-soft px-1.5 py-0.2 text-[9px] font-bold uppercase tracking-wider text-accent">
                    PRO
                  </span>
                ) : (
                  <span className="rounded bg-wash px-1.5 py-0.2 text-[9px] font-medium uppercase tracking-wider text-muted">
                    FREE
                  </span>
                )}
              </div>
              <div className="truncate text-[11px] text-muted">{user.email}</div>
            </div>
          </Link>
          <ThemeToggle />
          <SignOutButton />
        </div>
      </aside>

      {/* ---------------- Mobile top bar ---------------- */}
      <header className="sticky top-0 z-30 flex items-center justify-between border-b border-line bg-shell/90 px-4 py-3 backdrop-blur lg:hidden">
        <Link href="/" className="flex items-center gap-2">
          <span className="display flex h-8 w-8 items-center justify-center rounded-lg bg-brand text-[17px] leading-none text-brand-fg">
            S
          </span>
          <span className="display text-[17px] leading-none tracking-[-0.01em]">smpl.</span>
        </Link>
        <div className="flex items-center gap-2">
          <Link
            href="/account"
            className="flex items-center gap-2 rounded-lg p-1 transition-colors hover:bg-paper"
            title="Account options"
          >
            <UserAvatar name={accountName} email={user.email} avatarPath={user.avatarPath} size={28} />
            <span className="max-w-[7rem] truncate text-[12px] text-muted">{accountName}</span>
            {user.plan === "premium" && (
              <span className="rounded bg-accent-soft px-1 py-0.2 text-[8px] font-bold uppercase tracking-wider text-accent">
                PRO
              </span>
            )}
          </Link>
          <ThemeToggle variant="icon" />
          <SignOutIconButton />
          <Link href="/items/new" className="btn-primary px-3 py-1.5 text-[13px]">
            <IconPlus width={15} height={15} />
            Add
          </Link>
        </div>
      </header>

      {/* ---------------- Main ---------------- */}
      <main className="min-w-0 flex-1">
        <div className="mx-auto max-w-[1400px] px-4 py-8 pb-24 sm:px-6 lg:px-10 lg:py-12">{children}</div>
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
