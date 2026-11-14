import {createFileRoute} from '@tanstack/react-router';
export const Route=createFileRoute('/api/public/linq/process')({server:{handlers:{POST:async({request})=>{
  const {authenticateCronRequest}=await import('@/integrations/supabase/cron-auth');
  const failure=await authenticateCronRequest(request);
  if(failure)return failure;
  const {processLinqQueue}=await import('@/lib/linq.server');
  return Response.json(await processLinqQueue());
}}}});