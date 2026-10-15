import QRCode from 'qrcode';

/**
 * Static QR codes, generated locally: free, no API key, no network call.
 * The data is baked into the pattern, so a static code can't be edited or
 * tracked after it's printed — use `createQR(data, { dynamic: true })` or the
 * `Hovercode` client for that.
 */

export type ErrorCorrection = 'L' | 'M' | 'Q' | 'H';
export type DotStyle = 'square' | 'rounded' | 'circle';
export type EyeStyle = 'square' | 'rounded' | 'circle';

export interface LogoOptions {
  /** Image URL or data URI. Embedded as an <image>, so a remote URL must stay reachable wherever the SVG is shown. */
  src: string;
  /** Logo width as a fraction of the code's width. Defaults to 0.22, capped at 0.3 to keep the code scannable. */
  size?: number;
  /** Clear the modules behind the logo. Defaults to true. */
  excavate?: boolean;
}

export interface StaticQROptions {
  /** Rendered width and height in pixels. Defaults to 512. */
  size?: number;
  /** Quiet zone around the code, in modules. Defaults to 4 (the spec minimum). */
  margin?: number;
  /** Module color. Defaults to #111111. */
  color?: string;
  /** Background color, or `transparent`. Defaults to #ffffff. */
  background?: string;
  /** Corner eye color. Defaults to `color`. */
  eyeColor?: string;
  dotStyle?: DotStyle;
  eyeStyle?: EyeStyle;
  /** Defaults to M, or H when a logo is set. */
  errorCorrection?: ErrorCorrection;
  logo?: string | LogoOptions;
}

export interface QRMatrix {
  /** Modules per side, excluding the margin. */
  size: number;
  /** `isDark(row, col)` for 0 <= row, col < size. */
  isDark(row: number, col: number): boolean;
  errorCorrection: ErrorCorrection;
}

const FINDER = 7;

/** The raw module grid, for drawing a code yourself (canvas, React Native, a PDF...). */
export function toMatrix(data: string, errorCorrection: ErrorCorrection = 'M'): QRMatrix {
  if (!data) throw new Error('QR data is empty');
  const qr = QRCode.create(data, { errorCorrectionLevel: errorCorrection });
  return {
    size: qr.modules.size,
    isDark: (row, col) => Boolean(qr.modules.get(row, col)),
    errorCorrection,
  };
}

function escapeAttr(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function num(n: number): string {
  return Number(n.toFixed(3)).toString();
}

function roundedRect(x: number, y: number, w: number, h: number, r: number): string {
  if (r <= 0) return `M${num(x)} ${num(y)}h${num(w)}v${num(h)}h${num(-w)}z`;
  r = Math.min(r, w / 2, h / 2);
  return (
    `M${num(x + r)} ${num(y)}h${num(w - 2 * r)}a${num(r)} ${num(r)} 0 0 1 ${num(r)} ${num(r)}` +
    `v${num(h - 2 * r)}a${num(r)} ${num(r)} 0 0 1 ${num(-r)} ${num(r)}` +
    `h${num(-(w - 2 * r))}a${num(r)} ${num(r)} 0 0 1 ${num(-r)} ${num(-r)}` +
    `v${num(-(h - 2 * r))}a${num(r)} ${num(r)} 0 0 1 ${num(r)} ${num(-r)}z`
  );
}

function circle(cx: number, cy: number, r: number): string {
  return `M${num(cx - r)} ${num(cy)}a${num(r)} ${num(r)} 0 1 0 ${num(2 * r)} 0a${num(r)} ${num(r)} 0 1 0 ${num(-2 * r)} 0z`;
}

function eyePaths(x: number, y: number, style: EyeStyle): { ring: string; center: string } {
  if (style === 'circle') {
    const cx = x + FINDER / 2;
    const cy = y + FINDER / 2;
    return { ring: circle(cx, cy, 3.5) + circle(cx, cy, 2.5), center: circle(cx, cy, 1.5) };
  }
  const [outer, inner, center] = style === 'rounded' ? [2, 1.4, 0.9] : [0, 0, 0];
  return {
    ring: roundedRect(x, y, 7, 7, outer) + roundedRect(x + 1, y + 1, 5, 5, inner),
    center: roundedRect(x + 2, y + 2, 3, 3, center),
  };
}

function inFinder(row: number, col: number, n: number): boolean {
  return (
    (row < FINDER && col < FINDER) ||
    (row < FINDER && col >= n - FINDER) ||
    (row >= n - FINDER && col < FINDER)
  );
}

/** A static QR code as an SVG string. */
export function toSVG(data: string, options: StaticQROptions = {}): string {
  const logo: LogoOptions | undefined = typeof options.logo === 'string' ? { src: options.logo } : options.logo;
  const ecl = options.errorCorrection ?? (logo ? 'H' : 'M');
  const matrix = toMatrix(data, ecl);
  const n = matrix.size;
  const margin = options.margin ?? 4;
  const total = n + margin * 2;
  const px = options.size ?? 512;
  const color = options.color ?? '#111111';
  const eyeColor = options.eyeColor ?? color;
  const background = options.background ?? '#ffffff';
  const dotStyle = options.dotStyle ?? 'square';
  const eyeStyle = options.eyeStyle ?? 'square';

  let hole: { start: number; end: number; logoStart: number; logoSize: number } | undefined;
  if (logo) {
    const ratio = Math.min(Math.max(logo.size ?? 0.22, 0.05), 0.3);
    let logoSize = Math.round(n * ratio);
    // Keep the hole centred on a whole module.
    if ((n - logoSize) % 2 !== 0) logoSize += 1;
    const logoStart = (n - logoSize) / 2;
    hole = { start: logoStart - 1, end: logoStart + logoSize + 1, logoStart, logoSize };
  }
  const excavate = Boolean(hole) && logo?.excavate !== false;

  let dots = '';
  for (let row = 0; row < n; row++) {
    for (let col = 0; col < n; col++) {
      if (!matrix.isDark(row, col) || inFinder(row, col, n)) continue;
      if (excavate && hole && row >= hole.start && row < hole.end && col >= hole.start && col < hole.end) continue;
      const x = col + margin;
      const y = row + margin;
      if (dotStyle === 'circle') dots += circle(x + 0.5, y + 0.5, 0.45);
      else if (dotStyle === 'rounded') dots += roundedRect(x + 0.05, y + 0.05, 0.9, 0.9, 0.3);
      else dots += `M${x} ${y}h1v1h-1z`;
    }
  }

  let rings = '';
  let centers = '';
  for (const [row, col] of [
    [0, 0],
    [0, n - FINDER],
    [n - FINDER, 0],
  ]) {
    const eye = eyePaths(col + margin, row + margin, eyeStyle);
    rings += eye.ring;
    centers += eye.center;
  }

  const crisp = dotStyle === 'square' && eyeStyle === 'square' ? ' shape-rendering="crispEdges"' : '';
  const parts = [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${total} ${total}" width="${px}" height="${px}"${crisp}>`,
  ];
  if (background !== 'transparent') {
    parts.push(`<rect width="${total}" height="${total}" fill="${escapeAttr(background)}"/>`);
  }
  parts.push(`<path fill="${escapeAttr(color)}" d="${dots}"/>`);
  parts.push(`<path fill="${escapeAttr(eyeColor)}" fill-rule="evenodd" d="${rings}"/>`);
  parts.push(`<path fill="${escapeAttr(eyeColor)}" d="${centers}"/>`);
  if (logo && hole) {
    const at = hole.logoStart + margin;
    parts.push(
      `<image href="${escapeAttr(logo.src)}" x="${at}" y="${at}" width="${hole.logoSize}" height="${hole.logoSize}" preserveAspectRatio="xMidYMid meet"/>`,
    );
  }
  parts.push('</svg>');
  return parts.join('');
}

/** A static QR code as a `data:image/svg+xml` URI, usable directly as an <img> src. */
export function toDataURL(data: string, options: StaticQROptions = {}): string {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(toSVG(data, options))}`;
}
