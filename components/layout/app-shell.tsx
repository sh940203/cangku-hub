import type { ReactNode } from "react";
import { BottomTabs } from "./bottom-tabs";
import { OfflineBanner } from "./offline-banner";
import { SnapshotWarmer } from "./snapshot-warmer";
import { Sidebar } from "./sidebar";

// One shell for every route: bottom tabs below 1024px, sidebar at 1024px and up.
export function AppShell({ children }: { children: ReactNode }) {
  return (
    <>
      <Sidebar />
      <OfflineBanner />
      <main className="min-h-dvh px-4 pt-[max(1rem,env(safe-area-inset-top))] pb-[calc(3.5rem+env(safe-area-inset-bottom)+1rem)] lg:ml-52 lg:px-8 lg:pt-6 lg:pb-8 print:m-0 print:p-0">
        {children}
      </main>
      <BottomTabs />
      <SnapshotWarmer />
    </>
  );
}
