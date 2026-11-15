import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { MessageCircle, Copy, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { smsHref } from "@/lib/beni-number";

/** Opens Messages with beni's configured Linq number; never sends anything by itself. */
export function TextBeni({ number, size = "default" }: { number?: string | null; size?: "default" | "sm" | "lg" }) {
  const [copied, setCopied] = useState(false);
  const href = smsHref(number);
  if (!href || !number) {
    return (
      <div className="flex flex-col items-start gap-2">
        <Button asChild variant="outline" size={size}>
          <Link to="/demo"><MessageCircle size={16} />Try the web conversation</Link>
        </Button>
        <span className="text-xs text-muted-foreground">Texting isn't set up yet, so Text Beni is unavailable.</span>
      </div>
    );
  }
  async function copy() {
    try { await navigator.clipboard.writeText(number!); setCopied(true); setTimeout(() => setCopied(false), 2000); } catch { /* clipboard blocked */ }
  }
  return (
    <div className="flex flex-col items-start gap-2">
      <Button asChild size={size}>
        <a href={href} aria-label={`Text Beni at ${number}`}><MessageCircle size={16} />Text Beni</a>
      </Button>
      <span className="flex items-center gap-2 text-xs text-muted-foreground">
        Messages didn't open? Text {number}
        <Button type="button" variant="ghost" size="sm" className="h-7 px-2" onClick={copy}>
          {copied ? <Check size={13} /> : <Copy size={13} />}{copied ? "Copied" : "Copy number"}
        </Button>
      </span>
    </div>
  );
}
