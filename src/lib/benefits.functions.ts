import {createServerFn} from '@tanstack/react-start';
import {requireSupabaseAuth} from '@/integrations/supabase/auth-middleware';
import {activeInsurance,currentBenefits} from '@/lib/insurance-rules';
export const getHub = createServerFn({method:'GET'}).middleware([requireSupabaseAuth]).handler(async({context})=>{
 const client=context.supabase;
 const [profile,plans,benefits,visits,events,messages,reminders]=await Promise.all([client.from('profiles').select('*').eq('id',context.userId).single(),client.from('plans_uploaded').select('*').order('created_at',{ascending:false}),client.from('benefits').select('*'),client.from('visits').select('*'),client.from('calendar_events').select('*').order('starts_at'),client.from('messages').select('*').order('created_at').limit(100),client.from('reminders').select('*')]);
 for(const result of [profile,plans,benefits,visits,events,messages,reminders]) if(result.error) throw new Error('Your care information could not be loaded. Please try again.');
  return {profile:profile.data,plans:plans.data??[],benefits:currentBenefits(benefits.data??[],activeInsurance(plans.data??[])?.id),visits:visits.data??[],events:events.data??[],messages:messages.data??[],reminders:reminders.data??[],messagingConnected:Boolean(process.env['LINQ_API_TOKEN']&&process.env['LINQ_FROM_NUMBER'])&&Boolean(profile.data?.sms_consent),beniNumber:process.env['LINQ_FROM_NUMBER']??null};
});

type HoldInput={title:string;starts_at:string;ends_at?:string|null;location?:string|null;notes?:string|null;benefit_id?:string|null;provider_confirmed?:boolean};
export const createHold=createServerFn({method:'POST'}).middleware([requireSupabaseAuth]).inputValidator((d:HoldInput)=>d).handler(async({context,data})=>{
 const {error}=await context.supabase.from('calendar_events').insert({user_id:context.userId,title:data.title,starts_at:data.starts_at,ends_at:data.ends_at??null,kind:'healthcare',location:data.location??null,notes:data.notes??null,benefit_id:data.benefit_id??null,status:data.provider_confirmed?'provider_confirmed':'hold',user_confirmed:Boolean(data.provider_confirmed)});
 if(error)throw new Error('Your calendar hold could not be saved. Please try again.');
});

export const confirmHold=createServerFn({method:'POST'}).middleware([requireSupabaseAuth]).inputValidator((d:{id:string})=>d).handler(async({context,data})=>{
 const {error}=await context.supabase.from('calendar_events').update({status:'confirmed',user_confirmed:true}).eq('id',data.id).eq('user_id',context.userId);
 if(error)throw new Error('Your appointment could not be confirmed. Please try again.');
});

export const deleteEvent=createServerFn({method:'POST'}).middleware([requireSupabaseAuth]).inputValidator((d:{id:string})=>d).handler(async({context,data})=>{
 const {error}=await context.supabase.from('calendar_events').delete().eq('id',data.id).eq('user_id',context.userId);
 if(error)throw new Error('That calendar entry could not be removed. Please try again.');
});

type VisitInput={benefit_id?:string|null;visit_date:string};
export const addVisit=createServerFn({method:'POST'}).middleware([requireSupabaseAuth]).inputValidator((d:VisitInput)=>d).handler(async({context,data})=>{
 const {error}=await context.supabase.from('visits').insert({user_id:context.userId,benefit_id:data.benefit_id??null,visit_date:data.visit_date,confirmed:true});
 if(error)throw new Error('Your visit could not be recorded. Please try again.');
});

export const updateVisit=createServerFn({method:'POST'}).middleware([requireSupabaseAuth]).inputValidator((d:{id:string;visit_date:string;benefit_id?:string|null})=>d).handler(async({context,data})=>{
 const {error}=await context.supabase.from('visits').update({visit_date:data.visit_date,benefit_id:data.benefit_id??null}).eq('id',data.id).eq('user_id',context.userId);
 if(error)throw new Error('Your visit could not be updated. Please try again.');
});

export const addReminder=createServerFn({method:'POST'}).middleware([requireSupabaseAuth]).inputValidator((d:{title:string;remind_at?:string|null})=>d).handler(async({context,data})=>{
 const {error}=await context.supabase.from('reminders').insert({user_id:context.userId,title:data.title,remind_at:data.remind_at??null,status:'open'});
 if(error)throw new Error('Your reminder could not be saved. Please try again.');
});

export const completeReminder=createServerFn({method:'POST'}).middleware([requireSupabaseAuth]).inputValidator((d:{id:string})=>d).handler(async({context,data})=>{
 const {error}=await context.supabase.from('reminders').update({status:'done'}).eq('id',data.id).eq('user_id',context.userId);
 if(error)throw new Error('Your reminder could not be updated. Please try again.');
});
