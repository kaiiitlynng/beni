import type { CSSProperties } from 'react';
import { Button } from '@/components/ui/button';
import { fmtTime } from '@/lib/hub';
import { toKey } from '@/lib/calendar';
import { dayLabel, entriesOnDay, entryInterval, layoutEntries, minutesInDay, slotDuration, type Interval, type ScheduleEntry } from '@/lib/calendar-schedule';

export function CalendarTimeline({days,entries,availability,selected,onSelect,onSlot,onDetails}:{days:Date[];entries:ScheduleEntry[];availability:Map<string,Interval[]>;selected:string;onSelect:(date:Date)=>void;onSlot:(slot:Interval)=>void;onDetails:(entry:ScheduleEntry)=>void}) {
  const timed=entries.filter(e=>!e.allDay);
  const visible=days.flatMap(date=>entriesOnDay(timed,date));
  const startHour=Math.min(8,...visible.map(e=>new Date(e.start).getHours()));
  const endHour=Math.max(20,...visible.map(e=>Math.min(24,new Date(e.end).getHours()+1)));
  const hours=Array.from({length:endHour-startHour},(_,i)=>i+startHour);
  const position=(start:string,end:string,date:Date):CSSProperties=>{
    const top=Math.max(startHour*60,minutesInDay(start,date)),bottom=Math.min(endHour*60,minutesInDay(end,date));
    return {top:`${(top-startHour*60)*1.2}px`,height:`${Math.max(0,bottom-top)*1.2}px`};
  };
  return <div className="calendar-scroll" tabIndex={0} aria-label={`${days.length===1?'Day':'Week'} schedule`}>
    <div className={`calendar-timeline ${days.length===1?'calendar-single':''}`} style={{'--day-count':days.length} as CSSProperties}>
      <div className="calendar-corner text-xs text-muted-foreground">Local time</div>
      {days.map(date=><Button key={toKey(date)} variant="ghost" aria-pressed={selected===toKey(date)} onClick={()=>onSelect(date)} className={`calendar-day-heading ${selected===toKey(date)?'bg-accent':''}`}><span className="text-xs text-muted-foreground">{date.toLocaleDateString('en-US',{weekday:'short'})}</span><span className={toKey(date)===toKey(new Date())?'calendar-today':''}>{date.getDate()}</span></Button>)}
      <div className="calendar-all-day-label text-xs text-muted-foreground">All day</div>
      {days.map(date=><div key={toKey(date)} className="calendar-all-day">{entriesOnDay(entries.filter(e=>e.allDay),date).map(e=><Button key={e.id} variant="ghost" onClick={()=>onDetails(e)} className={`calendar-all-day-event calendar-${e.type}`} title={e.title}>{e.title}</Button>)}</div>)}
      <div className="calendar-hours" style={{height:hours.length*72}}>{hours.map(hour=><span key={hour} style={{top:(hour-startHour)*72}}>{hour%12||12} {hour<12?'AM':'PM'}</span>)}</div>
      {days.map(date=><div key={toKey(date)} className="calendar-day-track" style={{height:hours.length*72}}>
        {hours.map(hour=><div key={hour} className="calendar-hour-line" style={{top:(hour-startHour)*72}}/>)}
        {(availability.get(toKey(date))??[]).map(slot=><Button key={slot.start} variant="ghost" className="calendar-free" style={position(slot.start,slot.end,date)} onClick={()=>onSlot(slot)} aria-label={`Available ${dayLabel(date)}, ${fmtTime(slot.start)} to ${fmtTime(slot.end)}, ${slotDuration(slot)}`}><span>Available</span><span className="text-[11px] font-normal">{slotDuration(slot)}</span></Button>)}
        {layoutEntries(entriesOnDay(timed,date)).map(({entry,column,columns})=>{
          const range=entryInterval(entry);
          return <Button key={entry.id} variant="ghost" className={`calendar-event calendar-${entry.type}`} style={{...position(range.start,range.end,date),left:`calc(${column/columns*100}% + 3px)`,width:`calc(${100/columns}% - 6px)`}} title={`${entry.title} · ${fmtTime(entry.start)} – ${fmtTime(entry.end)}`} aria-label={`View details: ${entry.title}, ${fmtTime(entry.start)} to ${fmtTime(entry.end)}`} onClick={()=>onDetails(entry)}><span className="calendar-event-title">{entry.title}</span><span className="text-[11px] font-normal">{fmtTime(entry.start)} – {fmtTime(entry.end)}</span></Button>;
        })}
      </div>)}
    </div>
  </div>;
}