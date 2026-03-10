import 'server-only';

import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from 'crypto';

const ALGORITHM = 'aes-256-gcm';

function getSecretKey(): Buffer {
  const secret = process.env.WORDPRESS_CREDENTIALS_SECRET;
  if (!secret) {
    throw new Error('Missing WORDPRESS_CREDENTIALS_SECRET');
  }

  return createHash('sha256').update(secret).digest();
}

export function encryptSecret(plainText: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGORITHM, getSecretKey(), iv);
  const encrypted = Buffer.concat([
    cipher.update(plainText, 'utf8'),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();

  return [
    'v1',
    iv.toString('base64url'),
    tag.toString('base64url'),
    encrypted.toString('base64url'),
  ].join('.');
}

export function decryptSecret(payload: string): string {
  const [version, ivPart, tagPart, encryptedPart] = payload.split('.');
  if (version !== 'v1' || !ivPart || !tagPart || !encryptedPart) {
    throw new Error('Invalid encrypted secret payload');
  }

  const decipher = createDecipheriv(
    ALGORITHM,
    getSecretKey(),
    Buffer.from(ivPart, 'base64url'),
  );
  decipher.setAuthTag(Buffer.from(tagPart, 'base64url'));

  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(encryptedPart, 'base64url')),
    decipher.final(),
  ]);

  return decrypted.toString('utf8');
}