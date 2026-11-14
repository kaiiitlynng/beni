import {createServerFn} from '@tanstack/react-start';
import {requireSupabaseAuth} from '@/integrations/supabase/auth-middleware';
export const getHub = createServerFn({method:'GET'}).middleware([requireSupabaseAuth]).handler(async({context})=>{
 const client=context.supabase;
 const [profile,plans,benefits,visits,events,messages,reminders]=await Promise.all([client.from('profiles').select('*').eq('id',context.userId).single(),client.from('plans_uploaded').select('*').order('created_at',{ascending:false}),client.from('benefits').select('*'),client.from('visits').select('*'),client.from('calendar_events').select('*').order('starts_at'),client.from('messages').select('*').order('created_at').limit(100),client.from('reminders').select('*')]);
 for(const result of [profile,plans,benefits,visits,events,messages,reminders]) if(result.error) throw new Error('Your care information could not be loaded. Please try again.');
 return {profile:profile.data,plans:plans.data??[],benefits:benefits.data??[],visits:visits.data??[],events:events.data??[],messages:messages.data??[],reminders:reminders.data??[],messagingConnected:false};
});
