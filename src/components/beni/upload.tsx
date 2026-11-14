import { useRef, useState } from 'react';
import { useServerFn } from '@tanstack/react-start';
import { Link } from '@tanstack/react-router';
import { UploadCloud, FileText, Check, LoaderCircle, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { validatePdf } from '@/lib/beni';
import { useQueryClient } from '@tanstack/react-query';
import { extractPlan } from '@/lib/beni-ai.functions';

export function Upload({ onUploaded }: { onUploaded?: () => void }) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false), [name, setName] = useState(''), [error, setError] = useState('');
  const [planId, setPlanId] = useState<string>(), [found, setFound] = useState<number | null>(null);
  const qc = useQueryClient();
  const extract = useServerFn(extractPlan);
  async function process(id: string) {
    const result = await extract({ data: { planId: id } });
    if (result.status === 'ready') setFound(result.benefits);
    else setError(result.message ?? 'Your document could not be read. Please retry.');
    await qc.invalidateQueries({ queryKey: ['beni-hub'] });
    onUploaded?.();
  }
  async function upload(file?: File) {
    if (!file || busy) return;
    const validation = validatePdf(file);
    if (validation) { setError(validation); return; }
    setBusy(true); setError(''); setFound(null);
    try {
      const { data } = await supabase.auth.getUser();
      if (!data.user) throw new Error('Please sign in first.');
      const path = `${data.user.id}/${crypto.randomUUID()}.pdf`;
      const stored = await supabase.storage.from('insurance-plans').upload(path, file, { contentType: 'application/pdf' });
      if (stored.error) throw new Error('Your PDF could not be saved. Please try again.');
      const row = await supabase.from('plans_uploaded').insert({ user_id: data.user.id, file_name: file.name, storage_path: path }).select('id').single();
      if (row.error) { await supabase.storage.from('insurance-plans').remove([path]); throw new Error('Your document record could not be saved.'); }
      setName(file.name); setPlanId(row.data.id);
      await qc.invalidateQueries({ queryKey: ['beni-hub'] });
      await process(row.data.id);
    } catch (e) { setError(e instanceof Error ? e.message : 'Your document is saved, but processing failed. Please retry.'); }
    finally { setBusy(false); }
  }
  async function retry() {
    if (!planId || busy) return;
    setBusy(true); setError('');
    try { await process(planId); } catch { setError('Your document could not be processed. Please try again.'); }
    finally { setBusy(false); }
  }
  return <div>
    <div aria-busy={busy} className="border border-dashed border-border rounded-2xl py-12 px-5 text-center" onDragOver={e => e.preventDefault()} onDrop={e => { e.preventDefault(); void upload(e.dataTransfer.files[0]); }}>
      {busy ? <LoaderCircle className="mx-auto animate-spin text-muted-foreground" size={36} /> : found !== null ? <Check className="mx-auto text-muted-foreground" size={36} /> : <UploadCloud className="mx-auto text-muted-foreground" size={36} />}
      <h3 className="text-3xl mt-5">{busy ? 'reading your insurance…' : found !== null ? 'ready for your review.' : 'upload your insurance PDF.'}</h3>
      <p className="text-sm text-muted-foreground mt-3 mb-6 break-words">{name || 'drop a PDF here · medical, dental, or vision · up to 20 MB'}</p>
      <input ref={input} type="file" aria-label="Insurance PDF" accept="application/pdf,.pdf" className="hidden" onChange={e => { void upload(e.target.files?.[0]); e.target.value = ''; }} />
      <Button type="button" variant="outline" disabled={busy} onClick={() => input.current?.click()}><FileText />{name ? 'choose another PDF' : 'browse files'}</Button>
    </div>
    <p className="text-xs text-muted-foreground mt-4">private to you. your current coverage stays unchanged until you confirm a new plan.</p>
    {found !== null && <div className="mt-4 space-y-3"><p className="text-sm">{found} page-cited benefits found.</p><Button asChild><Link to="/insurance">review insurance</Link></Button></div>}
    {error && <div className="mt-3"><p role="alert" className="text-sm text-destructive">{error}</p>{planId && <Button className="mt-3" variant="outline" disabled={busy} onClick={retry}><RotateCcw />retry processing</Button>}</div>}
  </div>;
}
