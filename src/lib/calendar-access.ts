/** Only the verified owner of the linked Google account may use its credentials. */
export function canAccessLinkedCalendar(user: { email?: string; email_confirmed_at?: string } | null) {
  return Boolean(user?.email_confirmed_at && user.email?.toLowerCase() === 'jseaman@berkeley.edu');
}