// Stock / sellable quantity. Warn color below safety stock, always with a text hint (design.md §6, §11).
export function StockNumber({
  value,
  safety,
  size = "sm",
  hint = true,
}: {
  value: number;
  safety?: number | null;
  size?: "sm" | "lg";
  /** Visible "低於安全 N" text; when false it is still read out by screen readers. */
  hint?: boolean;
}) {
  const low = safety != null && value < safety;
  return (
    <span
      className={`font-code font-semibold ${size === "lg" ? "text-number leading-none" : "text-tag"} ${low ? "text-warn" : ""}`}
    >
      {value}
      {low && <span className={`ml-1 font-sans text-aux font-normal ${hint ? "" : "sr-only"}`}>低於安全 {safety}</span>}
    </span>
  );
}
