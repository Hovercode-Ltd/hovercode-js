import { Resvg } from '@resvg/resvg-js';
import { BinaryBitmap, HybridBinarizer, QRCodeReader, RGBLuminanceSource } from '@zxing/library';
import jsQR from 'jsqr';
import { PNG } from 'pngjs';
import { describe, expect, it } from 'vitest';
import { payloads, toDataURL, toMatrix, toSVG, type StaticQROptions } from '../src/index.js';
import { toPNG } from '../src/node.js';

// Each decoder misreads some perfectly clean synthetic images (ZXing's JS port fails
// even on the qrcode library's own PNGs at some sizes; jsQR struggles with separated
// dots at high resolution), so a code counts as scannable if either reads it.
// ZXing is the decoder behind most Android scanner apps.
function decodePNG(buffer: Buffer): string | undefined {
  const png = PNG.sync.read(buffer);
  const luminance = new Uint8ClampedArray(png.width * png.height);
  for (let i = 0; i < luminance.length; i++) {
    const a = png.data[i * 4 + 3] / 255;
    // Composite onto white so transparent pixels read as light.
    const gray = (png.data[i * 4] + 2 * png.data[i * 4 + 1] + png.data[i * 4 + 2]) / 4;
    luminance[i] = gray * a + 255 * (1 - a);
  }
  const bitmap = new BinaryBitmap(new HybridBinarizer(new RGBLuminanceSource(luminance, png.width, png.height)));
  try {
    return new QRCodeReader().decode(bitmap).getText();
  } catch {
    return jsQR(luminanceToRGBA(luminance), png.width, png.height)?.data;
  }
}

function luminanceToRGBA(luminance: Uint8ClampedArray): Uint8ClampedArray {
  const rgba = new Uint8ClampedArray(luminance.length * 4);
  for (let i = 0; i < luminance.length; i++) {
    rgba[i * 4] = rgba[i * 4 + 1] = rgba[i * 4 + 2] = luminance[i];
    rgba[i * 4 + 3] = 255;
  }
  return rgba;
}

function decodeSVG(svg: string, width = 600): string | undefined {
  return decodePNG(new Resvg(svg, { fitTo: { mode: 'width', value: width } }).render().asPng());
}

// A 1x1 red PNG, as a stand-in logo.
const LOGO =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFBQIAX8jx0gAAAABJRU5ErkJggg==';

describe('toSVG', () => {
  const url = 'https://hovercode.com/?utm_source=test&a=<b>';
  const styles: Array<[string, StaticQROptions]> = [
    ['defaults', {}],
    ['colors', { color: '#4f46e5', background: '#fef3c7', eyeColor: '#be123c' }],
    ['transparent', { background: 'transparent' }],
    ['circle dots, rounded eyes', { dotStyle: 'circle', eyeStyle: 'rounded' }],
    ['rounded dots, circle eyes', { dotStyle: 'rounded', eyeStyle: 'circle' }],
    ['logo', { logo: LOGO }],
    ['big logo + circles', { logo: { src: LOGO, size: 0.3 }, dotStyle: 'circle', eyeStyle: 'circle' }],
    ['no margin', { margin: 1, errorCorrection: 'L' }],
  ];

  for (const [name, options] of styles) {
    it(`scans: ${name}`, () => {
      const svg = toSVG(url, options);
      for (const width of [250, 600, 1500]) expect(decodeSVG(svg, width)).toBe(url);
    });
  }

  it('escapes attributes', () => {
    const svg = toSVG('x', { color: '"><script>', logo: 'https://e.com/a.png?x=1&y="2"' });
    expect(svg).not.toContain('<script>');
    expect(svg).toContain('x=1&amp;y=&quot;2&quot;');
  });

  it('uses H error correction when there is a logo', () => {
    expect(toSVG('x', { logo: LOGO })).toBe(toSVG('x', { logo: LOGO, errorCorrection: 'H' }));
  });

  it('sets the pixel size', () => {
    expect(toSVG('x', { size: 300 })).toContain('width="300" height="300"');
  });

  it('rejects empty data', () => {
    expect(() => toSVG('')).toThrow(/empty/);
  });

  it('handles unicode', () => {
    expect(decodeSVG(toSVG('héllo wörld ✓'))).toBe('héllo wörld ✓');
  });
});

describe('toDataURL / toMatrix', () => {
  it('produces an SVG data URI', () => {
    const uri = toDataURL('https://example.com');
    expect(uri.startsWith('data:image/svg+xml;charset=utf-8,')).toBe(true);
    expect(decodeURIComponent(uri.split(',')[1])).toBe(toSVG('https://example.com'));
  });

  it('exposes the module grid', () => {
    const m = toMatrix('hello');
    expect(m.size).toBe(21);
    expect(m.isDark(0, 0)).toBe(true); // finder pattern corner
    expect(m.isDark(7, 7)).toBe(false); // finder separator
  });
});

describe('toPNG', () => {
  it('scans', async () => {
    expect(decodePNG(await toPNG('https://example.com/png'))).toBe('https://example.com/png');
  });
  it('scans with colors', async () => {
    const png = await toPNG('colored', { color: '#1e3a8a', background: '#e0f2fe', size: 300 });
    expect(PNG.sync.read(png).width).toBe(300);
    expect(decodePNG(png)).toBe('colored');
  });
});

describe('payloads', () => {
  it('wifi escapes special characters', () => {
    expect(payloads.wifi({ ssid: 'My;Net', password: 'p:a,ss"\\' })).toBe('WIFI:T:WPA;S:My\\;Net;P:p\\:a\\,ss\\"\\\\;;');
    expect(payloads.wifi({ ssid: 'Open' })).toBe('WIFI:T:nopass;S:Open;;');
    expect(payloads.wifi({ ssid: 'H', password: 'x', hidden: true })).toBe('WIFI:T:WPA;S:H;P:x;H:true;;');
  });

  it('vcard', () => {
    const card = payloads.vcard({ first_name: 'Ada', last_name: 'Lovelace', company_name: 'Engines, Ltd', email: 'ada@example.com' });
    expect(card).toContain('N:Lovelace;Ada;;;');
    expect(card).toContain('FN:Ada Lovelace');
    expect(card).toContain('ORG:Engines\\, Ltd');
    expect(card.startsWith('BEGIN:VCARD\r\nVERSION:3.0')).toBe(true);
    expect(decodeSVG(toSVG(card))).toBe(card);
  });

  it('email, sms, phone, geo', () => {
    expect(payloads.email({ to: 'a@b.co', subject: 'Hi there', body: 'x&y' })).toBe('mailto:a@b.co?subject=Hi%20there&body=x%26y');
    expect(payloads.email({ to: 'a@b.co' })).toBe('mailto:a@b.co');
    expect(payloads.sms({ number: '+15551234', message: 'hey' })).toBe('SMSTO:+15551234:hey');
    expect(payloads.phone('+15551234')).toBe('tel:+15551234');
    expect(payloads.geo({ latitude: 51.5, longitude: -0.12 })).toBe('geo:51.5,-0.12');
  });
});
