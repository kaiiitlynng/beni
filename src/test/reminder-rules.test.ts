import { describe, it, expect } from 'vitest';
import { nextOccurrence, advanceAfterSend, textDecision, upcomingOccurrence } from '@/lib/reminder-rules';
const p = { sms_consent: true, notify_sms: true, messaging_hours: 'anytime', timezone: 'America/Los_Angeles' };
describe('recurring reminders', () => {
  it('every six months moves Jan 31 to Jul 31', () => expect(nextOccurrence(new Date('2026-01-31T18:00:00Z'), 'semiannual')!.toISOString()).toBe('2026-07-31T18:00:00.000Z'));
  it('monthly clamps to the end of shorter months', () => expect(nextOccurrence(new Date('2026-01-31T18:00:00Z'), 'monthly')!.toISOString().slice(0, 10)).toBe('2026-02-28'));
  it('once has no next occurrence', () => expect(nextOccurrence(new Date(), 'once')).toBeNull());
  it('custom repeats every N days', () => expect(nextOccurrence(new Date('2026-01-01T00:00:00Z'), 'custom', 10)!.toISOString().slice(0, 10)).toBe('2026-01-11'));
  it('missed occurrences are skipped, not sent repeatedly', () => expect(upcomingOccurrence(new Date('2026-01-01T10:00:00Z'), 'weekly', null, new Date('2026-01-20T00:00:00Z'))!.toISOString().slice(0, 10)).toBe('2026-01-22'));
  it('finishes after the end date', () => expect(advanceAfterSend({ remind_at: '2026-01-01T10:00:00Z', frequency: 'monthly', interval_days: null, end_date: '2026-01-15' }, new Date('2026-01-01T10:05:00Z')).status).toBe('sent'));
  it('an annual reminder advances one year after sending', () => expect(advanceAfterSend({ remind_at: '2026-03-01T17:00:00Z', frequency: 'annual', interval_days: null, end_date: null }, new Date('2026-03-01T17:01:00Z')).remind_at).toBe('2027-03-01T17:00:00.000Z'));
  it('never texts without SMS consent', () => expect(textDecision({ ...p, sms_consent: false }, 'text', new Date('2026-01-01T20:00:00Z'))).toBe('in_app'));
  it('never texts when texts are switched off', () => expect(textDecision({ ...p, notify_sms: false }, 'text', new Date('2026-01-01T20:00:00Z'))).toBe('in_app'));
  it('waits outside preferred hours (3 AM local)', () => expect(textDecision(p, 'text', new Date('2026-01-01T11:00:00Z'))).toBe('wait'));
  it('texts inside preferred hours (noon local)', () => expect(textDecision(p, 'text', new Date('2026-01-01T20:00:00Z'))).toBe('text'));
});
