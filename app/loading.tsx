import { PageSkeleton } from "@/components/ui/skeleton";

// Shown instantly on navigation while the server renders the page (prefetched with each link).
export default function Loading() {
  return <PageSkeleton />;
}
