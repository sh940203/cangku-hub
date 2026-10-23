import { PageHeader } from "@/components/ui/page-header";
import { FindClient } from "./find-client";

// Static shell (precached by the service worker); search runs in the browser over /api/snapshot.
export default function FindPage() {
  return (
    <>
      <PageHeader title="找貨" />
      <FindClient />
    </>
  );
}
