"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { isActive, primaryNav } from "@/lib/nav";
import { NavIcon } from "./nav-icon";

export function BottomTabs() {
  const pathname = usePathname();
  return (
    <nav
      aria-label="主要分頁"
      className="fixed inset-x-0 bottom-0 z-10 border-t border-line bg-surface pb-[env(safe-area-inset-bottom)] lg:hidden print:hidden"
    >
      <ul className="grid grid-cols-4">
        {primaryNav.map((item) => {
          const active = isActive(pathname, item.href);
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={`flex h-14 flex-col items-center justify-center gap-0.5 text-aux ${
                  active ? "text-action" : "text-ink-2"
                }`}
              >
                {item.icon && <NavIcon name={item.icon} />}
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
