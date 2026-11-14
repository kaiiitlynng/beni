import { describe, it, expect } from 'vitest';
import { activeInsurance, currentBenefits, canActivateInsurance } from '../lib/insurance-rules';

describe('insurance replacement safeguards', () => {
  it('keeps the existing plan when a replacement fails', () => {
    expect(activeInsurance([{id:'new',is_active:false,status:'failed'},{id:'old',is_active:true,status:'ready'}])?.id).toBe('old');
  });
  it('does not activate a processed replacement without confirmation', () => {
    expect(activeInsurance([{id:'new',is_active:false,status:'ready'},{id:'old',is_active:true,status:'ready'}])?.id).toBe('old');
  });
  it('only shows benefits from the active plan and preserves the input history', () => {
    const rows=[{plan_id:'old',name:'dental'},{plan_id:'new',name:'vision'}];
    expect(currentBenefits(rows,'new')).toEqual([{plan_id:'new',name:'vision'}]);
    expect(rows).toHaveLength(2);
  });
  it('requires a successful owned plan to activate', () => {
    expect(canActivateInsurance({status:'failed',user_id:'me'},'me')).toBe(false);
    expect(canActivateInsurance({status:'ready',user_id:'other'},'me')).toBe(false);
    expect(canActivateInsurance({status:'ready',user_id:'me'},'me')).toBe(true);
  });
  it('has no current coverage before a plan is confirmed', () => {
    expect(currentBenefits([{plan_id:'draft'}],undefined)).toEqual([]);
  });
});