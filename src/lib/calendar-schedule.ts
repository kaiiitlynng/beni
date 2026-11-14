import { availableWindows } from './google-calendar-rules';
import { toKey } from './calendar';

export type Interval = { start: string; end: string };
export type ScheduleEntry = Interval & { id: string; title: string; type: 'google' | 'confirmed' | 'hold'; allDay?: boolean; url?: string | null; location?: string | null; notes?: string | null };
export function localDate(value: string) { return new Date(value.length === 10 ? `${value}T12:00:00` : value); }
export function dayLabel(value: string | Date) { return (typeof value === 'string' ? localDate(value) : value).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' }); }
export function dayBounds(date: Date, from = 0, to = 24) {
  const start = new Date(date); start.setHours(from, 0, 0, 0);
  const end = new Date(date); end.setHours(to, 0, 0, 0);
  return { start: start.toISOString(), end: end.toISOString() };
}
export function entryInterval(entry: ScheduleEntry): Interval {
  return entry.allDay ? { start: `${entry.start}T00:00:00`, end: `${entry.end}T00:00:00` } : entry;
}
export function entriesOnDay(entries: ScheduleEntry[], date: Date) {
  const bounds = dayBounds(date);
  return entries.filter(entry => { const range = entryInterval(entry); return Date.parse(range.start) < Date.parse(bounds.end) && Date.parse(range.end) > Date.parse(bounds.start); });
}
/** Calendar-day arithmetic keeps daily windows local, including daylight-saving changes. */
export function dailyAvailability(date: Date, busy: Interval[], from = 8, to = 20, now = new Date()): Interval[] {
  const bounds = dayBounds(date, from, to);
  const start = Math.max(Date.parse(bounds.start), now.getTime());
  if (start >= Date.parse(bounds.end)) return [];
  return availableWindows(busy, new Date(start).toISOString(), bounds.end);
}
export function slotDuration(slot: Interval) {
  const minutes = Math.round((Date.parse(slot.end) - Date.parse(slot.start)) / 60000);
  return minutes < 60 ? `${minutes} min` : `${Math.floor(minutes / 60)} hr${minutes % 60 ? ` ${minutes % 60} min` : ''}`;
}
export function minutesInDay(value: string, date: Date) {
  const d = new Date(value);
  if (toKey(d) < toKey(date)) return 0;
  if (toKey(d) > toKey(date)) return 1440;
  return d.getHours() * 60 + d.getMinutes();
}
/** Assign columns to overlapping timed entries so neither event obscures another. */
export function layoutEntries(entries: ScheduleEntry[]) {
  const sorted = [...entries].sort((a, b) => Date.parse(a.start) - Date.parse(b.start));
  const output: { entry: ScheduleEntry; column: number; columns: number }[] = [];
  let group: typeof output = [], ends: number[] = [], groupEnd = 0;
  const flush = () => { group.forEach(item => { item.columns = ends.length; output.push(item); }); group = []; ends = []; };
  for (const entry of sorted) {
    const start = Date.parse(entry.start), end = Date.parse(entry.end);
    if (group.length && start >= groupEnd) flush();
    let column = ends.findIndex(t => t <= start);
    if (column < 0) column = ends.length;
    ends[column] = end; groupEnd = group.length ? Math.max(groupEnd, end) : end;
    group.push({ entry, column, columns: 1 });
  }
  flush(); return output;
}