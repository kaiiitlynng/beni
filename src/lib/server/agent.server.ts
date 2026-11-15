// agent: one code path for texts arriving through Linq and for the /demo web-chat fallback.
// Answers come only from the user's stored plan data; writes happen only after an explicit "yes".
import * as z from "zod/v4";
import type Anthropic from "@anthropic-ai/sdk";
import { betaZodTool } from "@anthropic-ai/sdk/helpers/beta/zod";
import { claude, FALLBACK, isClaudeConfigured, MODEL } from "./claude.server";
import {
  admin,
  getPendingAction,
  recordMessage,
  setPendingAction,
  type Channel,
  type Profile,
} from "./store.server";
import { createCalendarHold, logConfirmedVisit } from "./care.server";
import {
  deleteBeniGoogleEvent,
  isLinkedOwner,
  updateBeniGoogleEvent,
} from "./google-event-sync.server";
import { googleEventPatch, isEditableBeniGoogleEvent } from "../google-calendar-rules";
import { parseConfirmation, type PendingAction } from "../agent-rules";
import { confirmedUsage } from "../beni";
import { activeInsurance, currentBenefits } from "../insurance-rules";

const SYSTEM = `you are beni, a warm, text-first health insurance assistant for college students and young adults. you are texting the user over imessage/sms.

voice: lowercase, friendly, brief. one to three short sentences, at most about 320 characters. an occasional emoji like 🌱 is fine. no markdown, no bullet lists.

what you can do:
- answer questions about the user's own coverage using only the plan data in the context below.
- point out documented benefits they haven't used yet.
- help plan care around their school breaks and availability, share providers on file (with contact or booking link), and propose a tentative calendar hold.
- after a visit, ask whether they went and offer to log it.

hard rules:
- never invent coverage, costs, limits, providers or network status. if the plan data doesn't say, say you can't confirm it from their plan and suggest checking with the insurer.
- when you state coverage, include the source page, like "(p. 4)".
- "coverage unclear" means unclear: say so.
- never say an appointment is booked. you can only propose a tentative hold; the user books with the provider.
- a provider is in-network only if it is marked network_verified. otherwise say network status isn't verified.
- don't recommend treatments or diagnose from symptoms. for urgent symptoms, tell them to contact a clinician or call 911.
- don't assume cosmetic services are covered.
- to save anything (calendar hold or visit), call the matching propose_ tool, then ask the user to reply yes or no. never claim something is saved before they confirm.
- you can move, edit or delete a calendar entry only if it is marked in_google: true, and only by calling propose_google_event_change or propose_google_event_delete, then asking yes or no. you cannot change any other google calendar events; say so if asked. changing a calendar entry never reschedules or cancels anything with the provider.
- if they ask for something outside insurance and care planning, gently steer back.`;

type Db = Awaited<ReturnType<typeof admin>>;

async function loadContext(db: Db, profile: Profile) {
  const userId = profile.id;
  const [plans, benefits, visits, events, providers, history] = await Promise.all([
    db
      .from("plans_uploaded")
      .select("*")
      .eq("user_id", userId)
      .eq("is_active", true)
      .order("created_at", { ascending: false })
      .limit(1),
    db.from("benefits").select("*").eq("user_id", userId),
    db
      .from("visits")
      .select("*")
      .eq("user_id", userId)
      .order("visit_date", { ascending: false })
      .limit(30),
    db
      .from("calendar_events")
      .select("*")
      .eq("user_id", userId)
      .gte("starts_at", new Date(Date.now() - 14 * 864e5).toISOString())
      .order("starts_at")
      .limit(20),
    db.from("providers").select("*").eq("user_id", userId).limit(30),
    db
      .from("messages")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(20),
  ]);
  return {
    plan: plans.data?.[0] ?? null,
    benefits: currentBenefits(benefits.data ?? [], activeInsurance(plans.data ?? [])?.id),
    visits: visits.data ?? [],
    events: events.data ?? [],
    providers: providers.data ?? [],
    history: (history.data ?? []).reverse(),
    /** Whether this user may change Beni-created Google events (verified owner of the linked calendar). */
    googleEditable: false,
  };
}

type Ctx = Awaited<ReturnType<typeof loadContext>>;

function contextText(profile: Profile, ctx: Ctx, pending: PendingAction | null): string {
  const today = new Date().toLocaleDateString("en-US", {
    timeZone: profile.timezone || "America/Los_Angeles",
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  const benefits = ctx.benefits.map((b) => ({
    id: b.id,
    name: b.name,
    category: b.category,
    coverage: b.coverage_status,
    cost: b.cost,
    visit_limit: b.visit_limit,
    used: confirmedUsage(ctx.visits, b.id),
    restrictions: b.restrictions,
    page: b.source_page,
    hidden_perk: b.hidden_perk,
  }));
  return JSON.stringify({
    today,
    user: {
      first_name: profile.first_name,
      school_or_work: profile.organization,
      current_city: profile.current_city,
      home_city: profile.home_city,
      school_break: profile.break_start
        ? { start: profile.break_start, end: profile.break_end }
        : null,
      availability: profile.availability,
      interests: profile.interests,
      timezone: profile.timezone,
    },
    plan: ctx.plan
      ? {
          status: ctx.plan.status,
          provider: ctx.plan.provider,
          name: ctx.plan.plan_name,
          type: ctx.plan.plan_type,
          deductible: ctx.plan.deductible,
          out_of_pocket_max: ctx.plan.out_of_pocket_max,
          effective: [ctx.plan.effective_start, ctx.plan.effective_end],
        }
      : "no plan uploaded yet",
    benefits: benefits.length
      ? benefits
      : "no benefits extracted yet — you cannot confirm any coverage",
    confirmed_visits: ctx.visits
      .filter((v) => v.confirmed)
      .map((v) => ({ date: v.visit_date, benefit_id: v.benefit_id })),
    calendar: ctx.events.map((e) => ({
      id: e.id,
      in_google: ctx.googleEditable && isEditableBeniGoogleEvent(e),
      ends_at: e.ends_at,
      title: e.title,
      starts_at: e.starts_at,
      kind: e.kind,
      status: e.status,
      location: e.location,
    })),
    providers_on_file: ctx.providers.map((p) => ({
      name: p.name,
      city: p.city,
      contact: p.contact,
      booking_url: p.booking_url,
      network_verified: p.network_verified,
    })),
    awaiting_yes_no: pending,
  });
}

function toMessages(ctx: Ctx, text: string): Anthropic.Beta.BetaMessageParam[] {
  const msgs: Anthropic.Beta.BetaMessageParam[] = ctx.history.map((m) => ({
    role: m.direction === "incoming" ? "user" : "assistant",
    content: m.body,
  }));
  while (msgs.length && msgs[0]!.role !== "user") msgs.shift();
  msgs.push({ role: "user", content: text });
  return msgs;
}

function tools(profile: Profile, ctx: Ctx) {
  const userId = profile.id;
  const benefitIds = new Set(ctx.benefits.map((b) => b.id));
  const editable = (id: string) =>
    ctx.googleEditable
      ? ctx.events.find((e) => e.id === id && isEditableBeniGoogleEvent(e))
      : undefined;
  const googleTools = ctx.googleEditable
    ? [
        betaZodTool({
          name: "propose_google_event_change",
          description:
            "Stage a change to a calendar entry marked in_google: true (move it, or edit its title, location or notes). Nothing changes until the user replies yes. Only include fields that change.",
          inputSchema: z.object({
            event_id: z.string().describe("id of the calendar entry from context"),
            title: z.string().nullable().describe("new title, or null to keep"),
            starts_at: z
              .string()
              .nullable()
              .describe("new ISO 8601 start with timezone offset, or null to keep"),
            ends_at: z
              .string()
              .nullable()
              .describe("new ISO 8601 end, or null to keep the current duration"),
            location: z.string().nullable().describe("new location, or null to keep"),
            notes: z.string().nullable().describe("new notes, or null to keep"),
          }),
          run: async (a) => {
            const event = editable(a.event_id);
            if (!event)
              return "that entry can't be changed: only entries marked in_google can be. tell the user.";
            const changes: Extract<PendingAction, { type: "google_event_update" }>["changes"] = {};
            if (a.title) changes.title = a.title;
            if (a.starts_at) changes.starts_at = a.starts_at;
            if (a.ends_at) changes.ends_at = a.ends_at;
            if (a.location) changes.location = a.location;
            if (a.notes) changes.notes = a.notes;
            const built = googleEventPatch(event, changes);
            if (!built.ok)
              return `can't stage this change: ${built.error.toLowerCase()} ask the user to clarify.`;
            const ok = await setPendingAction(userId, {
              type: "google_event_update",
              event_id: event.id,
              title_before: event.title,
              changes: built.local,
              created_at: new Date().toISOString(),
            });
            return ok
              ? "staged. now ask the user to reply yes to update it in their google calendar, or no to leave it."
              : "could not stage the change; tell the user to edit it on the calendar page.";
          },
        }),
        betaZodTool({
          name: "propose_google_event_delete",
          description:
            "Stage deleting a calendar entry marked in_google: true from google calendar and beni. Nothing changes until the user replies yes.",
          inputSchema: z.object({
            event_id: z.string().describe("id of the calendar entry from context"),
          }),
          run: async (a) => {
            const event = editable(a.event_id);
            if (!event)
              return "that entry can't be deleted: only entries marked in_google can be. tell the user.";
            const ok = await setPendingAction(userId, {
              type: "google_event_delete",
              event_id: event.id,
              title: event.title,
              starts_at: event.starts_at,
              created_at: new Date().toISOString(),
            });
            return ok
              ? "staged. now ask the user to reply yes to delete it from google calendar and beni, or no to keep it."
              : "could not stage the deletion; tell the user to delete it on the calendar page.";
          },
        }),
      ]
    : [];
  return [
    ...googleTools,
    betaZodTool({
      name: "propose_calendar_hold",
      description:
        "Stage a tentative calendar hold for planned care. Nothing is saved until the user replies yes. Use only after agreeing on a date and time.",
      inputSchema: z.object({
        title: z.string().describe('e.g. "dental cleaning (tentative)"'),
        starts_at: z.string().describe("ISO 8601 start time with timezone offset"),
        ends_at: z.string().nullable().describe("ISO 8601 end time, or null"),
        location: z.string().nullable(),
        notes: z.string().nullable(),
        benefit_id: z
          .string()
          .nullable()
          .describe("id of the related benefit from context, or null"),
      }),
      run: async (a) => {
        if (Number.isNaN(Date.parse(a.starts_at)))
          return "invalid starts_at; ask the user for a specific date and time.";
        const ok = await setPendingAction(userId, {
          type: "calendar_hold",
          title: a.title,
          starts_at: new Date(a.starts_at).toISOString(),
          ends_at:
            a.ends_at && !Number.isNaN(Date.parse(a.ends_at))
              ? new Date(a.ends_at).toISOString()
              : null,
          location: a.location,
          notes: a.notes,
          benefit_id: a.benefit_id && benefitIds.has(a.benefit_id) ? a.benefit_id : null,
          created_at: new Date().toISOString(),
        });
        return ok
          ? "staged. now ask the user to reply yes to add the tentative hold, or no to skip."
          : "could not stage the hold right now; tell the user you can’t save holds by text yet.";
      },
    }),
    betaZodTool({
      name: "propose_visit_log",
      description:
        "Stage logging a visit the user says they attended, so the benefits tracker updates. Nothing is saved until the user replies yes.",
      inputSchema: z.object({
        visit_date: z.string().describe("YYYY-MM-DD"),
        benefit_id: z
          .string()
          .nullable()
          .describe("id of the matching benefit from context, or null"),
        label: z.string().describe('short description, e.g. "dental cleaning"'),
      }),
      run: async (a) => {
        if (!/^\d{4}-\d{2}-\d{2}$/.test(a.visit_date))
          return "invalid visit_date; ask the user which day they went.";
        const ok = await setPendingAction(userId, {
          type: "visit_log",
          visit_date: a.visit_date,
          benefit_id: a.benefit_id && benefitIds.has(a.benefit_id) ? a.benefit_id : null,
          label: a.label,
          created_at: new Date().toISOString(),
        });
        return ok
          ? "staged. now ask the user to reply yes to log it, or no to skip."
          : "could not stage the visit right now; tell the user to log it on the my care page.";
      },
    }),
  ];
}

function describeDate(iso: string, tz: string) {
  return new Date(iso)
    .toLocaleString("en-US", {
      timeZone: tz,
      weekday: "short",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    })
    .toLowerCase();
}

/** Executes or drops a pending proposal when the reply is a clear yes/no. Returns beni's reply, or null to fall through to the model. */
async function resolvePending(
  profile: Profile,
  pending: PendingAction | null,
  text: string,
): Promise<string | null> {
  if (!pending) return null;
  const answer = parseConfirmation(text);
  if (!answer) return null;
  await setPendingAction(profile.id, null);
  if (answer === "no")
    return pending.type === "visit_log"
      ? "no problem — i won’t log anything. 🌱"
      : pending.type === "calendar_hold"
        ? "no problem, i won’t add it. want to look at another time?"
        : "okay, i’ll leave it as it is. 🌱";
  const tz = profile.timezone || "America/Los_Angeles";
  if (pending.type === "google_event_update") {
    try {
      const r = await updateBeniGoogleEvent(profile.id, pending.event_id, pending.changes);
      return pending.changes.starts_at
        ? `done! ${r.title} is now ${describeDate(r.starts_at, tz)} in your google calendar. this doesn’t change anything with the provider, so let them know too.`
        : `done! i updated ${r.title} in your google calendar.`;
    } catch (e) {
      console.error("[agent] google update failed", e);
      return "sorry, i couldn’t update that in google calendar. try again in a bit, or edit it on your calendar page.";
    }
  }
  if (pending.type === "google_event_delete") {
    try {
      await deleteBeniGoogleEvent(profile.id, pending.event_id);
      return `done, i removed ${pending.title} from your google calendar and beni. if it was booked with a provider, remember to cancel with them too.`;
    } catch (e) {
      console.error("[agent] google delete failed", e);
      return "sorry, i couldn’t delete that from google calendar. try again in a bit, or remove it on your calendar page.";
    }
  }
  if (pending.type === "calendar_hold") {
    await createCalendarHold(profile.id, pending);
    return `done! i added a tentative hold for ${pending.title} on ${describeDate(pending.starts_at, tz)}. it’s not booked until the provider confirms — you can see it on your calendar.`;
  }
  await logConfirmedVisit(profile.id, pending);
  return "perfect! i’ve logged it in your benefits tracker. ✨";
}

async function generateReply(
  profile: Profile,
  ctx: Ctx,
  pending: PendingAction | null,
  text: string,
): Promise<string> {
  if (!isClaudeConfigured())
    return "beni’s assistant isn’t connected yet, so i can’t answer questions right now. your benefits are on your dashboard.";
  const runner = claude().beta.messages.toolRunner({
    model: MODEL,
    max_tokens: 4000,
    max_iterations: 4,
    thread: false,
    ...FALLBACK,
    betas: [...FALLBACK.betas],
    output_config: { effort: "low" },
    system: [
      { type: "text", text: SYSTEM, cache_control: { type: "ephemeral" } },
      {
        type: "text",
        text: `context (the only source of truth about this user):\n${contextText(profile, ctx, pending)}`,
      },
    ],
    messages: toMessages(ctx, text),
    tools: tools(profile, ctx),
  });
  const final = await runner.runUntilDone();
  if (final.stop_reason === "refusal")
    return "sorry, i can’t help with that one. i’m here for questions about your coverage and planning care.";
  const reply = final.content
    .filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === "text")
    .map((b) => b.text)
    .join(" ")
    .trim();
  return reply || "sorry, i lost my train of thought — could you say that again?";
}

/**
 * Handles one incoming message: stores it, resolves a pending yes/no or asks Claude, and returns beni's reply.
 * The caller delivers and records the reply (Linq for texts, the demo channel for the web fallback).
 */
export async function handleIncoming(opts: {
  profile: Profile;
  text: string;
  channel: Channel;
}): Promise<string> {
  const { profile, text, channel } = opts;
  const db = await admin();
  const [ctx, pending, owner] = await Promise.all([
    loadContext(db, profile),
    getPendingAction(profile.id),
    isLinkedOwner(profile.id).catch(() => false),
  ]);
  ctx.googleEditable = owner;
  await recordMessage({
    userId: profile.id,
    direction: "incoming",
    body: text,
    channel,
    delivery_status: channel === "demo" ? "demo" : "received",
  });
  try {
    return (
      (await resolvePending(profile, pending, text)) ??
      (await generateReply(profile, ctx, pending, text))
    );
  } catch (e) {
    console.error("[agent]", e);
    return "sorry, something went wrong on my end. please try again in a moment.";
  }
}
