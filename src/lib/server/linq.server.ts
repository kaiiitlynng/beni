// Linq Partner API v3 (iMessage / RCS / SMS). Token, number and signing secret live in Lovable Secrets.
// Shapes follow https://cdn.linqapp.com/openapi/linq-api-v3.yaml

import { toE164 } from "../agent-rules";

const BASE = "https://api.linqapp.com/api/partner/v3";

/** beni's sending number in E.164, tolerating spaces or dashes in the secret. */
export function linqNumber(): string | null {
  return toE164(process.env["LINQ_FROM_NUMBER"]);
}

export function isLinqConfigured(): boolean {
  return Boolean(process.env["LINQ_API_TOKEN"] && linqNumber());
}

type SendResult =
  { ok: true; chatId: string | null; service: string | null } | { ok: false; error: string };

/** Pulls Linq's human-readable error out of a response body, if there is one. */
function linqErrorMessage(detail: string): string {
  try {
    const j = JSON.parse(detail) as { error?: { message?: string } | string; message?: string };
    const msg = typeof j.error === "string" ? j.error : (j.error?.message ?? j.message);
    return msg ? `: ${String(msg).slice(0, 200)}` : "";
  } catch {
    return "";
  }
}

async function linqFetch(path: string, body?: unknown): Promise<Response> {
  return fetch(`${BASE}${path}`, {
    method: body === undefined ? "GET" : "POST",
    headers: {
      Authorization: `Bearer ${process.env["LINQ_API_TOKEN"]}`,
      "Content-Type": "application/json",
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
}

const textMessage = (body: string) => ({ parts: [{ type: "text", value: body.slice(0, 10000) }] });

/** Replies in an existing chat when we have its id, otherwise starts (or resumes) a 1:1 chat with the phone number. */
export async function sendText(opts: {
  to: string;
  body: string;
  chatId?: string | null;
}): Promise<SendResult> {
  if (!isLinqConfigured()) return { ok: false, error: "Linq is not configured." };
  try {
    const res = opts.chatId
      ? await linqFetch(`/chats/${encodeURIComponent(opts.chatId)}/messages`, {
          message: textMessage(opts.body),
        })
      : await linqFetch("/chats", {
          from: linqNumber(),
          to: [opts.to],
          message: textMessage(opts.body),
        });
    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      console.error("[linq] send failed", res.status, detail.slice(0, 500));
      return { ok: false, error: `Linq returned ${res.status}${linqErrorMessage(detail)}` };
    }
    const json = (await res.json().catch(() => ({}))) as {
      chat_id?: string;
      chat?: { id?: string; service?: string };
    };
    return {
      ok: true,
      chatId: json.chat_id ?? json.chat?.id ?? opts.chatId ?? null,
      service: json.chat?.service ?? null,
    };
  } catch (e) {
    console.error("[linq] send error", e);
    return { ok: false, error: "Linq could not be reached." };
  }
}

function base64ToBytes(b64: string): Uint8Array<ArrayBuffer> {
  const bin = atob(b64);
  const out = new Uint8Array(new ArrayBuffer(bin.length));
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function constantTimeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i]! ^ b[i]!;
  return diff === 0;
}

/**
 * Verifies a Standard Webhooks signature: HMAC-SHA256 over `{webhook-id}.{webhook-timestamp}.{raw body}`
 * with the base64 key after `whsec_`, and rejects timestamps more than 5 minutes off.
 */
export async function verifyLinqSignature(opts: {
  secret: string;
  rawBody: string;
  id: string | null;
  timestamp: string | null;
  signature: string | null;
  nowSeconds?: number;
}): Promise<boolean> {
  const { secret, rawBody, id, timestamp, signature } = opts;
  if (!secret || !id || !timestamp || !signature) return false;
  const ts = Number(timestamp);
  const now = opts.nowSeconds ?? Math.floor(Date.now() / 1000);
  if (!Number.isFinite(ts) || Math.abs(now - ts) > 5 * 60) return false;
  try {
    const keyBytes = base64ToBytes(secret.startsWith("whsec_") ? secret.slice(6) : secret);
    const key = await crypto.subtle.importKey(
      "raw",
      keyBytes,
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"],
    );
    const expected = new Uint8Array(
      await crypto.subtle.sign(
        "HMAC",
        key,
        new TextEncoder().encode(`${id}.${timestamp}.${rawBody}`),
      ),
    );
    return signature.split(" ").some((sig) => {
      if (!sig.startsWith("v1,")) return false;
      try {
        return constantTimeEqual(expected, base64ToBytes(sig.slice(3)));
      } catch {
        return false;
      }
    });
  } catch {
    return false;
  }
}

export type LinqInbound = {
  eventId: string;
  chatId: string;
  from: string;
  text: string;
  service: string | null;
};

/** Pulls an inbound 1:1 text out of a `message.received` event (webhook version 2026-02-03 or 2025-01-01). */
export function parseInbound(payload: unknown): LinqInbound | null {
  const p = payload as {
    event_type?: string;
    event_id?: string;
    data?: {
      direction?: string;
      is_from_me?: boolean;
      chat?: { id?: string; is_group?: boolean };
      chat_id?: string;
      is_group?: boolean;
      sender_handle?: { handle?: string };
      from_handle?: { handle?: string } | string;
      parts?: { type?: string; value?: string }[];
      message?: { parts?: { type?: string; value?: string }[] };
      service?: string;
    };
  };
  if (p?.event_type !== "message.received" || !p.event_id || !p.data) return null;
  const d = p.data;
  if (d.direction === "outbound" || d.is_from_me === true) return null;
  if (d.chat?.is_group || d.is_group) return null;
  const chatId = d.chat?.id ?? d.chat_id;
  const from =
    d.sender_handle?.handle ??
    (typeof d.from_handle === "string" ? d.from_handle : d.from_handle?.handle);
  const parts = d.parts ?? d.message?.parts ?? [];
  const text = parts
    .filter((x) => x.type === "text" && x.value)
    .map((x) => x.value)
    .join("\n")
    .trim();
  if (!chatId || !from || !text) return null;
  return { eventId: p.event_id, chatId, from, text, service: d.service ?? null };
}

export type LinqAccountCheck = {
  tokenValid: boolean;
  error: string | null;
  numberOnAccount: boolean | null;
  numberStatus: string | null;
  webhook: {
    registered: boolean;
    active: boolean;
    receivesMessages: boolean;
    usesExpectedVersion: boolean;
  };
};

/** Read-only check of the Linq account: token works, the sending number belongs to it, and a webhook points at `webhookUrl`. */
export async function checkLinqAccount(webhookUrl: string): Promise<LinqAccountCheck> {
  const empty = {
    registered: false,
    active: false,
    receivesMessages: false,
    usesExpectedVersion: false,
  };
  if (!process.env["LINQ_API_TOKEN"]) {
    return {
      tokenValid: false,
      error: "LINQ_API_TOKEN is not set.",
      numberOnAccount: null,
      numberStatus: null,
      webhook: empty,
    };
  }
  try {
    const [numbersRes, subsRes] = await Promise.all([
      linqFetch("/phone_numbers"),
      linqFetch("/webhook-subscriptions"),
    ]);
    if (numbersRes.status === 401 || numbersRes.status === 403) {
      return {
        tokenValid: false,
        error: "Linq rejected the token.",
        numberOnAccount: null,
        numberStatus: null,
        webhook: empty,
      };
    }
    if (!numbersRes.ok) {
      const detail = await numbersRes.text().catch(() => "");
      return {
        tokenValid: false,
        error: `Linq returned ${numbersRes.status}${linqErrorMessage(detail)}`,
        numberOnAccount: null,
        numberStatus: null,
        webhook: empty,
      };
    }
    const numbers =
      (
        (await numbersRes.json()) as {
          phone_numbers?: { phone_number?: string; line_status?: string }[];
        }
      ).phone_numbers ?? [];
    const from = linqNumber();
    const mine = from ? numbers.find((n) => toE164(n.phone_number) === from) : undefined;

    const subs = subsRes.ok
      ? ((
          (await subsRes.json()) as {
            subscriptions?: {
              target_url?: string;
              subscribed_events?: string[];
              is_active?: boolean;
            }[];
          }
        ).subscriptions ?? [])
      : [];
    const path = new URL(webhookUrl).pathname;
    const host = new URL(webhookUrl).host;
    const match = subs.find((s) => {
      try {
        const u = new URL(s.target_url ?? "");
        return u.pathname === path && u.host === host;
      } catch {
        return false;
      }
    });
    return {
      tokenValid: true,
      error: null,
      numberOnAccount: from ? Boolean(mine) : null,
      numberStatus: mine?.line_status ?? null,
      webhook: match
        ? {
            registered: true,
            active: match.is_active !== false,
            receivesMessages: (match.subscribed_events ?? []).some(
              (e) => e === "message.received" || e === "*",
            ),
            usesExpectedVersion:
              new URL(match.target_url!).searchParams.get("version") === "2026-02-03",
          }
        : empty,
    };
  } catch {
    return {
      tokenValid: false,
      error: "Linq could not be reached.",
      numberOnAccount: null,
      numberStatus: null,
      webhook: empty,
    };
  }
}
