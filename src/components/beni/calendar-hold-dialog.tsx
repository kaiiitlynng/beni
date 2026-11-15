import {useState} from 'react';
import {Button} from '@/components/ui/button';
import {Input} from '@/components/ui/input';
import {Dialog,DialogContent,DialogTitle,DialogDescription} from '@/components/ui/dialog';
import {createHold,addReminder} from '@/lib/benefits.functions';
import {toKey} from '@/lib/calendar';
import {toast} from 'sonner';
import type {Tables} from '@/integrations/supabase/types';
export function HoldDialog({benefits,start,benefitId:initialBenefit,onClose,onSaved}:{benefits:Tables<'benefits'>[];start:Date;benefitId?:string|undefined;onClose:()=>void;onSaved:()=>Promise<void>}) {
  const [title,setTitle]=useState(()=>benefits.find(b=>b.id===initialBenefit)?.name??''),[date,setDate]=useState(toKey(start)),[time,setTime]=useState(`${String(start.getHours()).padStart(2,'0')}:${String(start.getMinutes()).padStart(2,'0')}`);
  const [duration,setDuration]=useState(30),[location,setLocation]=useState(''),[notes,setNotes]=useState(''),[benefitId,setBenefitId]=useState(initialBenefit&&benefits.some(b=>b.id===initialBenefit)?initialBenefit:''),[providerConfirmed,setProviderConfirmed]=useState(false),[remind,setRemind]=useState(true),[busy,setBusy]=useState(false),[error,setError]=useState('');
  async function save(e:React.FormEvent){e.preventDefault();setBusy(true);setError('');try{
    const begins=new Date(`${date}T${time}`);
    if(begins.getTime()<Date.now())throw new Error('Choose a future appointment time.');
    await createHold({data:{title,starts_at:begins.toISOString(),ends_at:new Date(begins.getTime()+duration*60000).toISOString(),location:location||null,notes:notes||null,benefit_id:benefitId||null,provider_confirmed:providerConfirmed}});
    const remindAt=new Date(begins.getTime()-24*3600000);
    if(remind)await addReminder({data:{title:`Upcoming: ${title}`,remind_at:(remindAt.getTime()>Date.now()?remindAt:new Date(begins.getTime()-3600000)).toISOString()}});
    toast.success(providerConfirmed?'Provider-confirmed appointment saved.':'Tentative hold saved — not booked with a provider.');await onSaved();onClose();
  }catch(e){setError(e instanceof Error?e.message:'Your hold could not be saved.');}finally{setBusy(false);}}
  return <Dialog open onOpenChange={open=>{if(!open)onClose();}}><DialogContent className="max-h-[90dvh] overflow-y-auto w-[calc(100%-32px)]"><DialogTitle className="text-3xl">Add appointment</DialogTitle><DialogDescription>New appointments are tentative holds unless your provider has already confirmed. Nothing is added to Google until you explicitly approve it.</DialogDescription><form onSubmit={save} className="space-y-4">
    <label className="field">Appointment type<Input autoFocus required value={title} onChange={e=>setTitle(e.target.value)} placeholder="Dental cleaning"/></label>
    <div className="grid grid-cols-2 gap-4"><label className="field">Date<Input type="date" required value={date} onChange={e=>setDate(e.target.value)}/></label><label className="field">Start time<Input type="time" required value={time} onChange={e=>setTime(e.target.value)}/></label></div>
    <label className="field">Duration<select value={duration} onChange={e=>setDuration(Number(e.target.value))}>{[30,45,60,90,120].map(n=><option key={n} value={n}>{n} minutes</option>)}</select></label>
    <fieldset className="field"><legend className="mb-2">Status</legend><label className="flex items-center gap-2 text-sm"><input type="radio" name="status" checked={!providerConfirmed} onChange={()=>setProviderConfirmed(false)}/>Tentative hold — not booked yet</label><label className="flex items-center gap-2 text-sm mt-1"><input type="radio" name="status" checked={providerConfirmed} onChange={()=>setProviderConfirmed(true)}/>My provider confirmed this appointment</label></fieldset>
    <label className="field">Provider or location<Input value={location} onChange={e=>setLocation(e.target.value)} placeholder="Optional"/></label>
    <label className="field">Related benefit<select value={benefitId} onChange={e=>setBenefitId(e.target.value)}><option value="">None</option>{benefits.map(b=><option key={b.id} value={b.id}>{b.name}</option>)}</select></label>
    <label className="field">Notes<Input value={notes} onChange={e=>setNotes(e.target.value)} placeholder="Optional"/></label>
    <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={remind} onChange={e=>setRemind(e.target.checked)}/>Remind me the day before</label>
    {error&&<p role="alert" className="text-sm text-destructive">{error}</p>}<Button disabled={busy} className="w-full">{busy?'Saving…':providerConfirmed?'Save appointment':'Save tentative hold'}</Button>
  </form></DialogContent></Dialog>;
}