import { createFileRoute, Link } from '@tanstack/react-router';
import { useState } from 'react';
import { useSuspenseQuery } from '@tanstack/react-query';
import { Search, FileText, ArrowLeft, Sparkles } from 'lucide-react';
import { AuthedShell } from '@/components/beni/authed-shell';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { hubQuery } from '@/lib/hub-query';
import { pageHead, confirmedUsage } from '@/lib/beni';
import { CATEGORIES, coverageTone } from '@/lib/hub';
import type { Tables } from '@/integrations/supabase/types';
import { activeInsurance } from '@/lib/insurance-rules';

export const Route = createFileRoute('/_authenticated/benefits')({
  head: () => pageHead('everything you’re covered for', 'Browse, search and filter the benefits documented in your insurance plan.'),
  loader: ({ context }) => context.queryClient.ensureQueryData(hubQuery),
  component: BenefitsPage,
});

const TONE_STYLES = {
  covered: 'bg-accent text-foreground',
  'not-covered': 'bg-destructive/20 text-foreground',
  unclear: 'bg-muted text-muted-foreground',
} as const;

function BenefitsPage() {
  const { data } = useSuspenseQuery(hubQuery);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState<string>('all');
  const [perksOnly, setPerksOnly] = useState(false);
  const [selected, setSelected] = useState<Tables<'benefits'> | null>(null);
  const plan = activeInsurance(data.plans);

  const filtered = data.benefits.filter((b) => {
    if (perksOnly && !b.hidden_perk) return false;
    if (category !== 'all' && b.category.toLowerCase() !== category) return false;
    const q = search.toLowerCase();
    return b.name.toLowerCase().includes(q) || (b.description ?? '').toLowerCase().includes(q);
  });

  if (selected) {
    const used = confirmedUsage(data.visits, selected.id);
    const tone = coverageTone(selected.coverage_status);
    return (
      <AuthedShell>
        <main className="page-width max-w-3xl py-12 md:py-16">
          <Button variant="ghost" className="mb-8 -ml-3" onClick={() => setSelected(null)}>
            <ArrowLeft /> all benefits
          </Button>
          <span className={`text-xs rounded-full px-3 py-1 ${TONE_STYLES[tone]}`}>{selected.coverage_status}</span>
          <h1 className="section-title mt-5">{selected.name}</h1>
          <p className="text-muted-foreground text-sm mt-3">{selected.category}</p>
          <div className="grid sm:grid-cols-2 gap-6 mt-10 border-t border-border pt-8">
            <div>
              <p className="text-xs text-muted-foreground mb-2">cost</p>
              <p className="text-sm">{selected.cost || 'cost not documented'}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-2">annual limit</p>
              <p className="text-sm">{selected.visit_limit ? `${selected.visit_limit} visits` : 'no documented visit limit'}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-2">user-recorded usage · not insurer claims</p>
              <p className="text-sm">
                {used} confirmed {used === 1 ? 'visit' : 'visits'}
                {selected.visit_limit ? ` · ${Math.max(selected.visit_limit - used, 0)} remaining` : ''}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-2">source</p>
              <p className="text-sm">
                {plan?.file_name ?? 'your insurance document'} · page {selected.source_page}
              </p>
            </div>
          </div>
          {selected.description && <p className="text-sm leading-7 mt-8">{selected.description}</p>}
          {selected.restrictions && (
            <div className="mt-8 border border-border rounded-2xl p-6">
              <p className="text-xs text-muted-foreground mb-2">restrictions & requirements</p>
              <p className="text-sm leading-6">{selected.restrictions}</p>
            </div>
          )}
          {selected.hidden_perk && <p className="text-sm mt-8">worth exploring: your document covers this often-overlooked benefit · page {selected.source_page}.</p>}
          {selected.coverage_status === 'covered' && <Button asChild className="mt-6"><Link to="/calendar">plan an appointment</Link></Button>}
          <p className="text-xs text-muted-foreground mt-10">coverage details come from your uploaded document. usage is recorded by you, not verified with your insurer.</p>
        </main>
      </AuthedShell>
    );
  }

  return (
    <AuthedShell>
      <main className="page-width py-12 md:py-16">
        
        <h1 className="section-title">everything you’re covered for.</h1>

        <div className="flex flex-wrap gap-4 items-center mt-10 mb-6">
          <div className="relative w-full sm:w-72">
            <Search className="absolute left-3 top-3 text-muted-foreground" size={16} />
            <Input aria-label="Search benefits" placeholder="find a benefit" className="pl-10 h-11" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <Button variant={perksOnly ? 'default' : 'outline'} size="sm" aria-pressed={perksOnly} onClick={() => setPerksOnly(!perksOnly)}>
            <Sparkles size={14} /> hidden perks
          </Button>
        </div>
        <div className="flex flex-wrap gap-2 mb-10">
          {CATEGORIES.map((c) => (
            <Button key={c} size="sm" variant={category === c ? 'default' : 'ghost'} aria-pressed={category === c} onClick={() => setCategory(c)}>
              {c}
            </Button>
          ))}
        </div>

        {filtered.length ? (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map((b) => {
              const tone = coverageTone(b.coverage_status);
              const used = confirmedUsage(data.visits, b.id);
              return (
                <button
                  key={b.id}
                  onClick={() => setSelected(b)}
                  className="text-left border border-border bg-card rounded-2xl p-6 hover:border-muted-foreground/50 transition-colors"
                >
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-xs text-muted-foreground">{b.category}</span>
                    <span className={`text-[11px] rounded-full px-2.5 py-0.5 ${TONE_STYLES[tone]}`}>{b.coverage_status}</span>
                  </div>
                  <h3 className="text-2xl my-3 flex items-center gap-2">
                    {b.name}
                    {b.hidden_perk && <Sparkles size={15} className="text-muted-foreground shrink-0" />}
                  </h3>
                  <p className="text-sm">{b.cost || 'cost not documented'}</p>
                  <p className="text-xs text-muted-foreground mt-3">
                    {b.visit_limit ? `${used} / ${b.visit_limit} visits used` : `${used} confirmed ${used === 1 ? 'visit' : 'visits'}`} · page {b.source_page}
                  </p>
                </button>
              );
            })}
          </div>
        ) : (
          <div className="py-12 border-t border-border flex gap-5 items-start">
            <FileText size={28} className="text-muted-foreground shrink-0" />
            <div>
              <h3 className="text-3xl">{data.benefits.length ? 'nothing matches just yet.' : 'the answers are in your plan.'}</h3>
              <p className="text-sm text-muted-foreground mt-3">
                {data.benefits.length
                  ? 'try another search, category, or clear the hidden perks filter.'
                  : plan
                    ? 'no benefits were documented in this plan. review your source PDF or upload a more detailed document.'
                    : 'upload and confirm an insurance plan to see its documented benefits.'}
              </p>
              <Button asChild variant="outline" className="mt-4"><Link to="/insurance">my insurance</Link></Button>
            </div>
          </div>
        )}
      </main>
    </AuthedShell>
  );
}
