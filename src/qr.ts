import { Hovercode, type Design, type QRCodeRecord } from './client.js';
import { toSVG, type StaticQROptions } from './static.js';

export interface CreateQROptions extends StaticQROptions {
  /**
   * `false` (default): a free static code rendered locally. The data is fixed once printed.
   * `true`: a dynamic code from the Hovercode API. It encodes a tracked short link, so you can
   * change where it points after printing and see scans. Needs an API token.
   */
  dynamic?: boolean;
  /** Client to use for dynamic codes. Defaults to `new Hovercode()` (reads env vars). */
  client?: Hovercode;
  /** Dynamic only: internal name shown in the Hovercode dashboard. */
  name?: string;
  /** Dynamic only: folder ID or slug to file the code into. */
  folder?: string;
  /** Dynamic only: custom short-link domain on your workspace. */
  domain?: string;
  /**
   * Dynamic only: a saved design template ID from your workspace. Setting this (or `design`)
   * returns Hovercode's rendering of the code instead of the local one.
   */
  template?: string;
  /**
   * Dynamic only: Hovercode design fields (frames, captions, patterns...). Setting this (or
   * `template`) returns Hovercode's rendering of the code instead of the local one.
   */
  design?: Design;
}

export interface StaticQRResult {
  dynamic: false;
  data: string;
  svg: string;
}

export interface DynamicQRResult {
  dynamic: true;
  data: string;
  /**
   * The code as SVG. By default it is rendered locally from `shortlinkUrl` with your style
   * options, so it looks exactly like a static code made with the same options. With
   * `design` or `template`, it is Hovercode's rendering (as in the dashboard and downloads).
   */
  svg: string;
  /** Hovercode QR code ID: keep it to update the destination or read analytics later. */
  id: string;
  /** The short link the code encodes. */
  shortlinkUrl: string;
  record: QRCodeRecord;
}

// The closest Hovercode equivalents, so the code looks similar in the Hovercode dashboard.
const DOT_PATTERN = { square: 'Original', rounded: 'Squares', circle: 'Circles' } as const;
const EYE_STYLE = { square: 'Square', rounded: 'Rounded', circle: 'Rounded' } as const;

function designFrom(options: CreateQROptions): Design {
  const design: Design = {};
  if (options.color) design.primary_color = options.color;
  if (options.eyeColor) design.eye_color = options.eyeColor;
  if (options.background && options.background !== 'transparent') design.background_color = options.background;
  if (options.dotStyle) design.pattern = DOT_PATTERN[options.dotStyle];
  if (options.eyeStyle) design.eye_style = EYE_STYLE[options.eyeStyle];
  if (options.errorCorrection) design.error_correction = options.errorCorrection;
  const logo = typeof options.logo === 'string' ? options.logo : options.logo?.src;
  if (logo && /^https?:\/\//.test(logo)) design.logo_url = logo;
  return { ...design, ...options.design };
}

/**
 * Make a QR code. Static by default (free, local); pass `dynamic: true` for an
 * editable, trackable code from Hovercode. With the same style options, both look the same.
 * Each dynamic call creates a new code (counted against your plan): create it once, store
 * `id` (and `svg`), and use `codes.update` to change where it points.
 *
 * ```ts
 * const { svg } = await createQR('https://example.com');
 * const code = await createQR('https://example.com', { dynamic: true, name: 'Flyer' });
 * await new Hovercode().codes.update(code.id, { qr_data: 'https://example.com/new' });
 * ```
 */
export async function createQR(data: string, options: CreateQROptions & { dynamic: true }): Promise<DynamicQRResult>;
export async function createQR(data: string, options?: CreateQROptions & { dynamic?: false }): Promise<StaticQRResult>;
export async function createQR(data: string, options?: CreateQROptions): Promise<StaticQRResult | DynamicQRResult>;
export async function createQR(
  data: string,
  options: CreateQROptions = {},
): Promise<StaticQRResult | DynamicQRResult> {
  if (!options.dynamic) {
    return { dynamic: false, data, svg: toSVG(data, options) };
  }
  const client = options.client ?? new Hovercode();
  const record = await client.codes.create({
    qr_data: data,
    dynamic: true,
    display_name: options.name,
    folder: options.folder,
    domain: options.domain,
    template: options.template,
    size: options.size,
    ...designFrom(options),
  });
  const shortlinkUrl = record.shortlink_url ?? '';
  const useHovercodeRender = Boolean(options.design || options.template) || !shortlinkUrl;
  return {
    dynamic: true,
    data,
    svg: useHovercodeRender ? (record.svg ?? '') : toSVG(shortlinkUrl, options),
    id: record.id,
    shortlinkUrl,
    record,
  };
}
