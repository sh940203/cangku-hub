"use client";

import { type ComponentProps, type ReactNode, useActionState } from "react";
import { useFormStatus } from "react-dom";
import type { FormState } from "@/lib/form";
import { Button } from "./button";
import { FormMessage } from "./field";

/** Form bound to a server action that returns FormState; shows the error/ok line below its fields. */
export function ActionForm({
  action,
  children,
  className = "space-y-3",
  confirmText,
}: {
  action: (state: FormState, fd: FormData) => Promise<FormState>;
  children: ReactNode;
  className?: string;
  confirmText?: string;
}) {
  const [state, formAction] = useActionState(action, null);
  return (
    <form
      action={formAction}
      className={className}
      onSubmit={confirmText ? (e) => !confirm(confirmText) && e.preventDefault() : undefined}
    >
      {children}
      <FormMessage state={state} />
    </form>
  );
}

export function SubmitButton(props: ComponentProps<typeof Button>) {
  const { pending } = useFormStatus();
  return <Button {...props} disabled={pending || props.disabled} />;
}
