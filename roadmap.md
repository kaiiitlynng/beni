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

# insurance intelligence + text agent (Claude API, Linq v3)
- [x] extract-plan: Claude reads the uploaded PDF; only page-cited benefits are stored (`src/lib/server/extract-plan.server.ts`)
- [x] agent: one agent for Linq texts and the /demo web-chat fallback, grounded in stored plan data (`src/lib/server/agent.server.ts`)
- [x] calendar holds and visit logs only after an explicit "yes" (`profiles.pending_action`)
- [x] send-nudge: welcome, school break, unused benefit, appointment, post-visit check-in; consent and notification switches enforced
- [x] linq-webhook: Standard Webhooks signature check, event de-duplication, STOP/START (`src/routes/api/linq-webhook.ts`)
- [x] realtime refresh so changes made by text appear on the site
- [ ] Lovable schema change applied (see AGENTS.md → Backend integration)
- [ ] Secrets set: ANTHROPIC_API_KEY, LINQ_API_TOKEN, LINQ_FROM_NUMBER, LINQ_WEBHOOK_SECRET
- [ ] Linq webhook subscription registered for `message.received`
- [ ] End-to-end check with a public sample plan

# real integrations
- [ ] Secure per-user Google Calendar consent, upcoming events, availability and approved event export
- [x] Linq consent-gated test message and appointment reminders — built in `src/lib/server/nudge.server.ts` (secrets still to set)
- [x] Signed Linq reply webhook, private history and AI responses — built in `src/routes/api/linq-webhook.ts` + `src/lib/server/agent.server.ts`; extend these rather than adding a second webhook or agent
- [ ] Verify real integrations and document credential/setup blockers

Not started: provider search beyond the providers table.
