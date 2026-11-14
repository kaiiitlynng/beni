// extract-plan: reads an uploaded insurance PDF with Claude and stores only page-cited benefits.
import * as z from "zod/v4";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { generateMessage } from '@lovable.dev/ai-gateway';
import { BENEFIT_CATEGORIES, toBenefitRows } from "../agent-rules";

const nullableText = z.string().nullable();

const PlanExtraction = z.object({
  page_count: z.number().int().describe("Total number of pages in the document."),
  is_insurance_document: z
    .boolean()
    .describe("False if this is not a health, dental or vision plan or benefits document."),
  plan: z.object({
    provider: nullableText.describe("Insurance company, exactly as written."),
    plan_name: nullableText,
    plan_type: nullableText.describe("e.g. PPO, HMO, EPO, HDHP, dental PPO. Null if not stated."),
    deductible: nullableText.describe(
      'Individual in-network deductible as written, e.g. "$500 individual / $1,000 family".',
    ),
    out_of_pocket_max: nullableText,
    effective_start: nullableText.describe(
      "Coverage start date as YYYY-MM-DD, null if not stated.",
    ),
    effective_end: nullableText.describe("Coverage end date as YYYY-MM-DD, null if not stated."),
  }),
  benefits: z.array(
    z.object({
      name: z
        .string()
        .describe('Short benefit name, e.g. "routine dental cleaning", "acupuncture".'),
      category: z.enum(BENEFIT_CATEGORIES),
      coverage_status: z.enum(["covered", "not covered", "coverage unclear"]),
      cost: nullableText.describe("In-network copay, coinsurance or cost exactly as written."),
      visit_limit: z
        .number()
        .int()
        .nullable()
        .describe("Number of visits allowed per benefit period, only if stated."),
      annual_limit: nullableText.describe(
        "Any stated dollar, frequency or period limit, as written.",
      ),
      network_restrictions: nullableText,
      prior_authorization: nullableText.describe(
        "Prior authorization or referral requirement, as written.",
      ),
      restrictions: nullableText.describe("Other conditions or exclusions, as written."),
      source_page: z.number().int().describe("1-based page number where this benefit is stated."),
      description: nullableText.describe("One plain-language sentence explaining the benefit."),
      hidden_perk: z
        .boolean()
        .describe(
          "True only for a covered benefit a young adult might not know about (e.g. acupuncture, an annual eye exam, a free preventive service).",
        ),
    }),
  ),
});

const SYSTEM = `you extract health insurance benefits from a plan document for beni, an app that helps college students use their coverage.

rules:
- record only what the document states. never infer, assume or fill in typical coverage.
- every benefit needs the 1-based page number where it is stated. skip anything you cannot place on a page.
- copy costs, limits and restrictions as written; do not compute or round.
- if a service is mentioned but its coverage, cost or conditions are ambiguous, use "coverage unclear".
- list explicit exclusions as "not covered".
- cosmetic or reconstructive services count as covered only if the document explicitly says so.
- prefer in-network values when the document gives both.`;

function toBase64(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.length; i += 0x8000)
    binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(binary);
}

type Admin = typeof import("@/integrations/supabase/client.server").supabaseAdmin;

/** Runs extraction for one plan. Assumes ownership was already checked by the caller. */
export async function extractPlanForUser(admin: Admin, userId: string, planId: string) {
  const { data: plan, error } = await admin
    .from("plans_uploaded")
    .select("*")
    .eq("id", planId)
    .eq("user_id", userId)
    .single();
  if (error || !plan) throw new Error("That document could not be found.");
  if (plan.status === 'ready') return { status: 'ready' as const, benefits: (await admin.from('benefits').select('id').eq('plan_id', planId)).data?.length ?? 0 };
  const claim = await admin.from('plans_uploaded').update({ status: 'processing', extraction_error: null }).eq('id', planId).eq('user_id',userId).neq('status','processing').select('id');
  if (claim.error || !claim.data?.length) throw new Error('This document is already being processed. Please check back shortly.');
  try {
    const file = await admin.storage.from("insurance-plans").download(plan.storage_path);
    if (file.error || !file.data) throw new Error("The PDF could not be read from storage.");
    const pdf = toBase64(new Uint8Array(await file.data.arrayBuffer()));

    const response = await generateMessage(
      {
        model: 'anthropic/claude-opus-5-5',
        max_tokens: 16000,
        output_config: { effort: "medium", format: betaZodOutputFormat(PlanExtraction) },
        system: SYSTEM,
        messages: [
          {
            role: "user",
            content: [
              {
                type: "document",
                source: { type: "base64", media_type: "application/pdf", data: pdf },
              },
              {
                type: "text",
                text: "Extract the plan details and every benefit from this document.",
              },
            ],
          },
        ],
      },
    );

    if (response.stop_reason === "refusal")
      throw new Error("This document could not be processed.");
    if (response.stop_reason === "max_tokens")
      throw new Error("This document is too long to process in one pass.");
    const text = response.content.filter(b => b.type === 'text').map(b => b.text).join('');
    const parsed = PlanExtraction.parse(JSON.parse(text));
    if (!parsed) throw new Error("No benefits could be read from this document.");
    if (!parsed.is_insurance_document)
      throw new Error("This does not look like an insurance plan document.");

    const rows = toBenefitRows(parsed.benefits, parsed.page_count).map((b) => ({
      ...b,
      user_id: userId,
      plan_id: planId,
    }));
    const isoDate = (d: string | null) => (d && /^\d{4}-\d{2}-\d{2}$/.test(d) ? d : null);

    const removed = await admin
      .from("benefits")
      .delete()
      .eq("plan_id", planId)
      .eq("user_id", userId);
    if (removed.error) throw removed.error;
    if (rows.length) {
      const inserted = await admin.from("benefits").insert(rows);
      if (inserted.error) throw inserted.error;
    }
    const saved = await admin
      .from("plans_uploaded")
      .update({
        status: "ready",
        provider: parsed.plan.provider,
        plan_name: parsed.plan.plan_name,
        plan_type: parsed.plan.plan_type,
        deductible: parsed.plan.deductible,
        out_of_pocket_max: parsed.plan.out_of_pocket_max,
        effective_start: isoDate(parsed.plan.effective_start),
        effective_end: isoDate(parsed.plan.effective_end),
        updated_at: new Date().toISOString(),
        extraction_error: null,
      })
      .eq("id", planId);
    if (saved.error) throw new Error('Your extracted plan could not be saved. Please retry.');
    return { status: "ready" as const, benefits: rows.length };
  } catch (e) {
    const message =
      e instanceof Error && !("status" in e)
        ? e.message
        : "Your document could not be processed. Please try again.";
    await admin.from("plans_uploaded").update({ status: "failed", extraction_error: message }).eq("id", planId).eq('user_id',userId);
    return { status: "failed" as const, benefits: 0, message };
  }
}
