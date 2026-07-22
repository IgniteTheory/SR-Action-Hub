import crypto from 'crypto';

export function generateQuoteToken(): string {
  return crypto.randomBytes(20).toString('hex');
}
