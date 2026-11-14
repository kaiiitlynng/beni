import {createFileRoute} from '@tanstack/react-router';
import {z} from 'zod';
const schema=z.object({event_id:z.string().min(1).max(255),event_type:z.string().max(100),webhook_version:z.literal('2026-02-03'),data:z.object({id:z.string().max(255),direction:z.enum(['inbound','outbound']).optional(),chat:z.object({id:z.string().max(255),is_group:z.boolean()}),sender_handle:z.object({handle:z.string().max(50)}).optional(),parts:z.array(z.object({type:z.string().max(50),value:z.string().max(10000).optional()})).max(100).optional()})});
export const Route=createFileRoute('/api/public/linq/webhook')({server:{handlers:{
  GET:async()=>Response.json({service:'beni Linq webhook',version:'2026-02-03'}),
  POST:async({request})=>{
    const secret=process.env['LINQ_WEBHOOK_SECRET'];
    if(!secret)return new Response('Webhook signing secret is not configured.',{status:503});
    const raw=await request.text();
    if(raw.length>262144)return new Response('Payload too large',{status:413});
    const {verifyLinqSignature}=await import('@/lib/linq-signature.server');
    if(!verifyLinqSignature(request.headers,raw,secret))return new Response('Invalid signature',{status:401});
    const parsed=schema.safeParse(JSON.parse(raw));
    if(!parsed.success)return new Response('Invalid webhook payload or version',{status:400});
    const event=parsed.data;
    const {supabaseAdmin}=await import('@/integrations/supabase/client.server');
    const {error:receiptError}=await supabaseAdmin.from('linq_webhook_receipts').insert({id:event.event_id});
    if(receiptError) return receiptError.code==='23505'?Response.json({received:true,duplicate:true}):new Response('Could not save receipt',{status:503});
    try {
      if(event.event_type!=='message.received') {
        const statuses:Record<string,string>={'message.sent':'sent','message.delivered':'delivered','message.read':'read','message.failed':'failed'};
        const status=statuses[event.event_type];
        if(status) {
          const {data:current,error:readError}=await supabaseAdmin.from('linq_messages').select('id,delivery_status').eq('provider_message_id',event.data.id).maybeSingle();
          if(readError)throw readError;
          const rank:Record<string,number>={pending:0,queued:1,sent:2,delivered:3,read:4};
          if(current&&(status==='failed'||(rank[status]??0)>(rank[current.delivery_status]??0))) {
            const {error}=await supabaseAdmin.from('linq_messages').update({delivery_status:status}).eq('id',current.id);
            if(error)throw error;
          }
        }
      } else if(!event.data.chat.is_group&&event.data.direction==='inbound'&&event.data.sender_handle) {
        const phone=event.data.sender_handle.handle;
        // Only route signed replies to an existing direct chat sent to this exact phone.
        const {data:routes,error:routeError}=await supabaseAdmin.from('linq_messages').select('user_id').eq('chat_id',event.data.chat.id).eq('recipient_phone',phone).eq('direction','outbound');
        if(routeError)throw routeError;
        const users=[...new Set(routes?.map(r=>r.user_id))];
        if(users.length===1) {
          const userId=users[0];
          const {data:profile,error:profileError}=await supabaseAdmin.from('profiles').select('phone').eq('id',userId).single();
          if(profileError)throw profileError;
          const {normalizePhone}=await import('@/lib/integration-rules');
          if(profile&&normalizePhone(profile.phone)===phone) {
            const body=(event.data.parts??[]).filter(p=>p.type==='text').map(p=>p.value??'').join('\n').slice(0,10000);
            const stop=/^(stop|unsubscribe|cancel|end|quit|stopall)$/i.test(body.trim());
            const {error:updateError}=await supabaseAdmin.from('profiles').update({linq_verified_phone:phone,...(stop?{sms_consent:false,notify_sms:false}:{})}).eq('id',userId);
            if(updateError)throw updateError;
            const {error:messageError}=await supabaseAdmin.from('linq_messages').upsert({user_id:userId,provider_message_id:event.data.id,chat_id:event.data.chat.id,recipient_phone:phone,body,direction:'inbound',delivery_status:'received',reply_status:stop?'opted-out':body?'queued':'none'},{onConflict:'provider_message_id',ignoreDuplicates:true});
            if(messageError)throw messageError;
          }
        }
      }
      const {error:doneError}=await supabaseAdmin.from('linq_webhook_receipts').update({status:'completed'}).eq('id',event.event_id);
      if(doneError)throw doneError;
      return Response.json({received:true});
    } catch(error) {
      console.error('Linq webhook processing failed',error instanceof Error?error.message:'unknown');
      await supabaseAdmin.from('linq_webhook_receipts').delete().eq('id',event.event_id);
      return new Response('Webhook processing failed',{status:503});
    }
  }
}}});