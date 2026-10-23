"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { desktopNav, isActive, primaryNav, type NavItem } from "@/lib/nav";

function SidebarLink({ item, pathname }: { item: NavItem; pathname: string }) {
  const active = isActive(pathname, item.href);
  return (
    <li>
      <Link
        href={item.href}
        aria-current={active ? "page" : undefined}
        className={`flex h-10 items-center rounded-control px-3 ${
          active ? "bg-bg font-medium text-action" : "text-ink hover:bg-bg"
        }`}
      >
        {item.label}
      </Link>
    </li>
  );
}

export function Sidebar() {
  const pathname = usePathname();
  return (
    <nav
      aria-label="側邊導覽"
      className="fixed inset-y-0 left-0 hidden w-52 border-r border-line bg-surface p-3 lg:block"
    >
      <ul className="space-y-0.5">
        {primaryNav.map((item) => (
          <SidebarLink key={item.href} item={item} pathname={pathname} />
        ))}
      </ul>
      <hr className="my-3 border-line" />
      <ul className="space-y-0.5">
        {desktopNav.map((item) => (
          <SidebarLink key={item.href} item={item} pathname={pathname} />
        ))}
      </ul>
    </nav>
  );
}
