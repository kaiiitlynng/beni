import { useState } from "react";
import { MessageCircle } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { sendNudge } from "@/lib/beni-ai.functions";

/** Sends beni's welcome text through Linq. Disabled, with the reason, when texting isn't possible. */
export function TextMe({ connected, consent }: { connected: boolean; consent: boolean }) {
  const [state, setState] = useState<"idle" | "sending" | "sent" | "failed">("idle");
  const qc = useQueryClient();
  const reason = !consent
    ? "turn on text consent to hear from beni"
    : !connected
      ? "text connection not configured yet"
      : null;
  async function send() {
    setState("sending");
    try {
      const r = await sendNudge({ data: { kind: "welcome", mode: "auto" } });
      setState(r.sent && r.channel !== "demo" && r.delivery_status === "sent" ? "sent" : "failed");
    } catch {
      setState("failed");
    } finally {
      void qc.invalidateQueries({ queryKey: ["beni-hub"] });
    }
  }
  return (
    <div className="mt-6 flex flex-col items-center gap-2 text-xs text-muted-foreground">
      <Button
        variant="outline"
        disabled={!!reason || state === "sending" || state === "sent"}
        onClick={send}
      >
        <MessageCircle size={14} />
        {state === "sent"
          ? "check your messages ✓"
          : state === "sending"
            ? "texting you…"
            : "text me"}
      </Button>
      {reason && <span>{reason}</span>}
      {state === "failed" && (
        <span role="alert">that text didn’t go through. you can try again from the demo page.</span>
      )}
    </div>
  );
}
