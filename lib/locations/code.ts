// Location codes look like 4F-T-03: floor, zone, two-digit number.

export const FLOORS = ["1F", "3F", "4F"] as const;
export type Floor = (typeof FLOORS)[number];

const CODE_RE = /^(1F|3F|4F)-([A-Z]{1,2})-(\d{2})$/;

export function formatLocationCode(floor: Floor, zone: string, number: number): string {
  return `${floor}-${zone.toUpperCase()}-${String(number).padStart(2, "0")}`;
}

export function parseLocationCode(code: string): { floor: Floor; zone: string; number: number } | null {
  const m = CODE_RE.exec(code);
  return m ? { floor: m[1] as Floor, zone: m[2], number: Number(m[3]) } : null;
}

// Full class names so Tailwind can see them. 4F splits by zone (S 神明廳, T 鐵皮屋); other 4F zones use the 4F-T color.
const FLOOR_BG = {
  "1F": "bg-floor-1f",
  "3F": "bg-floor-3f",
  "4F-S": "bg-floor-4f-s",
  "4F-T": "bg-floor-4f-t",
} as const;

export function floorColorClass(code: string): string {
  const [floor, zone] = code.split("-");
  if (floor === "4F") return zone === "S" ? FLOOR_BG["4F-S"] : FLOOR_BG["4F-T"];
  if (floor === "1F" || floor === "3F") return FLOOR_BG[floor];
  return "bg-ink-2";
}
