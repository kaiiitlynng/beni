// Shared server-side persistence for the agent, nudges and the Linq webhook.
// Uses the service-role client, so every query here must be scoped by user_id.
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Tables } from "@/integrations/supabase/types";
import { isPendingActive, toE164, type PendingAction } from "../agent-rules";
import { isLinqConfigured, sendText } from "./linq.server";

export async function admin() {
  return (await import("@/integrations/supabase/client.server")).supabaseAdmin;
}

// `profiles.pending_action` and `webhook_events` come from the Lovable schema change described in
// AGENTS.md. Until types.ts is regenerated with them, they are reached through an untyped client.
async function untyped(): Promise<SupabaseClient> {
  return (await admin()) as unknown as SupabaseClient;
}

export type Profile = Tables<"profiles">;
export type Channel = "demo" | "sms" | "imessage";

export async function getProfile(userId: string): Promise<Profile | null> {
  const { data } = await (await admin()).from("profiles").select("*").eq("id", userId).single();
  return data ?? null;
}

/** Finds the profile whose stored phone number normalizes to the same E.164 number. */
export async function findProfileByPhone(phone: string): Promise<Profile | null> {
  const target = toE164(phone);
  if (!target) return null;
  const { data } = await (
    await admin()
  )
    .from("profiles")
    .select("*")
    .ilike("phone", `%${target.slice(-4)}`)
    .limit(50);
  const matches = (data ?? []).filter((p) => toE164(p.phone) === target);
  return matches.length === 1 ? matches[0]! : null;
}

export async function getPendingAction(userId: string): Promise<PendingAction | null> {
  const { data, error } = await (
    await untyped()
  )
    .from("profiles")
    .select("pending_action")
    .eq("id", userId)
    .single();
  if (error) {
    console.error(
      "[store] pending_action unavailable — has the Lovable schema change been applied?",
      error.message,
    );
    return null;
  }
  const action = (data as { pending_action: PendingAction | null } | null)?.pending_action ?? null;
  return isPendingActive(action) ? action : null;
}

export async function setPendingAction(
  userId: string,
  action: PendingAction | null,
): Promise<boolean> {
  const { error } = await (
    await untyped()
  )
    .from("profiles")
    .update({ pending_action: action })
    .eq("id", userId);
  if (error) console.error("[store] could not save pending_action", error.message);
  return !error;
}

/** Records a webhook event id. Returns false when it was already processed (Linq delivers at least once). */
export async function claimWebhookEvent(id: string): Promise<boolean> {
  const { error } = await (await untyped()).from("webhook_events").insert({ id });
  if (!error) return true;
  if (error.code === "23505") return false;
  throw new Error(`webhook_events unavailable: ${error.message}`);
}

export async function recordMessage(m: {
  userId: string;
  direction: "incoming" | "outgoing";
  body: string;
  channel: Channel;
  delivery_status: string;
}) {
  const { error } = await (
    await admin()
  )
    .from("messages")
    .insert({
      user_id: m.userId,
      direction: m.direction,
      body: m.body,
      channel: m.channel,
      delivery_status: m.delivery_status,
    });
  if (error) console.error("[store] message not recorded", error.message);
}

export function channelFromService(service: string | null | undefined): Channel {
  return service?.toLowerCase() === "imessage" ? "imessage" : "sms";
}

/**
 * Sends beni's outgoing text. Real texts go through Linq only with consent and a valid phone number;
 * otherwise (or when `mode` is 'demo') the message is stored on the clearly labeled demo channel.
 */
export async function deliver(opts: {
  profile: Profile;
  body: string;
  mode: "auto" | "demo";
  allowedToText: boolean;
  chatId?: string | null;
}): Promise<{ channel: Channel; delivery_status: string }> {
  const phone = toE164(opts.profile.phone);
  if (opts.mode === "auto" && opts.allowedToText && phone && isLinqConfigured()) {
    const sent = await sendText({ to: phone, body: opts.body, chatId: opts.chatId ?? null });
    const channel = sent.ok ? channelFromService(sent.service) : "sms";
    const delivery_status = sent.ok ? "sent" : "failed";
    await recordMessage({
      userId: opts.profile.id,
      direction: "outgoing",
      body: opts.body,
      channel,
      delivery_status,
    });
    return { channel, delivery_status };
  }
  await recordMessage({
    userId: opts.profile.id,
    direction: "outgoing",
    body: opts.body,
    channel: "demo",
    delivery_status: "demo",
  });
  return { channel: "demo", delivery_status: "demo" };
}
