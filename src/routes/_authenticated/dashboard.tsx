import { createFileRoute, Link } from '@tanstack/react-router';
import { TextBeni } from '@/components/beni/text-beni';
import { useEffect } from 'react';
import { useSuspenseQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowUpRight, CalendarDays, Sparkles, FileText, MessageCircle } from 'lucide-react';
import { AuthedShell } from '@/components/beni/authed-shell';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { hubQuery } from '@/lib/hub-query';
import { pageHead, confirmedUsage } from '@/lib/beni';
import { greeting, fmtDate, isHold } from '@/lib/hub';
import {activeInsurance} from '@/lib/insurance-rules';
import {CalendarConnection} from '@/components/beni/calendar-connection';

export const Route = createFileRoute('/_authenticated/dashboard')({
  head: () => pageHead('your beni home', 'Your insurance, benefits, upcoming care and beni’s suggestions in one calm place.'),
  loader: ({ context }) => context.queryClient.ensureQueryData(hubQuery),
  component: Dashboard,
});

function Dashboard() {
  const { data } = useSuspenseQuery(hubQuery);
  const qc = useQueryClient();
  useEffect(() => {
    const ch = supabase
      .channel(`hub-${crypto.randomUUID()}`)
      .on('postgres_changes', { event: '*', schema: 'public' }, () => qc.invalidateQueries({ queryKey: ['beni-hub'] }))
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [qc]);

  const plan = activeInsurance(data.plans);
  const perks = data.benefits.filter((b) => b.hidden_perk).slice(0, 3);
  const now = new Date().toISOString();
  const upcomingEvents = data.events.filter((e) => e.starts_at >= now).slice(0, 3);
  const openReminders = data.reminders.filter((r) => r.status !== 'done').slice(0, 3);
  const nextCare = data.events.filter((e) => e.kind === 'healthcare' && e.starts_at >= now)[0];

  // Suggestions grounded only in documented data — never invented coverage.
  const suggestions: { title: string; why: string }[] = [];
  for (const b of data.benefits) {
    const used = confirmedUsage(data.visits, b.id);
    if (b.coverage_status === 'covered' && b.visit_limit && used < b.visit_limit && suggestions.length < 3) {
      suggestions.push({
        title: `make time for ${b.name.toLowerCase()}.`,
        why: `your plan documents ${b.visit_limit} visits (${b.cost || 'cost needs verification'}; page ${b.source_page}). you’ve recorded ${used} visits; insurer usage may differ.`,
      });
    }
  }
  if (data.profile?.break_start && suggestions.length < 3) {
    suggestions.push({
      title: 'your break is a good window for care.',
      why: `you told beni you’re off ${fmtDate(data.profile.break_start)} – ${data.profile.break_end ? fmtDate(data.profile.break_end) : ''}. a calm time for appointments.`,
    });
  }

  return (
    <AuthedShell>
      <main className="page-width py-12 md:py-16">
        
        <div className="flex flex-wrap items-start justify-between gap-4"><h1 className="section-title">{greeting(data.profile?.first_name)}</h1><TextBeni number={data.beniNumber} size="sm" /></div>
        

        {/* Calendar connection card */}
        <section className="mt-10 border border-border bg-card rounded-2xl p-6 md:p-8 flex flex-wrap items-center justify-between gap-6">
          <div className="flex items-start gap-4">
            <CalendarDays size={26} className="text-muted-foreground shrink-0 mt-1" />
            <div>
              <h2 className="text-3xl">my calendar.</h2>
              <p className="text-sm text-muted-foreground mt-2 max-w-md">View your schedule and appointment holds.</p>
            </div>
          </div>
          <CalendarConnection />
        </section>

        {/* Insurance overview */}
        <section className="mt-12 border-y border-border py-8">
          <div className="flex justify-between items-center mb-5">
            <h2 className="text-3xl">my insurance.</h2>
            <FileText className="text-muted-foreground" size={20} />
          </div>
          {plan ? (
            <>
              <p className="text-sm text-muted-foreground">
                {plan.file_name} · {plan.status === 'uploaded' ? 'awaiting benefit extraction' : plan.status}
                {plan.effective_start ? ` · effective ${fmtDate(plan.effective_start)}${plan.effective_end ? ` – ${fmtDate(plan.effective_end)}` : ''}` : ''}
              </p>
              <p className="text-xs text-muted-foreground mt-3">last updated {fmtDate(plan.updated_at)} · {data.benefits.length} documented benefits</p>
              <div className="grid sm:grid-cols-3 lg:grid-cols-5 gap-6 mt-6">
                {[
                  ['provider', plan.provider],
                  ['plan', plan.plan_name],
                  ['plan type', plan.plan_type],
                  ['deductible', plan.deductible],
                  ['out-of-pocket max', plan.out_of_pocket_max],
                ].map(([k, v]) => (
                  <div key={k as string}>
                    <p className="text-xs text-muted-foreground mb-2">{k}</p>
                    <p className="text-sm">{(v as string) || 'not yet verified'}</p>
                  </div>
                ))}
              </div>
              <Button asChild variant="outline" className="mt-6"><Link to="/insurance">Change Insurance <ArrowUpRight /></Link></Button>
            </>
          ) : (
            <div className="flex flex-wrap items-center justify-between gap-5">
              <p className="text-sm text-muted-foreground">your plan hasn’t found its home here yet.</p>
              <Button asChild>
                <Link to="/insurance">
                  Upload Insurance <ArrowUpRight />
                </Link>
              </Button>
            </div>
          )}
        </section>

        {/* Hidden perks */}
        <section className="py-12">
          <div className="flex items-center gap-3 mb-6">
            <Sparkles size={22} />
            <h2 className="text-4xl">perks you might be missing.</h2>
          </div>
          {perks.length ? (
            <>
              <div className="grid md:grid-cols-3 gap-4">
                {perks.map((b) => (
                  <article key={b.id} className="border border-border bg-card rounded-2xl p-6">
                    <span className="text-xs text-muted-foreground">{b.category}</span>
                    <h3 className="text-2xl my-3">{b.name}</h3>
                    <p className="text-sm line-clamp-3">{b.description}</p>
                    <p className="text-xs text-muted-foreground mt-3">
                      {b.cost || 'cost not documented'} · page {b.source_page}
                    </p>
                    <p className="text-xs text-muted-foreground mt-3">worth exploring: covered in your document and easy to overlook.</p>
                    <Button asChild variant="link" className="px-0 mt-3"><Link to="/benefits">explore benefit <ArrowUpRight /></Link></Button>
                  </article>
                ))}
              </div>
              <Button asChild variant="link" className="px-0 mt-5">
                <Link to="/benefits">
                  view all benefits <ArrowUpRight />
                </Link>
              </Button>
            </>
          ) : (
            <p className="text-muted-foreground text-sm">no perks confirmed yet. we’ll only highlight what your plan actually documents.</p>
          )}
        </section>

        {/* Upcoming care */}
        <section className="border-t border-border py-10">
          <h2 className="text-4xl mb-6">your upcoming care.</h2>
          {upcomingEvents.length || openReminders.length ? (
            <>
              {upcomingEvents.map((ev) => (
                <div key={ev.id} className="flex gap-3 py-3">
                  <CalendarDays size={20} className="shrink-0 text-muted-foreground" />
                  <div>
                    <p>{ev.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {fmtDate(ev.starts_at)} · {isHold(ev) ? 'tentative hold — not booked' : ev.status}
                    </p>
                  </div>
                </div>
              ))}
              {openReminders.map((r) => (
                <p key={r.id} className="text-sm py-2 text-muted-foreground">
                  {r.title}
                  {r.remind_at ? ` · ${fmtDate(r.remind_at)}` : ''}
                </p>
              ))}
              <Button asChild variant="link" className="px-0 mt-3">
                <Link to="/care">
                  view my care <ArrowUpRight />
                </Link>
              </Button>
            </>
          ) : (
            <p className="text-sm text-muted-foreground">a little breathing room. no upcoming care yet.</p>
          )}
        </section>

        {/* Beni's suggestions */}
        <section className="border-t border-border py-10">
          <h2 className="text-4xl mb-6">a little nudge from beni.</h2>
          {suggestions.length ? (
            <div className="grid md:grid-cols-3 gap-4">
              {suggestions.map((s) => (
                <article key={s.title} className="border border-border rounded-2xl p-6">
                  <h3 className="text-2xl mb-3">{s.title}</h3>
                  <p className="text-sm text-muted-foreground leading-6">{s.why}</p>
                  <Button asChild variant="link" className="px-0 mt-3"><Link to="/benefits">explore benefits <ArrowUpRight /></Link></Button>
                </article>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              once your benefits are documented, beni will gently point out what’s worth using — always with the reason why.
            </p>
          )}
          <p className="text-xs text-muted-foreground mt-6 flex items-center gap-2">
            <MessageCircle size={14} /> suggestions come only from your documented plan and confirmed history.
          </p>
        </section>
      </main>
    </AuthedShell>
  );
}
