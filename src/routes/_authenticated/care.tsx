import { createFileRoute } from '@tanstack/react-router';
import { useState } from 'react';
import { useSuspenseQuery, useQueryClient } from '@tanstack/react-query';
import { CalendarDays, Check, Plus, X, Bell } from 'lucide-react';
import { AuthedShell } from '@/components/beni/authed-shell';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { hubQuery } from '@/lib/hub-query';
import { pageHead, confirmedUsage } from '@/lib/beni';
import { fmtDate, fmtTime, isHold } from '@/lib/hub';
import { addVisit, updateVisit, addReminder, completeReminder, confirmHold } from '@/lib/benefits.functions';
import { toast } from 'sonner';

export const Route = createFileRoute('/_authenticated/care')({
  head: () => pageHead('your care, all in one place', 'Planned appointments, completed visits and care reminders.'),
  loader: ({ context }) => context.queryClient.ensureQueryData(hubQuery),
  component: CarePage,
});

function CarePage() {
  const { data } = useSuspenseQuery(hubQuery);
  const qc = useQueryClient();
  const [visitForm, setVisitForm] = useState(false);
  const [reminderForm, setReminderForm] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [editDate, setEditDate] = useState('');
  const [busy, setBusy] = useState(false);

  const now = new Date().toISOString();
  const upcoming = data.events.filter((e) => e.kind === 'healthcare' && e.starts_at >= now);
  const completed = [...data.visits].sort((a, b) => b.visit_date.localeCompare(a.visit_date));
  const openReminders = data.reminders.filter((r) => r.status !== 'done');
  const benefitName = (id: string | null) => data.benefits.find((b) => b.id === id)?.name;

  async function refresh() {
    await qc.invalidateQueries({ queryKey: ['beni-hub'] });
  }
  async function run(fn: () => Promise<unknown>, ok: string) {
    setBusy(true);
    try {
      await fn();
      toast.success(ok);
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
        
        <h1 className="section-title">your care, all in one place.</h1>

        {/* Upcoming */}
        <section className="mt-12 border-t border-border pt-8">
          <h2 className="text-3xl mb-6">upcoming.</h2>
          {upcoming.length ? (
            upcoming.map((e) => (
              <div key={e.id} className="flex flex-wrap items-center justify-between gap-3 border border-border rounded-2xl p-5 mb-3">
                <div className="flex gap-3">
                  <CalendarDays size={20} className="text-muted-foreground shrink-0" />
                  <div>
                    <p className="text-sm">{e.title}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {fmtDate(e.starts_at)} · {fmtTime(e.starts_at)}
                      {e.location ? ` · ${e.location}` : ''} · {isHold(e) ? 'tentative hold — not booked' : 'confirmed'}
                    </p>
                  </div>
                </div>
                {isHold(e) && (
                  <Button size="sm" variant="outline" disabled={busy} onClick={() => run(() => confirmHold({ data: { id: e.id } }), 'appointment confirmed.')}>
                    <Check size={14} /> confirm
                  </Button>
                )}
              </div>
            ))
          ) : (
            <p className="text-sm text-muted-foreground">nothing planned yet. add a hold from your calendar when you’re ready.</p>
          )}
        </section>

        {/* Completed */}
        <section className="mt-12 border-t border-border pt-8">
          <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
            <h2 className="text-3xl">completed.</h2>
            <Button variant="outline" size="sm" onClick={() => setVisitForm(true)}>
              <Plus size={14} /> add a visit
            </Button>
          </div>
          {completed.length ? (
            completed.map((v) => (
              <div key={v.id} className="flex flex-wrap items-center justify-between gap-3 py-3 border-b border-border/50">
                {editing === v.id ? (
                  <form
                    className="flex flex-wrap items-center gap-3 w-full"
                    onSubmit={(e) => {
                      e.preventDefault();
                      run(() => updateVisit({ data: { id: v.id, visit_date: editDate, benefit_id: v.benefit_id } }), 'visit updated.').then(() => setEditing(null));
                    }}
                  >
                    <Input type="date" required value={editDate} onChange={(e) => setEditDate(e.target.value)} className="w-44" />
                    <Button size="sm" disabled={busy}>
                      save
                    </Button>
                    <Button type="button" size="sm" variant="ghost" onClick={() => setEditing(null)}>
                      <X size={14} />
                    </Button>
                  </form>
                ) : (
                  <>
                    <div>
                      <p className="text-sm">{benefitName(v.benefit_id) ?? 'healthcare visit'}</p>
                      <p className="text-xs text-muted-foreground mt-1">{fmtDate(v.visit_date)} · confirmed by you</p>
                    </div>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        setEditing(v.id);
                        setEditDate(v.visit_date);
                      }}
                    >
                      edit
                    </Button>
                  </>
                )}
              </div>
            ))
          ) : (
            <p className="text-sm text-muted-foreground">no visits recorded yet. beni only counts visits you confirm.</p>
          )}
        </section>

        {/* Benefit usage */}
        {data.benefits.length > 0 && (
          <section className="mt-12 border-t border-border pt-8">
            <h2 className="text-3xl mb-6">benefit usage.</h2>
            {data.benefits.map((b) => {
              const used = confirmedUsage(data.visits, b.id);
              return (
                <div key={b.id} className="py-3">
                  <div className="flex justify-between text-sm mb-2">
                    <span>{b.name}</span>
                    <span className="text-muted-foreground">
                      {used}
                      {b.visit_limit ? ` / ${b.visit_limit}` : ''} used
                    </span>
                  </div>
                  {b.visit_limit && <progress className="w-full accent-primary h-1" value={used} max={b.visit_limit} />}
                </div>
              );
            })}
          </section>
        )}

        {/* Reminders */}
        <section className="mt-12 border-t border-border pt-8">
          <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
            <h2 className="text-3xl">care reminders.</h2>
            <Button variant="outline" size="sm" onClick={() => setReminderForm(true)}>
              <Plus size={14} /> add a reminder
            </Button>
          </div>
          {openReminders.length ? (
            openReminders.map((r) => (
              <div key={r.id} className="flex items-center justify-between gap-3 py-3 border-b border-border/50">
                <div className="flex gap-3 items-center">
                  <Bell size={16} className="text-muted-foreground shrink-0" />
                  <p className="text-sm">
                    {r.title}
                    {r.remind_at ? <span className="text-xs text-muted-foreground"> · {fmtDate(r.remind_at)}</span> : null}
                  </p>
                </div>
                <Button size="sm" variant="ghost" disabled={busy} onClick={() => run(() => completeReminder({ data: { id: r.id } }), 'reminder done.')}>
                  <Check size={14} /> done
                </Button>
              </div>
            ))
          ) : (
            <p className="text-sm text-muted-foreground">no open reminders. a little breathing room.</p>
          )}
        </section>

        {visitForm && <VisitDialog benefits={data.benefits} onClose={() => setVisitForm(false)} onSaved={refresh} />}
        {reminderForm && <ReminderDialog onClose={() => setReminderForm(false)} onSaved={refresh} />}
      </main>
    </AuthedShell>
  );
}

function VisitDialog({ benefits, onClose, onSaved }: { benefits: { id: string; name: string }[]; onClose: () => void; onSaved: () => Promise<void> }) {
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [benefitId, setBenefitId] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      await addVisit({ data: { visit_date: date, benefit_id: benefitId || null } });
      toast.success('visit recorded.');
      await onSaved();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'something went wrong.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center p-5" role="dialog" aria-modal="true" aria-label="Add a completed visit">
      <form onSubmit={save} className="bg-card border border-border rounded-2xl p-7 w-full max-w-md space-y-5">
        <div className="flex items-center justify-between">
          <h2 className="text-3xl">a visit that happened.</h2>
          <Button type="button" variant="ghost" size="icon" aria-label="Close" onClick={onClose}>
            <X />
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">only add visits you actually attended — this updates your benefit usage.</p>
        <label className="field">
          date of visit
          <Input type="date" required value={date} onChange={(e) => setDate(e.target.value)} />
        </label>
        <label className="field">
          related benefit
          <select value={benefitId} onChange={(e) => setBenefitId(e.target.value)} className="h-12 rounded-lg border border-border bg-background px-3 text-sm">
            <option value="">general visit</option>
            {benefits.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
        </label>
        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
        <Button disabled={busy} className="w-full">
          {busy ? 'saving…' : 'record visit'}
        </Button>
      </form>
    </div>
  );
}

function ReminderDialog({ onClose, onSaved }: { onClose: () => void; onSaved: () => Promise<void> }) {
  const [title, setTitle] = useState('');
  const [date, setDate] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      await addReminder({ data: { title, remind_at: date ? new Date(`${date}T09:00`).toISOString() : null } });
      toast.success('reminder saved.');
      await onSaved();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'something went wrong.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center p-5" role="dialog" aria-modal="true" aria-label="Add a reminder">
      <form onSubmit={save} className="bg-card border border-border rounded-2xl p-7 w-full max-w-md space-y-5">
        <div className="flex items-center justify-between">
          <h2 className="text-3xl">a gentle reminder.</h2>
          <Button type="button" variant="ghost" size="icon" aria-label="Close" onClick={onClose}>
            <X />
          </Button>
        </div>
        <label className="field">
          what should beni remind you about?
          <Input required value={title} onChange={(e) => setTitle(e.target.value)} placeholder="schedule an eye exam" />
        </label>
        <label className="field">
          date
          <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </label>
        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
        <Button disabled={busy} className="w-full">
          {busy ? 'saving…' : 'save reminder'}
        </Button>
      </form>
    </div>
  );
}
