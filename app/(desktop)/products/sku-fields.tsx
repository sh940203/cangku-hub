import { Field, Input, Select } from "@/components/ui/field";

export type LocationOption = { id: number; code: string };

type Sku = {
  code: string;
  variantName: string | null;
  barcode: string | null;
  locationId: number | null;
  safetyStock: number | null;
};

export function SkuCommonFields({ initial }: { initial?: Sku }) {
  return (
    <div className="grid gap-3 lg:grid-cols-3">
      <Field label="貨號" hint="四平台的規格貨號都填這個">
        <Input name="code" defaultValue={initial?.code} required autoCapitalize="characters" />
      </Field>
      <Field label="規格名稱">
        <Input name="variantName" defaultValue={initial?.variantName ?? ""} placeholder="例：前左、一車份" />
      </Field>
      <Field label="條碼" hint="空白就用貨號">
        <Input name="barcode" defaultValue={initial?.barcode ?? ""} />
      </Field>
    </div>
  );
}

export function SkuPhysicalFields({ initial, locations }: { initial?: Sku; locations: LocationOption[] }) {
  return (
    <div className="grid gap-3 lg:grid-cols-3">
      <Field label="儲位">
        <Select name="locationId" defaultValue={initial?.locationId ?? ""}>
          <option value="">（未指定）</option>
          {locations.map((l) => (
            <option key={l.id} value={l.id}>
              {l.code}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="安全庫存" hint="低於這個數量會進叫貨清單">
        <Input name="safetyStock" inputMode="numeric" defaultValue={initial?.safetyStock ?? ""} />
      </Field>
    </div>
  );
}
