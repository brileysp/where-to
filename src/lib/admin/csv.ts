/**
 * Minimal RFC4180 CSV serialization, shared by every admin-screen export
 * route (see docs/todo.md's content-authoring-via-spreadsheet plan). Kept
 * hand-rolled rather than a dependency: escaping a field for CSV is a
 * three-line rule, and writing it here means the export and any future
 * import share the exact same quoting convention with nothing to version.
 */

/** Quotes a single cell only when it needs it — a comma, quote, or newline
 * anywhere in the value — doubling any internal quotes per RFC4180. Passing
 * this through Google Sheets/Excel and back preserves the value exactly. */
export function csvCell(value: string | number | boolean | null | undefined): string {
  if (value === null || value === undefined) return '';
  const s = typeof value === 'string' ? value : String(value);
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export function csvRow(cells: Array<string | number | boolean | null | undefined>): string {
  return cells.map(csvCell).join(',');
}

/** Builds a full CSV document (header + rows), CRLF line endings per
 * RFC4180 — Sheets/Excel both expect this and it avoids any ambiguity with
 * bare \n showing up inside a quoted multi-line cell. */
export function toCsv(header: string[], rows: Array<Array<string | number | boolean | null | undefined>>): string {
  const lines = [csvRow(header), ...rows.map(csvRow)];
  return lines.join('\r\n') + '\r\n';
}
