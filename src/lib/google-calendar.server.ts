import { z } from 'zod';
import { availableWindows } from './google-calendar-rules';
import { googleCalendarFailure } from './google-calendar-errors';
export async function googleCall(path: string, init?: RequestInit, okStatuses: number[] = []) {
  const apiKey = process.env['GOOGLE_CALENDAR_API_KEY'];
  const lovableKey = process.env['LOVABLE_API_KEY'];
  if (!apiKey || !lovableKey) throw new Error("Google Calendar is not configured. The app owner must check the existing Google connection in Lovable.");
  const headers = new Headers(init?.headers);
  headers.set('Authorization', `Bearer ${lovableKey}`);
  headers.set('X-Connection-Api-Key', apiKey);
  const res = await fetch(`https://connector-gateway.lovable.dev/google_calendar/calendar/v3${path}`, { ...init, headers });
  if (!res.ok && !(res.status === 409 && init?.method === 'POST') && !okStatuses.includes(res.status)) {
    const rawBody = await res.clone().text();
    const failure = googleCalendarFailure(res.status, rawBody);
    console.error('[google-calendar] Provider request failed', { path, status: res.status, cause: failure.cause, body: rawBody });
    throw new Error(failure.message);
  }
  return res;
}
const calendarSchema = z.object({ items: z.array(z.object({ id:z.string(), primary:z.boolean().optional(), summary:z.string().optional(), accessRole:z.string().optional(), timeZone:z.string().optional() })).default([]) });
const eventSchema = z.object({ id:z.string(), summary:z.string().optional(), status:z.string().optional(), start:z.object({ dateTime:z.string().optional(),date:z.string().optional() }), end:z.object({ dateTime:z.string().optional(),date:z.string().optional() }), htmlLink:z.string().optional() });
const eventsSchema = z.object({items:z.array(eventSchema).default([])});
const freeSchema = z.object({ calendars:z.record(z.object({busy:z.array(z.object({start:z.string(),end:z.string()})).default([]),errors:z.array(z.object({domain:z.string().optional(),reason:z.string().optional()})).optional()})) });
export async function readGoogleSchedule(range?: {start:string;end:string}) {
  try {
    const calResponse=await googleCall('/users/me/calendarList?maxResults=50');
    if (!calResponse.ok) throw new Error(`Google could not read your calendars (${calResponse.status}).`);
    const calendars=calendarSchema.parse(await calResponse.json()).items.filter(c=>c.primary===true);
    if (!calendars.length || calendars[0]?.id.toLowerCase() !== 'jseaman@berkeley.edu') throw new Error('The linked Google account does not match the calendar owner. Check the existing Google connection in Lovable.');
    const start=range?.start??new Date().toISOString(), end=range?.end??new Date(Date.now()+7*86400000).toISOString();
    const events=(await Promise.all(calendars.map(async c=>{
      const collected: z.infer<typeof eventSchema>[] = [];
      let pageToken: string | undefined;
      do {
        const res=await googleCall(`/calendars/${encodeURIComponent(c.id)}/events?singleEvents=true&orderBy=startTime&timeMin=${encodeURIComponent(start)}&timeMax=${encodeURIComponent(end)}&maxResults=2500${pageToken?`&pageToken=${encodeURIComponent(pageToken)}`:''}`);
        const page=eventsSchema.extend({nextPageToken:z.string().optional()}).parse(await res.json());
        collected.push(...page.items); pageToken=page.nextPageToken;
      } while(pageToken);
      return collected.filter(e=>e.status!=='cancelled').map(e=>({id:`${c.id}:${e.id}`,title:e.summary??'Busy',start:e.start.dateTime??e.start.date??'',end:e.end.dateTime??e.end.date??'',allDay:Boolean(e.start.date),calendar:c.summary??'calendar',url:e.htmlLink??null}));
    }))).flat().sort((a,b)=>a.start.localeCompare(b.start));
    const free=await googleCall('/freeBusy',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({timeMin:start,timeMax:end,items:calendars.map(c=>({id:c.id}))})});
    if(!free.ok) throw new Error(`Google could not read availability (${free.status}).`);
    const result=freeSchema.parse(await free.json());
    const calendarErrors = Object.values(result.calendars).flatMap(c=>c.errors??[]);
    if(calendarErrors.length) {
      console.error('[google-calendar] Availability check failed', { errors: calendarErrors });
      throw new Error(googleCalendarFailure(403, JSON.stringify({error:{errors:calendarErrors}})).message);
    }
    const busy=Object.values(result.calendars).flatMap(c=>c.busy);
    return {connected:true,reconnectRequired:false,events,busy,availability:availableWindows(busy,start,end),error:null};
  } catch(e) {
    return {connected:false,reconnectRequired:false,events:[],busy:[],availability:[],error:e instanceof Error?e.message:'Google Calendar could not be loaded. Please retry.'};
  }
}