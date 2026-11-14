export type CalDay = { date: Date; key: string; inMonth: boolean; isToday: boolean };

export function toKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function monthGrid(anchor: Date): CalDay[] {
  const first = new Date(anchor.getFullYear(), anchor.getMonth(), 1);
  const start = new Date(first);
  start.setDate(first.getDate() - first.getDay()); // Sunday start
  const today = toKey(new Date());
  const days: CalDay[] = [];
  for (let i = 0; i < 42; i++) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    days.push({ date: d, key: toKey(d), inMonth: d.getMonth() === anchor.getMonth(), isToday: toKey(d) === today });
  }
  return days;
}

export function weekDays(anchor: Date): CalDay[] {
  const start = new Date(anchor);
  start.setDate(anchor.getDate() - anchor.getDay());
  const today = toKey(new Date());
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    return { date: d, key: toKey(d), inMonth: true, isToday: toKey(d) === today };
  });
}

export function addMonths(d: Date, n: number): Date {
  return new Date(d.getFullYear(), d.getMonth() + n, 1);
}

export function addWeeks(d: Date, n: number): Date {
  const r = new Date(d);
  r.setDate(d.getDate() + n * 7);
  return r;
}

export function monthLabel(d: Date): string {
  return d.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
}
