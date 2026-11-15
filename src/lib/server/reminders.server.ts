// Sends due reminders. Service-role client: every write is scoped by reminder id and user_id.
import { admin, deliver, getProfile } from "./store.server";
import { advanceAfterSend, textDecision } from "../reminder-rules";

export async function processDueReminders(now = new Date()) {
  const db = await admin();
  const stale = new Date(now.getTime() - 10 * 60000).toISOString();
  const { data: due, error } = await db.from("reminders").select("*")
    .eq("status", "open").eq("paused", false).lte("remind_at", now.toISOString())
    .or(`sending_at.is.null,sending_at.lt.${stale}`).limit(50);
  if (error) throw new Error(error.message);
  const results: { id: string; outcome: string }[] = [];
  for (const r of due ?? []) {
    // Claim atomically so overlapping runs never send twice.
    const { data: claimed } = await db.from("reminders").update({ sending_at: now.toISOString() })
      .eq("id", r.id).eq("remind_at", r.remind_at!).eq("status", "open")
      .or(`sending_at.is.null,sending_at.lt.${stale}`).select("id");
    if (!claimed?.length) continue;
    const profile = await getProfile(r.user_id);
    if (!profile) { await db.from("reminders").update({ sending_at: null }).eq("id", r.id); continue; }
    const decision = textDecision(profile, r.method, now);
    if (decision === "wait") {
      await db.from("reminders").update({ sending_at: null }).eq("id", r.id);
      results.push({ id: r.id, outcome: "waiting for preferred hours" });
      continue;
    }
    let status = "in_app";
    if (decision === "text") {
      const sent = await deliver({ profile, body: `beni reminder: ${r.title}. reply here if you'd like help planning it.`, mode: "auto", allowedToText: true });
      status = sent.delivery_status;
    }
    const next = advanceAfterSend({ remind_at: r.remind_at!, frequency: r.frequency, interval_days: r.interval_days, end_date: r.end_date }, now);
    await db.from("reminders").update({ ...next, last_sent_at: now.toISOString(), delivery_status: status, sending_at: null })
      .eq("id", r.id).eq("user_id", r.user_id);
    results.push({ id: r.id, outcome: status });
  }
  return results;
}
