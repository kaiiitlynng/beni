import type { TablesUpdate } from '@/integrations/supabase/types';

const EDITABLE_FIELDS = [
  'first_name', 'phone', 'organization', 'current_city', 'home_city',
  'sms_consent', 'break_start', 'break_end', 'availability', 'interests',
  'reminder_preferences', 'onboarding_complete', 'timezone', 'messaging_hours',
  'reminder_frequency', 'notify_sms', 'notify_appointments', 'notify_benefits',
  'notify_expiration', 'notify_checkins',
] as const;

export function editableProfileUpdate(profile: TablesUpdate<'profiles'>): TablesUpdate<'profiles'> {
  return Object.fromEntries(
    EDITABLE_FIELDS.filter((key) => profile[key] !== undefined).map((key) => [key, profile[key]]),
  );
}