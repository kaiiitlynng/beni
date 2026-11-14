import {createFileRoute} from '@tanstack/react-router';
export const Route=createFileRoute('/api/public/oauth/google/return')({server:{handlers:{GET:async({request})=>{
  const url=new URL(request.url);
  const success=url.searchParams.get('success')==='true';
  const code=url.searchParams.get('code');
  const result={type:success&&code?'appUserConnectorOAuthComplete':'appUserConnectorOAuthFailed',connectorId:url.searchParams.get('connector_id'),code:success?code:null,error:url.searchParams.get('offline_access_allowed')==='false'?'Offline access must be enabled by your workspace administrator.':url.searchParams.get('error')??'Google authorization failed or returned no code.'};
  const json=JSON.stringify(result).replace(/</g,'\\u003c');
  return new Response(`<!doctype html><html><head><title>Google Calendar connection | beni</title></head><body><p>Finishing your Google Calendar connection. Return to beni.</p><script>const result=${json};if(window.opener){window.opener.postMessage(result,window.location.origin);window.close();}</script></body></html>`,{headers:{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store','Referrer-Policy':'no-referrer'}});
}}}});