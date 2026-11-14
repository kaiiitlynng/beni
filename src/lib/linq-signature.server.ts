import {createHmac,timingSafeEqual} from 'node:crypto';
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