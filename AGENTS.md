<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.

## What Lovable manages

Rules outside this block are the project's own. Change the pieces below in
Lovable, not by hand. With the [Lovable MCP](https://mcp.lovable.dev)
connected, `send_message` asks Lovable to do it; otherwise ask the user to
use the editor.

- **Database.** Do not add or edit `supabase/migrations/` or `drizzle/`.
  Ask Lovable to change the schema.
- **Generated files.** Do not edit a file whose header says it is automatically
  generated.
- **AI gateway.** Keep model calls on Lovable's gateway, and keep
  `LOVABLE_API_KEY` out of browser code.
- **Connectors.** Lovable provides native connectors. `list_connectors` shows
  which are enabled; `add_connector` only returns the dashboard link. When a
  connector is enabled, calls go through the connector gateway and need
  `LOVABLE_API_KEY`. When Lovable does not provide one, users can bring their
  own key and store it in Secrets.
- **Secrets.** Lovable manages them. Do not put secret values in the repo.
<!-- LOVABLE:END -->

## Application architecture
- Use authenticated TanStack route children for private onboarding, dashboard, settings and demo; public pages remain SSR-safe because browser sessions cannot be read by SSR.
- Keep profile/plan persistence in owner-scoped Cloud tables and private Storage; benefits are read-only to clients so coverage cannot be fabricated by browser writes.
- Filter every browser profile update through the editable-field allowlist; loaded rows include protected identity fields that must never be resubmitted or granted client write access.
- Phase-one demo stores explicitly demo-channel messages without real SMS delivery; external messaging and document intelligence are separate subsequent phases.

## Backend integration (Claude + Linq)
- The conversational Claude agent uses the private Anthropic SDK; PDF extraction uses Lovable AI's native Messages document input with the same model so extraction needs no separate provider credential.
- Linq v3 lives in `src/lib/server/linq.server.ts`; the inbound webhook is `POST /api/public/linq-webhook` (Standard Webhooks signature, `LINQ_WEBHOOK_SECRET`). The public prefix allows provider callbacks while signature validation protects writes. Outbound texts need `LINQ_API_TOKEN` and `LINQ_FROM_NUMBER`.
- The agent and the /demo web-chat fallback share `handleIncoming`. Calendar holds and visit logs are written only after an explicit yes to a stored `pending_action`; never let the model write them directly.
- Schema needed from Lovable (ask Lovable, do not hand-write migrations): `profiles.pending_action jsonb` (server-only writes; keep it out of client UPDATE grants if possible), table `webhook_events(id text primary key, received_at timestamptz not null default now())` with RLS on and service_role access only, and widen the `calendar_events.status` check to include `'confirmed'` (used by `confirmHold`).
- Insurance activation is an owner-authenticated atomic database operation with a unique active-plan index; current coverage in both web and text surfaces filters by that plan to prevent historical benefit mixing.
- Processing stores reviewable inactive plans; clients can insert only upload identity fields, not coverage, processing status or activation state, to prevent forged insurance facts.
- Google Calendar uses the linked per-user connector via popup code exchange, encrypted Cloud connection handles and live API verification; never infer connected status from popup closure or a stored handle alone.
- Google exports require an owned confirmed Beni entry plus explicit export approval and deterministic provider event IDs, preventing tentative exports and retry duplicates without claiming provider bookings.
