import Link from "next/link";
import type { ComponentProps } from "react";

// One solid "primary" per screen (design.md §6); everything else is outline or text.
const VARIANT = {
  primary: "bg-action text-white disabled:opacity-50",
  outline: "border border-line bg-surface text-ink hover:bg-bg disabled:opacity-50",
  text: "text-action hover:underline disabled:opacity-50",
  danger: "border border-line bg-surface text-error hover:bg-error-bg disabled:opacity-50",
} as const;

const BASE = "inline-flex min-h-12 items-center justify-center gap-1 rounded-control px-4 lg:min-h-10";

type Variant = keyof typeof VARIANT;

export function Button({
  variant = "outline",
  className = "",
  ...props
}: ComponentProps<"button"> & { variant?: Variant }) {
  return <button className={`${BASE} ${VARIANT[variant]} ${className}`} {...props} />;
}

export function ButtonLink({
  variant = "outline",
  className = "",
  ...props
}: ComponentProps<typeof Link> & { variant?: Variant }) {
  return <Link className={`${BASE} ${VARIANT[variant]} ${className}`} {...props} />;
}
