// send-nudge: proactive texts grounded in documented benefits and recorded usage.
// Facts are chosen in code; Claude only phrases them. No scheduler: these run when triggered.
import { claude, FALLBACK, isClaudeConfigured, MODEL } from "./claude.server";
import { admin, deliver, setPendingAction, type Profile } from "./store.server";
import { isSensitiveBenefit, mayTextNudge, type NudgeKind } from "../agent-rules";
import { confirmedUsage } from "../beni";
import { currentBenefits } from '../insurance-rules';

type Facts = { kind: NudgeKind; template: string; facts: Record<string, unknown> };

async function gatherFacts(profile: Profile, kind: NudgeKind): Promise<Facts | { skip: string }> {
  const db = await admin();
  const name = profile.first_name || "there";
  if (kind === "welcome") {
    return {
      kind,
      template: `hey ${name}! 🌱 welcome to beni — your care has a new home. text me anytime with questions about your coverage, or to plan care around your schedule.`,
      facts: {},
    };
  }

  const [benefitsRes, visitsRes, eventsRes] = await Promise.all([
    db.from("benefits").select("*").eq("user_id", profile.id),
    db.from("visits").select("*").eq("user_id", profile.id),
    db
      .from("calendar_events")
      .select("*")
      .eq("user_id", profile.id)
      .eq("kind", "healthcare")
      .order("starts_at"),
  ]);
  const { data: active } = await db.from('plans_uploaded').select('id').eq('user_id',profile.id).eq('is_active',true).eq('status','ready').maybeSingle();
  const benefits = currentBenefits(benefitsRes.data ?? [], active?.id);
  const visits = visitsRes.data ?? [];
  const events = eventsRes.data ?? [];

  // Unsolicited texts name only covered, non-sensitive benefits that still have documented room to use.
  const unused = benefits
    .filter((b) => b.coverage_status === "covered" && !isSensitiveBenefit(b))
    .map((b) => ({ b, used: confirmedUsage(visits, b.id) }))
    .filter(({ b, used }) => (b.visit_limit ? used < b.visit_limit : used === 0))
    .sort(
      (x, y) =>
        Number(y.b.hidden_perk) - Number(x.b.hidden_perk) ||
        (y.b.visit_limit ?? 0) - (x.b.visit_limit ?? 0),
    );
  const pick = unused[0];
  const benefitFacts = pick && {
    benefit: pick.b.name,
    used: pick.used,
    visit_limit: pick.b.visit_limit,
    page: pick.b.source_page,
  };

  if (kind === "school_break") {
    if (!profile.break_start) return { skip: "No school break dates are saved yet." };
    return {
      kind,
      template: `hey ${name}! 🌱 your break starts ${profile.break_start}. want help making a little room for your care while you're home?`,
      facts: {
        break_start: profile.break_start,
        break_end: profile.break_end,
        home_city: profile.home_city,
        ...benefitFacts,
      },
    };
  }
  if (kind === "unused_benefit") {
    if (!pick)
      return { skip: "No documented, unused benefit to suggest yet. Upload a plan first." };
    return {
      kind,
      template: `did you know? your plan lists ${pick.b.name}. want me to explain what it costs and help you plan a visit?`,
      facts: benefitFacts!,
    };
  }
  const now = Date.now();
  if (kind === "appointment") {
    const next = events.find((e) => new Date(e.starts_at).getTime() > now);
    if (!next) return { skip: "No upcoming healthcare appointment or hold is on the calendar." };
    return {
      kind,
      template: `hey ${name}! a reminder that ${next.title} is on your calendar for ${new Date(next.starts_at).toLocaleDateString("en-US", { timeZone: profile.timezone, weekday: "short", month: "short", day: "numeric" })}.`,
      facts: {
        title: next.title,
        starts_at: next.starts_at,
        status: next.status,
        is_tentative_hold: next.status === "hold",
      },
    };
  }
  // checkin: the most recent past healthcare event in the last two weeks.
  const past = [...events].reverse().find((e) => {
    const t = new Date(e.starts_at).getTime();
    return t < now && t > now - 14 * 864e5;
  });
  if (!past) return { skip: "No healthcare event in the last two weeks to check in about." };
  const day = past.starts_at.slice(0, 10);
  const linkedBenefit = benefits.find((b) => b.id === past.benefit_id);
  // Sensitive visits get a generic check-in.
  const label =
    linkedBenefit && isSensitiveBenefit(linkedBenefit)
      ? "your appointment"
      : past.title.replace(/\s*\(tentative\)\s*/i, "");
  await setPendingAction(profile.id, {
    type: "visit_log",
    benefit_id: past.benefit_id,
    visit_date: day,
    label,
    created_at: new Date().toISOString(),
  });
  return {
    kind,
    template: `hey ${name}! did you end up going to ${label}? reply yes and i'll log it in your benefits tracker.`,
    facts: { label, date: day },
  };
}

async function phrase(f: Facts, profile: Profile): Promise<string> {
  if (f.kind === "welcome" || f.kind === "checkin" || !isClaudeConfigured()) return f.template;
  try {
    const res = await claude().beta.messages.create({
      model: MODEL,
      max_tokens: 1000,
      ...FALLBACK,
      betas: [...FALLBACK.betas],
      output_config: { effort: "low" },
      system:
        "you write one proactive text from beni, a friendly health insurance assistant for students. lowercase, warm, under 240 characters, at most one emoji, end with a simple question. use only the facts given; never add coverage, costs, dates or medical advice that are not in the facts. no diagnoses, no sensitive health details. if a hold is tentative, do not call it booked. reply with the text only.",
      messages: [
        {
          role: "user",
          content: `kind: ${f.kind}\nfirst name: ${profile.first_name || "there"}\nfacts: ${JSON.stringify(f.facts)}\nfallback wording: ${f.template}`,
        },
      ],
    });
    const text =
      res.stop_reason === "end_turn"
        ? res.content
            .flatMap((b) => (b.type === "text" ? [b.text] : []))
            .join(" ")
            .trim()
        : "";
    return text && text.length <= 400 ? text : f.template;
  } catch (e) {
    console.error("[nudge] phrasing failed, using template", e);
    return f.template;
  }
}

export async function sendNudgeFor(profile: Profile, kind: NudgeKind, mode: "auto" | "demo") {
  const facts = await gatherFacts(profile, kind);
  if ("skip" in facts) return { sent: false as const, reason: facts.skip };
  const body = await phrase(facts, profile);
  const result = await deliver({ profile, body, mode, allowedToText: mayTextNudge(profile, kind) });
  return { sent: true as const, body, ...result };
}
