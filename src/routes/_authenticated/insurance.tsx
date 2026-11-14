import { fmtDate } from '@/lib/hub';
import { createFileRoute, Link } from '@tanstack/react-router';
import { useState } from 'react';
import { useQuery, useQueryClient, useSuspenseQuery } from '@tanstack/react-query';
import { useServerFn } from '@tanstack/react-start';
import { FileText, UploadCloud, RotateCcw, Check, ArrowUpRight } from 'lucide-react';
import { AuthedShell } from '@/components/beni/authed-shell';
import { Upload } from '@/components/beni/upload';
import { Button } from '@/components/ui/button';
import { hubQuery } from '@/lib/hub-query';
import { pageHead } from '@/lib/beni';
import { activeInsurance } from '@/lib/insurance-rules';
import { activateInsurance, viewInsurancePdf } from '@/lib/insurance.functions';
import { extractPlan } from '@/lib/beni-ai.functions';
import { supabase } from '@/integrations/supabase/client';
import type { Tables } from '@/integrations/supabase/types';

export const Route = createFileRoute('/_authenticated/insurance')({
  head: () => pageHead('my insurance', 'Securely upload, review and change your insurance plan with page-cited benefits.'),
  loader: ({ context }) => context.queryClient.ensureQueryData(hubQuery),
  component: InsurancePage,
});

function PlanDetails({ plan }: { plan: Tables<'plans_uploaded'> }) {
  return <dl className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6 mt-6">{[
    ['provider', plan.provider], ['plan name', plan.plan_name], ['plan type', plan.plan_type], ['deductible', plan.deductible], ['out-of-pocket maximum', plan.out_of_pocket_max], ['coverage dates', plan.effective_start ? `${fmtDate(plan.effective_start)} – ${plan.effective_end ? fmtDate(plan.effective_end) : 'Needs verification'}` : null],
  ].map(([label, value]) => <div key={label}><dt className="text-xs text-muted-foreground mb-2">{label}</dt><dd className="text-sm break-words">{value || 'Needs verification'}</dd></div>)}</dl>;
}

function InsurancePage() {
  const { data } = useSuspenseQuery(hubQuery);
  const active = activeInsurance(data.plans);
  const [uploading, setUploading] = useState(false), [selectedId, setSelectedId] = useState<string>();
  const [busy, setBusy] = useState(false), [error, setError] = useState('');
  const qc = useQueryClient();
  const activate = useServerFn(activateInsurance), extract = useServerFn(extractPlan), view = useServerFn(viewInsurancePdf);
  const newest = data.plans[0];
  const review = data.plans.find(p => p.id === selectedId) ?? (newest?.status === 'ready' && !newest.is_active ? newest : undefined);
  const { data: reviewBenefits = [] } = useQuery({ queryKey: ['insurance-review', review?.id], enabled: Boolean(review), queryFn: async () => {
    if (!review) return [];
    const result = await supabase.from('benefits').select('*').eq('plan_id', review.id);
    if (result.error) throw new Error('Benefits could not be loaded.');
    return result.data;
  } });
  async function action(work: () => Promise<unknown>) {
    setBusy(true); setError('');
    try { await work(); await qc.invalidateQueries({ queryKey: ['beni-hub'] }); await qc.invalidateQueries({ queryKey: ['insurance-review'] }); }
    catch (e) { setError(e instanceof Error ? e.message : 'Please try again.'); }
    finally { setBusy(false); }
  }
  return <AuthedShell><main className="page-width py-12 md:py-16">
    <div className="flex flex-wrap items-center justify-between gap-5"><h1 className="section-title">my insurance.</h1><Button onClick={() => setUploading(!uploading)}><UploadCloud />{active ? 'Change Insurance' : 'Upload Insurance'}</Button></div>
    <section className="border-y border-border py-8 mt-10">
      <h2 className="text-3xl">{active ? 'your active plan.' : 'no active insurance yet.'}</h2>
      {active ? <><PlanDetails plan={active} /><p className="text-xs text-muted-foreground mt-6">last updated {fmtDate(active.updated_at)} · {active.file_name} · {data.benefits.length} documented benefits</p><Button asChild variant="link" className="px-0 mt-3"><Link to="/benefits">explore coverage <ArrowUpRight /></Link></Button></> : <p className="text-sm text-muted-foreground mt-4">upload a plan, review the documented coverage, then confirm it as your active insurance.</p>}
    </section>
    {(uploading || !active) && <section className="py-10"><Upload onUploaded={() => { setSelectedId(undefined); setUploading(false); }} /></section>}
    {review && !review.is_active && <section className="border-b border-border py-10">
      <p className="text-xs text-muted-foreground">not active · awaiting your confirmation</p><h2 className="text-4xl mt-3">review your new plan.</h2><p className="text-sm mt-3 break-words">{review.file_name}</p><PlanDetails plan={review} />
      <h3 className="text-2xl mt-8 mb-4">documented benefits.</h3>
      <div className="divide-y divide-border">{reviewBenefits.map(b => <div key={b.id} className="py-4"><p className="text-sm">{b.name} · {b.coverage_status === 'coverage unclear' ? 'Needs verification' : b.coverage_status}</p><p className="text-xs text-muted-foreground mt-2">{b.category} · {b.cost || 'cost needs verification'} · {b.visit_limit != null ? `${b.visit_limit} visits` : 'visit limit needs verification'} · page {b.source_page}</p>{b.restrictions && <p className="text-xs mt-2">{b.restrictions}</p>}</div>)}</div>
      <p className="text-sm text-muted-foreground mt-6">make this your active insurance? previous documents and recorded visits will be preserved; only this plan’s benefits will appear as current coverage.</p>
      <div className="flex flex-wrap gap-3 mt-5"><Button disabled={busy} onClick={() => action(async () => { await activate({ data: { planId: review.id } }); setSelectedId(undefined); setUploading(false); })}><Check />{busy ? 'saving…' : 'confirm active insurance'}</Button><Button variant="outline" disabled={busy} onClick={() => action(async () => { const result = await view({ data: { planId: review.id } }); window.open(result.url, '_blank', 'noopener,noreferrer'); })}><FileText />open source PDF</Button></div>
    </section>}
    {error && <p role="alert" className="text-destructive text-sm mt-5">{error}</p>}
    <section className="py-10"><h2 className="text-3xl mb-6">your documents.</h2><div className="divide-y divide-border">{data.plans.map(plan => <div key={plan.id} className="py-5 flex flex-wrap items-center justify-between gap-4"><div className="min-w-0"><p className="text-sm break-words">{plan.file_name}</p><p className="text-xs text-muted-foreground mt-2">{plan.is_active ? 'active' : plan.status === 'ready' ? 'saved · not active' : plan.status} · {fmtDate(plan.created_at)}</p>{plan.extraction_error && <p className="text-xs text-destructive mt-2">{plan.extraction_error}</p>}</div><div className="flex flex-wrap gap-2">{plan.status === 'ready' && !plan.is_active && <Button variant="outline" size="sm" onClick={() => setSelectedId(plan.id)}>review plan</Button>}{['failed','uploaded'].includes(plan.status) && <Button variant="outline" size="sm" disabled={busy} onClick={() => action(async () => { const result = await extract({ data: { planId: plan.id } }); if (result.status === 'failed') throw new Error(result.message); setSelectedId(plan.id); })}><RotateCcw />retry processing</Button>}<Button variant="ghost" size="sm" title="Open private PDF" disabled={busy} onClick={() => action(async () => { const result = await view({ data: { planId: plan.id } }); window.open(result.url, '_blank', 'noopener,noreferrer'); })}><FileText />PDF</Button></div></div>)}</div></section>
  </main></AuthedShell>;
}