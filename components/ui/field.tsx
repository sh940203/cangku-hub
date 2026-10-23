import type { ComponentProps, ReactNode } from "react";

const CONTROL =
  "min-h-12 w-full rounded-control border border-line bg-surface px-3 text-body text-ink lg:min-h-10";

export function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-aux text-ink-2">{label}</span>
      {children}
      {hint && <span className="text-aux text-ink-2">{hint}</span>}
    </label>
  );
}

export function Input({ className = "", ...props }: ComponentProps<"input">) {
  return <input className={`${CONTROL} ${className}`} {...props} />;
}

export function Select({ className = "", ...props }: ComponentProps<"select">) {
  return <select className={`${CONTROL} ${className}`} {...props} />;
}

export function Textarea({ className = "", ...props }: ComponentProps<"textarea">) {
  return <textarea className={`${CONTROL} min-h-24 py-2 ${className}`} {...props} />;
}

/** Error or result line under a form. Text always says what happened; color is secondary. */
export function FormMessage({ state }: { state?: { error?: string; ok?: string } | null }) {
  if (state?.error) {
    return (
      <p role="alert" className="rounded-control bg-error-bg px-3 py-2 text-error">
        {state.error}
      </p>
    );
  }
  if (state?.ok) {
    return (
      <p role="status" className="rounded-control bg-ok-bg px-3 py-2 text-ok">
        {state.ok}
      </p>
    );
  }
  return null;
}
