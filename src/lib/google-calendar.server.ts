import { z } from 'zod';
import { callAsAppUser, appUserReconnectRequired } from '@/integrations/lovable/appUserConnector';
import { getConnectionKeyForUser } from './appUserConnections.server';
import { availableWindows } from './google-calendar-rules';
import { googleCalendarFailure } from './google-calendar-errors';
export const GOOGLE_SCOPES = ['https://www.googleapis.com/auth/userinfo.email','https://www.googleapis.com/auth/userinfo.profile','https://www.googleapis.com/auth/calendar.readonly','https://www.googleapis.com/auth/calendar.events'];
export class CalendarReconnect extends Error {}
export async function googleCall(userId: string, path: string, init?: RequestInit) {
  const connectionAPIKey = await getConnectionKeyForUser(userId,'google_calendar');
  if (!connectionAPIKey) throw new Error('Connect your Google Calendar first.');
  const res = await callAsAppUser({ gatewayBaseUrl:'https://connector-gateway.lovable.dev', connectionAPIKey, connectorId:'google_calendar', path:`/calendar/v3${path}`, requiredScopes:GOOGLE_SCOPES, ...(init ? {init}: {}) });
  if (await appUserReconnectRequired(res)) throw new CalendarReconnect('Your Google access needs to be renewed.');
  if (!res.ok && !(res.status === 409 && init?.method === 'POST')) {
    const rawBody = await res.clone().text();
    const failure = googleCalendarFailure(res.status, rawBody);
    console.error('[google-calendar] Provider request failed', { path, status: res.status, cause: failure.cause, body: rawBody });
    throw new Error(failure.message);
  }
  return res;
}
const calendarSchema = z.object({ items: z.array(z.object({ id:z.string(), summary:z.string().optional(), accessRole:z.string().optional(), timeZone:z.string().optional() })).default([]) });
const eventSchema = z.object({ id:z.string(), summary:z.string().optional(), status:z.string().optional(), start:z.object({ dateTime:z.string().optional(),date:z.string().optional() }), end:z.object({ dateTime:z.string().optional(),date:z.string().optional() }), htmlLink:z.string().optional() });
const eventsSchema = z.object({items:z.array(eventSchema).default([])});
const freeSchema = z.object({ calendars:z.record(z.object({busy:z.array(z.object({start:z.string(),end:z.string()})).default([]),errors:z.array(z.object({domain:z.string().optional(),reason:z.string().optional()})).optional()})) });
export async function readGoogleSchedule(userId:string) {
  const connection = await getConnectionKeyForUser(userId,'google_calendar');
  if (!connection) return { connected:false, reconnectRequired:false, events:[], availability:[], error:null };
  try {
    const calResponse=await googleCall(userId,'/users/me/calendarList?maxResults=50');
    if (!calResponse.ok) throw new Error(`Google could not read your calendars (${calResponse.status}).`);
    const calendars=calendarSchema.parse(await calResponse.json()).items.filter(c=>c.accessRole!=='freeBusyReader');
    const start=new Date().toISOString(), end=new Date(Date.now()+7*86400000).toISOString();
    const events=(await Promise.all(calendars.map(async c=>{
      const res=await googleCall(userId,`/calendars/${encodeURIComponent(c.id)}/events?singleEvents=true&orderBy=startTime&timeMin=${encodeURIComponent(start)}&timeMax=${encodeURIComponent(end)}&maxResults=100`);
      if (!res.ok) throw new Error(`Google could not read events (${res.status}).`);
      return eventsSchema.parse(await res.json()).items.filter(e=>e.status!=='cancelled').map(e=>({id:`${c.id}:${e.id}`,title:e.summary??'busy',start:e.start.dateTime??e.start.date??'',end:e.end.dateTime??e.end.date??'',allDay:Boolean(e.start.date),calendar:c.summary??'calendar',url:e.htmlLink??null}));
    }))).flat().sort((a,b)=>a.start.localeCompare(b.start));
    const free=await googleCall(userId,'/freeBusy',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({timeMin:start,timeMax:end,items:calendars.map(c=>({id:c.id}))})});
    if(!free.ok) throw new Error(`Google could not read availability (${free.status}).`);
    const result=freeSchema.parse(await free.json());
    const calendarErrors = Object.values(result.calendars).flatMap(c=>c.errors??[]);
    if(calendarErrors.length) {
      console.error('[google-calendar] Availability check failed', { errors: calendarErrors });
      throw new Error(googleCalendarFailure(403, JSON.stringify({error:{errors:calendarErrors}})).message);
    }
    return {connected:true,reconnectRequired:false,events,availability:availableWindows(Object.values(result.calendars).flatMap(c=>c.busy),start,end),error:null};
  } catch(e) {
    if(e instanceof CalendarReconnect) return {connected:false,reconnectRequired:true,events:[],availability:[],error:e.message};
    return {connected:false,reconnectRequired:false,events:[],availability:[],error:e instanceof Error?e.message:'Google Calendar could not be loaded. Please retry.'};
  }
}