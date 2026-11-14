import { afterEach, describe, expect, it, vi } from 'vitest';
import { googleCall, readGoogleSchedule } from '../lib/google-calendar.server';

afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });
describe('shared Google Calendar transport', () => {
  it('reads only the shared account primary calendar, excluding subscriptions', async () => {
    vi.stubEnv('GOOGLE_CALENDAR_API_KEY', 'test-connector');
    vi.stubEnv('LOVABLE_API_KEY', 'test-app');
    const fetcher = vi.fn()
      .mockResolvedValueOnce(Response.json({items:[{id:'jseaman@berkeley.edu',primary:true},{id:'holidays'}]}))
      .mockResolvedValueOnce(Response.json({items:[]}))
      .mockResolvedValueOnce(Response.json({calendars:{'jseaman@berkeley.edu':{busy:[]}}}));
    vi.stubGlobal('fetch', fetcher);
    expect((await readGoogleSchedule()).connected).toBe(true);
    expect(fetcher.mock.calls[1]?.[0]).toContain('/calendars/jseaman%40berkeley.edu/events?');
    expect(JSON.parse(fetcher.mock.calls[2]?.[1].body).items).toEqual([{id:'jseaman@berkeley.edu'}]);
  });
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
  it('rejects a connector for a different Google account before reading its events', async () => {
    vi.stubEnv('GOOGLE_CALENDAR_API_KEY', 'test-connector');
    vi.stubEnv('LOVABLE_API_KEY', 'test-app');
    const fetcher=vi.fn().mockResolvedValue(Response.json({items:[{id:'other@example.com',primary:true}]}));
    vi.stubGlobal('fetch',fetcher);
    expect((await readGoogleSchedule()).connected).toBe(false);
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
});