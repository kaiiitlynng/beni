import {createServerFn} from '@tanstack/react-start';
import {requireSupabaseAuth} from '@/integrations/supabase/auth-middleware';
import {z} from 'zod';
import {approvedGoogleExport} from './google-calendar-rules';
import { canAccessLinkedCalendar } from './calendar-access';

export const getGoogleCalendar=createServerFn({method:'GET'}).middleware([requireSupabaseAuth]).inputValidator(z.object({start:z.string().datetime(),end:z.string().datetime()}).refine(d => Date.parse(d.end) > Date.parse(d.start) && Date.parse(d.end) - Date.parse(d.start) <= 43 * 86400000, 'Choose a calendar range of at most 43 days.').optional()).handler(async({context,data})=>{
  const {data:auth,error}=await context.supabase.auth.getUser();
  if(error || !canAccessLinkedCalendar(auth.user)) return {connected:false,reconnectRequired:false,authorized:false,events:[],busy:[],availability:[],error:null};
  return { ...(await (await import('./google-calendar.server')).readGoogleSchedule(data)), authorized:true };
});
export const exportAppointment=createServerFn({method:'POST'}).middleware([requireSupabaseAuth]).inputValidator(z.object({id:z.string().uuid(),approved:z.literal(true)})).handler(async({context,data})=>{
  const {data:auth,error:authError}=await context.supabase.auth.getUser();
  if(authError || !canAccessLinkedCalendar(auth.user)) throw new Error('This Google Calendar connection is private to its verified owner.');
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
const isoTime = z.string().refine(v => Number.isFinite(Date.parse(v)), 'Choose a valid date and time.');
export const updateGoogleAppointment=createServerFn({method:'POST'}).middleware([requireSupabaseAuth]).inputValidator(z.object({
  id:z.string().uuid(),
  approved:z.literal(true),
  changes:z.object({title:z.string().max(200).optional(),starts_at:isoTime.optional(),ends_at:isoTime.nullable().optional(),location:z.string().max(300).nullable().optional(),notes:z.string().max(2000).nullable().optional()}),
})).handler(async({context,data})=>{
  const {data:auth,error}=await context.supabase.auth.getUser();
  if(error || !canAccessLinkedCalendar(auth.user)) throw new Error('This Google Calendar connection is private to its verified owner.');
  const {updateBeniGoogleEvent}=await import('./server/google-event-sync.server');
  const {url}=await updateBeniGoogleEvent(context.userId,data.id,data.changes);
  return {url};
});
export const deleteGoogleAppointment=createServerFn({method:'POST'}).middleware([requireSupabaseAuth]).inputValidator(z.object({id:z.string().uuid(),approved:z.literal(true)})).handler(async({context,data})=>{
  const {data:auth,error}=await context.supabase.auth.getUser();
  if(error || !canAccessLinkedCalendar(auth.user)) throw new Error('This Google Calendar connection is private to its verified owner.');
  const {deleteBeniGoogleEvent}=await import('./server/google-event-sync.server');
  await deleteBeniGoogleEvent(context.userId,data.id);
});
