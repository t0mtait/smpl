"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function NavLinks({
  href,
  label,
  icon,
  badge,
  exclude,
}: {
  href: string;
  label: string;
  icon: React.ReactNode;
  badge?: React.ReactNode;
  exclude?: string[];
}) {
  const pathname = usePathname();
  const active = href === "/" ? pathname === "/" : pathname.startsWith(href) && !(exclude ?? []).some((e) => pathname.startsWith(e));

  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={`group relative flex items-center justify-between rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
        active ? "bg-brand text-brand-fg" : "text-ink-soft hover:bg-paper hover:text-ink"
      }`}
    >
      <div className="flex items-center gap-2.5 min-w-0">
        {/* A small accent bar marks the current page. */}
        <span
          aria-hidden="true"
          className={`absolute left-0 top-1/2 h-4 w-0.5 -translate-y-1/2 rounded-r-full transition-opacity ${
            active ? "bg-brand-mark opacity-100" : "opacity-0"
          }`}
        />
        <span className={active ? "text-brand-fg" : "text-muted group-hover:text-ink-soft"}>
          {icon}
        </span>
        <span className="truncate">{label}</span>
      </div>
      {badge}
    </Link>
  );
}
