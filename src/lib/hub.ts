import type { Tables } from '@/integrations/supabase/types';
import { toKey } from './calendar';

export type Hub = {
  profile: Tables<'profiles'> | null;
  plans: Tables<'plans_uploaded'>[];
  benefits: Tables<'benefits'>[];
  visits: Tables<'visits'>[];
  events: Tables<'calendar_events'>[];
  messages: Tables<'messages'>[];
  reminders: Tables<'reminders'>[];
  messagingConnected: boolean;
  /** beni's Linq number, when messaging is configured. */
  beniNumber?: string | null;
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
  return toKey(new Date(event.starts_at));
}

export function greeting(firstName: string | undefined): string {
  const h = new Date().getHours();
  const part = h < 12 ? 'morning' : h < 18 ? 'afternoon' : 'evening';
  return `good ${part}, ${firstName || 'you'}.`;
}

export function fmtDate(iso: string): string {
  return new Date(iso.length === 10 ? `${iso}T12:00:00` : iso).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

export function fmtTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
}
