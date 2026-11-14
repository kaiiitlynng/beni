// Server-only: import only inside authenticated handlers.
function requireApiKey() {
  const key = process.env['LOVABLE_API_KEY'];
  if(!key) throw new Error('Calendar service authentication is not configured.');
  return key;
}
export async function authorizeAppUserOAuth(params: {gatewayBaseUrl:string;connectorId:string;appUserId:string;clientAPIKey:string;returnUrl:string;credentialsConfiguration?:Record<string,unknown>}) {
  const res = await fetch(`${params.gatewayBaseUrl}/api/v1/app-users/oauth2/authorize`,{method:'POST',headers:{Authorization:`Bearer ${requireApiKey()}`,'Content-Type':'application/json','X-Client-Api-Key':params.clientAPIKey},body:JSON.stringify({connector_id:params.connectorId,app_user_id:params.appUserId,return_url:params.returnUrl,credentials_configuration:params.credentialsConfiguration})});
  if(!res.ok) throw new Error(`Google authorization failed (${res.status}): ${await res.text()}`);
  const body: {authorization_url?:string;session_id?:string} = await res.json();
  if(!body.authorization_url) throw new Error('Google did not return an authorization URL.');
  return {authorizationUrl:body.authorization_url,sessionId:body.session_id??''};
}
export async function exchangeAppUserOAuthCode(gatewayBaseUrl:string,code:string) {
  const res = await fetch(`${gatewayBaseUrl}/api/v1/app-users/oauth2/exchange`,{method:'POST',headers:{Authorization:`Bearer ${requireApiKey()}`,'Content-Type':'application/json'},body:JSON.stringify({code})});
  if(!res.ok) throw new Error(`Google connection could not be completed (${res.status}): ${await res.text()}`);
  const body: {api_key?:string;connector_id?:string} = await res.json();
  if(!body.api_key || !body.connector_id) throw new Error('Google returned an incomplete connection.');
  return {connectionAPIKey:body.api_key,connectorId:body.connector_id};
}
export async function callAsAppUser(params:{gatewayBaseUrl:string;connectionAPIKey:string;connectorId:string;path:string;init?:RequestInit;requiredScopes?:string[]}) {
  const headers = new Headers(params.init?.headers);
  headers.set('Authorization',`Bearer ${requireApiKey()}`);
  headers.set('X-Connection-Api-Key',params.connectionAPIKey);
  if(params.requiredScopes?.length) headers.set('X-Lovable-Required-Scopes',params.requiredScopes.join(' '));
  return fetch(`${params.gatewayBaseUrl}/${params.connectorId}${params.path.startsWith('/')?'':'/'}${params.path}`,{...params.init,headers});
}
export async function appUserReconnectRequired(res:Response) {
  if(res.status!==401) return false;
  const body = await res.clone().json().catch(()=>null);
  return typeof body?.type==='string' && body.type.startsWith('credential_');
}
export async function disconnectAppUser(params:{gatewayBaseUrl:string;connectionAPIKey:string;connectorId:string}) {
  const res = await fetch(`${params.gatewayBaseUrl}/api/v1/app-users/connection`,{method:'DELETE',headers:{Authorization:`Bearer ${requireApiKey()}`,'X-Connection-Api-Key':params.connectionAPIKey,'Content-Type':'application/json'},body:JSON.stringify({connector_id:params.connectorId})});
  if(!res.ok) throw new Error(`Calendar disconnect failed (${res.status}): ${await res.text()}`);
}