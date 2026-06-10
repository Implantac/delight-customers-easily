// Minimal RFC 5545 .ics generator for a single VEVENT.

function pad(n: number) { return n.toString().padStart(2, "0"); }
function fmtUTC(d: Date) {
  return (
    d.getUTCFullYear().toString() +
    pad(d.getUTCMonth() + 1) +
    pad(d.getUTCDate()) +
    "T" +
    pad(d.getUTCHours()) +
    pad(d.getUTCMinutes()) +
    pad(d.getUTCSeconds()) +
    "Z"
  );
}
function esc(s: string) {
  return s.replace(/\\/g, "\\\\").replace(/\n/g, "\\n").replace(/,/g, "\\,").replace(/;/g, "\\;");
}

export type ICSEvent = {
  uid: string;
  title: string;
  description?: string;
  start: Date;
  durationMinutes?: number;
};

export function buildICS(ev: ICSEvent): string {
  const end = new Date(ev.start.getTime() + (ev.durationMinutes ?? 30) * 60000);
  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//USE PATRIUM//PT-BR//EN",
    "CALSCALE:GREGORIAN",
    "BEGIN:VEVENT",
    `UID:${ev.uid}@lovable-crm`,
    `DTSTAMP:${fmtUTC(new Date())}`,
    `DTSTART:${fmtUTC(ev.start)}`,
    `DTEND:${fmtUTC(end)}`,
    `SUMMARY:${esc(ev.title)}`,
    ev.description ? `DESCRIPTION:${esc(ev.description)}` : "",
    "END:VEVENT",
    "END:VCALENDAR",
  ].filter(Boolean).join("\r\n");
}

export function downloadICS(ev: ICSEvent) {
  const blob = new Blob([buildICS(ev)], { type: "text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${ev.title.replace(/[^a-z0-9-_]+/gi, "_").slice(0, 60) || "evento"}.ics`;
  a.click();
  URL.revokeObjectURL(url);
}
