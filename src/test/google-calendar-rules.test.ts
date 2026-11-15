import {describe,it,expect} from 'vitest';
import {approvedGoogleExport,availableWindows,allDayRange} from '../lib/google-calendar-rules';
describe('Google Calendar rules',()=>{
 it('never exports an unconfirmed hold',()=>expect(approvedGoogleExport({status:'hold',user_confirmed:false},true)).toBe(false));
 it('requires explicit export approval even for a confirmed entry',()=>expect(approvedGoogleExport({status:'confirmed',user_confirmed:true},false)).toBe(false));
 it('exports an explicitly approved confirmed entry',()=>expect(approvedGoogleExport({status:'confirmed',user_confirmed:true},true)).toBe(true));
 it('merges overlapping Google busy periods',()=>expect(availableWindows([{start:'2026-11-15T10:00:00Z',end:'2026-11-15T12:00:00Z'},{start:'2026-11-15T11:00:00Z',end:'2026-11-15T13:00:00Z'}],'2026-11-15T09:00:00Z','2026-11-15T14:00:00Z')).toEqual([{start:'2026-11-15T09:00:00.000Z',end:'2026-11-15T10:00:00.000Z'},{start:'2026-11-15T13:00:00.000Z',end:'2026-11-15T14:00:00.000Z'}]));
 it('does not present an exclusive all-day end as a busy day',()=>expect(allDayRange('2026-10-21','2026-10-24')).toEqual({start:'2026-10-21',end:'2026-10-23'}));
});
import {isEditableBeniGoogleEvent,googleEventPatch} from '../lib/google-calendar-rules';
describe('Editing Beni-created Google events',()=>{
 it('allows only confirmed entries Beni exported',()=>{
  expect(isEditableBeniGoogleEvent({google_event_id:'beni0123abcd',user_confirmed:true})).toBe(true);
  expect(isEditableBeniGoogleEvent({google_event_id:'abc123',user_confirmed:true})).toBe(false);
  expect(isEditableBeniGoogleEvent({google_event_id:null,user_confirmed:true})).toBe(false);
  expect(isEditableBeniGoogleEvent({google_event_id:'beni0123abcd',user_confirmed:false})).toBe(false);
 });
 const current={starts_at:'2026-11-20T18:00:00.000Z',ends_at:'2026-11-20T18:45:00.000Z'};
 it('sends only the fields that changed',()=>{
  const r=googleEventPatch(current,{title:' Dental cleaning '});
  expect(r).toEqual({ok:true,patch:{summary:'Dental cleaning'},local:{title:'Dental cleaning'}});
 });
 it('keeps the duration when only the start moves',()=>{
  const r=googleEventPatch(current,{starts_at:'2026-11-21T22:00:00Z'});
  expect(r.ok&&r.patch).toEqual({start:{dateTime:'2026-11-21T22:00:00.000Z'},end:{dateTime:'2026-11-21T22:45:00.000Z'}});
 });
 it('clears location and notes with empty Google fields',()=>{
  const r=googleEventPatch(current,{location:null,notes:''});
  expect(r).toEqual({ok:true,patch:{location:'',description:''},local:{location:null,notes:null}});
 });
 it('rejects an end before the start, bad times, empty titles and no-op changes',()=>{
  expect(googleEventPatch(current,{starts_at:'2026-11-21T22:00:00Z',ends_at:'2026-11-21T21:00:00Z'}).ok).toBe(false);
  expect(googleEventPatch(current,{starts_at:'friday at 3'}).ok).toBe(false);
  expect(googleEventPatch(current,{title:'  '}).ok).toBe(false);
  expect(googleEventPatch(current,{}).ok).toBe(false);
 });
});
