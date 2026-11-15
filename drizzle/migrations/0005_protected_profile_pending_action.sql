ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS pending_action jsonb;
COMMENT ON COLUMN public.profiles.pending_action IS 'Server-managed pending confirmation action; never writable by clients.';
REVOKE UPDATE, INSERT ON public.profiles FROM anon, PUBLIC;
REVOKE UPDATE ON public.profiles FROM authenticated;
REVOKE UPDATE (pending_action), INSERT (pending_action) ON public.profiles FROM anon, authenticated, PUBLIC;
GRANT UPDATE (first_name, phone, organization, current_city, home_city, sms_consent, break_start, break_end, availability, interests, reminder_preferences, onboarding_complete, timezone, messaging_hours, reminder_frequency, notify_sms, notify_appointments, notify_benefits, notify_expiration, notify_checkins) ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;