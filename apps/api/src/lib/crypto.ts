import { createCipheriv, createDecipheriv, createHash, randomBytes, scryptSync } from 'crypto';
import bcrypt from 'bcrypt';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const TAG_LENGTH = 16;

function getEncryptionKey(): Buffer {
  const key = process.env.ENCRYPTION_KEY;
  if (!key) throw new Error('ENCRYPTION_KEY is not set');
  return scryptSync(key, 'matumailer-salt', 32);
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export function encrypt(text: string): string {
  const key = getEncryptionKey();
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(text, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, encrypted]).toString('base64');
}

export function decrypt(encryptedText: string): string {
  try {
    const key = getEncryptionKey();
    const data = Buffer.from(encryptedText, 'base64');
    if (data.length <= IV_LENGTH + TAG_LENGTH) {
      throw new Error('DKIM_KEY_DECRYPT_FAILED — ciphertext inválido o truncado.');
    }
    const iv = data.subarray(0, IV_LENGTH);
    const tag = data.subarray(IV_LENGTH, IV_LENGTH + TAG_LENGTH);
    const encrypted = data.subarray(IV_LENGTH + TAG_LENGTH);
    const decipher = createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString('utf8');
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.startsWith('DKIM_KEY_DECRYPT_FAILED'))
      throw err instanceof Error ? err : new Error(msg);
    throw new Error(
      'DKIM_KEY_DECRYPT_FAILED — No se pudo descifrar la clave DKIM. Revisa que ENCRYPTION_KEY sea la misma con la que se creó el dominio.',
    );
  }
}
