import { describe, expect, it } from 'vitest';
import { editableProfileUpdate } from '@/lib/profile-updates';

describe('owner profile updates', () => {
  it('does not resend protected fields from a loaded profile', () => {
    const update = editableProfileUpdate({
      id: 'owner-id', created_at: '2026-11-14T23:05:00Z',
      linq_verified_phone: '+15555550100', first_name: 'Test', phone: '+15555550101',
    });
    expect(update).toEqual({ first_name: 'Test', phone: '+15555550101' });
  });
  it('preserves onboarding completion and explicit consent choices', () => {
    expect(editableProfileUpdate({ onboarding_complete: true, sms_consent: false, break_start: null }))
      .toEqual({ onboarding_complete: true, sms_consent: false, break_start: null });
  });
  it('preserves notification preferences without unrelated fields', () => {
    expect(editableProfileUpdate({ timezone: 'America/Los_Angeles', notify_sms: false, notify_appointments: true }))
      .toEqual({ timezone: 'America/Los_Angeles', notify_sms: false, notify_appointments: true });
  });
});