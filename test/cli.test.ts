import { mkdtemp, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { run } from '../src/cli.js';

let stdout: string;
let stderr: string;
let dir: string;

beforeEach(async () => {
  stdout = '';
  stderr = '';
  vi.spyOn(process.stdout, 'write').mockImplementation((chunk) => ((stdout += String(chunk)), true));
  vi.spyOn(process.stderr, 'write').mockImplementation((chunk) => ((stderr += String(chunk)), true));
  dir = await mkdtemp(join(tmpdir(), 'hovercode-cli-'));
  vi.stubEnv('XDG_CONFIG_HOME', dir);
  vi.stubEnv('HOVERCODE_API_TOKEN', '');
  vi.stubEnv('HOVERCODE_WORKSPACE_ID', '');
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe('hovercode qr', () => {
  it('prints an SVG', async () => {
    expect(await run(['qr', 'https://example.com'])).toBe(0);
    expect(stdout.startsWith('<svg')).toBe(true);
  });

  it('writes SVG and PNG files', async () => {
    expect(await run(['qr', 'https://example.com', '--dots', 'circle', '-o', join(dir, 'a.svg')])).toBe(0);
    expect(await readFile(join(dir, 'a.svg'), 'utf8')).toContain('<svg');
    expect(await run(['qr', '--type', 'wifi', '--ssid', 'Net', '--password', 'pw', '-o', join(dir, 'w.png')])).toBe(0);
    expect((await readFile(join(dir, 'w.png'))).subarray(1, 4).toString()).toBe('PNG');
    expect(JSON.parse(stdout.slice(stdout.lastIndexOf('{')))).toMatchObject({ data: 'WIFI:T:WPA;S:Net;P:pw;;' });
  });

  it('rejects bad input with exit code 2', async () => {
    expect(await run(['qr'])).toBe(2);
    expect(await run(['qr', 'x', '--dots', 'hexagon'])).toBe(2);
    expect(stderr).toContain('--dots must be one of');
    expect(await run(['qr', 'x', '--nope'])).toBe(2);
    expect(await run(['qr', 'x', '-o', join(dir, 'a.gif')])).toBe(1);
  });
});

describe('API commands', () => {
  it('explain how to log in when there is no token', async () => {
    expect(await run(['codes', 'create', 'https://example.com'])).toBe(2);
    expect(stderr).toContain('hovercode login');
    expect(stderr).toContain('hovercode qr');
  });

  it('create a dynamic code and strip the SVG from output', async () => {
    const fetch = vi.fn(async () =>
      new Response(JSON.stringify({ id: 'abc', shortlink_url: 'https://hov.to/x', dynamic: true, svg: '<svg/>' })),
    );
    vi.stubGlobal('fetch', fetch);
    const code = await run(['codes', 'create', 'https://example.com', '--token', 't', '--workspace', 'ws', '--name', 'Flyer', '--pattern', 'circles']);
    expect(code).toBe(0);
    const body = JSON.parse((fetch.mock.calls[0] as unknown as [string, RequestInit])[1].body as string);
    expect(body).toEqual({ qr_data: 'https://example.com', dynamic: true, display_name: 'Flyer', pattern: 'Circles', workspace: 'ws' });
    expect(JSON.parse(stdout)).toEqual({ id: 'abc', shortlink_url: 'https://hov.to/x', dynamic: true });
  });

  it('log in with just a token, picking the current workspace', async () => {
    const fetch = vi.fn(async () =>
      new Response(JSON.stringify({
        current_workspace: 'w2',
        results: [{ id: 'w1', name: 'Personal', plan: 'Free' }, { id: 'w2', name: 'Acme', plan: 'Business' }],
      })),
    );
    vi.stubGlobal('fetch', fetch);
    expect(await run(['login', '--token', 'tok'])).toBe(0);
    const saved = JSON.parse(await readFile(join(dir, 'hovercode', 'config.json'), 'utf8'));
    expect(saved).toEqual({ token: 'tok', workspace: 'w2' });
    expect(JSON.parse(stdout)).toMatchObject({ workspace: { id: 'w2', name: 'Acme' }, other_workspaces: [{ id: 'w1' }] });

    expect(await run(['login', '--token', 'tok', '--workspace', 'nope'])).toBe(2);
    expect(stderr).toContain('w1  Personal');
  });

  it('require --yes to delete', async () => {
    expect(await run(['codes', 'delete', 'abc', '--token', 't'])).toBe(2);
    expect(stderr).toContain('--yes');
  });

  it('fill {workspace} in raw api calls', async () => {
    const fetch = vi.fn(async () => new Response('{"ok":true}'));
    vi.stubGlobal('fetch', fetch);
    expect(await run(['api', 'get', '/api/v2/workspace/{workspace}/templates/', '--token', 't', '--workspace', 'ws', '--query', 'page=2'])).toBe(0);
    expect((fetch.mock.calls[0] as unknown as [string])[0]).toBe('https://hovercode.com/api/v2/workspace/ws/templates/?page=2');
  });
});
