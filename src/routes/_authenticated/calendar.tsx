import { createFileRoute, Link } from '@tanstack/react-router';
import { useMemo, useState } from 'react';
import { useSuspenseQuery, useQueryClient } from '@tanstack/react-query';
import { ChevronLeft, ChevronRight, CalendarDays, MessageCircle, Plus, X, Check } from 'lucide-react';
import { AuthedShell } from '@/components/beni/authed-shell';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { hubQuery } from '@/lib/hub-query';
import { pageHead } from '@/lib/beni';
import { monthGrid, weekDays, addMonths, addWeeks, monthLabel, toKey } from '@/lib/calendar';
import { eventDay, fmtTime, isHold, isBooked } from '@/lib/hub';
import { createHold, confirmHold, deleteEvent } from '@/lib/benefits.functions';
import { toast } from 'sonner';
import type { Tables } from '@/integrations/supabase/types';
import { CalendarConnection } from '@/components/beni/calendar-connection';
import { GoogleSchedule } from '@/components/beni/google-schedule';
import { exportAppointment } from '@/lib/calendar-integration.functions';
import { useServerFn } from '@tanstack/react-start';

export const Route = createFileRoute('/_authenticated/calendar')({
  head: () => pageHead('care that fits your life', 'Your schedule, your benefits, beautifully coordinated.'),
  loader: ({ context }) => context.queryClient.ensureQueryData(hubQuery),
  component: CalendarPage,
});

type View = 'month' | 'week' | 'day';

const MARKER = {
  personal: 'bg-muted-foreground/50',
  healthcare: 'bg-primary',
  hold: 'bg-muted-foreground/30 border border-muted-foreground/60',
} as const;

function markerFor(e: Tables<'calendar_events'>) {
  if (isHold(e)) return MARKER.hold;
  if (e.kind === 'healthcare') return MARKER.healthcare;
  return MARKER.personal;
}

function CalendarPage() {
  const { data } = useSuspenseQuery(hubQuery);
  const qc = useQueryClient();
  const exportToGoogle = useServerFn(exportAppointment);
  const [view, setView] = useState<View>('month');
  const [anchor, setAnchor] = useState(() => new Date());
  const [selected, setSelected] = useState(() => toKey(new Date()));
  const [holdForm, setHoldForm] = useState(false);
  const [busy, setBusy] = useState(false);

  const byDay = useMemo(() => {
    const map = new Map<string, Tables<'calendar_events'>[]>();
    for (const e of data.events) {
      const k = eventDay(e);
      map.set(k, [...(map.get(k) ?? []), e]);
    }
    return map;
  }, [data.events]);

  const days = view === 'month' ? monthGrid(anchor) : view === 'week' ? weekDays(anchor) : weekDays(anchor).filter((d) => d.key === toKey(anchor));
  const selectedEvents = byDay.get(selected) ?? [];
  const upcomingHolds = data.events.filter((e) => isHold(e) && e.starts_at >= new Date().toISOString());

  function prev() {
    setAnchor(view === 'month' ? addMonths(anchor, -1) : addWeeks(anchor, -1));
  }
  function next() {
    setAnchor(view === 'month' ? addMonths(anchor, 1) : addWeeks(anchor, 1));
  }
  function today() {
    const t = new Date();
    setAnchor(t);
    setSelected(toKey(t));
  }
  async function refresh() {
    await qc.invalidateQueries({ queryKey: ['beni-hub'] });
  }
  async function onConfirm(id: string) {
    setBusy(true);
    try {
      await confirmHold({ data: { id } });
      toast.success('appointment confirmed.');
      await refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'something went wrong.');
    } finally {
      setBusy(false);
    }
  }
  async function onDelete(id: string) {
    setBusy(true);
    try {
      await deleteEvent({ data: { id } });
      toast.success('calendar entry removed.');
      await refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'something went wrong.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthedShell>
      <main className="page-width py-12 md:py-16">
        <p className="text-xs text-muted-foreground mb-4">your schedule, your benefits, beautifully coordinated.</p>
        <h1 className="section-title">care that fits your life.</h1>

        {/* Connection bar — honest state, no fake connection */}
        <section className="mt-10 border border-border bg-card rounded-2xl p-5 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <CalendarDays size={20} className="text-muted-foreground" />
            <div>
              <p className="text-sm">connect your google calendar</p>
              <p className="text-xs text-muted-foreground">approve an entry before adding it to Google. A calendar entry is not a provider booking.</p>
            </div>
          </div>
          <CalendarConnection />
        </section>

        <div className="grid lg:grid-cols-[1fr_320px] gap-10 mt-10">
          <div>
            {/* View controls */}
            <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
              <div className="flex items-center gap-2">
                <Button variant="ghost" size="icon" aria-label="Previous" onClick={prev}>
                  <ChevronLeft />
                </Button>
                <h2 className="text-2xl min-w-44 text-center">{view === 'day' ? new Date(anchor).toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' }) : monthLabel(anchor)}</h2>
                <Button variant="ghost" size="icon" aria-label="Next" onClick={next}>
                  <ChevronRight />
                </Button>
                <Button variant="outline" size="sm" onClick={today}>
                  today
                </Button>
              </div>
              <div className="flex gap-1">
                {(['month', 'week', 'day'] as const).map((v) => (
                  <Button key={v} size="sm" variant={view === v ? 'default' : 'ghost'} aria-pressed={view === v} onClick={() => setView(v)}>
                    {v}
                  </Button>
                ))}
              </div>
            </div>

            {/* Grid */}
            <div className="grid grid-cols-7 gap-1 text-xs text-muted-foreground mb-1">
              {['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'].map((d) => (
                <p key={d} className="text-center py-1">
                  {d}
                </p>
              ))}
            </div>
            <div className={`grid grid-cols-7 gap-1 ${view === 'day' ? 'grid-cols-1' : ''}`} style={view === 'day' ? { gridTemplateColumns: '1fr' } : undefined}>
              {days.map((d) => {
                const evs = byDay.get(d.key) ?? [];
                const isSel = d.key === selected;
                return (
                  <button
                    key={d.key}
                    onClick={() => {
                      setSelected(d.key);
                      if (view !== 'day') setAnchor(d.date);
                    }}
                    aria-label={`${d.date.toDateString()}${evs.length ? `, ${evs.length} entries` : ''}`}
                    aria-pressed={isSel}
                    className={`rounded-xl border p-2 text-left transition-colors ${view === 'month' ? 'min-h-20' : 'min-h-28'} ${
                      isSel ? 'border-primary bg-accent/40' : 'border-border/60 hover:border-muted-foreground/40'
                    } ${d.inMonth ? '' : 'opacity-40'}`}
                  >
                    <span className={`text-xs ${d.isToday ? 'bg-primary text-primary-foreground rounded-full px-1.5 py-0.5' : ''}`}>{d.date.getDate()}</span>
                    <div className="flex flex-wrap gap-1 mt-1.5">
                      {evs.slice(0, view === 'month' ? 3 : 6).map((e) => (
                        <span key={e.id} className={`w-2 h-2 rounded-full ${markerFor(e)}`} title={e.title} />
                      ))}
                    </div>
                    {view !== 'month' &&
                      evs.map((e) => (
                        <p key={e.id} className="text-[11px] mt-1 truncate text-muted-foreground">
                          {fmtTime(e.starts_at)} {e.title}
                        </p>
                      ))}
                  </button>
                );
              })}
            </div>

            {/* Legend */}
            <div className="flex flex-wrap gap-5 mt-5 text-xs text-muted-foreground">
              <span className="flex items-center gap-2">
                <span className={`w-2 h-2 rounded-full ${MARKER.personal}`} /> personal
              </span>
              <span className="flex items-center gap-2">
                <span className={`w-2 h-2 rounded-full ${MARKER.healthcare}`} /> healthcare appointment
              </span>
              <span className="flex items-center gap-2">
                <span className={`w-2 h-2 rounded-full ${MARKER.hold}`} /> tentative beni hold
              </span>
            </div>

            {/* Selected day detail */}
            <section className="mt-8 border-t border-border pt-6">
              <h3 className="text-2xl mb-4">{new Date(selected + 'T12:00:00').toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}</h3>
              {selectedEvents.length ? (
                selectedEvents.map((e) => (
                  <div key={e.id} className="flex flex-wrap items-center justify-between gap-3 border border-border rounded-2xl p-4 mb-3">
                    <div>
                      <p className="text-sm">{e.title}</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {fmtTime(e.starts_at)}
                        {e.ends_at ? ` – ${fmtTime(e.ends_at)}` : ''}
                        {e.location ? ` · ${e.location}` : ''} · {isHold(e) ? 'tentative hold — not booked' : isBooked(e) ? 'confirmed' : e.status}
                      </p>
                      {e.notes && <p className="text-xs text-muted-foreground mt-1">{e.notes}</p>}
                    </div>
                    <div className="flex gap-2">
                      {isHold(e) && (
                        <Button size="sm" variant="outline" disabled={busy} onClick={() => onConfirm(e.id)}>
                          <Check size={14} /> confirm
                        </Button>
                      )}
                      {isBooked(e) && <Button size="sm" variant="outline" disabled={busy || !!e.google_event_id} onClick={async()=>{setBusy(true);try{await exportToGoogle({data:{id:e.id}});toast.success('Added to Google Calendar — not a provider booking.');await refresh();}catch(error){toast.error(error instanceof Error?error.message:'Google export failed.');}finally{setBusy(false);}}}>{e.google_event_id?'added to google':'add to google'}</Button>}
                      <Button size="sm" variant="ghost" disabled={busy} aria-label={`Remove ${e.title}`} onClick={() => onDelete(e.id)}>
                        <X size={14} />
                      </Button>
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-sm text-muted-foreground">nothing on this day yet.</p>
              )}
              <Button variant="outline" className="mt-4" onClick={() => setHoldForm(true)}>
                <Plus size={15} /> add calendar hold
              </Button>
            </section>
            <GoogleSchedule anchor={anchor} />
          </div>

          {/* Beni assistant panel */}
          <aside className="border border-border bg-card rounded-2xl p-6 h-fit lg:sticky lg:top-8">
            <h2 className="text-3xl mb-4">let’s find time for your care.</h2>
            <p className="text-sm text-muted-foreground leading-6">
              {upcomingHolds.length
                ? `you have ${upcomingHolds.length} tentative ${upcomingHolds.length === 1 ? 'hold' : 'holds'} waiting. confirm one when the plan is real — a hold is never a booking.`
                : data.profile?.availability
                  ? `you told beni you prefer ${data.profile.availability}. free stretches in your week are good candidates for care.`
                  : 'share your availability in settings and beni will spot good windows for care.'}
            </p>
            <div className="flex flex-col gap-2 mt-6">
              <Button variant="outline" onClick={() => setHoldForm(true)}>
                <Plus size={15} /> add calendar hold
              </Button>
              <Button variant="outline" asChild>
                <Link to="/demo">
                  <MessageCircle size={15} /> text beni
                </Link>
              </Button>
            </div>
            <p className="text-xs text-muted-foreground mt-5 leading-5">
              texting lives in the demo until messaging is connected. beni never books appointments — it suggests, you confirm.
            </p>
          </aside>
        </div>

        {holdForm && <HoldDialog benefits={data.benefits} defaultDate={selected} onClose={() => setHoldForm(false)} onSaved={refresh} />}
      </main>
    </AuthedShell>
  );
}

function HoldDialog({ benefits, defaultDate, onClose, onSaved }: { benefits: Tables<'benefits'>[]; defaultDate: string; onClose: () => void; onSaved: () => Promise<void> }) {
  const [title, setTitle] = useState('');
  const [date, setDate] = useState(defaultDate);
  const [time, setTime] = useState('10:00');
  const [location, setLocation] = useState('');
  const [notes, setNotes] = useState('');
  const [benefitId, setBenefitId] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      await createHold({
        data: {
          title,
          starts_at: new Date(`${date}T${time}`).toISOString(),
          location: location || null,
          notes: notes || null,
          benefit_id: benefitId || null,
        },
      });
      toast.success('hold saved. it’s tentative until you confirm it.');
      await onSaved();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'something went wrong.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center p-5" role="dialog" aria-modal="true" aria-label="Add calendar hold">
      <form onSubmit={save} className="bg-card border border-border rounded-2xl p-7 w-full max-w-md space-y-5">
        <div className="flex items-center justify-between">
          <h2 className="text-3xl">a tentative hold.</h2>
          <Button type="button" variant="ghost" size="icon" aria-label="Close" onClick={onClose}>
            <X />
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">a hold saves a spot. it is not a booked appointment.</p>
        <label className="field">
          appointment type
          <Input required value={title} onChange={(e) => setTitle(e.target.value)} placeholder="dental cleaning" />
        </label>
        <div className="grid grid-cols-2 gap-4">
          <label className="field">
            date
            <Input type="date" required value={date} onChange={(e) => setDate(e.target.value)} />
          </label>
          <label className="field">
            time
            <Input type="time" required value={time} onChange={(e) => setTime(e.target.value)} />
          </label>
        </div>
        <label className="field">
          location
          <Input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="optional" />
        </label>
        <label className="field">
          related benefit
          <select value={benefitId} onChange={(e) => setBenefitId(e.target.value)} className="h-12 rounded-lg border border-border bg-background px-3 text-sm">
            <option value="">none</option>
            {benefits.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          notes
          <Input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="optional" />
        </label>
        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
        <Button disabled={busy} className="w-full">
          {busy ? 'saving…' : 'save hold'}
        </Button>
      </form>
    </div>
  );
}
