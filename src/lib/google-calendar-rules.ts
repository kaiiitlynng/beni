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
/** Beni may change only Google events it exported itself (deterministic `beni…` ids) from a confirmed entry. */
export function isEditableBeniGoogleEvent(e: { google_event_id: string | null; user_confirmed: boolean }) {
  return Boolean(e.google_event_id?.startsWith('beni') && e.user_confirmed);
}

export type BeniEventChanges = { title?: string | undefined; starts_at?: string | undefined; ends_at?: string | null | undefined; location?: string | null | undefined; notes?: string | null | undefined };
/** Columns written to the local calendar_events row; only present keys change. */
export type LocalEventUpdate = { title?: string; starts_at?: string; ends_at?: string | null; location?: string | null; notes?: string | null };
export type GoogleEventPatch = { summary?: string; location?: string; description?: string; start?: { dateTime: string }; end?: { dateTime: string } };

/**
 * Builds a Google PATCH body plus the matching local columns from only the fields that changed.
 * Moving only the start keeps the current duration. Returns an error for unusable times.
 */
export function googleEventPatch(current: { starts_at: string; ends_at: string | null }, changes: BeniEventChanges):
  { ok: true; patch: GoogleEventPatch; local: LocalEventUpdate } | { ok: false; error: string } {
  const patch: GoogleEventPatch = {}, local: LocalEventUpdate = {};
  if (changes.title !== undefined) {
    const title = changes.title.trim();
    if (!title) return { ok: false, error: 'The title cannot be empty.' };
    patch.summary = title; local.title = title;
  }
  if (changes.location !== undefined) { patch.location = changes.location ?? ''; local.location = changes.location || null; }
  if (changes.notes !== undefined) { patch.description = changes.notes ?? ''; local.notes = changes.notes || null; }
  if (changes.starts_at !== undefined || changes.ends_at !== undefined) {
    const oldStart = Date.parse(current.starts_at);
    const oldEnd = current.ends_at ? Date.parse(current.ends_at) : oldStart + 3600000;
    const iso = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/;
    if ((changes.starts_at !== undefined && !iso.test(changes.starts_at)) || (changes.ends_at && !iso.test(changes.ends_at)))
      return { ok: false, error: 'Choose a valid date and time.' };
    const start = changes.starts_at !== undefined ? Date.parse(changes.starts_at) : oldStart;
    const end = changes.ends_at ? Date.parse(changes.ends_at) : start + (oldEnd - oldStart);
    if (!Number.isFinite(start) || !Number.isFinite(end)) return { ok: false, error: 'Choose a valid date and time.' };
    if (end <= start) return { ok: false, error: 'The end time must be after the start time.' };
    const s = new Date(start).toISOString(), en = new Date(end).toISOString();
    patch.start = { dateTime: s }; patch.end = { dateTime: en }; local.starts_at = s; local.ends_at = en;
  }
  if (!Object.keys(patch).length) return { ok: false, error: 'Nothing to change.' };
  return { ok: true, patch, local };
}
