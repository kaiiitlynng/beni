import type { Tables } from '@/integrations/supabase/types';

export type Hub = {
  profile: Tables<'profiles'> | null;
  plans: Tables<'plans_uploaded'>[];
  benefits: Tables<'benefits'>[];
  visits: Tables<'visits'>[];
  events: Tables<'calendar_events'>[];
  messages: Tables<'messages'>[];
  realMessages: Tables<'linq_messages'>[];
  reminders: Tables<'reminders'>[];
  messagingConnected: boolean;
};

export const CATEGORIES = ['all', 'medical', 'dental', 'vision', 'mental health', 'physical therapy', 'alternative care', 'dermatology', 'other'] as const;

export function coverageTone(status: string): 'covered' | 'not-covered' | 'unclear' {
  const s = status.toLowerCase();
  if (s.includes('not') || s.includes('excluded')) return 'not-covered';
  if (s.includes('unclear') || s.includes('unknown') || s.includes('verify')) return 'unclear';
  return 'covered';
}

export function isHold(event: Pick<Tables<'calendar_events'>, 'status' | 'user_confirmed'>): boolean {
  return event.status === 'hold' || !event.user_confirmed;
}

/** A calendar hold is never a booked appointment until the user confirms it. */
export function isBooked(event: Pick<Tables<'calendar_events'>, 'status' | 'user_confirmed'>): boolean {
  return event.user_confirmed && event.status === 'confirmed';
}

export function eventDay(event: Pick<Tables<'calendar_events'>, 'starts_at'>): string {
  return event.starts_at.slice(0, 10);
}

export function greeting(firstName: string | undefined): string {
  const h = new Date().getHours();
  const part = h < 12 ? 'morning' : h < 18 ? 'afternoon' : 'evening';
  return `good ${part}, ${firstName || 'you'}.`;
}

export function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
}

export function fmtTime(iso: string): string {
  return new Date(iso).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
}
