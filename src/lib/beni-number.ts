/** Builds an `sms:` link for beni's configured number, or null when none is configured. */
export function smsHref(number: string | null | undefined): string | null {
  const digits = (number ?? "").replace(/[^\d+]/g, "");
  if (!/^\+?\d{8,15}$/.test(digits)) return null;
  return `sms:${digits.startsWith("+") ? digits : `+${digits}`}`;
}
