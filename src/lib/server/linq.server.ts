// Linq Partner API v3 (iMessage / RCS / SMS). Token, number and signing secret live in Lovable Secrets.
// Shapes follow https://cdn.linqapp.com/openapi/linq-api-v3.yaml

const BASE = "https://api.linqapp.com/api/partner/v3";

export function linqNumber(): string | null {
  return process.env["LINQ_FROM_NUMBER"] || null;
}

export function isLinqConfigured(): boolean {
  return Boolean(process.env["LINQ_API_TOKEN"] && process.env["LINQ_FROM_NUMBER"]);
}

type SendResult =
  { ok: true; chatId: string | null; service: string | null } | { ok: false; error: string };

async function linqFetch(path: string, body: unknown): Promise<Response> {
  return fetch(`${BASE}${path}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env["LINQ_API_TOKEN"]}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
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
      return { ok: false, error: `Linq returned ${res.status}` };
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
