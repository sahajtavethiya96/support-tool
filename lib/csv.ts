export interface CsvColumn<T> {
  key: keyof T;
  label: string;
}

/** Minimal RFC-4180 CSV writer — quotes a field only when it contains a
 * comma, quote, or newline, doubling any embedded quotes. \r\n line endings
 * (the RFC-4180 convention, and what Excel expects). */
export function toCsv<T extends Record<string, unknown>>(
  rows: T[],
  columns: CsvColumn<T>[]
): string {
  const escapeField = (value: unknown): string => {
    const s = value == null ? "" : String(value);
    return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };

  const lines = [
    columns.map((c) => escapeField(c.label)).join(","),
    ...rows.map((row) => columns.map((c) => escapeField(row[c.key])).join(",")),
  ];

  return `${lines.join("\r\n")}\r\n`;
}
