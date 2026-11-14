// Server-only Claude client. ANTHROPIC_API_KEY lives in Lovable Secrets, never in browser code.
// Called through the Anthropic SDK directly (not Lovable's AI gateway); see the note in AGENTS.md.
import Anthropic from "@anthropic-ai/sdk";

export const MODEL = "claude-opus-5-5";

/** Server-side refusal fallback: a declined request is re-run on a suitable model inside the same call. */
export const FALLBACK = {
  betas: ["server-side-fallback-2026-07-01"] as const,
  fallbacks: "default" as const,
};

let client: Anthropic | undefined;

export function isClaudeConfigured(): boolean {
  return Boolean(process.env["ANTHROPIC_API_KEY"]);
}

export function claude(): Anthropic {
  if (!isClaudeConfigured())
    throw new Error("Missing ANTHROPIC_API_KEY. Add it in Lovable Secrets.");
  client ??= new Anthropic({ apiKey: process.env["ANTHROPIC_API_KEY"] });
  return client;
}
