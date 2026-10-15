import { createHmac } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';
import { createQR, Hovercode, HovercodeError, parseWebhook, toSVG, verifyWebhook } from '../src/index.js';

type Call = { url: URL; method: string; headers: Record<string, string>; body: unknown };

function mockFetch(responses: Array<{ status?: number; body?: unknown; headers?: Record<string, string> }>) {
  const calls: Call[] = [];
  const fetch = vi.fn(async (url: string, init: RequestInit) => {
    calls.push({
      url: new URL(url),
      method: init.method!,
      headers: init.headers as Record<string, string>,
      body: init.body ? JSON.parse(init.body as string) : undefined,
    });
    const next = responses.shift() ?? { status: 200, body: {} };
    const text = next.body === undefined ? '' : typeof next.body === 'string' ? next.body : JSON.stringify(next.body);
    return new Response(next.status === 204 ? null : text, { status: next.status ?? 200, headers: next.headers });
  });
  return { fetch: fetch as unknown as typeof globalThis.fetch, calls };
}

const RECORD = {
  id: 'c0ffee00-0000-4000-8000-000000000000',
  qr_data: 'https://example.com',
  qr_type: 'Link',
  shortlink_url: 'https://hov.to/abc',
  dynamic: true,
  svg: '<svg></svg>',
  created: '2026-10-15T00:00:00Z',
};

describe('Hovercode client', () => {
  it('creates a code with the token header and the default workspace', async () => {
    const { fetch, calls } = mockFetch([{ body: RECORD }]);
    const hc = new Hovercode({ token: 'tok', workspace: 'ws', fetch });
    const record = await hc.codes.create({ qr_data: 'https://example.com', dynamic: true, primary_color: '#000000' });
    expect(record.id).toBe(RECORD.id);
    expect(calls[0].method).toBe('POST');
    expect(calls[0].url.href).toBe('https://hovercode.com/api/v2/hovercode/create/');
    expect(calls[0].headers.Authorization).toBe('Token tok');
    expect(calls[0].body).toEqual({ qr_data: 'https://example.com', dynamic: true, primary_color: '#000000', workspace: 'ws' });
  });

  it('reads token and workspace from the environment', async () => {
    vi.stubEnv('HOVERCODE_API_TOKEN', 'envtok');
    vi.stubEnv('HOVERCODE_WORKSPACE_ID', 'envws');
    const { fetch, calls } = mockFetch([{ body: { count: 0, next: null, results: [] } }]);
    await new Hovercode({ fetch }).codes.list({ include: ['scans', 'tags'], days: 30 });
    expect(calls[0].headers.Authorization).toBe('Token envtok');
    expect(calls[0].url.pathname).toBe('/api/v2/workspace/envws/hovercodes/');
    expect(calls[0].url.searchParams.get('include')).toBe('scans,tags');
    expect(calls[0].url.searchParams.get('days')).toBe('30');
    vi.unstubAllEnvs();
  });

  it('explains a missing token or workspace', async () => {
    vi.stubEnv('HOVERCODE_API_TOKEN', '');
    vi.stubEnv('HOVERCODE_WORKSPACE_ID', '');
    const noToken = await new Hovercode().codes.get('x').catch((e) => e);
    expect(noToken.message).toMatch(/HOVERCODE_API_TOKEN/);
    expect(noToken).toMatchObject({ code: 'missing_credentials', status: 0 });
    vi.unstubAllEnvs();
  });

  it("defaults to the token's current workspace, looked up once", async () => {
    vi.stubEnv('HOVERCODE_WORKSPACE_ID', '');
    const { fetch, calls } = mockFetch([
      { body: { current_workspace: 'cur', results: [{ id: 'other' }, { id: 'cur' }] } },
      { body: RECORD },
      { body: { count: 0, next: null, results: [] } },
    ]);
    const hc = new Hovercode({ token: 't', fetch });
    await hc.codes.create({ qr_data: 'https://example.com', dynamic: true });
    await hc.codes.list();
    expect(calls.map((c) => c.url.pathname)).toEqual([
      '/api/v2/workspaces/',
      '/api/v2/hovercode/create/',
      '/api/v2/workspace/cur/hovercodes/',
    ]);
    expect(calls[1].body).toMatchObject({ workspace: 'cur' });
    vi.unstubAllEnvs();
  });

  it('explains a failed workspace lookup and retries it next time', async () => {
    vi.stubEnv('HOVERCODE_WORKSPACE_ID', '');
    const { fetch, calls } = mockFetch([
      { status: 404, body: { detail: 'Not found.' } },
      { body: { current_workspace: 'cur', results: [{ id: 'cur' }] } },
      { body: { count: 0, next: null, results: [] } },
    ]);
    const hc = new Hovercode({ token: 't', fetch });
    await expect(hc.codes.list()).rejects.toThrow(/HOVERCODE_WORKSPACE_ID/);
    await hc.codes.list();
    expect(calls.at(-1)!.url.pathname).toBe('/api/v2/workspace/cur/hovercodes/');
    vi.unstubAllEnvs();
  });

  it('creates and renames workspaces', async () => {
    const { fetch, calls } = mockFetch([{ status: 201, body: { id: 'w9', name: 'Acme' } }, { body: { id: 'w9', name: 'Acme Ltd' } }]);
    const hc = new Hovercode({ token: 't', fetch });
    expect((await hc.workspaces.create({ name: 'Acme' })).id).toBe('w9');
    await hc.workspaces.update('w9', { name: 'Acme Ltd' });
    expect(calls[0]).toMatchObject({ method: 'POST', body: { name: 'Acme' } });
    expect(calls[0].url.pathname).toBe('/api/v2/workspace/create/');
    expect(calls[1]).toMatchObject({ method: 'PATCH', body: { name: 'Acme Ltd' } });
    expect(calls[1].url.pathname).toBe('/api/v2/workspace/w9/update/');
  });

  it('walks every page with listAll', async () => {
    const { fetch, calls } = mockFetch([
      { body: { count: 3, next: 'https://hovercode.com/api/v2/workspace/ws/hovercodes/?page=2&page_size=200', results: [{ id: '1' }, { id: '2' }] } },
      { body: { count: 3, next: null, results: [{ id: '3' }] } },
    ]);
    const ids = [];
    for await (const code of new Hovercode({ token: 't', workspace: 'ws', fetch }).codes.listAll()) ids.push(code.id);
    expect(ids).toEqual(['1', '2', '3']);
    expect(calls[0].url.searchParams.get('page_size')).toBe('200');
    expect(calls[1].url.searchParams.get('page')).toBe('2');
  });

  it('retries a 429 after Retry-After', async () => {
    vi.useFakeTimers();
    const { fetch, calls } = mockFetch([
      { status: 429, headers: { 'Retry-After': '1' }, body: { error: { code: 'rate_limited', message: 'slow down' } } },
      { body: RECORD },
    ]);
    const promise = new Hovercode({ token: 't', fetch }).codes.get(RECORD.id);
    await vi.advanceTimersByTimeAsync(1000);
    expect((await promise).id).toBe(RECORD.id);
    expect(calls).toHaveLength(2);
    vi.useRealTimers();
  });

  it('throws HovercodeError with the API message', async () => {
    const { fetch } = mockFetch([{ status: 400, body: { error: { qr_data: ['This field is required.'] } } }]);
    const err = await new Hovercode({ token: 't', workspace: 'ws', fetch }).codes.create({}).catch((e) => e);
    expect(err).toBeInstanceOf(HovercodeError);
    expect(err.status).toBe(400);
    expect(err.code).toBe('http_error');
    expect(err.message).toContain('This field is required.');

    const { fetch: f2 } = mockFetch([{ status: 429, headers: { 'Retry-After': '9' }, body: { error: { code: 'rate_limited', message: 'Rate limit exceeded' } } }]);
    const limited = await new Hovercode({ token: 't', fetch: f2, maxRetries: 0 }).codes.get('x').catch((e) => e);
    expect(limited.message).toBe('Rate limit exceeded');
    expect(limited.retryAfter).toBe(9);
    expect(limited.code).toBe('rate_limited');
  });

  it('handles 204 deletes and updates destinations with PATCH', async () => {
    const { fetch, calls } = mockFetch([{ status: 204 }, { body: RECORD }]);
    const hc = new Hovercode({ token: 't', fetch });
    await expect(hc.codes.delete('abc')).resolves.toBeUndefined();
    await hc.codes.update('abc', { qr_data: 'https://new.example.com' });
    expect(calls[0]).toMatchObject({ method: 'DELETE' });
    expect(calls[0].url.pathname).toBe('/api/v2/hovercode/abc/delete/');
    expect(calls[1]).toMatchObject({ method: 'PATCH', body: { qr_data: 'https://new.example.com' } });
  });

  it('refuses to run in a browser by default', () => {
    vi.stubGlobal('document', {});
    expect(() => new Hovercode({ token: 't' })).toThrow(/server/);
    expect(() => new Hovercode({ token: 't', dangerouslyAllowBrowser: true })).not.toThrow();
    vi.unstubAllGlobals();
  });
});

describe('createQR', () => {
  it('is static and local by default', async () => {
    const fetch = vi.fn();
    const result = await createQR('https://example.com', { client: new Hovercode({ token: 't', fetch }) });
    expect(result.dynamic).toBe(false);
    expect(result.svg.startsWith('<svg')).toBe(true);
    expect(fetch).not.toHaveBeenCalled();
  });

  it('maps the same options onto the API for dynamic codes', async () => {
    const { fetch, calls } = mockFetch([{ body: RECORD }]);
    const result = await createQR('https://example.com', {
      dynamic: true,
      client: new Hovercode({ token: 't', workspace: 'ws', fetch }),
      name: 'Flyer',
      color: '#4f46e5',
      background: 'transparent',
      dotStyle: 'circle',
      eyeStyle: 'rounded',
      logo: 'https://example.com/logo.png',
      design: { frame: 'card', text: 'Scan me' },
    });
    // `design` was passed, so the SVG is Hovercode's rendering.
    expect(result).toMatchObject({ dynamic: true, id: RECORD.id, shortlinkUrl: RECORD.shortlink_url, svg: RECORD.svg });
    expect(calls[0].body).toEqual({
      workspace: 'ws',
      qr_data: 'https://example.com',
      dynamic: true,
      display_name: 'Flyer',
      primary_color: '#4f46e5',
      pattern: 'Circles',
      eye_style: 'Rounded',
      logo_url: 'https://example.com/logo.png',
      frame: 'card',
      text: 'Scan me',
    });
  });
});

it('renders dynamic codes locally from the short link, matching the static look', async () => {
  const { fetch } = mockFetch([{ body: RECORD }]);
  const style = { dotStyle: 'circle', eyeStyle: 'rounded', color: '#4f46e5' } as const;
  const result = await createQR('https://example.com', { ...style, dynamic: true, client: new Hovercode({ token: 't', workspace: 'ws', fetch }) });
  expect(result.svg).toBe(toSVG(RECORD.shortlink_url, style));
});

describe('webhooks', () => {
  // Same construction as the server: hex HMAC-SHA256 of the raw JSON body.
  const secret = 'whsec_test';
  const body = JSON.stringify({ qr_code_id: 'abc', time_utc: '2026-06-01 17:44:48+00:00', location: 'London', device: 'iPhone', scanner_id: 's', id: 'e' });
  const signature = createHmac('sha256', secret).update(body).digest('hex');

  it('accepts a valid signature', async () => {
    expect(await verifyWebhook(body, signature, secret)).toBe(true);
    expect(await verifyWebhook(new TextEncoder().encode(body), signature.toUpperCase(), secret)).toBe(true);
    expect((await parseWebhook(body, signature, secret)).qr_code_id).toBe('abc');
  });

  it('rejects tampering, wrong secrets and missing headers', async () => {
    expect(await verifyWebhook(body.replace('London', 'Paris'), signature, secret)).toBe(false);
    expect(await verifyWebhook(body, signature, 'other')).toBe(false);
    expect(await verifyWebhook(body, undefined, secret)).toBe(false);
    await expect(parseWebhook(body, 'deadbeef', secret)).rejects.toThrow(/signature/);
  });
});
