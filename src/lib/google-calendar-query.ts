import {queryOptions} from '@tanstack/react-query';
import {getGoogleCalendar} from './calendar-integration.functions';
export const googleCalendarQuery=queryOptions({queryKey:['google-calendar'],queryFn:()=>getGoogleCalendar(),staleTime:60000,retry:false});