// Changes to Google events Beni exported, shared by the /calendar page and the text agent.
// Only the verified owner of the linked calendar may write, and only to Beni-created events.
// Google is written first, then the local row, so a retry after a partial failure is safe.
import { z } from "zod";
import { canAccessLinkedCalendar } from "../calendar-access";
import {
  googleEventPatch,
  isEditableBeniGoogleEvent,
  type BeniEventChanges,
} from "../google-calendar-rules";
import { admin } from "./store.server";

/** True when this Beni user is the verified owner of the linked Google account. */
export async function isLinkedOwner(userId: string): Promise<boolean> {
  const { data, error } = await (await admin()).auth.admin.getUserById(userId);
  return !error && canAccessLinkedCalendar(data.user ?? null);
}

async function loadEditableEvent(userId: string, eventId: string) {
  if (!(await isLinkedOwner(userId)))
    throw new Error("This Google Calendar connection is private to its verified owner.");
  const { data: event, error } = await (
    await admin()
  )
    .from("calendar_events")
    .select("*")
    .eq("id", eventId)
    .eq("user_id", userId)
    .maybeSingle();
  if (error || !event || !isEditableBeniGoogleEvent(event))
    throw new Error("Beni can only change Google entries it added for you.");
  const path = `/calendars/${encodeURIComponent(event.google_calendar_id ?? "primary")}/events/${encodeURIComponent(event.google_event_id!)}`;
  return { event, path };
}

export async function updateBeniGoogleEvent(
  userId: string,
  eventId: string,
  changes: BeniEventChanges,
): Promise<{ url: string | null; starts_at: string; title: string }> {
  const { event, path } = await loadEditableEvent(userId, eventId);
  const built = googleEventPatch(event, changes);
  if (!built.ok) throw new Error(built.error);
  const { googleCall } = await import("../google-calendar.server");
  await googleCall(path, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(built.patch),
  });
  const read = await googleCall(path);
  const verified = z.object({ htmlLink: z.string().optional() }).parse(await read.json());
  const saved = await (
    await admin()
  )
    .from("calendar_events")
    .update(built.local)
    .eq("id", event.id)
    .eq("user_id", userId);
  if (saved.error)
    throw new Error(
      "Google was updated, but Beni could not save the change. Retry safely to sync it.",
    );
  return {
    url: verified.htmlLink ?? null,
    starts_at: built.local.starts_at ?? event.starts_at,
    title: built.local.title ?? event.title,
  };
}

export async function deleteBeniGoogleEvent(userId: string, eventId: string): Promise<void> {
  const { event, path } = await loadEditableEvent(userId, eventId);
  const { googleCall } = await import("../google-calendar.server");
  // 404/410 mean the Google event is already gone, which is the outcome we want.
  await googleCall(path, { method: "DELETE" }, [404, 410]);
  const removed = await (
    await admin()
  )
    .from("calendar_events")
    .delete()
    .eq("id", event.id)
    .eq("user_id", userId);
  if (removed.error)
    throw new Error(
      "The Google entry was removed, but Beni could not remove its copy. Retry safely.",
    );
}
