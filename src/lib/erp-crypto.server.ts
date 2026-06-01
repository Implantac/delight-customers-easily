/**
 * Criptografia simétrica para credenciais de ERP.
 * AES-256-GCM. Chave em ERP_CREDENTIALS_KEY (env). Formato: base64(iv|authTag|ciphertext).
 * Server-only — NUNCA importar do bundle client.
 */
import { createCipheriv, createDecipheriv, randomBytes, createHash } from 'node:crypto';

function getKey(): Buffer {
  const raw = process.env.ERP_CREDENTIALS_KEY;
  if (!raw) throw new Error('ERP_CREDENTIALS_KEY não configurada');
  // Derive 32-byte key from input via SHA-256 (aceita qualquer comprimento de chave)
  return createHash('sha256').update(raw, 'utf8').digest();
}

export function encryptCredentials(payload: Record<string, unknown>): string {
  const key = getKey();
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const plaintext = Buffer.from(JSON.stringify(payload), 'utf8');
  const enc = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, enc]).toString('base64');
}

export function decryptCredentials<T = Record<string, unknown>>(blob: string): T {
  const key = getKey();
  const buf = Buffer.from(blob, 'base64');
  const iv = buf.subarray(0, 12);
  const tag = buf.subarray(12, 28);
  const enc = buf.subarray(28);
  const decipher = createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(tag);
  const dec = Buffer.concat([decipher.update(enc), decipher.final()]);
  return JSON.parse(dec.toString('utf8')) as T;
}
