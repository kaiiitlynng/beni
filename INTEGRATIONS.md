# Beni integration setup and verification

Uses the existing Lovable Cloud project. No external database project and no frontend redesign.
Server functions and signed public server endpoints are the supported equivalent of legacy Edge Functions on this app's stack.

## Google Calendar

The workspace Google Calendar client is linked, with offline access enabled. Composio is unnecessary: the native per-user connector handles OAuth and refresh securely.

1. Google Cloud Console → APIs & Services → Library → enable **Google Calendar API**.
2. Google Auth Platform → Branding / Audience → configure the consent screen. Publish the External app, or use Internal for your organization. External Testing requires adding participants as test users and grants expire after seven days.
3. APIs & Services → Credentials → create an OAuth client of type **Web application**.
4. Authorized redirect URI: `https://connector-gateway.lovable.dev/api/v1/app-users/oauth2/callback`.
5. Configure the client ID and secret in Lovable workspace **App User Connectors → Google Calendar**; never enter them in source code. Enable offline access.
6. Beni → Settings → Connections → Connect Google Calendar → authorize. Successful consent exchanges the one-time code in the signed-in opener and stores an encrypted per-user connection in Cloud.
7. My Calendar shows upcoming Google events and free windows. Confirm a Beni entry, then choose **add to google**. Only user-approved entries are exported. This does not book a healthcare provider.

Scopes: `userinfo.email`, `userinfo.profile`, `calendar.readonly`, `calendar.events` (full Google scope URLs in the authorization request).
Google Calendar reads and free/busy results are live, not mock data. All-day end dates are exclusive. Exports use deterministic event IDs to avoid duplicate creation.

## Linq

`LINQ_API_KEY` is saved in Cloud Secrets. A real account check returned HTTP 200 and one line. The app calls Linq Partner API v3 directly from server handlers.

1. Linq Dashboard → API toolkit → Overview → Generate new token; save as `LINQ_API_KEY` through Lovable's secure secret form (already completed).
2. Ensure the Linq line is enabled for real delivery, not a sandbox-only account, and has sufficient balance.
3. Beni → Settings → Personal: save your full country-coded phone (`+1…` for US). Privacy: opt in. Notifications: enable text reminders.
4. Settings → Connections → **Send Test Message** sends a real, generic text to the saved opted-in phone. Acceptance is not proof of delivery; delivery/read/failed receipts update Activity.
5. **Publish Beni first.** Its current private preview returns HTTP 401 to outside callers; it cannot receive provider webhooks. After publication, verify an unauthenticated GET to `https://<published-beni-host>/api/public/linq/webhook` returns JSON with HTTP 200.
6. Linq API toolkit → Webhook subscriptions → create subscription targeting `https://<published-beni-host>/api/public/linq/webhook?version=2026-02-03`. Subscribe to `message.received`, `message.sent`, `message.delivered`, `message.read`, `message.failed`.
7. Linq returns a signing secret only at creation. Copy it into Lovable's secure secret form as **LINQ_WEBHOOK_SECRET** (provider-issued `whsec_…`). Do not paste it in chat. Publish changes again so the published endpoint receives the new secret.
8. Reply **HELLO** to the test text. A valid signed direct-chat reply verifies that phone, saves private history, and queues an AI reply. Replies are processed by the managed minute schedule. Reply STOP immediately disables consent and notifications; Beni sends no AI response to STOP.

API alternative for step 6, with the token supplied securely by your own API client:

```json
POST https://api.linqapp.com/api/partner/v3/webhook-subscriptions
{
  "target_url": "https://<published-beni-host>/api/public/linq/webhook?version=2026-02-03",
  "subscribed_events": ["message.received", "message.sent", "message.delivered", "message.read", "message.failed"]
}
```

Managed job `beni-linq-replies-and-reminders` calls `/api/public/linq/process` every minute with managed authentication. It needs the published deployment. Approved entries starting within 24 hours receive one generic reminder, subject to consent, verified phone, notification settings and preferred messaging hours. No medical title/details are included. Outbound attempts are durably deduplicated; ambiguous or permanent failures are not automatically resent. Failed AI replies remain recorded instead of silently replaying inference.

## Verification performed

- 14 tests pass: existing safeguards plus consent, notification switch, approval gating, phone format, overlapping availability, signature tampering/replay.
- Signed-in Settings and Calendar render without browser errors; visual design preserved.
- Connect Google Calendar reaches `accounts.google.com`; cancellation produces a visible error. Full consent, event reads, free/busy and export remain unverified until the user authorizes their own Google account.
- Linq real line lookup succeeds (HTTP 200, one line).
- Clicking Send Test Message correctly blocks the existing phone because it lacks a country code. No message was sent and no delivery is claimed.
- Real AI inference succeeds and states that Google Calendar entries do not book doctors.
- Cron endpoint rejects unauthorized callers (HTTP 401). Webhook fails closed while signing secret is missing (HTTP 503). Unit tests verify actual signed payload verification, tampering and five-minute replay tolerance.
- Current hosted preview rejects external callers (HTTP 401); live webhook delivery, phone replies, AI-to-phone delivery and scheduled reminders remain blocked by publication, webhook registration/signing secret, and phone verification.

Official Linq contracts: https://docs.linqapp.com/channel/imessage/guides/messaging/sending-messages/ and https://docs.linqapp.com/channel/imessage/guides/webhooks/.