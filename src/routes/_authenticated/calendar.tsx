import {createFileRoute} from '@tanstack/react-router';
import {useEffect,useMemo,useState} from 'react';
import {useQuery,useSuspenseQuery,useQueryClient} from '@tanstack/react-query';
import {useServerFn} from '@tanstack/react-start';
import {ChevronLeft,ChevronRight,Plus,Check,Trash2,Clock,SlidersHorizontal,Pencil} from 'lucide-react';
import {AuthedShell} from '@/components/beni/authed-shell';
import {Button} from '@/components/ui/button';
import {Dialog,DialogContent,DialogTitle,DialogDescription} from '@/components/ui/dialog';
import {CalendarConnection} from '@/components/beni/calendar-connection';
import {CalendarTimeline} from '@/components/beni/calendar-timeline';
import {HoldDialog} from '@/components/beni/calendar-hold-dialog';
import {GoogleEditDialog} from '@/components/beni/google-edit-dialog';
import {hubQuery} from '@/lib/hub-query';
import {googleCalendarRangeQuery} from '@/lib/google-calendar-query';
import {pageHead} from '@/lib/beni';
import {monthGrid,weekDays,monthLabel,toKey,addMonths,addWeeks} from '@/lib/calendar';
import {dailyAvailability,dayBounds,dayLabel,entriesOnDay,entryInterval,slotDuration,type ScheduleEntry,type Interval} from '@/lib/calendar-schedule';
import {fmtDate,fmtTime,isHold,isBooked} from '@/lib/hub';
import {confirmHold,deleteEvent} from '@/lib/benefits.functions';
import {exportAppointment,deleteGoogleAppointment} from '@/lib/calendar-integration.functions';
import {isEditableBeniGoogleEvent} from '@/lib/google-calendar-rules';
import type {Tables} from '@/integrations/supabase/types';
import {toast} from 'sonner';

export const Route=createFileRoute('/_authenticated/calendar')({head:()=>pageHead('My Calendar','View your private schedule, find daily availability and approve tentative healthcare appointments.'),validateSearch:(s:Record<string,unknown>):{benefit?:string}=>typeof s['benefit']==='string'?{benefit:s['benefit']}:{},loader:({context})=>context.queryClient.ensureQueryData(hubQuery),component:CalendarPage});
type View='month'|'week'|'day';
function CalendarPage(){
  const {data}=useSuspenseQuery(hubQuery),qc=useQueryClient(),search=Route.useSearch(),navigate=Route.useNavigate();
  const [benefitId,setBenefitId]=useState<string|undefined>(search.benefit);
  useEffect(()=>{if(search.benefit){setBenefitId(search.benefit);addHold();void navigate({search:{},replace:true});}},[search.benefit]);
  const [view,setView]=useState<View>('week'),[anchor,setAnchor]=useState(()=>new Date()),[selected,setSelected]=useState(()=>toKey(new Date()));
  const [holdStart,setHoldStart]=useState<Date|null>(null),[details,setDetails]=useState<ScheduleEntry|null>(null),[busy,setBusy]=useState(false),[hoursOpen,setHoursOpen]=useState(false),[editing,setEditing]=useState<Tables<'calendar_events'>|null>(null),[from,setFrom]=useState(8),[to,setTo]=useState(20);
  const days=useMemo(()=>view==='month'?monthGrid(anchor).map(d=>d.date):view==='week'?weekDays(anchor).map(d=>d.date):[anchor],[anchor,view]);
  const first=days[0]??anchor,last=days[days.length-1]??anchor;
  const range={start:dayBounds(first).start,end:dayBounds(last).end};
  const google=useQuery(googleCalendarRangeQuery(range.start,range.end));
  const entries:ScheduleEntry[]=useMemo(()=>[
    ...(google.data?.events??[]).filter(e=>!data.events.some(b=>b.google_event_id&&e.id.endsWith(`:${b.google_event_id}`))).map(e=>({...e,type:'google' as const})),
    ...data.events.map(e=>({id:e.id,title:e.title,start:e.starts_at,end:e.ends_at??new Date(Date.parse(e.starts_at)+3600000).toISOString(),type:isHold(e)?'hold' as const:'confirmed' as const,location:e.location,notes:e.notes})),
  ],[google.data,data.events]);
  const busyIntervals=useMemo(()=>[...(google.data?.busy??[]),...entries.map(entryInterval)],[google.data,entries]);
  const availability=new Map(days.map(d=>[toKey(d),google.data?.connected?dailyAvailability(d,busyIntervals,from,to):[]]));
  const selectedDate=new Date(`${selected}T12:00:00`);
  const selectedSlots=google.data?.connected?dailyAvailability(selectedDate,busyIntervals,from,to):[];
  const upcoming=data.events.filter(e=>e.kind==='healthcare'&&Date.parse(e.ends_at??e.starts_at)>=Date.now());
  const exportToGoogle=useServerFn(exportAppointment),removeFromGoogle=useServerFn(deleteGoogleAppointment);
  async function refresh(){await qc.invalidateQueries({queryKey:['beni-hub']});await qc.invalidateQueries({queryKey:['google-calendar']});}
  function move(n:number){const next=view==='month'?addMonths(anchor,n):view==='week'?addWeeks(anchor,n):new Date(anchor.getFullYear(),anchor.getMonth(),anchor.getDate()+n);setAnchor(next);setSelected(toKey(next));}
  function select(date:Date,openDay=false){setSelected(toKey(date));if(openDay){setAnchor(date);setView('day');}}
  function chooseSlot(slot:Interval){setHoldStart(new Date(slot.start));}
  function addHold(){const start=new Date(`${selected}T10:00:00`);if(start.getTime()<Date.now()){start.setTime(Math.ceil((Date.now()+30*60000)/(30*60000))*30*60000);}setHoldStart(start);}
  async function act(work:()=>Promise<unknown>,message:string){setBusy(true);try{await work();toast.success(message);setDetails(null);await refresh();}catch(e){toast.error(e instanceof Error?e.message:'Please try again.');}finally{setBusy(false);}}
  async function addToGoogle(id:string){if(!window.confirm('Add this approved appointment to your private Google Calendar? This creates a calendar entry only, not a booking with a healthcare provider.'))return;await act(()=>exportToGoogle({data:{id,approved:true}}),'Added to Google Calendar — not booked with a provider.');}
  async function deleteFromGoogle(id:string){if(!window.confirm('Delete this entry from your Google Calendar and from Beni? This does not cancel anything with your provider.'))return;await act(()=>removeFromGoogle({data:{id,approved:true}}),'Removed from Google Calendar and Beni.');}
  const localEntry=details?data.events.find(e=>e.id===details.id):undefined;
  const googleEditable=Boolean(localEntry&&isEditableBeniGoogleEvent(localEntry)&&google.data?.authorized);
  return <AuthedShell><main className="page-width calendar-page py-8 md:py-10">
    <div className="flex flex-wrap items-center justify-between gap-4"><h1 className="text-4xl md:text-5xl">My Calendar</h1><Button size="lg" className="text-base font-semibold" onClick={()=>addHold()}><Plus size={18}/>Add Appointment</Button></div>
    <div className="border-b border-border py-5 mb-5"><CalendarConnection range={range}/></div>
    <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
      <div className="flex items-center gap-1"><Button variant="ghost" size="icon" aria-label="Previous period" onClick={()=>move(-1)}><ChevronLeft/></Button><Button variant="ghost" size="icon" aria-label="Next period" onClick={()=>move(1)}><ChevronRight/></Button><h2 className="text-2xl mx-2">{view==='day'?dayLabel(anchor):monthLabel(anchor)}</h2><Button variant="outline" onClick={()=>{const d=new Date();setAnchor(d);setSelected(toKey(d));}}>Today</Button></div>
      <div className="flex items-center gap-1" aria-label="Calendar view">{(['month','week','day'] as const).map(v=><Button key={v} variant={v===view?'default':'ghost'} aria-pressed={view===v} onClick={()=>{setView(v);if(v==='day')setAnchor(selectedDate);}}>{v[0]?.toUpperCase()}{v.slice(1)}</Button>)}<Button variant="ghost" size="icon" aria-label="Preferred scheduling hours" title="Preferred scheduling hours" aria-expanded={hoursOpen} onClick={()=>setHoursOpen(!hoursOpen)}><SlidersHorizontal size={17}/></Button></div>
    </div>
    {hoursOpen&&<div className="flex flex-wrap items-end gap-4 border-y border-border py-4 mb-4"><label className="field">Scheduling starts<select value={from} onChange={e=>setFrom(Number(e.target.value))}>{Array.from({length:to},(_,i)=><option value={i} key={i}>{i%12||12}:00 {i<12?'AM':'PM'}</option>)}</select></label><label className="field">Scheduling ends<select value={to} onChange={e=>setTo(Number(e.target.value))}>{Array.from({length:24-from},(_,i)=>i+from+1).map(i=><option value={i} key={i}>{i%12||12}:00 {i<12||i===24?'AM':'PM'}</option>)}</select></label></div>}
    <div className="flex flex-wrap gap-x-5 gap-y-2 text-xs mb-4 text-muted-foreground">{[['google','Google · Busy'],['confirmed','Confirmed appointment'],['hold','Tentative hold'],['free','Available']].map(([type,label])=><span className="flex items-center gap-2" key={type}><span className={`calendar-legend calendar-${type}`}/>{label}</span>)}</div>
    {google.isFetching&&<p role="status" className="text-sm text-muted-foreground mb-3">Refreshing Google Calendar…</p>}
    {view==='month'?<div className="calendar-month"><div className="grid grid-cols-7 text-xs text-muted-foreground">{['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map(d=><span key={d} className="text-center py-3">{d}</span>)}</div><div className="grid grid-cols-7">{days.map(date=>{const dayEntries=entriesOnDay(entries,date);return <Button variant="ghost" key={toKey(date)} aria-label={`${dayLabel(date)}, ${dayEntries.length} events`} aria-pressed={selected===toKey(date)} onClick={()=>select(date,true)} className={`calendar-month-day ${selected===toKey(date)?'bg-accent':''} ${date.getMonth()!==anchor.getMonth()?'text-muted-foreground':''}`}><span className={toKey(date)===toKey(new Date())?'calendar-today':''}>{date.getDate()}</span><span className="calendar-month-indicators">{dayEntries.slice(0,3).map(e=><span key={e.id} className={`calendar-month-item calendar-${e.type}`}><span className="hidden md:inline">{e.title}</span><span className="md:hidden">•</span></span>)}{dayEntries.length>3&&<span className="text-[11px]">+{dayEntries.length-3}</span>}</span></Button>;})}</div></div>:<CalendarTimeline days={days} entries={entries} availability={availability} selected={selected} onSelect={d=>select(d)} onSlot={chooseSlot} onDetails={setDetails}/>}
    <section className="pt-7 pb-6 border-b border-border"><div className="flex flex-wrap items-baseline justify-between gap-2 mb-4"><h2 className="text-3xl">Available appointment times</h2><p className="text-sm text-muted-foreground">{dayLabel(selectedDate)}</p></div>
      {google.data?.connected?selectedSlots.length?<div className="flex flex-wrap gap-3">{selectedSlots.map(slot=><Button variant="outline" key={slot.start} className="h-auto min-h-12 py-3 justify-start gap-3" onClick={()=>chooseSlot(slot)}><Clock size={16}/><span className="text-left">{fmtTime(slot.start)} – {fmtTime(slot.end)}<span className="block text-xs font-normal text-muted-foreground mt-1">Available · {slotDuration(slot)}</span></span><Plus size={15}/></Button>)}</div>:<p className="text-sm text-muted-foreground">No available blocks of 30 minutes or longer during your preferred hours.</p>:<p className="text-sm text-muted-foreground">{google.data?.authorized===false?'Google availability is not available for this account. You can still manage your private Beni appointments.':'Availability is unavailable until Google Calendar can be read. Refresh to try again.'}</p>}
    </section>
    <section className="py-7 border-b border-border"><h2 className="text-3xl mb-5">Upcoming appointments</h2>{upcoming.length?<div className="grid md:grid-cols-2 gap-4">{upcoming.map(e=><article key={e.id} className="border border-border rounded-lg p-5"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><h3 className="text-2xl break-words">{e.title}</h3><p className="text-sm text-muted-foreground mt-2">{fmtDate(e.starts_at)} · {fmtTime(e.starts_at)}{e.ends_at?` – ${fmtTime(e.ends_at)}`:''}</p><p className="text-xs mt-2 text-muted-foreground">{isHold(e)?'Tentative hold — not booked with a provider':e.status==='provider_confirmed'?'Provider-confirmed appointment':'Confirmed Beni calendar entry'}</p></div><Button variant="ghost" size="icon" aria-label={`View details: ${e.title}`} onClick={()=>setDetails(entries.find(entry=>entry.id===e.id)??null)}><ChevronRight/></Button></div><div className="flex flex-wrap gap-2 mt-4">{isHold(e)&&<Button variant="outline" disabled={busy} onClick={()=>act(()=>confirmHold({data:{id:e.id}}),'Beni appointment confirmed — no provider booking was made.')}><Check size={15}/>Confirm appointment</Button>}{isBooked(e)&&google.data?.authorized&&<Button variant="outline" disabled={busy} onClick={()=>addToGoogle(e.id)}>{e.google_event_id?'Verify Google entry':'Add to Google'}</Button>}</div></article>)}</div>:<p className="text-sm text-muted-foreground">No upcoming healthcare appointments.</p>}</section>
    {editing&&<GoogleEditDialog event={editing} onClose={()=>setEditing(null)} onSaved={refresh}/>}
    {holdStart&&<HoldDialog benefits={data.benefits} start={holdStart} benefitId={benefitId} onClose={()=>{setHoldStart(null);setBenefitId(undefined);}} onSaved={refresh}/>}
    {details&&<Dialog open onOpenChange={open=>{if(!open)setDetails(null);}}><DialogContent className="w-[calc(100%-32px)] max-h-[85dvh] overflow-y-auto"><DialogTitle className="text-3xl pr-6 break-words">{details.title}</DialogTitle><DialogDescription>{details.type==='google'?'Google Calendar event':details.type==='hold'?'Tentative Beni hold — not booked with a provider':localEntry?.status==='provider_confirmed'?'Provider-confirmed appointment (you told Beni your provider confirmed it)':'Confirmed Beni calendar entry — not a provider booking'}</DialogDescription><p className="text-sm">{dayLabel(details.start)} · {details.allDay?'All day':`${fmtTime(details.start)} – ${fmtTime(details.end)}`}</p>{details.location&&<p className="text-sm break-words">{details.location}</p>}{details.notes&&<p className="text-sm break-words">{details.notes}</p>}<div className="flex flex-wrap gap-3">{details.url&&<Button asChild variant="outline"><a href={details.url} target="_blank" rel="noopener noreferrer">View in Google Calendar</a></Button>}{localEntry&&<>{isHold(localEntry)&&<Button disabled={busy} onClick={()=>act(()=>confirmHold({data:{id:localEntry.id}}),'Beni appointment confirmed — not booked with a provider.')}><Check/>Confirm appointment</Button>}{isBooked(localEntry)&&google.data?.authorized&&!localEntry.google_event_id&&<Button disabled={busy} variant="outline" onClick={()=>addToGoogle(localEntry.id)}>Add to Google</Button>}{googleEditable?<><Button variant="outline" disabled={busy} onClick={()=>{setEditing(localEntry);setDetails(null);}}><Pencil size={16}/>Edit</Button><Button variant="ghost" disabled={busy} onClick={()=>void deleteFromGoogle(localEntry.id)}><Trash2 size={16}/>Delete from Google and Beni</Button></>:<Button variant="ghost" disabled={busy} onClick={()=>{if(window.confirm('Remove this Beni entry? Any exported Google event stays in Google Calendar.'))void act(()=>deleteEvent({data:{id:localEntry.id}}),'Beni entry removed.');}}><Trash2 size={16}/>Remove hold</Button>}</>}</div></DialogContent></Dialog>}
  </main></AuthedShell>;
}