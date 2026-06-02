// Tiny CSV builder + browser downloader (no deps).
// Escapes fields per RFC 4180: wraps in quotes if it contains , " \n \r, doubles internal quotes.
function esc(v: unknown): string {
  if (v == null) return "";
  const s = String(v);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function toCSV(rows: Record<string, unknown>[], headers?: string[]): string {
  if (!rows.length) return (headers ?? []).join(",");
  const cols = headers ?? Object.keys(rows[0]);
  const head = cols.join(",");
  const body = rows.map((r) => cols.map((c) => esc((r as any)[c])).join(",")).join("\n");
  return `${head}\n${body}`;
}

export function downloadCSV(filename: string, csv: string) {
  // BOM for Excel pt-BR friendliness
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
