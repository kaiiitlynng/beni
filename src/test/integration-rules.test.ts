import {describe,it,expect} from 'vitest';
import {createHmac} from 'node:crypto';
import {textingAllowed,approvedCalendarEntry,availableWindows,normalizePhone} from '@/lib/integration-rules';
import {verifyLinqSignature} from '@/lib/linq-signature.server';
describe('real integration safeguards',()=>{
  it('requires opt-in for real and test messages',()=>{expect(textingAllowed({sms_consent:false,notify_sms:true})).toBe(false);expect(textingAllowed({sms_consent:true,notify_sms:true})).toBe(true);});
  it('honors the text notification master switch',()=>{expect(textingAllowed({sms_consent:true,notify_sms:false})).toBe(false);});
  it('exports only user-approved entries, never holds',()=>{expect(approvedCalendarEntry({user_confirmed:false,status:'hold'})).toBe(false);expect(approvedCalendarEntry({user_confirmed:true,status:'hold'})).toBe(false);expect(approvedCalendarEntry({user_confirmed:true,status:'confirmed'})).toBe(true);});
  it('requires country-coded phone numbers',()=>{expect(normalizePhone('+1 (415) 555-1234')).toBe('+14155551234');expect(()=>normalizePhone('4155551234')).toThrow();});
  it('excludes overlapping busy calendar intervals',()=>{expect(availableWindows('2026-11-14T09:00:00Z','2026-11-14T17:00:00Z',[{start:'2026-11-14T10:00:00Z',end:'2026-11-14T12:00:00Z'},{start:'2026-11-14T11:00:00Z',end:'2026-11-14T13:00:00Z'}])).toEqual([{start:'2026-11-14T09:00:00.000Z',end:'2026-11-14T10:00:00.000Z'},{start:'2026-11-14T13:00:00.000Z',end:'2026-11-14T17:00:00.000Z'}]);});
  it('rejects forged and replayed Linq webhooks',()=>{
    const secret='whsec_'+Buffer.from('test-only-signature-key').toString('base64');
    const body='{"event_type":"message.received"}';const timestamp='1794693600';
    const signature=createHmac('sha256',Buffer.from('test-only-signature-key')).update(`event-1.${timestamp}.${body}`).digest('base64');
    const headers=new Headers({'webhook-id':'event-1','webhook-timestamp':timestamp,'webhook-signature':`v1,${signature}`});
    expect(verifyLinqSignature(headers,body,secret,Number(timestamp)*1000)).toBe(true);
    expect(verifyLinqSignature(headers,body+' ',secret,Number(timestamp)*1000)).toBe(false);
    expect(verifyLinqSignature(headers,body,secret,Number(timestamp)*1000+301000)).toBe(false);
  });
});