import {createServerFn} from '@tanstack/react-start';
import {requireSupabaseAuth} from '@/integrations/supabase/auth-middleware';
import {z} from 'zod';
import {approvedGoogleExport} from './google-calendar-rules';

export const getGoogleCalendar=createServerFn({method:'GET'}).middleware([requireSupabaseAuth]).handler(async()=>{
  return (await import('./google-calendar.server')).readGoogleSchedule();
});
export const exportAppointment=createServerFn({method:'POST'}).middleware([requireSupabaseAuth]).inputValidator(z.object({id:z.string().uuid(),approved:z.literal(true)})).handler(async({context,data})=>{
  const {data:event,error}=await context.supabase.from('calendar_events').select('*').eq('id',data.id).eq('user_id',context.userId).maybeSingle();
  if(error||!event||!approvedGoogleExport(event,data.approved)) throw new Error('Confirm this Beni appointment and explicitly approve adding it to Google first.');
  const {googleCall}=await import('./google-calendar.server');
  const eventId=`beni${event.id.replaceAll('-','')}`;
  const body={id:eventId,summary:event.title,description:'Added with your approval from Beni. This calendar entry does not book a healthcare provider.',...(event.location?{location:event.location}:{}),start:{dateTime:event.starts_at},end:{dateTime:event.ends_at??new Date(Date.parse(event.starts_at)+3600000).toISOString()}};
  const res=await googleCall('/calendars/primary/events',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
  if(!res.ok&&res.status!==409) throw new Error(`Google could not add this calendar entry (${res.status}).`);
  // Deterministic event IDs make retry after an uncertain save safe.
  const read=await googleCall(`/calendars/primary/events/${eventId}`);
  if(!read.ok) throw new Error('The Google calendar entry could not be verified. Please retry.');
  const verified=z.object({id:z.string(),htmlLink:z.string().optional()}).parse(await read.json());
  const saved=await context.supabase.from('calendar_events').update({google_event_id:verified.id,google_calendar_id:'primary'}).eq('id',event.id).eq('user_id',context.userId);
  if(saved.error) throw new Error('The entry was added to Google, but Beni could not save its link. Retry safely to reconnect it.');
  return {url:verified.htmlLink??null};
});