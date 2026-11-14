import {createFileRoute,Outlet,redirect} from '@tanstack/react-router';
import {supabase} from '@/integrations/supabase/client';
import {useHubRealtime} from '@/hooks/use-hub-realtime';
export const Route=createFileRoute('/_authenticated')({ssr:false,beforeLoad:async()=>{const {data,error}=await supabase.auth.getUser();if(error||!data.user)throw redirect({to:'/auth'});},component:AuthedLayout});
function AuthedLayout(){useHubRealtime();return <Outlet/>;}
