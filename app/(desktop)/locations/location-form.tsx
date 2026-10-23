"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Field, FormMessage, Input, Select } from "@/components/ui/field";
import type { FormState } from "@/lib/form";
import { FLOORS } from "@/lib/locations/code";

type Location = { floor: string; zone: string; number: number; description: string | null };

export function LocationForm({
  action,
  initial,
  submitLabel,
}: {
  action: (state: FormState, fd: FormData) => Promise<FormState>;
  initial?: Location;
  submitLabel: string;
}) {
  const [state, formAction, pending] = useActionState(action, null);
  return (
    <form action={formAction} className="space-y-3">
      <div className="grid grid-cols-3 gap-3 lg:grid-cols-[6rem_6rem_6rem_1fr_auto] lg:items-end">
        <Field label="樓層">
          <Select name="floor" defaultValue={initial?.floor ?? "1F"}>
            {FLOORS.map((f) => (
              <option key={f}>{f}</option>
            ))}
          </Select>
        </Field>
        <Field label="區域">
          <Input name="zone" defaultValue={initial?.zone} maxLength={2} required autoCapitalize="characters" />
        </Field>
        <Field label="編號">
          <Input name="number" defaultValue={initial?.number} inputMode="numeric" required />
        </Field>
        <div className="col-span-3 lg:col-span-1">
          <Field label="說明">
            <Input name="description" defaultValue={initial?.description ?? ""} placeholder="例：鐵皮屋左側第二層" />
          </Field>
        </div>
        <Button variant="primary" disabled={pending} className="col-span-3 lg:col-span-1">
          {submitLabel}
        </Button>
      </div>
      <FormMessage state={state} />
    </form>
  );
}
