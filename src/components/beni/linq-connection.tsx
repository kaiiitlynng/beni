import {useState} from 'react';
import {useServerFn} from '@tanstack/react-start';
import {useQuery,useQueryClient} from '@tanstack/react-query';
import {getMessagingStatus,sendTestMessage} from '@/lib/messaging.functions';
import {Button} from '@/components/ui/button';
import {toast} from 'sonner';
export function LinqConnection() {
  const status=useServerFn(getMessagingStatus);
  const send=useServerFn(sendTestMessage);
  const qc=useQueryClient();
  const [busy,setBusy]=useState(false);
  const query=useQuery({queryKey:['linq-status'],queryFn:()=>status()});
  return <div className="flex flex-col items-start gap-2"><p className="text-xs text-muted-foreground max-w-md">{query.error instanceof Error?query.error.message:query.data?.error??(query.data?.connected?`Linq connected · ${query.data.verified?'phone verified':'reply to a test to verify your phone'}${query.data.webhookReady?'':' · replies awaiting webhook setup'}`:'checking connection…')}</p><Button variant="outline" size="sm" disabled={busy||!query.data?.connected} onClick={async()=>{setBusy(true);try{const result=await send({data:{requestId:crypto.randomUUID()}});toast.success(`Linq ${result.status}. Delivery is confirmed only after a delivery receipt.`);await qc.invalidateQueries({queryKey:['beni-hub']});}catch(error){toast.error(error instanceof Error?error.message:'Test message failed.');}finally{setBusy(false);}}}>{busy?'sending…':'Send Test Message'}</Button></div>;
}