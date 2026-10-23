import { ActionForm, SubmitButton } from "@/components/ui/action-form";
import { ButtonLink } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { createProduct } from "../actions";
import { ProductFields } from "../product-fields";

export default function NewProductPage() {
  return (
    <div className="max-w-3xl">
      <PageHeader title="新增商品" />
      <ActionForm action={createProduct}>
        <ProductFields />
        <div className="flex gap-3">
          <SubmitButton variant="primary">新增商品</SubmitButton>
          <ButtonLink href="/products" variant="text">
            取消
          </ButtonLink>
        </div>
      </ActionForm>
    </div>
  );
}
