export function googleCalendarFailure(status: number, rawBody: string) {
  let body: Record<string, unknown> = {};
  try {
    const parsed: unknown = JSON.parse(rawBody);
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) body = parsed as Record<string, unknown>;
  } catch { /* Provider may return plain text. */ }
  const error = body['error'] && typeof body['error'] === 'object' ? body['error'] : body;
  const detail = JSON.stringify(error);
  if (/accessNotConfigured|SERVICE_DISABLED|API has not been used|is disabled/i.test(detail)) {
    return { cause: 'api_disabled', message: 'Google Calendar API is disabled for Beni’s Google OAuth project. The app owner must enable Google Calendar API in Google Cloud Console → APIs & Services → Library, using the project that owns the configured OAuth client. Wait a few minutes, then refresh your calendar; reconnecting alone will not fix this.' };
  }
  if (/insufficientPermissions|ACCESS_TOKEN_SCOPE_INSUFFICIENT|insufficient.*scope/i.test(detail)) {
    return { cause: 'insufficient_scope', message: 'Google did not grant the Calendar permissions Beni needs. Reconnect Calendar and approve access to read calendars and manage events. If Google does not offer those permissions, the app owner must allow calendar.readonly and calendar.events in the Google OAuth configuration.' };
  }
  if (/project_not_authorized|workspace_not_authorized|connector_mismatch/i.test(detail)) {
    return { cause: 'connector_permission', message: 'Beni’s Google Calendar connector is not authorized for this app. The app owner must check the linked Google Calendar client in Lovable’s App User Connectors settings. Signing in again will not fix this configuration issue.' };
  }
  if (status === 429 || /rateLimitExceeded|quotaExceeded|RESOURCE_EXHAUSTED/i.test(detail)) {
    return { cause: 'quota', message: 'Google Calendar’s request limit was reached. Try refreshing later; the app owner can check the Google Calendar API quota if this continues.' };
  }
  if (/notFound|not_found/i.test(detail)) {
    return { cause: 'calendar_missing', message: 'Google could not find one of the requested calendars. Check that it still exists and is shared with your connected Google account, then refresh. Beni will not show availability until every calendar can be checked.' };
  }
  if (/forbidden|permission_denied/i.test(detail)) {
    return { cause: 'calendar_permission', message: 'Google denied access to a calendar. Check its sharing permissions for your connected Google account; adding events requires permission to edit that calendar. Reconnecting will not change calendar-sharing permissions.' };
  }
  if (status >= 500 || /backendError|internalError/i.test(detail)) {
    return { cause: 'provider_unavailable', message: 'Google Calendar is temporarily unavailable. Refresh later. If you were adding an appointment, check Google Calendar before retrying; Beni uses the same event identifier to avoid duplicate entries.' };
  }
  return { cause: 'unknown', message: `Google Calendar denied this request (HTTP ${status}). The app owner should check the Google Calendar API settings and calendar-sharing permissions; the response did not identify missing OAuth scopes or a disabled API.` };
}