/**
 * Scan webhooks: Hovercode POSTs JSON to your URL on every scan of a dynamic code,
 * signed with an `X-Signature` header (hex HMAC-SHA256 of the raw body, keyed with
 * your webhook secret). Enable them in your workspace API settings.
 */

import type { Scan } from './client.js';

export type ScanEvent = Scan;

function toHex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer), (b) => b.toString(16).padStart(2, '0')).join('');
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/**
 * Check a webhook's `X-Signature` header. Pass the **raw** request body exactly as
 * received: re-serialised JSON won't match.
 */
export async function verifyWebhook(
  rawBody: string | Uint8Array,
  signature: string | null | undefined,
  secret: string,
): Promise<boolean> {
  if (!signature || !secret) return false;
  const encoder = new TextEncoder();
  const key = await globalThis.crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const body = typeof rawBody === 'string' ? encoder.encode(rawBody) : rawBody;
  const expected = toHex(await globalThis.crypto.subtle.sign('HMAC', key, body));
  return timingSafeEqual(expected, signature.trim().toLowerCase());
}

/** Verify and parse a webhook in one step. Throws if the signature doesn't match. */
export async function parseWebhook(
  rawBody: string | Uint8Array,
  signature: string | null | undefined,
  secret: string,
): Promise<ScanEvent> {
  if (!(await verifyWebhook(rawBody, signature, secret))) {
    throw new Error('Invalid Hovercode webhook signature');
  }
  const text = typeof rawBody === 'string' ? rawBody : new TextDecoder().decode(rawBody);
  return JSON.parse(text) as ScanEvent;
}
