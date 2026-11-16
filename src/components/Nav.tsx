"use client";

import { ChartNoAxesColumn, House, MessageCirclePlus, UserRound } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Logo } from "./Logo";

const ITEMS = [
  { href: "/today", label: "Today", icon: House },
  { href: "/log", label: "Log food", icon: MessageCirclePlus },
  { href: "/trends", label: "Trends", icon: ChartNoAxesColumn },
  { href: "/profile", label: "Profile", icon: UserRound },
];

/** Bottom tab bar on phones, side rail from the md breakpoint up. */
export function Nav() {
  const pathname = usePathname();
  return (
    <nav
      aria-label="Main"
      className="fixed inset-x-0 bottom-0 z-20 border-t border-line bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:inset-y-0 md:right-auto md:w-56 md:border-r md:border-t-0 md:pb-0"
    >
      <div className="hidden items-center gap-2.5 px-5 pb-4 pt-6 md:flex">
        <Logo size={30} />
        <span className="text-lg font-semibold tracking-tight">Nourish</span>
      </div>
      <ul className="mx-auto flex max-w-lg md:max-w-none md:flex-col md:gap-1 md:px-3">
        {ITEMS.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || pathname.startsWith(`${href}/`);
          return (
            <li key={href} className="flex-1 md:flex-none">
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={`flex min-h-14 flex-col items-center justify-center gap-0.5 text-xs font-medium transition-colors md:min-h-11 md:flex-row md:justify-start md:gap-3 md:rounded-xl md:px-3 md:text-sm ${
                  active ? "text-accent md:bg-accent-soft" : "text-muted hover:text-ink md:hover:bg-surface-2"
                }`}
              >
                <Icon size={22} strokeWidth={active ? 2.4 : 2} aria-hidden="true" />
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
