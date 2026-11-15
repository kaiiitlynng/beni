import { describe, it, expect } from "vitest";
import { smsHref } from "@/lib/beni-number";
describe("Text Beni link", () => {
  it("uses the configured number as the sms recipient", () => expect(smsHref("+1 (415) 555-0100")).toBe("sms:+14155550100"));
  it("offers no link when no number is configured", () => { expect(smsHref(null)).toBeNull(); expect(smsHref("")).toBeNull(); });
});
