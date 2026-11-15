import {useState} from 'react';
import {useServerFn} from '@tanstack/react-start';
import {Button} from '@/components/ui/button';
import {Input} from '@/components/ui/input';
import {Dialog,DialogContent,DialogTitle,DialogDescription} from '@/components/ui/dialog';
import {updateGoogleAppointment} from '@/lib/calendar-integration.functions';
import {toKey} from '@/lib/calendar';
import {toast} from 'sonner';
import type {Tables} from '@/integrations/supabase/types';

const hhmm=(d:Date)=>`${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;

/** Edits a Beni entry that was exported to Google. Saving updates both Google and Beni. */
export function GoogleEditDialog({event,onClose,onSaved}:{event:Tables<'calendar_events'>;onClose:()=>void;onSaved:()=>Promise<void>}) {
  const start=new Date(event.starts_at),end=event.ends_at?new Date(event.ends_at):new Date(start.getTime()+3600000);
  const initialDuration=Math.max(15,Math.round((end.getTime()-start.getTime())/60000));
  const [title,setTitle]=useState(event.title),[date,setDate]=useState(toKey(start)),[time,setTime]=useState(hhmm(start));
  const [duration,setDuration]=useState(initialDuration),[location,setLocation]=useState(event.location??''),[notes,setNotes]=useState(event.notes??'');
  const [busy,setBusy]=useState(false),[error,setError]=useState('');
  const update=useServerFn(updateGoogleAppointment);
  const durations=[...new Set([15,30,45,60,90,120,initialDuration])].sort((a,b)=>a-b);
  async function save(e:React.FormEvent){e.preventDefault();setBusy(true);setError('');try{
    const begins=new Date(`${date}T${time}`);
    if(!Number.isFinite(begins.getTime()))throw new Error('Choose a valid date and time.');
    const changes:{title?:string;starts_at?:string;ends_at?:string;location?:string|null;notes?:string|null}={};
    if(title.trim()!==event.title)changes.title=title.trim();
    if(begins.getTime()!==start.getTime()||duration!==initialDuration){
      if(begins.getTime()<Date.now())throw new Error('Choose a future appointment time.');
      changes.starts_at=begins.toISOString();changes.ends_at=new Date(begins.getTime()+duration*60000).toISOString();
    }
    if(location!==(event.location??''))changes.location=location||null;
    if(notes!==(event.notes??''))changes.notes=notes||null;
    if(!Object.keys(changes).length){onClose();return;}
    await update({data:{id:event.id,approved:true,changes}});
    toast.success('Updated in Google Calendar and Beni. This does not change any provider booking.');await onSaved();onClose();
  }catch(e){setError(e instanceof Error?e.message:'The entry could not be updated.');}finally{setBusy(false);}}
  return <Dialog open onOpenChange={open=>{if(!open)onClose();}}><DialogContent className="max-h-[90dvh] overflow-y-auto w-[calc(100%-32px)]"><DialogTitle className="text-3xl">Edit appointment</DialogTitle><DialogDescription>Saving updates this entry in your Google Calendar and in Beni. It does not reschedule anything with your provider.</DialogDescription><form onSubmit={save} className="space-y-4">
    <label className="field">Appointment type<Input autoFocus required value={title} onChange={e=>setTitle(e.target.value)}/></label>
    <div className="grid grid-cols-2 gap-4"><label className="field">Date<Input type="date" required value={date} onChange={e=>setDate(e.target.value)}/></label><label className="field">Start time<Input type="time" required value={time} onChange={e=>setTime(e.target.value)}/></label></div>
    <label className="field">Duration<select value={duration} onChange={e=>setDuration(Number(e.target.value))}>{durations.map(n=><option key={n} value={n}>{n} minutes</option>)}</select></label>
    <label className="field">Location<Input value={location} onChange={e=>setLocation(e.target.value)} placeholder="Optional"/></label>
    <label className="field">Notes<Input value={notes} onChange={e=>setNotes(e.target.value)} placeholder="Optional"/></label>
    {error&&<p role="alert" className="text-sm text-destructive">{error}</p>}<Button disabled={busy} className="w-full">{busy?'Saving…':'Save to Google and Beni'}</Button>
  </form></DialogContent></Dialog>;
}
