import { describe, it, expect } from "vitest";
import {
  toE164,
  parseConfirmation,
  smsKeyword,
  mayTextNudge,
  isSensitiveBenefit,
  toBenefitRows,
  isPendingActive,
  type ExtractedBenefit,
} from "@/lib/agent-rules";
import { verifyLinqSignature, parseInbound } from "@/lib/server/linq.server";

const prefs = {
  sms_consent: true,
  notify_sms: true,
  notify_appointments: true,
  notify_benefits: true,
  notify_checkins: true,
};

async function sign(secretB64: string, id: string, ts: string, body: string) {
  const key = await crypto.subtle.importKey(
    "raw",
    Uint8Array.from(atob(secretB64), (c) => c.charCodeAt(0)),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const mac = new Uint8Array(
    await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(`${id}.${ts}.${body}`)),
  );
  return `v1,${btoa(String.fromCharCode(...mac))}`;
}

const benefit = (o: Partial<ExtractedBenefit>): ExtractedBenefit => ({
  name: "dental cleaning",
  category: "dental",
  coverage_status: "covered",
  cost: "$0",
  visit_limit: 2,
  annual_limit: null,
  network_restrictions: null,
  prior_authorization: null,
  restrictions: null,
  source_page: 3,
  description: null,
  hidden_perk: false,
  ...o,
});

describe("phone numbers", () => {
  it("normalizes common US formats to E.164", () => {
    expect(toE164("(408) 555-1234")).toBe("+14085551234");
    expect(toE164("1-408-555-1234")).toBe("+14085551234");
    expect(toE164("+44 20 7946 0958")).toBe("+442079460958");
    expect(toE164("555-1234")).toBeNull();
  });
});

describe("confirmations", () => {
  it("reads clear yes and no replies", () => {
    expect(parseConfirmation("yes!")).toBe("yes");
    expect(parseConfirmation("Yeah I went")).toBe("yes");
    expect(parseConfirmation("nope")).toBe("no");
    expect(parseConfirmation("i didn't go")).toBe("no");
  });
  it("treats anything else as not a confirmation", () => {
    expect(parseConfirmation("does my plan cover acupuncture?")).toBeNull();
    expect(parseConfirmation("know any dentists in san jose")).toBeNull();
  });
  it("expires proposals after a day", () => {
    const p = {
      type: "visit_log" as const,
      benefit_id: null,
      visit_date: "2026-11-01",
      label: "x",
      created_at: new Date(0).toISOString(),
    };
    expect(isPendingActive(p, 25 * 3600 * 1000)).toBe(false);
    expect(isPendingActive(p, 3600 * 1000)).toBe(true);
  });
});

describe("texting consent", () => {
  it("honors STOP/START keywords", () => {
    expect(smsKeyword(" stop ")).toBe("stop");
    expect(smsKeyword("START")).toBe("start");
    expect(smsKeyword("stop sending me dentist stuff")).toBeNull();
  });
  it("never texts without consent, and respects each notification switch", () => {
    expect(mayTextNudge({ ...prefs, sms_consent: false }, "welcome")).toBe(false);
    expect(mayTextNudge({ ...prefs, notify_sms: false }, "welcome")).toBe(true);
    expect(mayTextNudge({ ...prefs, notify_sms: false }, "unused_benefit")).toBe(false);
    expect(mayTextNudge({ ...prefs, notify_checkins: false }, "checkin")).toBe(false);
    expect(mayTextNudge({ ...prefs, notify_appointments: false }, "appointment")).toBe(false);
  });
  it("keeps sensitive benefits out of unsolicited texts", () => {
    expect(isSensitiveBenefit({ name: "outpatient therapy", category: "mental health" })).toBe(
      true,
    );
    expect(isSensitiveBenefit({ name: "routine cleaning", category: "dental" })).toBe(false);
  });
});

describe("extraction safeguards", () => {
  it("drops benefits without a real source page", () => {
    const rows = toBenefitRows(
      [
        benefit({ source_page: 0 }),
        benefit({ source_page: 12 }),
        benefit({ name: "eye exam", category: "vision", source_page: 2 }),
      ],
      10,
    );
    expect(rows.map((r) => r.name)).toEqual(["eye exam"]);
  });
  it("never marks uncovered benefits as hidden perks and keeps requirements visible", () => {
    const [row] = toBenefitRows(
      [
        benefit({
          coverage_status: "coverage unclear",
          hidden_perk: true,
          prior_authorization: "required",
        }),
      ],
      5,
    );
    expect(row!.hidden_perk).toBe(false);
    expect(row!.restrictions).toContain("prior authorization: required");
  });
});

describe("linq webhook", () => {
  const secretB64 = btoa("beni-test-signing-key-32-bytes!!");
  const secret = `whsec_${secretB64}`;
  const body = JSON.stringify({
    event_type: "message.received",
    event_id: "evt_1",
    data: {
      direction: "inbound",
      chat: { id: "chat_1", is_group: false },
      sender_handle: { handle: "+14085551234" },
      parts: [{ type: "text", value: "yes!" }],
      service: "iMessage",
    },
  });
  const now = 1_800_000_000;

  it("accepts a valid Standard Webhooks signature", async () => {
    const signature = await sign(secretB64, "msg_1", String(now), body);
    expect(
      await verifyLinqSignature({
        secret,
        rawBody: body,
        id: "msg_1",
        timestamp: String(now),
        signature,
        nowSeconds: now,
      }),
    ).toBe(true);
  });
  it("rejects a tampered body or a stale timestamp", async () => {
    const signature = await sign(secretB64, "msg_1", String(now), body);
    expect(
      await verifyLinqSignature({
        secret,
        rawBody: body + " ",
        id: "msg_1",
        timestamp: String(now),
        signature,
        nowSeconds: now,
      }),
    ).toBe(false);
    expect(
      await verifyLinqSignature({
        secret,
        rawBody: body,
        id: "msg_1",
        timestamp: String(now),
        signature,
        nowSeconds: now + 600,
      }),
    ).toBe(false);
    expect(
      await verifyLinqSignature({
        secret,
        rawBody: body,
        id: "msg_1",
        timestamp: String(now),
        signature: null,
        nowSeconds: now,
      }),
    ).toBe(false);
  });
  it("parses inbound 1:1 texts and ignores outbound or group messages", () => {
    expect(parseInbound(JSON.parse(body))).toEqual({
      eventId: "evt_1",
      chatId: "chat_1",
      from: "+14085551234",
      text: "yes!",
      service: "iMessage",
    });
    const p = JSON.parse(body);
    expect(parseInbound({ ...p, data: { ...p.data, direction: "outbound" } })).toBeNull();
    expect(
      parseInbound({ ...p, data: { ...p.data, chat: { id: "c", is_group: true } } }),
    ).toBeNull();
  });
});
