import {createServerFn} from '@tanstack/react-start';
import {getRequest} from '@tanstack/react-start/server';
import {requireSupabaseAuth} from '@/integrations/supabase/auth-middleware';
import {z} from 'zod';
import {availableWindows, approvedCalendarEntry} from './integration-rules';

export const startCalendarConnect = createServerFn({method:'POST'}).middleware([requireSupabaseAuth]).handler(async({context})=>{
  const {authorizeAppUserOAuth} = await import('@/integrations/lovable/appUserConnector');
  const {GOOGLE_SCOPES,GATEWAY} = await import('./google-calendar.server');
  const key = process.env['GOOGLE_CALENDAR_APP_USER_CONNECTOR_CLIENT_API_KEY'];
  if(!key) throw new Error('A workspace administrator must configure the Google Calendar OAuth client.');
  const request = getRequest();
  const url = new URL(request.url);
  const host = url.hostname==='localhost' ? request.headers.get('x-forwarded-host') : null;
  const returnUrl = new URL('/api/public/oauth/google/return',host?`https://${host}`:url.origin).toString();
  return authorizeAppUserOAuth({gatewayBaseUrl:GATEWAY,connectorId:'google_calendar',appUserId:context.userId,clientAPIKey:key,returnUrl,credentialsConfiguration:{scopes:GOOGLE_SCOPES}}).then(({authorizationUrl})=>({authorizationUrl}));
});
export const completeCalendarConnect = createServerFn({method:'POST'}).middleware([requireSupabaseAuth]).inputValidator((d:unknown)=>z.object({code:z.string().min(1).max(4096)}).parse(d)).handler(async({context,data})=>{
  const {exchangeAppUserOAuthCode} = await import('@/integrations/lovable/appUserConnector');
  const {saveConnectionKeyForUser} = await import('./appUserConnections.server');
  const result = await exchangeAppUserOAuthCode('https://connector-gateway.lovable.dev',data.code);
  if(result.connectorId!=='google_calendar') throw new Error('The returned connection is not Google Calendar.');
  await saveConnectionKeyForUser(context.userId,result.connectorId,result.connectionAPIKey);
  return {ok:true};
});
export const disconnectCalendar = createServerFn({method:'POST'}).middleware([requireSupabaseAuth]).handler(async({context})=>{
  const {getConnectionKeyForUser} = await import('./appUserConnections.server');
  const key = await getConnectionKeyForUser(context.userId,'google_calendar');
  if(key) {
    const {disconnectAppUser} = await import('@/integrations/lovable/appUserConnector');
    await disconnectAppUser({gatewayBaseUrl:'https://connector-gateway.lovable.dev',connectionAPIKey:key,connectorId:'google_calendar'});
    const {supabaseAdmin} = await import('@/integrations/supabase/client.server');
    const {error} = await supabaseAdmin.from('app_user_connections').delete().eq('user_id',context.userId).eq('connector_id','google_calendar');
    if(error) throw new Error('Could not remove the saved calendar connection.');
  }
});
export const getGoogleCalendar = createServerFn({method:'GET'}).middleware([requireSupabaseAuth]).inputValidator((d:unknown)=>z.object({start:z.string().datetime(),end:z.string().datetime()}).refine(d=>Date.parse(d.end)>Date.parse(d.start)&&Date.parse(d.end)-Date.parse(d.start)<=62*86400000,'Choose a range of up to 62 days.').parse(d)).handler(async({context,data})=>{
  const {getConnectionKeyForUser} = await import('./appUserConnections.server');
  if(!await getConnectionKeyForUser(context.userId,'google_calendar')) return {connected:false,events:[],windows:[],error:null};
  try {
    const {googleCall,googleEventSchema} = await import('./google-calendar.server');
    const calendars = z.object({items:z.array(z.object({id:z.string(),accessRole:z.string().optional()})).default([])}).parse(await (await googleCall(context.userId,'/calendar/v3/users/me/calendarList?maxResults=250')).json());
    const events: {id:string;title:string;start:string;end:string;allDay:boolean;calendarId:string}[]=[];
    for(const calendar of calendars.items.filter(c=>c.accessRole!=='freeBusyReader')) {
      let pageToken: string|undefined;
      do {
        const query = new URLSearchParams({timeMin:data.start,timeMax:data.end,singleEvents:'true',orderBy:'startTime',maxResults:'2500',...(pageToken?{pageToken}:{})});
        const page = z.object({items:z.array(googleEventSchema).default([]),nextPageToken:z.string().optional()}).parse(await (await googleCall(context.userId,`/calendar/v3/calendars/${encodeURIComponent(calendar.id)}/events?${query}`)).json());
        for(const e of page.items) if(e.status!=='cancelled') events.push({id:e.id,title:e.summary??'busy',start:e.start.dateTime??e.start.date??'',end:e.end.dateTime??e.end.date??'',allDay:!!e.start.date,calendarId:calendar.id});
        pageToken=page.nextPageToken;
      } while(pageToken);
    }
    const freeBusy = z.object({calendars:z.record(z.object({busy:z.array(z.object({start:z.string(),end:z.string()})).default([]),errors:z.array(z.unknown()).optional()}))}).parse(await (await googleCall(context.userId,'/calendar/v3/freeBusy',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({timeMin:data.start,timeMax:data.end,items:calendars.items.map(c=>({id:c.id}))})})).json());
    if(Object.values(freeBusy.calendars).some(c=>c.errors?.length)) throw new Error('Google could not verify availability for every calendar. No free times are shown.');
    const windows=availableWindows(data.start,data.end,Object.values(freeBusy.calendars).flatMap(c=>c.busy));
    return {connected:true,events,windows,error:null};
  } catch(error) {return {connected:true,events:[],windows:[],error:error instanceof Error?error.message:'Calendar could not be loaded.'};}
});
export const exportAppointment = createServerFn({method:'POST'}).middleware([requireSupabaseAuth]).inputValidator((d:unknown)=>z.object({id:z.string().uuid()}).parse(d)).handler(async({context,data})=>{
  const {data:event,error}=await context.supabase.from('calendar_events').select('*').eq('id',data.id).eq('user_id',context.userId).single();
  if(error||!event) throw new Error('Calendar entry was not found.');
  if(!approvedCalendarEntry(event)) throw new Error('Confirm this calendar entry before adding it to Google.');
  if(event.google_event_id) return {created:false};
  const {googleCall}=await import('./google-calendar.server');
  // Deterministic Google ID makes ambiguous network failures safe to retry without duplicates.
  const id=`beni${event.id.replace(/-/g,'')}`;
  const path='/calendar/v3/calendars/primary/events';
  const payload={id,summary:event.title,description:'Added with your approval by beni. This calendar entry is not proof of a healthcare provider booking.',location:event.location??undefined,start:{dateTime:event.starts_at},end:{dateTime:event.ends_at??new Date(Date.parse(event.starts_at)+3600000).toISOString()}};
  try {await googleCall(context.userId,path,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});}
  catch(error) {
    if(!(error instanceof Error)||!error.message.includes('(409)')) throw error;
    await googleCall(context.userId,`${path}/${id}`);
  }
  const {error:saveError}=await context.supabase.from('calendar_events').update({google_event_id:id,google_calendar_id:'primary'}).eq('id',event.id).eq('user_id',context.userId);
  if(saveError) throw new Error('Google added the event, but Beni could not save its reference. Retry safely.');
  return {created:true};
});