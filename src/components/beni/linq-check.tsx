import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Check, X, Minus, RefreshCw, Copy, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { linqConnectionStatus, sendLinqTestText } from "@/lib/beni-ai.functions";

type State = boolean | null;

function Row({ ok, label, hint }: { ok: State; label: string; hint?: string | null }) {
  const Icon = ok === null ? Minus : ok ? Check : X;
  return (
    <li className="flex gap-3 py-2 border-b border-border last:border-0">
      <Icon
        size={16}
        aria-label={ok === null ? "not checked" : ok ? "ok" : "needs attention"}
        className={`mt-0.5 shrink-0 ${ok === false ? "text-destructive" : "text-muted-foreground"}`}
      />
      <div className="min-w-0">
        <p className="text-sm">{label}</p>
        {hint && <p className="text-xs text-muted-foreground mt-1 break-words">{hint}</p>}
      </div>
    </li>
  );
}

/** Developer-facing checklist for the Linq text flow, plus a test text. Shows no secret values. */
export function LinqCheck() {
  const status = useQuery({
    queryKey: ["linq-status"],
    queryFn: () => linqConnectionStatus(),
    staleTime: 0,
  });
  const [test, setTest] = useState<{ busy: boolean; msg: string; ok?: boolean }>({
    busy: false,
    msg: "",
  });
  const [copied, setCopied] = useState(false);
  const s = status.data;

  async function sendTest() {
    setTest({ busy: true, msg: "" });
    try {
      const r = await sendLinqTestText();
      setTest({
        busy: false,
        ok: r.ok,
        msg: r.ok ? `test text sent to ${r.to}. reply to it with a question.` : r.error,
      });
    } catch (e) {
      setTest({
        busy: false,
        ok: false,
        msg: e instanceof Error ? e.message : "the test text failed.",
      });
    }
  }

  async function copy() {
    if (!s) return;
    try {
      await navigator.clipboard.writeText(s.webhookUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      setCopied(false);
    }
  }

  const missing = s
    ? Object.entries(s.secrets)
        .filter(([, v]) => !v)
        .map(([k]) => k)
    : [];
  const w = s?.account.webhook;
  const canTest = Boolean(
    s?.secrets.LINQ_API_TOKEN && s.secrets.LINQ_FROM_NUMBER && s.you.phone && s.you.consent,
  );

  return (
    <section
      className="border border-border rounded-2xl p-6 mb-12"
      aria-labelledby="linq-check-title"
    >
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <h2 id="linq-check-title" className="text-3xl">
          linq connection.
        </h2>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => status.refetch()}
          disabled={status.isFetching}
        >
          <RefreshCw className={status.isFetching ? "animate-spin" : ""} /> check again
        </Button>
      </div>
      {status.isError && (
        <p role="alert" className="text-sm text-destructive">
          the connection check failed to load.
        </p>
      )}
      {!s && !status.isError && <p className="text-sm text-muted-foreground">checking…</p>}
      {s && (
        <div className="grid md:grid-cols-2 gap-8">
          <ul>
            <Row
              ok={missing.length === 0}
              label="secrets saved in lovable"
              hint={missing.length ? `missing: ${missing.join(", ")}` : null}
            />
            <Row
              ok={s.secrets.LINQ_API_TOKEN ? s.account.tokenValid : null}
              label="linq accepts the api token"
              hint={s.account.error}
            />
            <Row
              ok={s.account.numberOnAccount}
              label={`beni number ${s.beniNumber ?? ""} is on this linq account`}
              hint={s.account.numberStatus ? `status: ${s.account.numberStatus}` : null}
            />
            <Row
              ok={
                s.account.tokenValid
                  ? Boolean(w?.registered && w.active && w.receivesMessages)
                  : null
              }
              label="webhook registered for message.received"
              hint={
                w?.registered && !w.usesExpectedVersion
                  ? "add ?version=2026-02-03 to the registered url"
                  : !w?.registered && s.account.tokenValid
                    ? "no linq subscription points at the url below yet"
                    : null
              }
            />
            <Row
              ok={s.lastWebhookAt ? true : null}
              label="a signed text has reached the webhook"
              hint={
                s.lastWebhookAt
                  ? `last received ${new Date(s.lastWebhookAt).toLocaleString()}`
                  : "nothing received yet"
              }
            />
            <Row
              ok={Boolean(s.you.phone && s.you.consent && s.you.phoneRoutesToYou)}
              label="your phone can reach this account"
              hint={
                !s.you.phone
                  ? "add a valid phone number in settings"
                  : !s.you.consent
                    ? "turn on text consent in settings (or text START)"
                    : !s.you.phoneRoutesToYou
                      ? `${s.you.phone} matches another profile too, so replies can’t be routed`
                      : `texts from ${s.you.phone} come to you`
              }
            />
            <Row
              ok={s.confirmationsReady}
              label="“yes” confirmations by text (holds, visit logs)"
              hint={
                s.confirmationsReady
                  ? null
                  : "needs profiles.pending_action from lovable; questions still work"
              }
            />
          </ul>

          <div className="space-y-6">
            <div>
              <p className="text-xs text-muted-foreground mb-2">webhook url to register in linq</p>
              <div className="flex gap-2 items-start">
                <code className="text-xs break-all border border-border rounded-xl px-3 py-2 flex-1">
                  {s.webhookUrl}
                </code>
                <Button variant="outline" size="icon" aria-label="Copy webhook url" onClick={copy}>
                  {copied ? <Check /> : <Copy />}
                </Button>
              </div>
              {s.isPreviewOrigin && (
                <p className="text-xs text-muted-foreground mt-2">
                  this is a preview address. open this page on your published site to get the url
                  linq should use.
                </p>
              )}
            </div>

            <div>
              <p className="text-xs text-muted-foreground mb-2">demo it</p>
              <ol className="text-sm leading-7 list-decimal pl-5">
                <li>
                  from {s.you.phone ?? "your phone"}, text {s.beniNumber ?? "the beni number"}:
                  “does my plan cover vision?”
                </li>
                <li>beni texts back an answer from your plan, with page numbers.</li>
                <li>both messages appear in the conversation below.</li>
              </ol>
            </div>

            <div>
              <Button variant="outline" disabled={!canTest || test.busy} onClick={sendTest}>
                <Send /> {test.busy ? "sending…" : "send me a test text"}
              </Button>
              {test.msg && (
                <p
                  role={test.ok ? "status" : "alert"}
                  className={`text-xs mt-2 ${test.ok ? "text-muted-foreground" : "text-destructive"}`}
                >
                  {test.msg}
                </p>
              )}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
