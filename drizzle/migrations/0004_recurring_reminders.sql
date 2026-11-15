ALTER TABLE public.reminders
  ADD COLUMN IF NOT EXISTS frequency text NOT NULL DEFAULT 'once' CHECK (frequency IN ('once','weekly','monthly','quarterly','semiannual','annual','custom')),
  ADD COLUMN IF NOT EXISTS interval_days integer CHECK (interval_days IS NULL OR interval_days BETWEEN 1 AND 730),
  ADD COLUMN IF NOT EXISTS benefit_id uuid,
  ADD COLUMN IF NOT EXISTS end_date date,
  ADD COLUMN IF NOT EXISTS paused boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS method text NOT NULL DEFAULT 'text' CHECK (method IN ('text','in_app')),
  ADD COLUMN IF NOT EXISTS last_sent_at timestamptz,
  ADD COLUMN IF NOT EXISTS delivery_status text,
  ADD COLUMN IF NOT EXISTS sending_at timestamptz,
  ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now();
REVOKE ALL ON public.reminders FROM authenticated;
GRANT SELECT, DELETE ON public.reminders TO authenticated;
GRANT INSERT (user_id,title,remind_at,status,frequency,interval_days,benefit_id,end_date,paused,method) ON public.reminders TO authenticated;
GRANT UPDATE (title,remind_at,status,frequency,interval_days,benefit_id,end_date,paused,method) ON public.reminders TO authenticated;
GRANT ALL ON public.reminders TO service_role;
CREATE INDEX IF NOT EXISTS reminders_due_idx ON public.reminders (remind_at) WHERE status = 'open' AND paused = false;