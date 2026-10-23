import { Field, Input, Textarea } from "@/components/ui/field";

type Product = {
  name: string;
  category: string | null;
  notes: string | null;
  weightG: number | null;
  lengthCm: number | null;
  widthCm: number | null;
  heightCm: number | null;
};

export function ProductFields({ initial }: { initial?: Product }) {
  return (
    <>
      <div className="grid gap-3 lg:grid-cols-[2fr_1fr]">
        <Field label="商品名稱">
          <Input name="name" defaultValue={initial?.name} required placeholder="例：車門膠條 示意車型" />
        </Field>
        <Field label="分類">
          <Input name="category" defaultValue={initial?.category ?? ""} placeholder="汽車用品、工具、收藏品…" />
        </Field>
      </div>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Field label="重量（g）">
          <Input name="weightG" inputMode="numeric" defaultValue={initial?.weightG ?? ""} />
        </Field>
        <Field label="長（cm）">
          <Input name="lengthCm" inputMode="decimal" defaultValue={initial?.lengthCm ?? ""} />
        </Field>
        <Field label="寬（cm）">
          <Input name="widthCm" inputMode="decimal" defaultValue={initial?.widthCm ?? ""} />
        </Field>
        <Field label="高（cm）">
          <Input name="heightCm" inputMode="decimal" defaultValue={initial?.heightCm ?? ""} />
        </Field>
      </div>
      <Field label="重點筆記">
        <Textarea name="notes" defaultValue={initial?.notes ?? ""} />
      </Field>
    </>
  );
}
