import {useState} from 'react';
import {useServerFn} from '@tanstack/react-start';
import {useQuery,useQueryClient} from '@tanstack/react-query';
import {Button} from '@/components/ui/button';
import {startCalendarConnect,completeCalendarConnect,disconnectCalendar,getGoogleCalendar} from '@/lib/calendar-integration.functions';
import {toast} from 'sonner';
export function CalendarConnection() {
  const [busy,setBusy]=useState(false);
  const qc=useQueryClient();
  const start=useServerFn(startCalendarConnect);
  const complete=useServerFn(completeCalendarConnect);
  const disconnect=useServerFn(disconnectCalendar);
  const read=useServerFn(getGoogleCalendar);
  const query=useQuery({queryKey:['google-connection'],queryFn:()=>read({data:{start:new Date().toISOString(),end:new Date(Date.now()+86400000).toISOString()}})});
  async function connect() {
    const popup=window.open('','beni-calendar-oauth','width=600,height=720');
    if(!popup){toast.error('Allow popups to connect your Google Calendar.');return;}
    setBusy(true);
    try {
      const {authorizationUrl}=await start();
      const codePromise=new Promise<string>((resolve,reject)=>{
        const cleanup=()=>{window.removeEventListener('message',onMessage);window.clearInterval(poll);window.clearTimeout(timeout);};
        const onMessage=(event:MessageEvent)=>{
          if(event.origin!==window.location.origin||event.source!==popup||event.data?.connectorId!=='google_calendar')return;
          if(!['appUserConnectorOAuthComplete','appUserConnectorOAuthFailed'].includes(event.data?.type))return;
          cleanup();
          if(event.data.type==='appUserConnectorOAuthComplete'&&typeof event.data.code==='string')resolve(event.data.code);
          else reject(new Error(event.data.error??'Google authorization failed.'));
        };
        const poll=window.setInterval(()=>{if(popup.closed){cleanup();reject(new Error('Google connection was cancelled.'));}},700);
        const timeout=window.setTimeout(()=>{cleanup();reject(new Error('Google authorization timed out. Please try again.'));},300000);
        window.addEventListener('message',onMessage);
      });
      popup.location.href=authorizationUrl;
      await complete({data:{code:await codePromise}});
      await qc.invalidateQueries({queryKey:['google-connection']});
      await qc.invalidateQueries({queryKey:['google-calendar']});
      toast.success('Google Calendar connected.');
    } catch(error){toast.error(error instanceof Error?error.message:'Google connection failed.');}
    finally{popup.close();setBusy(false);}
  }
  return <div className="flex flex-col items-start gap-2"><Button variant="outline" disabled={busy} onClick={connect}>{busy?'connecting…':query.data?.connected?'reconnect google calendar ↗':'connect google calendar ↗'}</Button><p className="text-xs text-muted-foreground max-w-md">{query.error instanceof Error?query.error.message:query.data?.error??(query.data?.connected?'connected · calendar entries are not provider bookings':'not connected')}</p>{query.data?.connected&&<Button variant="ghost" size="sm" disabled={busy} onClick={async()=>{setBusy(true);try{await disconnect();await qc.invalidateQueries({queryKey:['google-connection']});await qc.invalidateQueries({queryKey:['google-calendar']});toast.success('Google Calendar disconnected.');}catch(error){toast.error(error instanceof Error?error.message:'Disconnect failed.');}finally{setBusy(false);}}}>disconnect</Button>}</div>;
}