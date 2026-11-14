import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
function key() {
  const raw = process.env['APP_USER_CONNECTION_KEY_SECRET'];
  if (!raw) throw new Error('Secure calendar connection storage is unavailable.');
  return Buffer.from(raw, 'base64');
}
export function encryptConnectionKey(plaintext: string) {
  const iv = randomBytes(12), cipher = createCipheriv('aes-256-gcm', key(), iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), encrypted]).toString('base64');
}
export function decryptConnectionKey(ciphertext: string) {
  const bytes = Buffer.from(ciphertext, 'base64'), cipher = createDecipheriv('aes-256-gcm', key(), bytes.subarray(0, 12));
  cipher.setAuthTag(bytes.subarray(12, 28));
  return Buffer.concat([cipher.update(bytes.subarray(28)), cipher.final()]).toString('utf8');
}