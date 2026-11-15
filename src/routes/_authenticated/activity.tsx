import { createFileRoute, Link } from '@tanstack/react-router';
import { useSuspenseQuery } from '@tanstack/react-query';
import { MessageCircle, Bell, Sparkles, CalendarDays, CheckCircle2 } from 'lucide-react';
import { AuthedShell } from '@/components/beni/authed-shell';
import { TextBeni } from '@/components/beni/text-beni';
import { Button } from '@/components/ui/button';
import { hubQuery } from '@/lib/hub-query';
import { pageHead } from '@/lib/beni';
import { fmtDate, fmtTime, isHold } from '@/lib/hub';
import type { ReactNode } from 'react';

export const Route = createFileRoute('/_authenticated/activity')({
  head: () => pageHead('your latest from beni', 'Messages, reminders, recommendations and care activity — in order.'),
  loader: ({ context }) => context.queryClient.ensureQueryData(hubQuery),
  component: ActivityPage,
});

type Item = { key: string; at: string; icon: ReactNode; label: string; text: string; action?: { label: string; to: '/benefits' | '/calendar' | '/settings' } };

function ActivityPage() {
  const { data } = useSuspenseQuery(hubQuery);

  const items: Item[] = [
    ...data.messages.map((m) => ({
      key: `m-${m.id}`,
      at: m.created_at,
      icon: <MessageCircle size={16} />,
      label: m.direction === 'outgoing' ? 'beni messaged you' : 'you replied',
      text: m.body,
    })),
    ...data.reminders.map((r) => ({
      key: `r-${r.id}`,
      at: r.remind_at ?? r.id,
      icon: r.status === 'done' ? <CheckCircle2 size={16} /> : <Bell size={16} />,
      label: r.status === 'done' ? 'reminder completed' : 'reminder',
      text: r.title,
    })),
    ...data.benefits
      .filter((b) => b.hidden_perk)
      .map((b) => ({
        key: `b-${b.id}`,
        at: b.id,
        icon: <Sparkles size={16} />,
        label: 'benefit recommendation',
        text: `${b.name} — documented on page ${b.source_page} of your plan.`,
        action: { label: 'View benefit', to: '/benefits' as const },
      })),
    ...data.events.map((e) => ({
      key: `e-${e.id}`,
      at: e.starts_at,
      icon: <CalendarDays size={16} />,
      label: isHold(e) ? 'tentative calendar hold' : 'appointment',
      text: `${e.title} · ${fmtDate(e.starts_at)}${isHold(e) ? ' (not booked)' : ''}`,
      action: { label: 'View appointment', to: '/calendar' as const },
    })),
    ...data.visits.map((v) => ({
      key: `v-${v.id}`,
      at: v.created_at,
      icon: <CheckCircle2 size={16} />,
      label: 'visit confirmed',
      text: `you confirmed a visit on ${fmtDate(v.visit_date)}.`,
    })),
  ].sort((a, b) => b.at.localeCompare(a.at));

  const conversation = data.messages.slice(-6);
  const upcomingReminders = data.reminders.filter((r) => r.status !== 'done').sort((a, b) => (a.remind_at ?? '9').localeCompare(b.remind_at ?? '9')).slice(0, 5);

  return (
    <AuthedShell>
      <main className="page-width max-w-3xl py-12 md:py-16">
        
        <h1 className="section-title">your latest from beni.</h1>

        {/* Conversation preview */}
        <section className="mt-12 border border-border bg-card rounded-2xl p-6">
          <div className="flex items-center justify-between gap-4 mb-5">
            <h2 className="text-3xl">your conversation.</h2>
            <TextBeni number={data.beniNumber} />
          </div>
          {conversation.length ? (
            <div className="space-y-3">
              {conversation.map((m) => (
                <p key={m.id} className={`text-sm rounded-2xl px-4 py-3 max-w-[85%] ${m.direction === 'outgoing' ? 'bg-muted' : 'bg-accent ml-auto'}`}>
                  {m.body}
                </p>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">no messages yet. text Beni to start a conversation; it previews here — the full conversation stays in your texts.</p>
          )}
        </section>

        <section className="mt-12 border-t border-border pt-8">
          <div className="flex flex-wrap items-center justify-between gap-4 mb-5">
            <h2 className="text-3xl">Upcoming reminders</h2>
            <Button asChild variant="outline" size="sm"><Link to="/settings">Manage reminders</Link></Button>
          </div>
          {upcomingReminders.length ? (
            <ul className="space-y-3">
              {upcomingReminders.map((r) => (
                <li key={r.id} className="flex items-center gap-3 text-sm"><Bell size={15} className="text-muted-foreground" />{r.title}{r.remind_at && <span className="text-xs text-muted-foreground">· {fmtDate(r.remind_at)} {fmtTime(r.remind_at)}</span>}</li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">No upcoming reminders. Add one from a benefit or when you save an appointment.</p>
          )}
        </section>

        {/* Chronological feed */}
        <section className="mt-12"><h2 className="text-3xl mb-6">Timeline</h2></section>
        <section className="mt-12">
          {items.length ? (
            <div className="border-l border-border pl-6 space-y-7">
              {items.map((i) => (
                <div key={i.key} className="relative">
                  <span className="absolute -left-[31px] top-0.5 bg-background border border-border rounded-full p-1.5 text-muted-foreground">{i.icon}</span>
                  <p className="text-xs text-muted-foreground">{i.label}</p>
                  <p className="text-sm mt-1">{i.text}</p>
                  {i.at.includes('T') && <p className="text-xs text-muted-foreground mt-1">{fmtDate(i.at)} · {fmtTime(i.at)}</p>}
                  {i.action && <Button asChild variant="link" size="sm" className="px-0 h-auto mt-1"><Link to={i.action.to}>{i.action.label}</Link></Button>}
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground border-t border-border pt-8">quiet so far. as beni reminds, recommends and plans, it all lands here.</p>
          )}
        </section>
      </main>
    </AuthedShell>
  );
}
