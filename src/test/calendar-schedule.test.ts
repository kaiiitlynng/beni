import {describe,it,expect} from 'vitest';
import {dailyAvailability,entriesOnDay,layoutEntries,type ScheduleEntry} from '../lib/calendar-schedule';
import {canAccessLinkedCalendar} from '../lib/calendar-access';
const date=new Date('2026-11-14T12:00:00');
const past=new Date('2026-11-13T00:00:00');
describe('daily appointment availability',()=>{
 it('defaults to 8 AM–8 PM on one calendar day',()=>{const windows=dailyAvailability(date,[],undefined,undefined,past);expect(new Date(windows[0]?.start??'').getHours()).toBe(8);expect(new Date(windows[0]?.end??'').getHours()).toBe(20);expect(windows).toHaveLength(1);});
 it('subtracts Google busy periods separately for each day',()=>{const busy=[{start:'2026-11-14T10:00:00',end:'2026-11-14T19:00:00'}];const slots=dailyAvailability(date,busy,8,20,past);expect(slots.map(w=>[new Date(w.start).getHours(),new Date(w.end).getHours()])).toEqual([[8,10],[19,20]]);});
 it('excludes past times',()=>{const slots=dailyAvailability(date,[],8,20,new Date('2026-11-14T13:00:00'));expect(new Date(slots[0]?.start??'').getHours()).toBe(13);});
 it('excludes available gaps shorter than 30 minutes',()=>{const slots=dailyAvailability(date,[{start:'2026-11-14T08:20:00',end:'2026-11-14T20:00:00'}],8,20,past);expect(slots).toEqual([]);});
 it('keeps a gap of exactly 30 minutes',()=>{const slots=dailyAvailability(date,[{start:'2026-11-14T08:30:00',end:'2026-11-14T20:00:00'}],8,20,past);expect(slots).toHaveLength(1);expect(Date.parse(slots[0]?.end??'')-Date.parse(slots[0]?.start??'')).toBe(30*60000);});
 it('honors customized preferred hours',()=>{const slots=dailyAvailability(date,[],9,17,past);expect(new Date(slots[0]?.start??'').getHours()).toBe(9);expect(new Date(slots[0]?.end??'').getHours()).toBe(17);});
 it('all-day Google end remains exclusive',()=>{const event:ScheduleEntry={id:'a',title:'All day',type:'google',allDay:true,start:'2026-11-14',end:'2026-11-15'};expect(entriesOnDay([event],date)).toHaveLength(1);expect(entriesOnDay([event],new Date('2026-11-15T12:00:00'))).toHaveLength(0);});
 it('gives overlapping events separate columns',()=>{const events:ScheduleEntry[]=[{id:'1',title:'One',type:'google',start:'2026-11-14T10:00:00',end:'2026-11-14T12:00:00'},{id:'2',title:'Two',type:'google',start:'2026-11-14T11:00:00',end:'2026-11-14T13:00:00'}];expect(layoutEntries(events).map(e=>[e.column,e.columns])).toEqual([[0,2],[1,2]]);});
});
describe('linked calendar privacy',()=>{
 it('allows Julie’s verified account',()=>expect(canAccessLinkedCalendar({email:'jseaman@berkeley.edu',email_confirmed_at:'2026-01-01'})).toBe(true));
 it('denies every other signed-in account',()=>expect(canAccessLinkedCalendar({email:'someone@berkeley.edu',email_confirmed_at:'2026-01-01'})).toBe(false));
 it('denies an unverified matching email',()=>expect(canAccessLinkedCalendar({email:'jseaman@berkeley.edu'})).toBe(false));
 it('denies signed-out requests',()=>expect(canAccessLinkedCalendar(null)).toBe(false));
});