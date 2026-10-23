export type NavIcon = "today" | "find" | "ship" | "list";

export type NavItem = { href: string; label: string; icon?: NavIcon; /** Other paths that light up this item. */ also?: string[] };

// Bottom tabs on mobile; also the top group of the desktop sidebar.
export const primaryNav: NavItem[] = [
  // Pages opened from 今日 keep the 今日 tab lit.
  { href: "/", label: "今日", icon: "today", also: ["/tasks", "/restock", "/stocktake"] },
  { href: "/find", label: "找貨", icon: "find" },
  { href: "/ship", label: "出貨", icon: "ship" },
  { href: "/list", label: "上架", icon: "list" },
];

// Desktop sidebar only. On mobile these are reached from the 今日 page.
export const desktopNav: NavItem[] = [
  { href: "/import", label: "訂單匯入" },
  { href: "/export", label: "批次匯出" },
  { href: "/products", label: "商品" },
  { href: "/locations", label: "儲位" },
];

// Entries listed on the 今日 page.
export const todayLinks: NavItem[] = [
  { href: "/tasks", label: "任務" },
  { href: "/restock", label: "叫貨清單" },
  { href: "/stocktake", label: "盤點" },
];

const under = (pathname: string, href: string) => pathname === href || pathname.startsWith(`${href}/`);

export function isActive(pathname: string, item: NavItem) {
  if (item.also?.some((p) => under(pathname, p))) return true;
  return item.href === "/" ? pathname === "/" : under(pathname, item.href);
}
