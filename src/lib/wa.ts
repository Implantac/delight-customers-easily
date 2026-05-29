// WhatsApp deep-link helper. Strips non-digits; assumes phone already
// includes country code if international. For Brazil-only numbers without
// country code, prepends "55".
export function whatsappLink(phone: string, message?: string): string | null {
  const digits = (phone ?? "").replace(/\D+/g, "");
  if (!digits) return null;
  const withCC = digits.length <= 11 ? `55${digits}` : digits;
  const base = `https://wa.me/${withCC}`;
  return message ? `${base}?text=${encodeURIComponent(message)}` : base;
}
