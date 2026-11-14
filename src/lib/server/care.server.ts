// calendar-hold + visit logging, run only after the user said yes to a specific proposal.
// Mirrors createHold / addVisit in benefits.functions.ts, which do the same from the web UI.
import { admin } from "./store.server";
import type { PendingAction } from "../agent-rules";

/** Saves a tentative hold. A hold is never a booked appointment (see isBooked in lib/hub.ts). */
export async function createCalendarHold(
  userId: string,
  a: Extract<PendingAction, { type: "calendar_hold" }>,
) {
  const { error } = await (await admin()).from("calendar_events").insert({
    user_id: userId,
    title: a.title,
    starts_at: a.starts_at,
    ends_at: a.ends_at ?? null,
    kind: "healthcare",
    location: a.location ?? null,
    notes: a.notes ?? null,
    benefit_id: a.benefit_id ?? null,
    status: "hold",
    user_confirmed: false,
  });
  if (error) throw new Error(`calendar hold not saved: ${error.message}`);
}

/** Logs a visit the user confirmed they attended; this is what moves the benefits tracker. */
export async function logConfirmedVisit(
  userId: string,
  a: Extract<PendingAction, { type: "visit_log" }>,
) {
  const db = await admin();
  let benefitId = a.benefit_id;
  if (benefitId) {
    const { data } = await db
      .from("benefits")
      .select("id")
      .eq("id", benefitId)
      .eq("user_id", userId)
      .maybeSingle();
    if (!data) benefitId = null;
  }
  const { error } = await db
    .from("visits")
    .insert({ user_id: userId, benefit_id: benefitId, visit_date: a.visit_date, confirmed: true });
  if (error) throw new Error(`visit not saved: ${error.message}`);
}
