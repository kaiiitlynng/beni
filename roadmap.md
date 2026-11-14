# beni foundation
- [x] Editorial landing page and messaging preview
- [x] Profile sign-in and three-step onboarding
- [x] Private insurance PDF upload and stored preferences
- [x] Benefits dashboard and settings
- [x] Separate demo and messaging connection state
- [x] Desktop/mobile public flow and five safeguard/routing tests
- [ ] Signed-in upload/readback verification — blocked: no app user exists yet; sign up and confirm email first

# benefits hub expansion
- [x] Database: calendar hold details, plan effective dates, notification settings
- [x] Authenticated shell: collapsible sidebar (desktop) + bottom nav (mobile)
- [x] Home dashboard: insurance overview, hidden perks, upcoming care, calendar card, beni suggestions
- [x] My Benefits page: search, category filters, coverage indicators, hidden perks filter, detail view
- [x] My Calendar page: month/week/day views, holds, beni assistant panel, honest not-connected state
- [x] My Care page: upcoming / completed / reminders, add and confirm visits
- [x] Activity page: chronological beni activity feed with message preview
- [x] Settings page: personal info, notifications, documents, connected accounts, privacy
- [x] Rule tests: hold ≠ booked, consent gating, coverage indicators

Subsequent requested phases: AI document extraction, Linq authenticated webhook and outbound messaging, Google Calendar connection (Composio or App User Connector), same-agent demo fallback, and appointment assistance. These are not enabled in the foundation.

# real integrations
- [x] Secure per-user Google Calendar consent, upcoming events, availability and approved event export code
- [x] Linq secret setup, consent-gated test message and scheduled real appointment reminder code
- [x] Signed Linq reply webhook, private history and queued AI responses
- [x] Verify safeguards, Google authorization launch, Linq account access and real AI inference
- [ ] Google event read/write end-to-end — waiting for user to complete Google consent
- [ ] Linq phone delivery — saved phone lacks a country code; user must correct it before a real test can send
- [ ] Live Linq replies and reminders — publish Beni, register public webhook with version 2026-02-03, then save provider-issued LINQ_WEBHOOK_SECRET
