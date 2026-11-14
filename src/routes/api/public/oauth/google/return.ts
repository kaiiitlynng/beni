import {createFileRoute} from '@tanstack/react-router';
export const Route=createFileRoute('/api/public/oauth/google/return')({server:{handlers:{GET:async({request})=>{
  const url=new URL(request.url);
  const result={success:url.searchParams.get('success')==='true'&&Boolean(url.searchParams.get('code')),connectorId:url.searchParams.get('connector_id'),code:url.searchParams.get('code')};
  const safe=JSON.stringify(result).replace(/</g,'\\u003c');
  return new Response(`<!DOCTYPE html><html><head><title>Google Calendar | beni</title></head><body><p>${result.success?'Finishing Google Calendar connection…':'Google connection did not complete. Return to Beni and try again.'}</p><script>const r=${safe};if(window.opener&&window.opener!==window){window.opener.postMessage({type:r.success?'appUserConnectorOAuthComplete':'appUserConnectorOAuthFailed',connectorId:r.connectorId,code:r.code},window.location.origin)}window.close();</script></body></html>`,{headers:{'Content-Type':'text/html','Cache-Control':'no-store','Referrer-Policy':'no-referrer'}});
}}}});