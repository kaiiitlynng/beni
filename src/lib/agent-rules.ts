// Pure rules shared by the text agent, nudges, extraction and the Linq webhook.
// Kept free of server imports so they can be unit-tested.

/** Normalizes a US-style or international phone number to E.164, or null if it can't. */
export function toE164(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  const digits = trimmed.replace(/\D/g, "");
  if (trimmed.startsWith("+"))
    return digits.length >= 8 && digits.length <= 15 ? `+${digits}` : null;
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  return null;
}

export type Confirmation = "yes" | "no" | null;

const YES =
  /^(y|ya|yah|yea|yeah|yes|yep|yup|sure|ok|okay|k|confirm|confirmed|please do|do it|sounds good|perfect|i did|i went|absolutely|of course)\b/;
const NO =
  /^(n|no|nope|nah|not yet|don'?t|do not|cancel|stop|never ?mind|i didn'?t|i did not|skip)\b/;

/** Reads a short reply as a yes/no to a pending proposal. Anything else is null (not a confirmation). */
export function parseConfirmation(text: string): Confirmation {
  const t = text
    .trim()
    .toLowerCase()
    .replace(/[!.?,\s]+$/g, "")
    .replace(/^[^a-z]+/, "");
  if (!t || t.length > 60) return null;
  if (NO.test(t)) return "no";
  if (YES.test(t)) return "yes";
  return null;
}

/** Carrier-style opt-out / opt-in keywords. */
export function smsKeyword(text: string): "stop" | "start" | null {
  const t = text.trim().toUpperCase();
  if (["STOP", "STOPALL", "UNSUBSCRIBE", "CANCEL", "END", "QUIT"].includes(t)) return "stop";
  if (["START", "UNSTOP", "YES SUBSCRIBE"].includes(t)) return "start";
  return null;
}

export type NudgeKind = "welcome" | "school_break" | "unused_benefit" | "appointment" | "checkin";

type NotifyPrefs = {
  sms_consent: boolean;
  notify_sms: boolean;
  notify_appointments: boolean;
  notify_benefits: boolean;
  notify_checkins: boolean;
};

/** Whether a real text of this kind may be sent. The welcome text only needs consent. */
export function mayTextNudge(p: NotifyPrefs, kind: NudgeKind): boolean {
  if (!p.sms_consent) return false;
  if (kind === "welcome") return true;
  if (!p.notify_sms) return false;
  if (kind === "appointment") return p.notify_appointments;
  if (kind === "checkin") return p.notify_checkins;
  return p.notify_benefits;
}

/** Categories never named in unsolicited texts, since they can reveal sensitive health information. */
const SENSITIVE = [
  "mental",
  "behavioral",
  "therapy",
  "psych",
  "substance",
  "reproductive",
  "sexual",
  "hiv",
  "cosmetic",
  "reconstructive",
  "dermatology",
];

export function isSensitiveBenefit(b: { name: string; category: string }): boolean {
  const s = `${b.name} ${b.category}`.toLowerCase();
  return SENSITIVE.some((w) => s.includes(w));
}

export const BENEFIT_CATEGORIES = [
  "medical",
  "dental",
  "vision",
  "mental health",
  "physical therapy",
  "alternative care",
  "dermatology",
  "other",
] as const;

export type ExtractedBenefit = {
  name: string;
  category: string;
  coverage_status: "covered" | "not covered" | "coverage unclear";
  cost: string | null;
  visit_limit: number | null;
  annual_limit: string | null;
  network_restrictions: string | null;
  prior_authorization: string | null;
  restrictions: string | null;
  source_page: number;
  description: string | null;
  hidden_perk: boolean;
};

/** Drops benefits that can't be traced to a real page, and folds the extra fields into the stored `restrictions` text. */
export function toBenefitRows(benefits: ExtractedBenefit[], pageCount: number) {
  return benefits
    .filter(
      (b) =>
        b.name.trim() &&
        Number.isInteger(b.source_page) &&
        b.source_page >= 1 &&
        b.source_page <= Math.max(pageCount, 1),
    )
    .map((b) => {
      const notes = [
        b.restrictions,
        b.annual_limit ? `annual limit: ${b.annual_limit}` : null,
        b.network_restrictions ? `network: ${b.network_restrictions}` : null,
        b.prior_authorization ? `prior authorization: ${b.prior_authorization}` : null,
      ].filter(Boolean);
      return {
        name: b.name.trim(),
        category: (BENEFIT_CATEGORIES as readonly string[]).includes(b.category)
          ? b.category
          : "other",
        coverage_status: b.coverage_status,
        cost: b.cost,
        visit_limit: b.visit_limit != null && b.visit_limit > 0 ? Math.round(b.visit_limit) : null,
        restrictions: notes.length ? notes.join(" · ") : null,
        source_page: b.source_page,
        description: b.description,
        hidden_perk: b.hidden_perk && b.coverage_status === "covered",
      };
    });
}

export type PendingAction =
  | {
      type: "calendar_hold";
      title: string;
      starts_at: string;
      ends_at?: string | null;
      location?: string | null;
      notes?: string | null;
      benefit_id?: string | null;
      created_at: string;
    }
  | {
      type: "visit_log";
      benefit_id: string | null;
      visit_date: string;
      label: string;
      created_at: string;
    };

/** A proposal only waits a day for its yes/no. */
export function isPendingActive(
  p: PendingAction | null | undefined,
  now = Date.now(),
): p is PendingAction {
  return !!p && now - new Date(p.created_at).getTime() < 24 * 60 * 60 * 1000;
}
