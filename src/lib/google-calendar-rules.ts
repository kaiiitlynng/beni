export function approvedGoogleExport(event: { status: string; user_confirmed: boolean }, approved: boolean) {
  return approved && event.user_confirmed && event.status === 'confirmed';
}
export function availableWindows(busy: { start: string; end: string }[], start: string, end: string) {
  const lo = Date.parse(start), hi = Date.parse(end);
  const intervals = busy.map(b => [Math.max(lo, Date.parse(b.start)), Math.min(hi, Date.parse(b.end))]).filter(([a,b]) => Number.isFinite(a) && Number.isFinite(b) && b > a).sort((a,b) => a[0] - b[0]);
  const windows: { start: string; end: string }[] = []; let cursor = lo;
  for (const [a,b] of intervals) { if (a > cursor && a - cursor >= 30 * 60000) windows.push({ start: new Date(cursor).toISOString(), end: new Date(a).toISOString() }); cursor = Math.max(cursor,b); }
  if (hi - cursor >= 30 * 60000) windows.push({ start: new Date(cursor).toISOString(), end: new Date(hi).toISOString() });
  return windows;
}
export function allDayRange(start: string, exclusiveEnd: string) {
  const end = new Date(`${exclusiveEnd}T12:00:00Z`); end.setUTCDate(end.getUTCDate()-1);
  return { start, end: end.toISOString().slice(0,10) };
}