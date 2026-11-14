export function approvedGoogleExport(event: { status: string; user_confirmed: boolean }, approved: boolean) {
  return approved && event.user_confirmed && event.status === 'confirmed';
}
export function availableWindows(busy: { start: string; end: string }[], start: string, end: string) {
  const lo = Date.parse(start), hi = Date.parse(end);
  const intervals = busy.map(b => ({start:Math.max(lo, Date.parse(b.start)),end:Math.min(hi, Date.parse(b.end))})).filter(b => Number.isFinite(b.start) && Number.isFinite(b.end) && b.end > b.start).sort((a,b) => a.start - b.start);
  const windows: { start: string; end: string }[] = []; let cursor = lo;
  for (const {start:a,end:b} of intervals) { if (a > cursor && a - cursor >= 30 * 60000) windows.push({ start: new Date(cursor).toISOString(), end: new Date(a).toISOString() }); cursor = Math.max(cursor,b); }
  if (hi - cursor >= 30 * 60000) windows.push({ start: new Date(cursor).toISOString(), end: new Date(hi).toISOString() });
  return windows;
}
export function allDayRange(start: string, exclusiveEnd: string) {
  const end = new Date(`${exclusiveEnd}T12:00:00Z`); end.setUTCDate(end.getUTCDate()-1);
  return { start, end: end.toISOString().slice(0,10) };
}