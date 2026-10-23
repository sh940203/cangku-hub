import Link from "next/link";
import { PageHeader } from "@/components/ui/page-header";
import { todayLinks } from "@/lib/nav";

export default function TodayPage() {
  return (
    <>
      <PageHeader title="今日" />
      <ul className="divide-y divide-line border-y border-line bg-surface">
        {todayLinks.map((item) => (
          <li key={item.href}>
            <Link href={item.href} className="flex min-h-14 items-center justify-between px-4 active:bg-bg">
              {item.label}
              <span aria-hidden="true" className="text-ink-2">
                ›
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </>
  );
}
