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
- Keep per-user Google credentials encrypted server-side and exchange one-time OAuth codes only in the authenticated opener; never expose provider credentials to browser code.
- Use signed public TanStack endpoints and durable Cloud queues for Linq replies and reminders; require consent, verified phone routing, and idempotent outbound attempts before sending.
- Keep real Linq history separate from demo history so simulated messages never appear as actual phone deliveries.
