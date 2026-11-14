import {createHmac,timingSafeEqual} from 'node:crypto';
export function linqWebhookPreflight(headers:Headers,secret:string|undefined):Response|null {
  // Anonymous probes are not provider deliveries. Reject them before setup checks.
  if(!headers.get('webhook-id')||!headers.get('webhook-timestamp')||!headers.get('webhook-signature')) {
    return Response.json({error:'Missing webhook signature.'},{status:401});
  }
  // Preserve retryable failure for actual deliveries until verification is configured.
  if(!secret) return Response.json({error:'Webhook signing secret is not configured.'},{status:503,headers:{'Retry-After':'60'}});
  return null;
}
export function verifyLinqSignature(headers:Headers,body:string,secret:string,now=Date.now()) {
  const id=headers.get('webhook-id');
  const timestamp=headers.get('webhook-timestamp');
  const signature=headers.get('webhook-signature');
  if(!id||!timestamp||!signature||!/^\d+$/.test(timestamp)||Math.abs(now-Number(timestamp)*1000)>300000) return false;
  const key=Buffer.from(secret.replace(/^whsec_/,''),'base64');
  const expected=createHmac('sha256',key).update(`${id}.${timestamp}.${body}`).digest();
  return signature.split(' ').some(value=>{
    if(!value.startsWith('v1,'))return false;
    const actual=Buffer.from(value.slice(3),'base64');
    return actual.length===expected.length&&timingSafeEqual(actual,expected);
  });
}