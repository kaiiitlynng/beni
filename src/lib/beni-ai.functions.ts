// Authenticated server functions for extraction, the demo web-chat fallback, and nudges.
// Server modules are imported inside handlers so they never reach the browser bundle.
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { NudgeKind } from "@/lib/agent-rules";

const NUDGES: NudgeKind[] = ["welcome", "school_break", "unused_benefit", "appointment", "checkin"];

export const extractPlan = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d: { planId: string }) => {
    if (typeof d?.planId !== "string" || !d.planId) throw new Error("Missing plan.");
    return d;
  })
  .handler(async ({ context, data }) => {
    // RLS-scoped read proves the plan belongs to the signed-in user before the service role touches it.
    const { data: plan } = await context.supabase
      .from("plans_uploaded")
      .select("id")
      .eq("id", data.planId)
      .maybeSingle();
    if (!plan) throw new Error("That document could not be found.");
    const [{ extractPlanForUser }, { admin }] = await Promise.all([
      import("./server/extract-plan.server"),
      import("./server/store.server"),
    ]);
    return extractPlanForUser(await admin(), context.userId, data.planId);
  });

/** Web-chat fallback for /demo: the same agent and database logic as texts, on the demo channel. */
export const agentDemoChat = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d: { text: string }) => {
    const text = typeof d?.text === "string" ? d.text.trim().slice(0, 1000) : "";
    if (!text) throw new Error("Write a message first.");
    return { text };
  })
  .handler(async ({ context, data }) => {
    const [{ handleIncoming }, store] = await Promise.all([
      import("./server/agent.server"),
      import("./server/store.server"),
    ]);
    const profile = await store.getProfile(context.userId);
    if (!profile) throw new Error("Your profile could not be loaded.");
    const reply = await handleIncoming({ profile, text: data.text, channel: "demo" });
    await store.recordMessage({
      userId: profile.id,
      direction: "outgoing",
      body: reply,
      channel: "demo",
      delivery_status: "demo",
    });
    return { reply };
  });

/** Triggers a proactive text. 'auto' texts through Linq when configured and allowed, otherwise uses the demo channel. */
export const sendNudge = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d: { kind: NudgeKind; mode?: "auto" | "demo" }) => {
    if (!NUDGES.includes(d?.kind)) throw new Error("Unknown reminder type.");
    return { kind: d.kind, mode: d.mode === "demo" ? ("demo" as const) : ("auto" as const) };
  })
  .handler(async ({ context, data }) => {
    const [{ sendNudgeFor }, store] = await Promise.all([
      import("./server/nudge.server"),
      import("./server/store.server"),
    ]);
    const profile = await store.getProfile(context.userId);
    if (!profile) throw new Error("Your profile could not be loaded.");
    return sendNudgeFor(profile, data.kind, data.mode);
  });
