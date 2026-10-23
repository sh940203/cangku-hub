import { eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { LocationTag } from "@/components/stock/location-tag";
import { ButtonLink } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { getDb } from "@/db";
import { locations } from "@/db/schema";
import { parseLocationCode } from "@/lib/locations/code";
import { deleteLocation, updateLocation } from "../actions";
import { LocationForm } from "../location-form";
import { DeleteLocationButton } from "./delete-button";

export const dynamic = "force-dynamic";

export default async function EditLocationPage({ params }: PageProps<"/locations/[id]">) {
  const id = Number((await params).id);
  const [loc] = Number.isInteger(id) ? await getDb().select().from(locations).where(eq(locations.id, id)) : [];
  if (!loc) notFound();
  const parsed = parseLocationCode(loc.code);

  return (
    <div className="max-w-4xl space-y-6">
      <div className="flex items-center gap-3">
        <PageHeader title="編輯儲位" />
        <div className="mb-4">
          <LocationTag code={loc.code} />
        </div>
      </div>
      <LocationForm
        action={updateLocation.bind(null, loc.id)}
        initial={{ floor: loc.floor, zone: loc.zone, number: parsed?.number ?? 1, description: loc.description }}
        submitLabel="儲存儲位"
      />
      <div className="flex gap-3 border-t border-line pt-6">
        <ButtonLink href="/locations">回儲位列表</ButtonLink>
        <DeleteLocationButton action={deleteLocation.bind(null, loc.id)} code={loc.code} />
      </div>
    </div>
  );
}
