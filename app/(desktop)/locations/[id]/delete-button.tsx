"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { FormMessage } from "@/components/ui/field";
import type { FormState } from "@/lib/form";

export function DeleteLocationButton({ action, code }: { action: (s: FormState) => Promise<FormState>; code: string }) {
  const [state, formAction, pending] = useActionState(action, null);
  return (
    <form
      action={formAction}
      onSubmit={(e) => {
        if (!confirm(`刪除儲位 ${code}？`)) e.preventDefault();
      }}
      className="space-y-2"
    >
      <Button variant="danger" disabled={pending}>
        刪除儲位
      </Button>
      <FormMessage state={state} />
    </form>
  );
}
