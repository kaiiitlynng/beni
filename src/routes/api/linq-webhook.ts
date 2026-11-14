// linq-webhook: verifies Linq's Standard Webhooks signature, de-duplicates, and routes inbound texts to the agent.
// Register https://<app>/api/linq-webhook?version=2026-02-03 for `message.received` in Linq.
import { createFileRoute } from "@tanstack/react-router";

async function processInbound(rawBody: string) {
  const [{ parseInbound, sendText }, store, { handleIncoming }, rules] = await Promise.all([
    import("@/lib/server/linq.server"),
    import("@/lib/server/store.server"),
    import("@/lib/server/agent.server"),
    import("@/lib/agent-rules"),
  ]);
  const inbound = parseInbound(JSON.parse(rawBody));
  if (!inbound) return;
  if (!(await store.claimWebhookEvent(inbound.eventId))) return;

  const profile = await store.findProfileByPhone(inbound.from);
  if (!profile) return; // Unknown numbers get no reply and nothing is stored.
  const channel = store.channelFromService(inbound.service);

  const keyword = rules.smsKeyword(inbound.text);
  if (keyword) {
    const db = await store.admin();
    await db
      .from("profiles")
      .update({ sms_consent: keyword === "start" })
      .eq("id", profile.id);
    await store.recordMessage({
      userId: profile.id,
      direction: "incoming",
      body: inbound.text,
      channel,
      delivery_status: "received",
    });
    const body =
      keyword === "stop"
        ? "you’re unsubscribed from beni texts. reply START to turn them back on."
        : "welcome back! beni texts are on again. 🌱";
    const sent = await sendText({ to: inbound.from, body, chatId: inbound.chatId });
    await store.recordMessage({
      userId: profile.id,
      direction: "outgoing",
      body,
      channel,
      delivery_status: sent.ok ? "sent" : "failed",
    });
    return;
  }
  if (!profile.sms_consent) return; // No conversation without opt-in.

  const reply = await handleIncoming({ profile, text: inbound.text, channel });
  const sent = await sendText({ to: inbound.from, body: reply, chatId: inbound.chatId });
  await store.recordMessage({
    userId: profile.id,
    direction: "outgoing",
    body: reply,
    channel,
    delivery_status: sent.ok ? "sent" : "failed",
  });
}

export const Route = createFileRoute("/api/linq-webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const secret = process.env["LINQ_WEBHOOK_SECRET"];
        if (!secret) return new Response("Server configuration error", { status: 500 });
        const rawBody = await request.text();
        const { verifyLinqSignature } = await import("@/lib/server/linq.server");
        const valid = await verifyLinqSignature({
          secret,
          rawBody,
          id: request.headers.get("webhook-id"),
          timestamp: request.headers.get("webhook-timestamp"),
          signature: request.headers.get("webhook-signature"),
        });
        if (!valid) return new Response("Invalid signature", { status: 401 });

        const work = processInbound(rawBody).catch((e) => console.error("[linq-webhook]", e));
        // Linq expects a reply within 10 seconds; finish in the background where the runtime allows it.
        const waitUntil = (request as Request & { waitUntil?: (p: Promise<unknown>) => void })
          .waitUntil;
        if (typeof waitUntil === "function") waitUntil.call(request, work);
        else await work;
        return new Response("ok", { status: 200 });
      },
    },
  },
});
