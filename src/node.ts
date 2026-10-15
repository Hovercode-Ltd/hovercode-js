/** Node-only helpers: PNG output and writing files. */

import { writeFile } from 'node:fs/promises';
import QRCode from 'qrcode';
import { toSVG, type StaticQROptions } from './static.js';

export * from './index.js';

export interface PNGOptions {
  /** Width and height in pixels. Defaults to 512. */
  size?: number;
  /** Quiet zone in modules. Defaults to 4. */
  margin?: number;
  color?: string;
  /** Hex color; `transparent` for a transparent background. Defaults to #ffffff. */
  background?: string;
  errorCorrection?: StaticQROptions['errorCorrection'];
}

/**
 * A static QR code as a PNG buffer. Plain square modules: for dot/eye styles and
 * logos use `toSVG()` (or render that SVG with an SVG rasteriser such as resvg).
 */
export function toPNG(data: string, options: PNGOptions = {}): Promise<Buffer> {
  if (!data) throw new Error('QR data is empty');
  const background = options.background ?? '#ffffff';
  return QRCode.toBuffer(data, {
    type: 'png',
    width: options.size ?? 512,
    margin: options.margin ?? 4,
    errorCorrectionLevel: options.errorCorrection ?? 'M',
    color: {
      dark: options.color ?? '#111111',
      light: background === 'transparent' ? '#0000' : background,
    },
  });
}

/** Write a static code to disk; the format follows the extension (.svg or .png). */
export async function toFile(path: string, data: string, options: StaticQROptions = {}): Promise<void> {
  if (path.toLowerCase().endsWith('.png')) {
    await writeFile(path, await toPNG(data, options));
  } else if (path.toLowerCase().endsWith('.svg')) {
    await writeFile(path, toSVG(data, options));
  } else {
    throw new Error(`Unsupported file type for ${path}: use .svg or .png`);
  }
}
