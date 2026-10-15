export { toSVG, toDataURL, toMatrix } from './static.js';
export type { StaticQROptions, LogoOptions, DotStyle, EyeStyle, ErrorCorrection, QRMatrix } from './static.js';

export * as payloads from './payloads.js';
export type { WifiOptions, VCardOptions, EmailOptions, SmsOptions, GeoOptions } from './payloads.js';

export { createQR } from './qr.js';
export type { CreateQROptions, StaticQRResult, DynamicQRResult } from './qr.js';

export { Hovercode, HovercodeError, DEFAULT_BASE_URL } from './client.js';
export type * from './client.js';

export { verifyWebhook, parseWebhook } from './webhooks.js';
export type { ScanEvent } from './webhooks.js';
