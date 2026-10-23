// Customer data never leaves the browser (docs/系統結構規劃.md §8).
// Two layers: drop PII columns by header right after parsing, then check the outgoing payload
// against a field whitelist and PII-looking values. The server runs the same check.

/** Header keywords for columns that are dropped as soon as the sheet is parsed. Matched as substrings, case-insensitive. */
export const PII_HEADER_KEYWORDS = [
  "姓名",
  "收件",
  "收貨",
  "寄件",
  "買家",
  "會員",
  "帳號",
  "電話",
  "手機",
  "聯絡",
  "地址",
  "郵遞區號",
  "郵遞",
  "門市",
  "身分證",
  "身份證",
  "統一編號",
  "統編",
  "載具",
  "email",
  "e-mail",
  "信箱",
  "備註", // free text, often contains names or phone numbers
  "留言",
  "name",
  "phone",
  "address",
  "zip",
  "buyer",
  "recipient",
  "note",
  "remark",
] as const;

export function isPiiHeader(header: string): boolean {
  const h = header.normalize("NFKC").toLowerCase();
  return PII_HEADER_KEYWORDS.some((k) => h.includes(k));
}

/** Removes every PII column from parsed sheet rows. Returns the cleaned rows and the dropped headers. */
export function stripPiiColumns(rows: readonly Record<string, unknown>[]): {
  rows: Record<string, unknown>[];
  dropped: string[];
} {
  const dropped = new Set<string>();
  const cleaned = rows.map((row) => {
    const out: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(row)) {
      if (isPiiHeader(key)) dropped.add(key);
      else out[key] = value;
    }
    return out;
  });
  return { rows: cleaned, dropped: [...dropped] };
}

// Values that look like customer data even inside an allowed field.
const PII_VALUE_PATTERNS: { label: string; re: RegExp }[] = [
  { label: "Email", re: /[^\s@]+@[^\s@]+\.[^\s@]+/ },
  { label: "手機號碼", re: /(?<!\d)09\d{2}[-\s]?\d{3}[-\s]?\d{3}(?!\d)/ },
  { label: "市話", re: /(?<!\d)0\d{1,2}[-\s)]\d{3,4}[-\s]?\d{4}(?!\d)/ },
  { label: "地址", re: /[縣市].{0,6}[區鄉鎮市].{0,10}[路街道].{0,10}號/ },
];

/** Fields allowed in an imported order line; anything else is rejected. */
export const ORDER_LINE_FIELDS = ["orderNo", "status", "cancelled", "orderedAt", "skuCode", "name", "qty"] as const;

export class PiiError extends Error {}

/** Throws PiiError if any line has a field outside the whitelist or a value that looks like PII. */
export function assertNoPii(lines: readonly Record<string, unknown>[]): void {
  const allowed = new Set<string>(ORDER_LINE_FIELDS);
  lines.forEach((line, i) => {
    for (const [key, value] of Object.entries(line)) {
      if (!allowed.has(key)) throw new PiiError(`第 ${i + 1} 筆有不允許的欄位 ${key}`);
      if (typeof value !== "string") continue;
      const hit = PII_VALUE_PATTERNS.find((p) => p.re.test(value));
      if (hit) throw new PiiError(`第 ${i + 1} 筆的「${key}」看起來含有${hit.label}，已停止送出。`);
    }
  });
}
