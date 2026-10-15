import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { toSVG } from '../src/index.js';
import { QRCode } from '../src/react.js';

describe('<QRCode>', () => {
  it('renders the same SVG as toSVG, with an accessible label', () => {
    const html = renderToStaticMarkup(
      createElement(QRCode, { value: 'https://example.com', dotStyle: 'circle', color: '#4f46e5', title: 'Menu QR' }),
    );
    expect(html).toContain('role="img"');
    expect(html).toContain('aria-label="Menu QR"');
    expect(html).toContain(toSVG('https://example.com', { dotStyle: 'circle', color: '#4f46e5' }));
  });

  it('passes className and merges style', () => {
    const html = renderToStaticMarkup(createElement(QRCode, { value: 'x', className: 'qr', style: { width: 120 } }));
    expect(html).toContain('class="qr"');
    expect(html).toContain('width:120px');
    expect(html).toContain('display:inline-block');
  });
});
