import crypto from 'crypto';

const SALT = process.env.EMAIL_HASH_SALT || '';

export function hashEmail(email: string): string {
  const normalized = email.trim().toLowerCase();
  return crypto
    .createHash('sha256')
    .update(normalized + SALT)
    .digest('hex');
}
