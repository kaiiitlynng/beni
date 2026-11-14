import {useState} from 'react';
import {useQuery,useQueryClient} from '@tanstack/react-query';
import {useServerFn} from '@tanstack/react-start';
import {CalendarDays,ArrowUpRight,LoaderCircle,RefreshCw} from 'lucide-react';
import {Button} from '@/components/ui/button';
import {googleCalendarQuery} from '@/lib/google-calendar-query';
import {startCalendarConnect,completeCalendarConnect,disconnectCalendar} from '@/lib/calendar-integration.functions';

function waitForOAuth(popup:Window){return new Promise<string>((resolve,reject)=>{
  let poll:number|undefined;
  const clean=()=>{window.removeEventListener('message',message);if(poll!==undefined)window.clearInterval(poll);};
  const message=(event:MessageEvent)=>{
    if(event.origin!==window.location.origin||event.source!==popup||event.data?.connectorId!=='google_calendar')return;
    if(!['appUserConnectorOAuthComplete','appUserConnectorOAuthFailed'].includes(event.data?.type))return;
    clean();
    if(event.data.type==='appUserConnectorOAuthComplete'&&typeof event.data.code==='string'&&event.data.code)resolve(event.data.code);
    else reject(new Error('Google authorization did not complete. Please try again.'));
  };
  window.addEventListener('message',message);
  poll=window.setInterval(()=>{if(popup.closed){clean();reject(new Error('Google authorization was canceled. Your calendar is not connected.'));}},500);
});}
export function CalendarConnection(){
  const {data,isPending,error:queryError}=useQuery(googleCalendarQuery),qc=useQueryClient();
  const [busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState('');
  const start=useServerFn(startCalendarConnect),complete=useServerFn(completeCalendarConnect),disconnect=useServerFn(disconnectCalendar);
  async function connect(){
    const popup=window.open('','beni-google-calendar','width=600,height=720');
    if(!popup){setError('Allow popups to connect Google Calendar.');return;}
    setBusy(true);setError('');setNotice('');
    try{
      const {authorizationUrl}=await start();const completion=waitForOAuth(popup);popup.location.href=authorizationUrl;
      const code=await completion;await complete({data:{code}});await qc.invalidateQueries({queryKey:['google-calendar']});setNotice(data?.connected?'reconnected to Google Calendar.':'connected to Google Calendar.');
    }catch(e){popup.close();setError(e instanceof Error?e.message:'Google Calendar could not connect.');}finally{setBusy(false);}
  }
  async function remove(){setBusy(true);setError('');setNotice('');try{await disconnect();await qc.invalidateQueries({queryKey:['google-calendar']});setNotice('Google Calendar disconnected.');}catch(e){setError(e instanceof Error?e.message:'Please retry.');}finally{setBusy(false);}}
  return <div className="w-full flex flex-wrap items-center justify-between gap-4">
    <div className="flex items-start gap-3"><CalendarDays size={20} className="text-muted-foreground shrink-0 mt-1"/><div><p className="text-sm">google calendar</p><p className="text-xs text-muted-foreground mt-1">{isPending?'checking connection…':data?.connected?'connected · your next 7 days':data?.reconnectRequired?'your Google access needs to be renewed.':'not connected · Beni entries stay in Beni until you approve adding them.'}</p></div></div>
    <div className="flex flex-wrap gap-2">{data?.connected&&<Button size="sm" variant="ghost" disabled={busy} onClick={remove}>disconnect</Button>}<Button variant="outline" disabled={busy||isPending} onClick={connect}>{busy?<LoaderCircle className="animate-spin"/>:<ArrowUpRight/>}{data?.connected||data?.reconnectRequired?'reconnect calendar':'connect calendar'}</Button><Button size="icon" variant="ghost" title="Refresh Google Calendar" disabled={busy} onClick={()=>qc.invalidateQueries({queryKey:['google-calendar']})}><RefreshCw size={16}/></Button></div>
    {(error||data?.error||queryError)&&<p role="alert" className="w-full text-sm text-destructive">{error||data?.error||(queryError instanceof Error?queryError.message:'Google Calendar could not be loaded.')}</p>}{notice&&<p role="status" className="w-full text-xs text-muted-foreground">{notice}</p>}
  </div>;
}