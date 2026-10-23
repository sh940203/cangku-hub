// Small helpers for reading FormData in server actions.

export type FormState = { error?: string; ok?: string } | null;

export function str(fd: FormData, key: string): string {
  const v = fd.get(key);
  return typeof v === "string" ? v.trim() : "";
}

export function optStr(fd: FormData, key: string): string | null {
  return str(fd, key) || null;
}

/** Integer field. Returns null when empty, NaN when not an integer. */
export function int(fd: FormData, key: string): number | null {
  const s = str(fd, key);
  if (s === "") return null;
  return /^-?\d+$/.test(s) ? Number(s) : NaN;
}

/** Number field (decimals allowed). Returns null when empty, NaN when invalid. */
export function num(fd: FormData, key: string): number | null {
  const s = str(fd, key);
  if (s === "") return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : NaN;
}

export function isUniqueViolation(e: unknown): boolean {
  const msg = String((e as { cause?: unknown })?.cause ?? e);
  return msg.includes("UNIQUE constraint failed");
}
