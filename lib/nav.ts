export type NavIcon = "today" | "find" | "ship" | "list";

export type NavItem = { href: string; label: string; icon?: NavIcon };

// Bottom tabs on mobile; also the top group of the desktop sidebar.
export const primaryNav: NavItem[] = [
  { href: "/", label: "今日", icon: "today" },
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

export function isActive(pathname: string, href: string) {
  return href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);
}
