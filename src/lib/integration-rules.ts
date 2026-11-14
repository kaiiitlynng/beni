export function normalizePhone(phone: string) {
  const cleaned = phone.replace(/[\s().-]/g, '');
  if (!/^\+[1-9]\d{7,14}$/.test(cleaned)) throw new Error('Save your phone with its country code, for example +1 followed by your number.');
  return cleaned;
}
export function textingAllowed(profile: {sms_consent: boolean; notify_sms: boolean}) {
  return profile.sms_consent && profile.notify_sms;
}
export function approvedCalendarEntry(event: {user_confirmed: boolean; status: string}) {
  return event.user_confirmed && event.status === 'confirmed';
}
export function availableWindows(start: string, end: string, busy: {start: string; end: string}[], durationMinutes = 60) {
  let cursor = Date.parse(start);
  const limit = Date.parse(end);
  const windows: {start: string; end: string}[] = [];
  for (const interval of [...busy].sort((a,b)=>Date.parse(a.start)-Date.parse(b.start))) {
    const from = Math.max(cursor, Date.parse(interval.start));
    if (from - cursor >= durationMinutes * 60000) windows.push({start: new Date(cursor).toISOString(), end: new Date(Math.min(from,limit)).toISOString()});
    cursor = Math.max(cursor, Date.parse(interval.end));
    if (cursor >= limit) break;
  }
  if (limit-cursor >= durationMinutes*60000) windows.push({start: new Date(cursor).toISOString(), end: new Date(limit).toISOString()});
  return windows.filter(w=>Date.parse(w.end)-Date.parse(w.start)>=durationMinutes*60000);
}