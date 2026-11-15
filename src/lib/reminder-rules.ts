export const FREQUENCIES = [
  ['once', 'Once'], ['weekly', 'Every week'], ['monthly', 'Every month'], ['quarterly', 'Every 3 months'],
  ['semiannual', 'Every 6 months'], ['annual', 'Every year'], ['custom', 'Custom (every N days)'],
] as const;
export type Frequency = (typeof FREQUENCIES)[number][0];

export function frequencyLabel(f: string, days?: number | null): string {
  if (f === 'custom') return `Every ${days ?? '?'} days`;
  return FREQUENCIES.find(([k]) => k === f)?.[1] ?? f;
}

function addMonthsClamped(d: Date, n: number): Date {
  const r = new Date(d);
  const day = r.getUTCDate();
  r.setUTCDate(1);
  r.setUTCMonth(r.getUTCMonth() + n);
  const last = new Date(Date.UTC(r.getUTCFullYear(), r.getUTCMonth() + 1, 0)).getUTCDate();
  r.setUTCDate(Math.min(day, last));
  return r;
}

/** The occurrence after `from`, or null for one-time reminders. */
export function nextOccurrence(from: Date, f: string, intervalDays?: number | null): Date | null {
  switch (f) {
    case 'weekly': return new Date(from.getTime() + 7 * 86400000);
    case 'monthly': return addMonthsClamped(from, 1);
    case 'quarterly': return addMonthsClamped(from, 3);
    case 'semiannual': return addMonthsClamped(from, 6);
    case 'annual': return addMonthsClamped(from, 12);
    case 'custom': return intervalDays && intervalDays > 0 ? new Date(from.getTime() + intervalDays * 86400000) : null;
    default: return null;
  }
}

/** First future occurrence at or after `now` (skips missed ones so a backlog never sends repeatedly). */
export function upcomingOccurrence(start: Date, f: string, intervalDays: number | null | undefined, now: Date): Date | null {
  let t: Date | null = start;
  let guard = 0;
  while (t && t.getTime() < now.getTime() && guard++ < 1000) t = nextOccurrence(t, f, intervalDays);
  return t;
}

/** After sending, where the reminder goes next. Past the end date it finishes. */
export function advanceAfterSend(r: { remind_at: string; frequency: string; interval_days: number | null; end_date: string | null }, now: Date):
  { status: 'open' | 'sent'; remind_at: string } {
  const next = upcomingOccurrence(new Date(r.remind_at), r.frequency, r.interval_days, new Date(Math.max(now.getTime(), Date.parse(r.remind_at) + 1)));
  if (!next || (r.end_date && next.getTime() > Date.parse(`${r.end_date}T23:59:59Z`))) return { status: 'sent', remind_at: r.remind_at };
  return { status: 'open', remind_at: next.toISOString() };
}

const HOURS: Record<string, [number, number]> = { mornings: [8, 12], afternoons: [12, 17], evenings: [17, 21], anytime: [8, 21] };

/** Texts only go out with consent, the text switch on, a text method, and inside preferred local hours. */
export function textDecision(p: { sms_consent: boolean; notify_sms: boolean; messaging_hours: string; timezone: string }, method: string, now: Date):
  'text' | 'in_app' | 'wait' {
  if (method !== 'text' || !p.sms_consent || !p.notify_sms) return 'in_app';
  const [from, to] = HOURS[p.messaging_hours] ?? HOURS['anytime']!;
  let hour: number;
  try { hour = Number(new Intl.DateTimeFormat('en-US', { hour: 'numeric', hourCycle: 'h23', timeZone: p.timezone || 'UTC' }).format(now)); }
  catch { hour = now.getUTCHours(); }
  return hour >= from && hour < to ? 'text' : 'wait';
}
