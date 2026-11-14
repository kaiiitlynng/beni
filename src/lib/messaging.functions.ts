import {createServerFn} from '@tanstack/react-start';
import {requireSupabaseAuth} from '@/integrations/supabase/auth-middleware';
import {z} from 'zod';
export const getMessagingStatus=createServerFn({method:'GET'}).middleware([requireSupabaseAuth]).handler(async({context})=>{
  const {data:profile,error}=await context.supabase.from('profiles').select('linq_verified_phone,phone,sms_consent,notify_sms').eq('id',context.userId).single();
  if(error)throw new Error('Messaging preferences could not be loaded.');
  if(!process.env['LINQ_API_KEY'])return {configured:false,connected:false,verified:false,webhookReady:false,error:'Linq API token is not configured.'};
  try {
    const {linqCall}=await import('./linq.server');
    const result=z.object({phone_numbers:z.array(z.object({line_status:z.string().optional()}))}).parse(await (await linqCall('/phone_numbers')).json());
    return {configured:true,connected:result.phone_numbers.length>0,verified:!!profile.linq_verified_phone&&profile.linq_verified_phone===profile.phone,webhookReady:!!process.env['LINQ_WEBHOOK_SECRET'],error:result.phone_numbers.length?null:'No Linq messaging line is available.'};
  } catch(error) {return {configured:true,connected:false,verified:false,webhookReady:false,error:error instanceof Error?error.message:'Linq connection failed.'};}
});
export const sendTestMessage=createServerFn({method:'POST'}).middleware([requireSupabaseAuth]).inputValidator((d:unknown)=>z.object({requestId:z.string().uuid()}).parse(d)).handler(async({context,data})=>{
  const {sendTextForUser}=await import('./linq.server');
  return sendTextForUser(context.userId,'hi, it’s beni. this is your real test message. Reply HELLO to verify your phone and talk with beni. Reply STOP to opt out.',`test-${context.userId}-${data.requestId}`,true);
});