import {encryptConnectionKey, decryptConnectionKey} from './connectionKeyCrypto.server';
export async function saveConnectionKeyForUser(userId: string, connectorId: string, connectionAPIKey: string) {
  const {supabaseAdmin} = await import('@/integrations/supabase/client.server');
  const {error} = await supabaseAdmin.from('app_user_connections').upsert({user_id:userId,connector_id:connectorId,connection_key_ciphertext:encryptConnectionKey(connectionAPIKey),updated_at:new Date().toISOString()},{onConflict:'user_id,connector_id'});
  if(error) throw new Error('Calendar connection could not be saved.');
}
export async function getConnectionKeyForUser(userId: string, connectorId: string) {
  const {supabaseAdmin} = await import('@/integrations/supabase/client.server');
  const {data,error} = await supabaseAdmin.from('app_user_connections').select('connection_key_ciphertext').eq('user_id',userId).eq('connector_id',connectorId).maybeSingle();
  if(error) throw new Error('Calendar connection could not be read.');
  return data ? decryptConnectionKey(data.connection_key_ciphertext) : null;
}