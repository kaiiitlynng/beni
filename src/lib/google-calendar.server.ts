import {z} from 'zod';
import {callAsAppUser,appUserReconnectRequired} from '@/integrations/lovable/appUserConnector';
import {getConnectionKeyForUser} from './appUserConnections.server';
export const GOOGLE_SCOPES = ['https://www.googleapis.com/auth/userinfo.email','https://www.googleapis.com/auth/userinfo.profile','https://www.googleapis.com/auth/calendar.readonly','https://www.googleapis.com/auth/calendar.events'];
export const GATEWAY = 'https://connector-gateway.lovable.dev';
export async function googleCall(userId:string,path:string,init?:RequestInit) {
  const key = await getConnectionKeyForUser(userId,'google_calendar');
  if(!key) throw new Error('Connect your Google Calendar first.');
  const res = await callAsAppUser({gatewayBaseUrl:GATEWAY,connectionAPIKey:key,connectorId:'google_calendar',path,...(init?{init}:{}),requiredScopes:GOOGLE_SCOPES});
  if(await appUserReconnectRequired(res)) throw new Error('Your Google Calendar access needs to be renewed. Reconnect your calendar.');
  if(!res.ok) {
    const body = await res.text();
    console.error('Google Calendar request failed',res.status,body);
    throw new Error(`Google Calendar request failed (${res.status}): ${body}`);
  }
  return res;
}
export const googleEventSchema = z.object({id:z.string(),summary:z.string().optional(),start:z.object({date:z.string().optional(),dateTime:z.string().optional()}),end:z.object({date:z.string().optional(),dateTime:z.string().optional()}),location:z.string().optional(),status:z.string().optional()});