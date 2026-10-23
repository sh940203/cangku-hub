import { floorColorClass } from "@/lib/locations/code";

const SIZE = {
  // in lists
  sm: "px-1.5 py-0.5 text-tag leading-none",
  // find result: the largest thing on screen
  lg: "px-3 py-1.5 text-tag-lg leading-none",
  // physical label, sized in mm for the A4 print sheet
  print: "w-full px-[4mm] py-[3mm] text-[20mm] leading-none text-center",
} as const;

/** The on-screen location tag. Looks exactly like the label on the wall. */
export function LocationTag({ code, size = "sm" }: { code: string; size?: keyof typeof SIZE }) {
  return (
    <span
      className={`inline-block rounded-tag font-code font-semibold tracking-wide text-white [print-color-adjust:exact] ${floorColorClass(code)} ${SIZE[size]}`}
    >
      {code}
    </span>
  );
}
