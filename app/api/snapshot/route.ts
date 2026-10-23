import { getDb } from "@/db";
import { buildSnapshot } from "@/lib/find/snapshot";

// Cached by the service worker (NetworkFirst) so /find works offline.
export const dynamic = "force-dynamic";

export async function GET() {
  return Response.json(await buildSnapshot(getDb()), { headers: { "Cache-Control": "no-store" } });
}
