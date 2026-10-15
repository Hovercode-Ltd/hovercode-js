/**
 * React component for QR codes. Renders locally (no network, no API key), in the
 * browser or during SSR.
 *
 * Static code: pass the data itself.
 *   <QRCode value="https://example.com" dotStyle="circle" />
 *
 * Dynamic code: create it on your server (`createQR(url, { dynamic: true })`), store
 * `shortlinkUrl`, and render that. It looks identical with the same style props, and
 * the API token never reaches the browser.
 *   <QRCode value={listing.qrShortlinkUrl} dotStyle="circle" />
 */

import { createElement, useMemo, type CSSProperties, type ReactElement } from 'react';
import { toSVG, type StaticQROptions } from './static.js';

export interface QRCodeProps extends StaticQROptions {
  /** What the code encodes: a URL, text, a `payloads.*` string, or a dynamic code's `shortlinkUrl`. */
  value: string;
  /** Accessible label. Defaults to "QR code". */
  title?: string;
  className?: string;
  style?: CSSProperties;
}

export function QRCode({ value, title = 'QR code', className, style, ...options }: QRCodeProps): ReactElement {
  const { size, margin, color, background, eyeColor, dotStyle, eyeStyle, errorCorrection, logo } = options;
  const logoKey = typeof logo === 'string' ? logo : logo && `${logo.src}|${logo.size}|${logo.excavate}`;
  const svg = useMemo(
    () => toSVG(value, { size, margin, color, background, eyeColor, dotStyle, eyeStyle, errorCorrection, logo }),
    // `logo` may be a fresh object each render; key on its contents instead.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [value, size, margin, color, background, eyeColor, dotStyle, eyeStyle, errorCorrection, logoKey],
  );
  return createElement('span', {
    role: 'img',
    'aria-label': title,
    className,
    style: { display: 'inline-block', lineHeight: 0, ...style },
    dangerouslySetInnerHTML: { __html: svg },
  });
}

export type { StaticQROptions } from './static.js';
