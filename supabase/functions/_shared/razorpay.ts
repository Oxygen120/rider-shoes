import { requireEnv } from './env.ts';

export interface RazorpayOrder {
  id: string;
  entity?: string;
  amount: number;
  amount_paid?: number;
  amount_due?: number;
  currency: string;
  receipt?: string;
  status?: string;
  notes?: Record<string, string>;
}

export class RazorpayRequestError extends Error {
  readonly status: number;

  constructor(status: number) {
    super(`Razorpay request failed with status ${status}`);
    this.name = 'RazorpayRequestError';
    this.status = status;
  }
}

export async function razorpayFetch<T>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const keyId = requireEnv('RAZORPAY_KEY_ID');
  const keySecret = requireEnv('RAZORPAY_KEY_SECRET');
  const headers = new Headers(init.headers);
  headers.set('Authorization', `Basic ${btoa(`${keyId}:${keySecret}`)}`);
  headers.set('Content-Type', 'application/json');

  const response = await fetch(`https://api.razorpay.com/v1${path}`, {
    ...init,
    headers,
  });
  const text = await response.text();
  let payload: unknown = null;
  try {
    payload = text ? JSON.parse(text) : null;
  } catch {
    payload = null;
  }

  if (!response.ok) {
    // Never include payload in the thrown error; provider responses can include
    // customer/payment details and must not be sent back to a browser.
    throw new RazorpayRequestError(response.status);
  }
  return payload as T;
}

async function hmacSha256Hex(secret: string, message: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const signature = await crypto.subtle.sign(
    'HMAC',
    key,
    new TextEncoder().encode(message),
  );
  return Array.from(new Uint8Array(signature))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

export async function verifyHmacHex(
  secret: string,
  message: string,
  suppliedSignature: string,
): Promise<boolean> {
  if (!/^[a-f0-9]{64}$/i.test(suppliedSignature)) return false;
  const expected = await hmacSha256Hex(secret, message);
  const actual = suppliedSignature.toLowerCase();
  let different = expected.length ^ actual.length;
  for (let index = 0; index < expected.length; index += 1) {
    different |= expected.charCodeAt(index) ^ (actual.charCodeAt(index) || 0);
  }
  return different === 0;
}

export async function sha256Hex(message: string): Promise<string> {
  const digest = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(message),
  );
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

export function safePaymentPayload(
  payment: Record<string, unknown>,
): Record<string, unknown> {
  const allowedKeys = [
    'id',
    'order_id',
    'amount',
    'currency',
    'status',
    'method',
    'captured',
    'error_code',
    'error_description',
    'created_at',
  ];
  return Object.fromEntries(
    allowedKeys
      .filter((key) => payment[key] !== undefined)
      .map((key) => [key, payment[key]]),
  );
}
