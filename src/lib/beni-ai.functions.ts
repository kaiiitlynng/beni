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

/**
 * Connection check for the /demo page. Reports which pieces are in place without revealing secret values,
 * and the exact webhook URL to register with Linq.
 */
export const linqConnectionStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const [{ getRequest }, linq, store, rules, { isClaudeConfigured }] = await Promise.all([
      import("@tanstack/react-start/server"),
      import("./server/linq.server"),
      import("./server/store.server"),
      import("./agent-rules"),
      import("./server/claude.server"),
    ]);
    const origin = new URL(getRequest().url).origin;
    const webhookUrl = `${origin}/api/public/linq-webhook?version=2026-02-03`;
    const profile = await store.getProfile(context.userId);
    const yourPhone = rules.toE164(profile?.linq_verified_phone) ?? rules.toE164(profile?.phone);
    const [account, lastWebhookAt, owner, schemaReady] = await Promise.all([
      linq.checkLinqAccount(webhookUrl),
      store.lastWebhookReceipt(),
      yourPhone ? store.findProfileByPhone(yourPhone) : Promise.resolve(null),
      store.hasPendingActionColumn(),
    ]);
    return {
      secrets: {
        LINQ_API_TOKEN: Boolean(process.env["LINQ_API_TOKEN"]),
        LINQ_FROM_NUMBER: Boolean(linq.linqNumber()),
        LINQ_WEBHOOK_SECRET: Boolean(process.env["LINQ_WEBHOOK_SECRET"]),
        ANTHROPIC_API_KEY: isClaudeConfigured(),
      },
      beniNumber: linq.linqNumber(),
      webhookUrl,
      isPreviewOrigin: /id-preview|lovableproject|localhost/.test(origin),
      account,
      lastWebhookAt,
      you: {
        phone: yourPhone,
        consent: Boolean(profile?.sms_consent),
        // A reply can only be routed when exactly this profile owns the number.
        phoneRoutesToYou: Boolean(owner && owner.id === context.userId),
      },
      confirmationsReady: schemaReady,
    };
  });

/** Sends a one-off test text to the signed-in user's own number through Linq. */
export const sendLinqTestText = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const [linq, store, rules] = await Promise.all([
      import("./server/linq.server"),
      import("./server/store.server"),
      import("./agent-rules"),
    ]);
    const profile = await store.getProfile(context.userId);
    if (!profile) throw new Error("Your profile could not be loaded.");
    const to = rules.toE164(profile.linq_verified_phone) ?? rules.toE164(profile.phone);
    if (!to) return { ok: false as const, error: "Add a valid phone number in settings first." };
    if (!profile.sms_consent)
      return { ok: false as const, error: "Turn on text consent in settings first." };
    if (!linq.isLinqConfigured())
      return {
        ok: false as const,
        error: "LINQ_API_TOKEN and LINQ_FROM_NUMBER must be set in Lovable Secrets.",
      };
    const body =
      "beni connection test ✓ now text me a question, like “does my plan cover vision?”, to test replies.";
    const sent = await linq.sendText({ to, body });
    await store.recordMessage({
      userId: profile.id,
      direction: "outgoing",
      body,
      channel: sent.ok ? store.channelFromService(sent.service) : "sms",
      delivery_status: sent.ok ? "sent" : "failed",
    });
    return sent.ok ? { ok: true as const, to } : { ok: false as const, error: sent.error };
  });
