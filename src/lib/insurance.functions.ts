import { createServerFn } from '@tanstack/react-start';
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware';

export const activateInsurance = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { planId: string }) => data)
  .handler(async ({ context, data }) => {
    const { error } = await context.supabase.rpc('activate_insurance_plan', { target_plan: data.planId });
    if (error) throw new Error('Only a successfully processed plan belonging to you can be activated. Please try again.');
    return { activated: true };
  });

export const viewInsurancePdf = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { planId: string }) => data)
  .handler(async ({ context, data }) => {
    const { data: plan } = await context.supabase.from('plans_uploaded').select('storage_path').eq('id', data.planId).eq('user_id', context.userId).maybeSingle();
    if (!plan) throw new Error('Your document could not be found.');
    const result = await context.supabase.storage.from('insurance-plans').createSignedUrl(plan.storage_path, 300);
    if (result.error) throw new Error('Your PDF could not be opened.');
    return { url: result.data.signedUrl };
  });