import { createFileRoute, Link } from '@tanstack/react-router';
import { useState } from 'react';
import { useSuspenseQuery, useQueryClient } from '@tanstack/react-query';
import { User, Bell, FileText, Plug, ShieldCheck, CalendarDays, MessageCircle } from 'lucide-react';
import { AuthedShell } from '@/components/beni/authed-shell';
import { PersonalFields, type ProfileFields } from '@/components/beni/profile-form';
import { Preferences } from '@/components/beni/preferences';
import { Upload } from '@/components/beni/upload';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { hubQuery } from '@/lib/hub-query';
import { pageHead } from '@/lib/beni';
import { toast } from 'sonner';
import type { TablesUpdate } from '@/integrations/supabase/types';
import { CalendarConnection } from '@/components/beni/calendar-connection';
import { LinqConnection } from '@/components/beni/linq-connection';

export const Route = createFileRoute('/_authenticated/settings')({
  head: () => pageHead('your preferences', 'Manage your personal information, notifications, documents, connections and privacy.'),
  loader: ({ context }) => context.queryClient.ensureQueryData(hubQuery),
  component: Settings,
});

const TABS = [
  { id: 'personal', label: 'personal', icon: User },
  { id: 'notifications', label: 'notifications', icon: Bell },
  { id: 'documents', label: 'documents', icon: FileText },
  { id: 'connections', label: 'connections', icon: Plug },
  { id: 'privacy', label: 'privacy', icon: ShieldCheck },
] as const;

type Tab = (typeof TABS)[number]['id'];

type NotifyFields = {
  notify_sms: boolean;
  notify_appointments: boolean;
  notify_benefits: boolean;
  notify_expiration: boolean;
  notify_checkins: boolean;
  reminder_frequency: string;
  messaging_hours: string;
  timezone: string;
};

const TIMEZONES = ['America/Los_Angeles', 'America/Denver', 'America/Chicago', 'America/New_York', 'Pacific/Honolulu'];

function Settings() {
  const { data } = useSuspenseQuery(hubQuery);
  const qc = useQueryClient();
  const [tab, setTab] = useState<Tab>('personal');
  const [busy, setBusy] = useState(false);

  const p = data.profile;
  const [profile, setProfile] = useState<ProfileFields>(
    p ?? { first_name: '', phone: '', organization: '', current_city: '', home_city: '', sms_consent: false, break_start: null, break_end: null, availability: '', interests: [], reminder_preferences: [] },
  );
  const [notify, setNotify] = useState<NotifyFields>({
    notify_sms: p?.notify_sms ?? true,
    notify_appointments: p?.notify_appointments ?? true,
    notify_benefits: p?.notify_benefits ?? true,
    notify_expiration: p?.notify_expiration ?? true,
    notify_checkins: p?.notify_checkins ?? true,
    reminder_frequency: p?.reminder_frequency ?? 'weekly',
    messaging_hours: p?.messaging_hours ?? 'anytime',
    timezone: p?.timezone ?? 'America/Los_Angeles',
  });

  async function save(fields: TablesUpdate<'profiles'>, ok: string) {
    setBusy(true);
    const { error } = await supabase.from('profiles').update(fields).eq('id', p?.id ?? '');
    setBusy(false);
    if (error) toast.error(error.message);
    else {
      toast.success(ok);
      qc.invalidateQueries({ queryKey: ['beni-hub'] });
    }
  }

  const toggle = (key: keyof NotifyFields) => (
    <input
      type="checkbox"
      checked={Boolean(notify[key])}
      onChange={(e) => setNotify({ ...notify, [key]: e.target.checked })}
      className="mt-1 accent-primary"
    />
  );

  return (
    <AuthedShell>
      <main className="page-width max-w-3xl py-12 md:py-16">
        <h1 className="section-title mb-10">your life. your preferences.</h1>

        <div className="flex flex-wrap gap-2 mb-12" role="tablist" aria-label="Settings sections">
          {TABS.map(({ id, label, icon: Icon }) => (
            <Button key={id} role="tab" aria-selected={tab === id} size="sm" variant={tab === id ? 'default' : 'ghost'} onClick={() => setTab(id)}>
              <Icon size={14} /> {label}
            </Button>
          ))}
        </div>

        {tab === 'personal' && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              save(profile, 'your information is saved.');
            }}
            className="space-y-12"
          >
            <section>
              <h2 className="text-3xl mb-6">the basics.</h2>
              <PersonalFields value={profile} onChange={setProfile} />
            </section>
            <section className="border-t border-border pt-10">
              <h2 className="text-3xl mb-6">make room for care.</h2>
              <Preferences value={profile} onChange={setProfile} />
            </section>
            <Button disabled={busy} size="lg">
              {busy ? 'saving…' : 'save preferences'}
            </Button>
          </form>
        )}

        {tab === 'notifications' && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (notify.notify_sms && !profile.sms_consent) {
                toast.error('text reminders need your SMS consent — turn it on in privacy first.');
                return;
              }
              save(notify, 'your notification settings are saved.');
            }}
            className="space-y-10"
          >
            <section>
              <h2 className="text-3xl mb-6">how beni reaches you.</h2>
              <div className="space-y-4">
                {(
                  [
                    ['notify_sms', 'text message reminders', 'master switch for texts from beni'],
                    ['notify_appointments', 'appointment reminders', 'before confirmed appointments and holds'],
                    ['notify_benefits', 'benefits discovery', 'when beni spots something documented and unused'],
                    ['notify_expiration', 'benefit expiration reminders', 'before documented limits or plan dates lapse'],
                    ['notify_checkins', 'post-visit check-ins', 'a gentle note after confirmed visits'],
                  ] as const
                ).map(([key, label, hint]) => (
                  <label key={key} className="flex gap-3 items-start text-sm">
                    {toggle(key)}
                    <span>
                      {label}
                      <span className="block text-xs text-muted-foreground mt-0.5">{hint}</span>
                    </span>
                  </label>
                ))}
              </div>
              {!profile.sms_consent && <p className="text-xs text-muted-foreground mt-4">SMS consent is off — texts stay paused until you opt in under privacy.</p>}
            </section>
            <section className="border-t border-border pt-10 grid sm:grid-cols-3 gap-5">
              <label className="field">
                reminder frequency
                <select value={notify.reminder_frequency} onChange={(e) => setNotify({ ...notify, reminder_frequency: e.target.value })}>
                  <option value="daily">daily</option>
                  <option value="weekly">weekly</option>
                  <option value="monthly">monthly</option>
                </select>
              </label>
              <label className="field">
                preferred messaging hours
                <select value={notify.messaging_hours} onChange={(e) => setNotify({ ...notify, messaging_hours: e.target.value })}>
                  <option value="anytime">anytime</option>
                  <option value="mornings">mornings</option>
                  <option value="afternoons">afternoons</option>
                  <option value="evenings">evenings</option>
                </select>
              </label>
              <label className="field">
                time zone
                <select value={notify.timezone} onChange={(e) => setNotify({ ...notify, timezone: e.target.value })}>
                  {TIMEZONES.map((tz) => (
                    <option key={tz}>{tz}</option>
                  ))}
                </select>
              </label>
            </section>
            <Button disabled={busy} size="lg">
              {busy ? 'saving…' : 'save notification settings'}
            </Button>
          </form>
        )}

        {tab === 'documents' && (
          <section className="space-y-8">
            <h2 className="text-3xl">your insurance documents.</h2>
            {data.plans.length ? (
              <div className="space-y-3">
                {data.plans.map((plan) => (
                  <div key={plan.id} className="border border-border rounded-2xl p-5 flex flex-wrap items-center justify-between gap-4">
                    <div>
                      <p className="text-sm">{plan.file_name}</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {plan.status === 'uploaded' ? 'awaiting benefit extraction' : plan.status} · uploaded {new Date(plan.created_at).toLocaleDateString()}
                        {plan.effective_start ? ` · effective ${plan.effective_start}${plan.effective_end ? ` – ${plan.effective_end}` : ''}` : ''}
                      </p>
                    </div>
                    <FileText size={18} className="text-muted-foreground" />
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">no documents yet.</p>
            )}
            <div className="border-t border-border pt-8">
              <h3 className="text-2xl mb-5">{data.plans.length ? 'add or replace a document.' : 'add your first document.'}</h3>
              <Upload />
            </div>
          </section>
        )}

        {tab === 'connections' && (
          <section className="space-y-6">
            <h2 className="text-3xl">connected accounts.</h2>
            <div className="border border-border rounded-2xl p-6 flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <CalendarDays size={20} className="text-muted-foreground" />
                <div>
                  <p className="text-sm">google calendar</p>
                </div>
              </div>
              <CalendarConnection />
            </div>
            <div className="border border-border rounded-2xl p-6 flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <MessageCircle size={20} className="text-muted-foreground" />
                <div>
                  <p className="text-sm">text messaging (linq)</p>
                </div>
              </div>
              <LinqConnection />
            </div>
          </section>
        )}

        {tab === 'privacy' && (
          <section className="space-y-8">
            <h2 className="text-3xl">your privacy.</h2>
            <label className="flex gap-3 items-start text-sm border border-border rounded-2xl p-6">
              <input
                type="checkbox"
                className="mt-1 accent-primary"
                checked={profile.sms_consent}
                onChange={(e) => {
                  const sms_consent = e.target.checked;
                  setProfile({ ...profile, sms_consent });
                  save({ sms_consent }, sms_consent ? 'texts opted in.' : 'texts opted out. beni will stay quiet.');
                }}
              />
              <span>
                SMS consent
                <span className="block text-xs text-muted-foreground mt-1">
                  I agree to receive conversational messages and care reminders from beni. Message and data rates may apply. Unchecking opts out immediately — the same as replying STOP.
                </span>
              </span>
            </label>
            <div className="border border-border rounded-2xl p-6">
              <p className="text-sm">your data</p>
              <p className="text-xs text-muted-foreground mt-2 leading-5">
                your profile, documents, visits and calendar holds are private to you and stored securely. coverage details come only from documents you upload — beni never invents them. to export or delete
                your data, text beni or reach out and we’ll take care of it.
              </p>
            </div>
          </section>
        )}
      </main>
    </AuthedShell>
  );
}
