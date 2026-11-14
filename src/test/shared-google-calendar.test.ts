import { afterEach, describe, expect, it, vi } from 'vitest';
import { googleCall, readGoogleSchedule } from '../lib/google-calendar.server';

afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });
describe('shared Google Calendar transport', () => {
  it('uses the workspace connector rather than any per-user connection', async () => {
    vi.stubEnv('GOOGLE_CALENDAR_API_KEY', 'test-connector');
    vi.stubEnv('LOVABLE_API_KEY', 'test-app');
    const fetcher = vi.fn().mockResolvedValue(new Response('{}'));
    vi.stubGlobal('fetch', fetcher);
    await googleCall('/users/me/calendarList');
    expect(fetcher.mock.calls[0]?.[0]).toBe('https://connector-gateway.lovable.dev/google_calendar/calendar/v3/users/me/calendarList');
    const headers = fetcher.mock.calls[0]?.[1].headers as Headers;
    expect(headers.get('X-Connection-Api-Key')).toBe('test-connector');
  });
  it('never reports connected when the shared provider read fails', async () => {
    vi.stubEnv('GOOGLE_CALENDAR_API_KEY', 'test-connector');
    vi.stubEnv('LOVABLE_API_KEY', 'test-app');
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('{}', {status: 403})));
    expect((await readGoogleSchedule()).connected).toBe(false);
  });
});