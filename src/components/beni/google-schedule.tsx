import {useMemo} from 'react';
import {useQuery} from '@tanstack/react-query';
import {useServerFn} from '@tanstack/react-start';
import {getGoogleCalendar} from '@/lib/calendar-integration.functions';
export function GoogleSchedule({anchor}:{anchor:Date}) {
  const read=useServerFn(getGoogleCalendar);
  const range=useMemo(()=>{
    const start=new Date(anchor.getFullYear(),anchor.getMonth(),anchor.getDate());
    const end=new Date(start);end.setDate(end.getDate()+7);
    return {start:start.toISOString(),end:end.toISOString()};
  },[anchor]);
  const query=useQuery({queryKey:['google-calendar',range],queryFn:()=>read({data:range})});
  if(query.error)return <p role="alert" className="text-sm text-destructive">{query.error.message}</p>;
  if(!query.data?.connected)return null;
  return <section className="mt-8 border-t border-border pt-6"><h3 className="text-2xl mb-4">your google calendar · next 7 days.</h3>{query.data.error?<p role="alert" className="text-sm text-destructive">{query.data.error}</p>:<><div className="space-y-3">{query.data.events.map(event=><div key={`${event.calendarId}-${event.id}`}><p className="text-sm">{event.title}</p><p className="text-xs text-muted-foreground">{event.allDay?`${event.start} · all day (through ${new Date(Date.parse(event.end+'T12:00:00Z')-86400000).toISOString().slice(0,10)})`:new Date(event.start).toLocaleString()}</p></div>)}</div>{!query.data.events.length&&<p className="text-sm text-muted-foreground">no upcoming events.</p>}<h4 className="text-xl mt-6 mb-3">available windows · 60 minutes or longer.</h4><div className="space-y-2">{query.data.windows.slice(0,10).map(w=><p key={w.start} className="text-xs text-muted-foreground">{new Date(w.start).toLocaleString()} – {new Date(w.end).toLocaleString()}</p>)}</div>{!query.data.windows.length&&<p className="text-sm text-muted-foreground">no verified free windows in this range.</p>}</>}</section>;
}