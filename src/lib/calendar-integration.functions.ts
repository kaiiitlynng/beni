import {createServerFn} from '@tanstack/react-start';
import {getRequest} from '@tanstack/react-start/server';
import {requireSupabaseAuth} from '@/integrations/supabase/auth-middleware';
import {z} from 'zod';
import {approvedGoogleExport} from './google-calendar-rules';

export const startCalendarConnect=createServerFn({method:'POST'}).middleware([requireSupabaseAuth]).handler(async({context})=>{
  const clientAPIKey=process.env['GOOGLE_CALENDAR_APP_USER_CONNECTOR_CLIENT_API_KEY'];
  if(!clientAPIKey) throw new Error('The Google Calendar connector client is not linked.');
  const [{authorizeAppUserOAuth},{GOOGLE_SCOPES}]=await Promise.all([import('@/integrations/lovable/appUserConnector'),import('./google-calendar.server')]);
  const request=getRequest(),url=new URL(request.url);
  const host=url.hostname==='localhost'?request.headers.get('x-forwarded-host'):null;
  return authorizeAppUserOAuth({gatewayBaseUrl:'https://connector-gateway.lovable.dev',connectorId:'google_calendar',appUserId:context.userId,clientAPIKey,returnUrl:new URL('/api/public/oauth/google/return',host?`https://${host}`:url.origin).toString(),credentialsConfiguration:{scopes:GOOGLE_SCOPES}});
});
export const completeCalendarConnect=createServerFn({method:'POST'}).middleware([requireSupabaseAuth]).inputValidator(z.object({code:z.string().min(1)})).handler(async({context,data})=>{
  const [{exchangeAppUserOAuthCode},{saveConnectionKeyForUser},{readGoogleSchedule}]=await Promise.all([import('@/integrations/lovable/appUserConnector'),import('./appUserConnections.server'),import('./google-calendar.server')]);
  const result=await exchangeAppUserOAuthCode('https://connector-gateway.lovable.dev',data.code);
  if(result.connectorId!=='google_calendar') throw new Error('The authorization was for a different service.');
  await saveConnectionKeyForUser(context.userId,'google_calendar',result.connectionAPIKey);
  const schedule=await readGoogleSchedule(context.userId);
  if(!schedule.connected) throw new Error(schedule.error??'Google access could not be verified. Please reconnect.');
  return {connected:true};
});
export const getGoogleCalendar=createServerFn({method:'GET'}).middleware([requireSupabaseAuth]).handler(async({context})=>{
  return (await import('./google-calendar.server')).readGoogleSchedule(context.userId);
});
export const disconnectCalendar=createServerFn({method:'POST'}).middleware([requireSupabaseAuth]).handler(async({context})=>{
  const [{getConnectionKeyForUser},{disconnectAppUser},{supabaseAdmin}]=await Promise.all([import('./appUserConnections.server'),import('@/integrations/lovable/appUserConnector'),import('@/integrations/supabase/client.server')]);
  const connectionAPIKey=await getConnectionKeyForUser(context.userId,'google_calendar');
  if(connectionAPIKey) await disconnectAppUser({gatewayBaseUrl:'https://connector-gateway.lovable.dev',connectionAPIKey,connectorId:'google_calendar'});
  const result=await supabaseAdmin.from('app_user_connections').delete().eq('user_id',context.userId).eq('connector_id','google_calendar');
  if(result.error) throw new Error('The saved Google connection could not be removed.');
  return {disconnected:true};
});
export const exportAppointment=createServerFn({method:'POST'}).middleware([requireSupabaseAuth]).inputValidator(z.object({id:z.string().uuid(),approved:z.literal(true)})).handler(async({context,data})=>{
  const {data:event,error}=await context.supabase.from('calendar_events').select('*').eq('id',data.id).eq('user_id',context.userId).maybeSingle();
  if(error||!event||!approvedGoogleExport(event,data.approved)) throw new Error('Confirm this Beni appointment and explicitly approve adding it to Google first.');
  const {googleCall}=await import('./google-calendar.server');
  const eventId=`beni${event.id.replaceAll('-','')}`;
  const body={id:eventId,summary:event.title,description:'Added with your approval from Beni. This calendar entry does not book a healthcare provider.',...(event.location?{location:event.location}:{}),start:{dateTime:event.starts_at},end:{dateTime:event.ends_at??new Date(Date.parse(event.starts_at)+3600000).toISOString()}};
  const res=await googleCall(context.userId,'/calendars/primary/events',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
  if(!res.ok&&res.status!==409) throw new Error(`Google could not add this calendar entry (${res.status}).`);
  // Deterministic event IDs make retry after an uncertain save safe.
  const read=await googleCall(context.userId,`/calendars/primary/events/${eventId}`);
  if(!read.ok) throw new Error('The Google calendar entry could not be verified. Please retry.');
  const verified=z.object({id:z.string(),htmlLink:z.string().optional()}).parse(await read.json());
  const saved=await context.supabase.from('calendar_events').update({google_event_id:verified.id,google_calendar_id:'primary'}).eq('id',event.id).eq('user_id',context.userId);
  if(saved.error) throw new Error('The entry was added to Google, but Beni could not save its link. Retry safely to reconnect it.');
  return {url:verified.htmlLink??null};
});