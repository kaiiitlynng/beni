ALTER TABLE public.plans_uploaded ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT false;
ALTER TABLE public.plans_uploaded ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE public.plans_uploaded ADD COLUMN IF NOT EXISTS extraction_error text;
CREATE UNIQUE INDEX IF NOT EXISTS one_active_insurance_per_user ON public.plans_uploaded(user_id) WHERE is_active;
REVOKE INSERT, UPDATE ON public.plans_uploaded FROM authenticated;
GRANT INSERT(user_id,file_name,storage_path) ON public.plans_uploaded TO authenticated;
GRANT ALL ON public.plans_uploaded TO service_role;
CREATE OR REPLACE FUNCTION public.activate_insurance_plan(target_plan uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE owner_id uuid := auth.uid();
BEGIN
 IF owner_id IS NULL THEN RAISE EXCEPTION 'Sign in first'; END IF;
 PERFORM id FROM public.profiles WHERE id=owner_id FOR UPDATE;
 IF NOT EXISTS (SELECT 1 FROM public.plans_uploaded WHERE id=target_plan AND user_id=owner_id AND status='ready') THEN RAISE EXCEPTION 'Only your processed insurance plan can be activated'; END IF;
 UPDATE public.plans_uploaded SET is_active=false WHERE user_id=owner_id AND is_active;
 UPDATE public.plans_uploaded SET is_active=true,updated_at=now() WHERE id=target_plan AND user_id=owner_id;
END; $$;
REVOKE ALL ON FUNCTION public.activate_insurance_plan(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.activate_insurance_plan(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.activate_insurance_plan(uuid) TO service_role;