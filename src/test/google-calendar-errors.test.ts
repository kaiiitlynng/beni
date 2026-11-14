import { describe, expect, it } from 'vitest';
import { googleCalendarFailure } from '@/lib/google-calendar-errors';

describe('Google Calendar failure diagnosis', () => {
  it('distinguishes disabled API access from missing consent', () => {
    expect(googleCalendarFailure(403, JSON.stringify({ error: { errors: [{ reason: 'accessNotConfigured' }], details: [{ reason: 'SERVICE_DISABLED' }] } })).cause).toBe('api_disabled');
  });
  it('identifies insufficient OAuth scopes', () => {
    expect(googleCalendarFailure(403, JSON.stringify({ error: { errors: [{ reason: 'insufficientPermissions' }] } })).cause).toBe('insufficient_scope');
  });
  it('distinguishes connector authorization from Google permission errors', () => {
    expect(googleCalendarFailure(403, JSON.stringify({ type: 'project_not_authorized' })).cause).toBe('connector_permission');
    expect(googleCalendarFailure(403, JSON.stringify({ error: { status: 'PERMISSION_DENIED' } })).cause).toBe('unknown');
  });
  it('does not recommend reconnecting for quota errors', () => {
    expect(googleCalendarFailure(403, JSON.stringify({ error: { errors: [{ reason: 'rateLimitExceeded' }] } })).cause).toBe('quota');
  });
});