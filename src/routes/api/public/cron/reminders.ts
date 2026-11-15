import { createFileRoute } from "@tanstack/react-router";
import { authenticateCronRequest } from "@/integrations/supabase/cron-auth";

export const Route = createFileRoute("/api/public/cron/reminders")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const denied = await authenticateCronRequest(request);
        if (denied) return denied;
        const { processDueReminders } = await import("@/lib/server/reminders.server");
        try {
          const results = await processDueReminders();
          return Response.json({ processed: results.length, results });
        } catch (e) {
          console.error("[reminders] run failed", e);
          return Response.json({ error: "Reminder run failed" }, { status: 500 });
        }
      },
    },
  },
});
