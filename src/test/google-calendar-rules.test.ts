import {describe,it,expect} from 'vitest';
import {approvedGoogleExport,availableWindows,allDayRange} from '../lib/google-calendar-rules';
describe('Google Calendar rules',()=>{
 it('never exports an unconfirmed hold',()=>expect(approvedGoogleExport({status:'hold',user_confirmed:false},true)).toBe(false));
 it('requires explicit export approval even for a confirmed entry',()=>expect(approvedGoogleExport({status:'confirmed',user_confirmed:true},false)).toBe(false));
 it('exports an explicitly approved confirmed entry',()=>expect(approvedGoogleExport({status:'confirmed',user_confirmed:true},true)).toBe(true));
 it('merges overlapping Google busy periods',()=>expect(availableWindows([{start:'2026-11-15T10:00:00Z',end:'2026-11-15T12:00:00Z'},{start:'2026-11-15T11:00:00Z',end:'2026-11-15T13:00:00Z'}],'2026-11-15T09:00:00Z','2026-11-15T14:00:00Z')).toEqual([{start:'2026-11-15T09:00:00.000Z',end:'2026-11-15T10:00:00.000Z'},{start:'2026-11-15T13:00:00.000Z',end:'2026-11-15T14:00:00.000Z'}]));
 it('does not present an exclusive all-day end as a busy day',()=>expect(allDayRange('2026-10-21','2026-10-24')).toEqual({start:'2026-10-21',end:'2026-10-23'}));
});