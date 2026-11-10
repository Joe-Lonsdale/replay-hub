"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  ["/review", "Review"],
  ["/replays", "Replays"],
  ["/patterns", "Patterns"],
  ["/scenarios", "Scenarios"],
  ["/settings", "Settings"],
];

export function Nav() {
  const pathname = usePathname();
  return (
    <nav className="flex flex-wrap items-center gap-1 text-sm">
      {LINKS.map(([href, label]) => {
        const active = pathname === href || pathname.startsWith(`${href}/`);
        return (
          <Link
            key={href}
            href={href}
            className={`px-3 py-1.5 ${active ? "bg-gold text-bg" : "text-muted hover:text-ink"}`}
          >
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
