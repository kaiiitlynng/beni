import {useQuery,useQueryClient} from '@tanstack/react-query';
import {CalendarDays,RefreshCw} from 'lucide-react';
import {Button} from '@/components/ui/button';
import {googleCalendarQuery} from '@/lib/google-calendar-query';
import {googleCalendarRangeQuery} from '@/lib/google-calendar-query';
export function CalendarConnection({range}:{range?:{start:string;end:string}} = {}){
  const {data,isPending,isFetching,error:queryError}=useQuery(range?googleCalendarRangeQuery(range.start,range.end):googleCalendarQuery),qc=useQueryClient();
  async function refresh(){await qc.invalidateQueries({queryKey:['google-calendar']});}
  return <div className="w-full flex flex-wrap items-center justify-between gap-4">
    <div className="flex items-start gap-3"><CalendarDays size={20} className="text-muted-foreground shrink-0 mt-1"/><div><p className="text-sm">Google Calendar</p><p className="text-xs text-muted-foreground mt-1" role="status">{isPending?'Checking connection…':data?.connected?'Connected · private to your account':data?.authorized===false?'No Google Calendar connected to your account. Julie’s calendar is private.':'Calendar unavailable'}</p></div></div>
    {data?.authorized!==false&&<Button size="icon" variant="ghost" title="Refresh Google Calendar" aria-label="Refresh Google Calendar" disabled={isFetching} onClick={refresh}><RefreshCw size={16}/></Button>}
    {(data?.error||queryError)&&<p role="alert" className="w-full text-sm text-destructive">{data?.error||(queryError instanceof Error?queryError.message:'Google Calendar could not be loaded.')}</p>}
  </div>;
}