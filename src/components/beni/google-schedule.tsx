import {useQuery} from '@tanstack/react-query';
import {googleCalendarQuery} from '@/lib/google-calendar-query';
import {allDayRange} from '@/lib/google-calendar-rules';
export function GoogleSchedule(){
 const {data}=useQuery(googleCalendarQuery);
 if(!data?.connected)return null;
 const format=(value:string)=>new Date(value).toLocaleString(undefined,{weekday:'short',month:'short',day:'numeric',hour:'numeric',minute:'2-digit'});
 return <section className="border-y border-border py-8 mt-8"><div className="grid md:grid-cols-2 gap-8"><div><h2 className="text-3xl mb-5">your Google events.</h2>{data.events.length?data.events.map(e=><div key={e.id} className="py-3 border-b border-border/50"><p className="text-sm break-words">{e.title}</p><p className="text-xs text-muted-foreground mt-1">{e.allDay?`${allDayRange(e.start,e.end).start} – ${allDayRange(e.start,e.end).end} · all day`:`${format(e.start)} – ${format(e.end)}`} · {e.calendar}</p></div>):<p className="text-sm text-muted-foreground">no events in the next 7 days.</p>}</div><div><h2 className="text-3xl mb-5">available time.</h2><p className="text-xs text-muted-foreground mb-4">free stretches of at least 30 minutes across your Google calendars · next 7 days · your local time</p>{data.availability.length?data.availability.map(w=><p key={w.start} className="text-sm py-3 border-b border-border/50">{format(w.start)} – {format(w.end)}</p>):<p className="text-sm text-muted-foreground">no free stretches found.</p>}</div></div></section>;
}