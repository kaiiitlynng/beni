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
- Phase-one demo stores explicitly demo-channel messages without real SMS delivery; external messaging and document intelligence are separate subsequent phases.

## Backend integration (Claude + Linq)
- Claude is called with `@anthropic-ai/sdk` from server-only modules in `src/lib/server/` (model `claude-opus-5-5`), not through Lovable's AI gateway. This is a deliberate exception to the gateway rule above: the product spec requires Claude, and plan extraction sends the PDF to Claude natively. `ANTHROPIC_API_KEY` lives in Lovable Secrets.
- Linq v3 lives in `src/lib/server/linq.server.ts`; the inbound webhook is `POST /api/linq-webhook` (Standard Webhooks signature, `LINQ_WEBHOOK_SECRET`). Outbound texts need `LINQ_API_TOKEN` and `LINQ_FROM_NUMBER`.
- The agent and the /demo web-chat fallback share `handleIncoming`. Calendar holds and visit logs are written only after an explicit yes to a stored `pending_action`; never let the model write them directly.
- Schema needed from Lovable (ask Lovable, do not hand-write migrations): `profiles.pending_action jsonb` (server-only writes; keep it out of client UPDATE grants if possible), table `webhook_events(id text primary key, received_at timestamptz not null default now())` with RLS on and service_role access only, and widen the `calendar_events.status` check to include `'confirmed'` (used by `confirmHold`).
