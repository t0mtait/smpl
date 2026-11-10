"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function NavLinks({
  href,
  label,
  icon,
}: {
  href: string;
  label: string;
  icon: React.ReactNode;
}) {
  const pathname = usePathname();
  const active = href === "/" ? pathname === "/" : pathname.startsWith(href);

  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={`flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
        active ? "bg-ink text-paper" : "text-ink-600 hover:bg-paper hover:text-ink"
      }`}
    >
      <span className={active ? "text-paper" : "text-ink-500"}>{icon}</span>
      {label}
    </Link>
  );
}
