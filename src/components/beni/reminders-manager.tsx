import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Plus, Pause, Play, Trash2, Check, Pencil, Bell } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { saveReminder, setReminderPaused, deleteReminder, completeReminder } from '@/lib/benefits.functions';
import { FREQUENCIES, frequencyLabel, nextOccurrence, type Frequency } from '@/lib/reminder-rules';
import { fmtDate, fmtTime } from '@/lib/hub';
import { toKey } from '@/lib/calendar';
import type { Tables } from '@/integrations/supabase/types';

type Reminder = Tables<'reminders'>;
const pad = (n: number) => String(n).padStart(2, '0');

export function ReminderDialog({ reminder, benefits, benefitId, onClose }: { reminder?: Reminder | undefined; benefits: Tables<'benefits'>[]; benefitId?: string | undefined; onClose: () => void }) {
  const qc = useQueryClient();
  const start = reminder?.remind_at ? new Date(reminder.remind_at) : (() => { const d = new Date(Date.now() + 86400000); d.setHours(10, 0, 0, 0); return d; })();
  const preBenefit = benefits.find((b) => b.id === (reminder?.benefit_id ?? benefitId));
  const [title, setTitle] = useState(reminder?.title ?? (preBenefit ? `Schedule ${preBenefit.name.toLowerCase()}` : ''));
  const [benefit, setBenefit] = useState(preBenefit?.id ?? '');
  const [frequency, setFrequency] = useState<Frequency>((reminder?.frequency as Frequency) ?? 'once');
  const [days, setDays] = useState(reminder?.interval_days ?? 30);
  const [date, setDate] = useState(toKey(start));
  const [time, setTime] = useState(`${pad(start.getHours())}:${pad(start.getMinutes())}`);
  const [method, setMethod] = useState<'text' | 'in_app'>((reminder?.method as 'text' | 'in_app') ?? 'text');
  const [end, setEnd] = useState(reminder?.end_date ?? '');
  const [busy, setBusy] = useState(false), [error, setError] = useState('');
  const first = new Date(`${date}T${time}`);
  const second = Number.isNaN(first.getTime()) ? null : nextOccurrence(first, frequency, days);
  async function save(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setError('');
    try {
      if (first.getTime() < Date.now() - 60000) throw new Error('Choose a start time in the future.');
      await saveReminder({ data: { ...(reminder ? { id: reminder.id } : {}), title, remind_at: first.toISOString(), frequency, interval_days: frequency === 'custom' ? days : null, benefit_id: benefit || null, end_date: end || null, method } });
      toast.success(reminder ? 'Reminder updated.' : 'Reminder created.');
      await qc.invalidateQueries({ queryKey: ['beni-hub'] }); onClose();
    } catch (e) { setError(e instanceof Error ? e.message : 'Please try again.'); } finally { setBusy(false); }
  }
  return <Dialog open onOpenChange={(o) => { if (!o) onClose(); }}><DialogContent className="max-h-[90dvh] overflow-y-auto w-[calc(100%-32px)]">
    <DialogTitle className="text-3xl">{reminder ? 'Edit reminder' : 'Create recurring reminder'}</DialogTitle>
    <DialogDescription>Beni reminds you to book — it doesn't book anything with a provider.</DialogDescription>
    <form onSubmit={save} className="space-y-4">
      <label className="field">Reminder title<Input required autoFocus value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Schedule a dental cleaning" /></label>
      <label className="field">Related benefit (optional)<select value={benefit} onChange={(e) => setBenefit(e.target.value)}><option value="">None</option>{benefits.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}</select></label>
      <label className="field">Frequency<select value={frequency} onChange={(e) => setFrequency(e.target.value as Frequency)}>{FREQUENCIES.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></label>
      {frequency === 'custom' && <label className="field">Every how many days?<Input type="number" min={1} max={730} value={days} onChange={(e) => setDays(Number(e.target.value))} /></label>}
      <div className="grid grid-cols-2 gap-4"><label className="field">Start date<Input type="date" required value={date} onChange={(e) => setDate(e.target.value)} /></label><label className="field">Time<Input type="time" required value={time} onChange={(e) => setTime(e.target.value)} /></label></div>
      <label className="field">Notify me by<select value={method} onChange={(e) => setMethod(e.target.value as 'text' | 'in_app')}><option value="text">Text message (needs SMS consent)</option><option value="in_app">In Beni only</option></select></label>
      {frequency !== 'once' && <label className="field">End date (optional)<Input type="date" value={end} onChange={(e) => setEnd(e.target.value)} /></label>}
      {!Number.isNaN(first.getTime()) && <p className="text-sm border border-border rounded-lg p-3" role="status">First reminder: {fmtDate(first.toISOString())} at {fmtTime(first.toISOString())}{second ? ` · then ${fmtDate(second.toISOString())}` : ''}</p>}
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      <Button disabled={busy} className="w-full">{busy ? 'Saving…' : 'Save reminder'}</Button>
    </form>
  </DialogContent></Dialog>;
}

export function RemindersManager({ reminders, benefits }: { reminders: Reminder[]; benefits: Tables<'benefits'>[] }) {
  const qc = useQueryClient();
  const [editing, setEditing] = useState<Reminder | 'new' | null>(null);
  async function act(work: () => Promise<unknown>, msg: string) {
    try { await work(); toast.success(msg); await qc.invalidateQueries({ queryKey: ['beni-hub'] }); } catch (e) { toast.error(e instanceof Error ? e.message : 'Please try again.'); }
  }
  const sorted = [...reminders].sort((a, b) => (a.status === 'open' ? 0 : 1) - (b.status === 'open' ? 0 : 1) || (a.remind_at ?? '').localeCompare(b.remind_at ?? ''));
  return <section className="border-t border-border pt-10">
    <div className="flex flex-wrap items-center justify-between gap-4 mb-6"><h2 className="text-3xl">Your reminders</h2><Button onClick={() => setEditing('new')}><Plus size={16} />Create Recurring Reminder</Button></div>
    {sorted.length ? <ul className="divide-y divide-border border-y border-border">{sorted.map((r) => {
      const state = r.status !== 'open' ? (r.status === 'done' ? 'Completed' : 'Finished') : r.paused ? 'Paused' : 'Active';
      return <li key={r.id} className="py-4 flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0"><p className="text-sm flex items-center gap-2"><Bell size={14} className="text-muted-foreground" />{r.title}</p>
          <p className="text-xs text-muted-foreground mt-1">{frequencyLabel(r.frequency, r.interval_days)} · {state}{r.status === 'open' && r.remind_at ? ` · next ${fmtDate(r.remind_at)} at ${fmtTime(r.remind_at)}` : ''}{r.delivery_status ? ` · last: ${r.delivery_status === 'sent' ? 'texted' : r.delivery_status === 'in_app' ? 'shown in Beni' : r.delivery_status}` : ''}</p></div>
        {r.status === 'open' && <div className="flex flex-wrap gap-1">
          <Button variant="ghost" size="sm" onClick={() => setEditing(r)}><Pencil size={14} />Edit</Button>
          <Button variant="ghost" size="sm" onClick={() => act(() => setReminderPaused({ data: { id: r.id, paused: !r.paused } }), r.paused ? 'Reminder resumed.' : 'Reminder paused.')}>{r.paused ? <Play size={14} /> : <Pause size={14} />}{r.paused ? 'Resume' : 'Pause'}</Button>
          <Button variant="ghost" size="sm" onClick={() => act(() => completeReminder({ data: { id: r.id } }), 'Marked completed.')}><Check size={14} />Complete</Button>
          <Button variant="ghost" size="sm" aria-label={`Delete ${r.title}`} onClick={() => { if (window.confirm('Delete this reminder?')) void act(() => deleteReminder({ data: { id: r.id } }), 'Reminder deleted.'); }}><Trash2 size={14} />Delete</Button>
        </div>}
        {r.status !== 'open' && <Button variant="ghost" size="sm" onClick={() => act(() => deleteReminder({ data: { id: r.id } }), 'Reminder deleted.')}><Trash2 size={14} />Delete</Button>}
      </li>;
    })}</ul> : <p className="text-sm text-muted-foreground">No reminders yet. Try “schedule a dental cleaning every six months.”</p>}
    {editing && <ReminderDialog reminder={editing === 'new' ? undefined : editing} benefits={benefits} onClose={() => setEditing(null)} />}
  </section>;
}
