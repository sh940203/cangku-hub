"use client";

import { useState } from "react";
import { ActionForm, SubmitButton } from "@/components/ui/action-form";
import { Field, Input } from "@/components/ui/field";
import type { FormState } from "@/lib/form";
import { type LocationOption, SkuCommonFields, SkuPhysicalFields } from "../sku-fields";

export function SkuCreateForm({
  action,
  locations,
}: {
  action: (s: FormState, fd: FormData) => Promise<FormState>;
  locations: LocationOption[];
}) {
  const [kind, setKind] = useState<"physical" | "bundle">("physical");
  return (
    <ActionForm action={action}>
      <fieldset className="flex gap-4">
        <legend className="mb-1 text-aux text-ink-2">類型</legend>
        {(
          [
            ["physical", "實體貨號（有自己的庫存）"],
            ["bundle", "組合商品（由部件組成）"],
          ] as const
        ).map(([value, label]) => (
          <label key={value} className="flex min-h-12 items-center gap-2">
            <input type="radio" name="kind" value={value} checked={kind === value} onChange={() => setKind(value)} />
            {label}
          </label>
        ))}
      </fieldset>
      <SkuCommonFields />
      {kind === "physical" && (
        <>
          <SkuPhysicalFields locations={locations} />
          <div className="grid gap-3 lg:grid-cols-3">
            <Field label="初始庫存" hint="會寫入一筆「初始」異動">
              <Input name="initialStock" inputMode="numeric" defaultValue="0" />
            </Field>
          </div>
        </>
      )}
      <SubmitButton variant="primary">新增貨號</SubmitButton>
    </ActionForm>
  );
}
