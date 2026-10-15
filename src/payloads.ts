/**
 * Builders for the strings that scanner apps understand. Encode the result with
 * `toSVG()` for a free static code, or pass it as `qr_data` (qr_type `Text`) to
 * the API. For an editable, tracked contact card, use the API's dynamic vCard
 * instead (`hovercode.codes.create({ qr_type: 'vCard', dynamic: true, vcard })`).
 */

export interface WifiOptions {
  ssid: string;
  password?: string;
  /** Defaults to `WPA` when a password is given, otherwise `nopass`. */
  encryption?: 'WPA' | 'WEP' | 'nopass';
  hidden?: boolean;
}

export interface VCardOptions {
  first_name: string;
  last_name?: string;
  company_name?: string;
  position?: string;
  email?: string;
  mobile_number?: string;
  phone_number?: string;
  website?: string;
  street?: string;
  city?: string;
  state?: string;
  country?: string;
  post_code?: string;
  description?: string;
}

export interface EmailOptions {
  to: string;
  subject?: string;
  body?: string;
}

export interface SmsOptions {
  number: string;
  message?: string;
}

export interface GeoOptions {
  latitude: number;
  longitude: number;
}

function escapeWifi(value: string): string {
  return value.replace(/([\\;,:"])/g, '\\$1');
}

function escapeVCard(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/([;,])/g, '\\$1');
}

export function wifi({ ssid, password, encryption, hidden }: WifiOptions): string {
  const type = encryption ?? (password ? 'WPA' : 'nopass');
  let out = `WIFI:T:${type};S:${escapeWifi(ssid)};`;
  if (password && type !== 'nopass') out += `P:${escapeWifi(password)};`;
  if (hidden) out += 'H:true;';
  return `${out};`;
}

export function vcard(card: VCardOptions): string {
  const lines = ['BEGIN:VCARD', 'VERSION:3.0'];
  const first = escapeVCard(card.first_name);
  const last = escapeVCard(card.last_name ?? '');
  lines.push(`N:${last};${first};;;`);
  lines.push(`FN:${[card.first_name, card.last_name].filter(Boolean).map((s) => escapeVCard(s!)).join(' ')}`);
  if (card.company_name) lines.push(`ORG:${escapeVCard(card.company_name)}`);
  if (card.position) lines.push(`TITLE:${escapeVCard(card.position)}`);
  if (card.mobile_number) lines.push(`TEL;TYPE=CELL:${card.mobile_number}`);
  if (card.phone_number) lines.push(`TEL;TYPE=WORK,VOICE:${card.phone_number}`);
  if (card.email) lines.push(`EMAIL:${card.email}`);
  if (card.website) lines.push(`URL:${card.website}`);
  if (card.street || card.city || card.state || card.post_code || card.country) {
    const adr = [card.street, card.city, card.state, card.post_code, card.country].map((s) => escapeVCard(s ?? ''));
    lines.push(`ADR;TYPE=WORK:;;${adr.join(';')}`);
  }
  if (card.description) lines.push(`NOTE:${escapeVCard(card.description)}`);
  lines.push('END:VCARD');
  return lines.join('\r\n');
}

export function email({ to, subject, body }: EmailOptions): string {
  const params = new URLSearchParams();
  if (subject) params.set('subject', subject);
  if (body) params.set('body', body);
  // URLSearchParams encodes spaces as '+', which mail clients show literally.
  const query = params.toString().replace(/\+/g, '%20');
  return `mailto:${to}${query ? `?${query}` : ''}`;
}

export function sms({ number, message }: SmsOptions): string {
  return message ? `SMSTO:${number}:${message}` : `SMSTO:${number}`;
}

export function phone(number: string): string {
  return `tel:${number}`;
}

export function geo({ latitude, longitude }: GeoOptions): string {
  return `geo:${latitude},${longitude}`;
}
