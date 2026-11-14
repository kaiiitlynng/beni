export function activeInsurance<T extends { is_active: boolean; status: string }>(plans: T[]): T | undefined {
  return plans.find(p => p.is_active && p.status === 'ready');
}
export function currentBenefits<T extends { plan_id: string }>(benefits: T[], planId?: string): T[] {
  return planId ? benefits.filter(b => b.plan_id === planId) : [];
}
export function canActivateInsurance(plan: { status: string; user_id: string }, userId: string) {
  return plan.status === 'ready' && plan.user_id === userId;
}