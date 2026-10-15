import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';
import { createInterface } from 'node:readline/promises';
import { parseArgs } from 'node:util';
import { Hovercode, HovercodeError, type DesignUpdate } from './client.js';
import * as payloads from './payloads.js';
import { toFile } from './node.js';
import { toSVG, type StaticQROptions } from './static.js';

declare const __VERSION__: string;
const VERSION = typeof __VERSION__ === 'string' ? __VERSION__ : 'dev';

const HELP: Record<string, string> = {
  main: `hovercode ${VERSION} - QR codes from the command line

Free static codes (no account):
  hovercode qr <data> [-o code.svg|code.png]      Generate a static QR code locally

Dynamic codes (editable after printing, scan tracking; needs an API token):
  hovercode login                                 Save your API token
  hovercode workspaces [list|create|rename]       Your workspaces, plans and quotas
  hovercode codes create <url>                    Create a dynamic QR code
  hovercode codes update <id> --url <new-url>     Point a printed code somewhere new
  hovercode codes list|get|design|analytics|scans|download|delete
  hovercode links create|list|get|update|scans|delete   Short links (each has a QR)
  hovercode pdf create <file.pdf|url>             Host a PDF behind a dynamic code
  hovercode pages create --title <t> --link <url> Link-in-bio page with its own QR
  hovercode forms list|responses                  Read forms and their submissions
  hovercode folders list|create, templates list, tags list
  hovercode analytics                             Workspace-wide scan stats
  hovercode api <METHOD> <path> [--data <json>]   Call any API endpoint directly

Run "hovercode <command> --help" for details and examples.

Auth: --token flag, else HOVERCODE_API_TOKEN, else the config saved by "hovercode login".
The workspace defaults to your current one (override: --workspace or HOVERCODE_WORKSPACE_ID).
Get a token at https://hovercode.com/api/ (Business plan, with a free trial).
API docs: https://hovercode.com/api/  ·  Agents: https://hovercode.com/mcp/docs`,

  qr: `hovercode qr [data] [options]

Generate a STATIC QR code locally. Free, no account, no network. The data is
fixed forever once printed; for a code you can edit or track, use
"hovercode codes create" (or add --dynamic here).

Content (default --type is url/text, taking <data>):
  --type wifi    --ssid <name> [--password <pw>] [--encryption WPA|WEP|nopass] [--hidden]
  --type vcard   --first-name <n> [--last-name] [--company] [--title] [--email]
                 [--phone] [--mobile] [--website]
  --type email   --to <addr> [--subject] [--body]
  --type sms     --number <n> [--message]
  --type tel     --number <n>
  --type geo     --lat <n> --lng <n>

Style:
  --color <hex>          Modules (default #111111)
  --background <hex>     Background, or "transparent" (default #ffffff)
  --eye-color <hex>      Corner eyes (default: --color)
  --dots square|rounded|circle
  --eyes square|rounded|circle
  --logo <url|data-uri>  Centered logo (SVG output only; bumps error correction to H)
  --size <px>            Default 512
  --margin <modules>     Quiet zone, default 4
  --ecl L|M|Q|H          Error correction

Output:
  -o, --output <file>    .svg or .png (PNG uses plain square modules). Default: SVG to stdout
  --dynamic              Create a dynamic code via the API instead (see "codes create")

Examples:
  hovercode qr https://example.com -o example.svg
  hovercode qr https://example.com --dots circle --eyes rounded --color "#4f46e5" -o code.png
  hovercode qr --type wifi --ssid "Cafe Guest" --password hunter2 -o wifi.png`,

  codes: `hovercode codes <subcommand>

  create <url> [options]          Create a dynamic QR code (prints id + shortlink_url)
      --static                    Make it static instead (fixed data, not tracked)
      --text                      Encode plain text (qr_type Text; static only)
      --name <name>  --folder <id|slug>  --template <id>  --domain <domain>  --gps
      Design: --color --background --eye-color --pattern Original|Circles|Squares|Diamonds|Triangles
              --eye-style Square|Rounded|Drop|Leaf  --frame <slug>  --frame-color  --text-caption <t>
              --logo <url>  --ecl L|M|Q|H
      -o <file.svg|file.png>      Save the image (PNG is the print-ready file from the API)
  list [--q <search>] [--folder <id|slug|none>] [--scans] [--tags] [--days <n>] [--all] [--page <n>] [--page-size <n>]
  get <id>
  update <id> [--url <new-destination>] [--name <name>] [--folder <id|slug>] [--no-folder]
  design <id> [design options] [--remove-logo]     Restyle in place; the printed code keeps working
  analytics <id> [--days <n> | --start <date> --end <date>]
  scans <id> [--page <n>] [--page-size <n>]       Individual scans (time, location, device)
  download <id> [-o file.png|file.svg]            Print-ready PNG/SVG URLs, or save one
  delete <id> --yes

Examples:
  hovercode codes create https://example.com/menu --name "Table menu" -o menu.png
  hovercode codes update 2fbb014a-... --url https://example.com/winter-menu
  hovercode codes list --scans --q menu`,

  links: `hovercode links <subcommand>

  create <url> [--slug <slug>] [--domain <domain>] [--name <name>] [--gps]
  list [--q <search>] [--page <n>]
  get <id>
  update <id> [--url <destination>] [--name <name>]
  scans <id>
  qr <id> [-o file.svg]
  delete <id> --yes`,

  pdf: `hovercode pdf create <file.pdf|https://...pdf> [--name <name>] [--filename <name.pdf>] [--domain <domain>] [-o qr.svg]

Hosts the PDF and returns a dynamic QR code pointing at it (swap the PDF later
without reprinting).`,

  pages: `hovercode pages <subcommand>

  create --title <title> --link <url>[|<label>] [--link ...] [--description <text>]
         [--bg-color <hex>] [--text-color <hex>] [--slug <slug>] [--domain <domain>] [-o qr.svg]
  list
  get <id>

Example:
  hovercode pages create --title "Find us" --link "https://instagram.com/acme|Instagram" --link "https://acme.com|Shop"`,

  forms: `hovercode forms <subcommand>

  list [--q <search>]
  responses <id> [--page <n>]

Build forms with "hovercode api" (create, save fields, publish): see https://hovercode.com/api/#forms`,

  folders: `hovercode folders list
hovercode folders create <name> [--parent <id|slug>]`,

  analytics: `hovercode analytics [--days <n> | --start <date> --end <date>] [--top <n>]

Workspace-wide scan totals, by day/country/city/OS/browser, and top codes.
For one code: hovercode codes analytics <id>`,

  api: `hovercode api <METHOD> <path> [--data <json>|@file.json] [--query key=value ...]

Call any endpoint from https://hovercode.com/api/ with your saved credentials.
"{workspace}" in the path or data is replaced with your workspace ID.

Examples:
  hovercode api GET /api/v2/workspace/{workspace}/templates/
  hovercode api POST /api/v2/form/create/ --data '{"workspace":"{workspace}","title":"RSVP"}'`,

  login: `hovercode login [--token <token>] [--workspace <id>]

Checks your API token and saves it to ${configPath()} (mode 600), with your
current workspace (or --workspace). Get the token at https://hovercode.com/api/.
API access is on the Business plan, with a free trial.`,
  workspaces: `hovercode workspaces [list]          Your workspaces, plans and dynamic-code quotas
hovercode workspaces create <name>                 Create one (e.g. one per customer of your product)
hovercode workspaces rename <id> <name>

Use a workspace with --workspace <id> on any command, or HOVERCODE_WORKSPACE_ID.`,
};

const OPTIONS = {
  help: { type: 'boolean', short: 'h' },
  version: { type: 'boolean', short: 'v' },
  token: { type: 'string' },
  workspace: { type: 'string' },
  output: { type: 'string', short: 'o' },
  'include-svg': { type: 'boolean' },
  yes: { type: 'boolean', short: 'y' },
  // qr content
  type: { type: 'string', short: 't' },
  ssid: { type: 'string' },
  password: { type: 'string' },
  encryption: { type: 'string' },
  hidden: { type: 'boolean' },
  'first-name': { type: 'string' },
  'last-name': { type: 'string' },
  company: { type: 'string' },
  title: { type: 'string' },
  email: { type: 'string' },
  phone: { type: 'string' },
  mobile: { type: 'string' },
  website: { type: 'string' },
  to: { type: 'string' },
  subject: { type: 'string' },
  body: { type: 'string' },
  number: { type: 'string' },
  message: { type: 'string' },
  lat: { type: 'string' },
  lng: { type: 'string' },
  // static style
  color: { type: 'string' },
  background: { type: 'string' },
  'eye-color': { type: 'string' },
  dots: { type: 'string' },
  eyes: { type: 'string' },
  logo: { type: 'string' },
  size: { type: 'string' },
  margin: { type: 'string' },
  ecl: { type: 'string' },
  dynamic: { type: 'boolean' },
  // api design
  pattern: { type: 'string' },
  'eye-style': { type: 'string' },
  frame: { type: 'string' },
  'frame-color': { type: 'string' },
  'text-caption': { type: 'string' },
  'remove-logo': { type: 'boolean' },
  // codes / links
  static: { type: 'boolean' },
  text: { type: 'boolean' },
  name: { type: 'string' },
  folder: { type: 'string' },
  'no-folder': { type: 'boolean' },
  template: { type: 'string' },
  domain: { type: 'string' },
  gps: { type: 'boolean' },
  url: { type: 'string' },
  slug: { type: 'string' },
  q: { type: 'string' },
  scans: { type: 'boolean' },
  tags: { type: 'boolean' },
  all: { type: 'boolean' },
  page: { type: 'string' },
  'page-size': { type: 'string' },
  days: { type: 'string' },
  start: { type: 'string' },
  end: { type: 'string' },
  top: { type: 'string' },
  // pdf / pages / folders
  filename: { type: 'string' },
  link: { type: 'string', multiple: true },
  description: { type: 'string' },
  'bg-color': { type: 'string' },
  'text-color': { type: 'string' },
  parent: { type: 'string' },
  // api
  data: { type: 'string' },
  query: { type: 'string', multiple: true },
} as const;

type Flags = ReturnType<typeof parse>['values'];

function parse(argv: string[]) {
  return parseArgs({ args: argv, options: OPTIONS, allowPositionals: true, strict: true });
}

class UsageError extends Error {}

function configPath(): string {
  const base = process.env.XDG_CONFIG_HOME || join(homedir(), '.config');
  return join(base, 'hovercode', 'config.json');
}

async function readConfig(): Promise<{ token?: string; workspace?: string }> {
  try {
    return JSON.parse(await readFile(configPath(), 'utf8'));
  } catch {
    return {};
  }
}

async function client(flags: Flags): Promise<Hovercode> {
  const config = await readConfig();
  const token = flags.token ?? process.env.HOVERCODE_API_TOKEN ?? config.token;
  const workspace = flags.workspace ?? process.env.HOVERCODE_WORKSPACE_ID ?? config.workspace;
  if (!token) {
    throw new UsageError(
      'Not logged in. Run "hovercode login", or set HOVERCODE_API_TOKEN.\n' +
        'Get your API token at https://hovercode.com/api/ (API access: Business plan, with a free trial).\n' +
        'For a free static code with no account, use "hovercode qr <data>".',
    );
  }
  return new Hovercode({ token, workspace });
}

function out(value: unknown, flags: Flags): void {
  if (value === undefined) return;
  if (typeof value === 'string') {
    process.stdout.write(value.endsWith('\n') ? value : `${value}\n`);
    return;
  }
  process.stdout.write(`${JSON.stringify(flags['include-svg'] ? value : stripSvg(value), null, 2)}\n`);
}

/** SVG strings are long; leave them out of JSON output unless asked. */
function stripSvg(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stripSvg);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).filter(([k, v]) => !(typeof v === 'string' && /svg$/.test(k) && v.startsWith('<'))).map(([k, v]) => [k, stripSvg(v)]),
    );
  }
  return value;
}

function int(value: string | undefined, name: string): number | undefined {
  if (value === undefined) return undefined;
  const n = Number(value);
  if (!Number.isFinite(n)) throw new UsageError(`--${name} must be a number`);
  return n;
}

function need<T>(value: T | undefined, message: string): T {
  if (value === undefined || value === '') throw new UsageError(message);
  return value;
}

function oneOf<T extends string>(value: string | undefined, allowed: readonly T[], name: string): T | undefined {
  if (value === undefined) return undefined;
  const match = allowed.find((a) => a.toLowerCase() === value.toLowerCase());
  if (!match) throw new UsageError(`--${name} must be one of: ${allowed.join(', ')}`);
  return match;
}

function period(flags: Flags) {
  return { days: int(flags.days, 'days'), start: flags.start, end: flags.end };
}

function apiDesign(flags: Flags): DesignUpdate {
  const design: DesignUpdate = {
    primary_color: flags.color,
    background_color: flags.background,
    eye_color: flags['eye-color'],
    pattern: oneOf(flags.pattern, ['Original', 'Circles', 'Squares', 'Diamonds', 'Triangles'] as const, 'pattern'),
    eye_style: oneOf(flags['eye-style'], ['Square', 'Rounded', 'Drop', 'Leaf'] as const, 'eye-style'),
    frame: flags.frame as DesignUpdate['frame'],
    frame_color: flags['frame-color'],
    text: flags['text-caption'],
    logo_url: flags.logo,
    error_correction: oneOf(flags.ecl, ['L', 'M', 'Q', 'H'] as const, 'ecl'),
    remove_logo: flags['remove-logo'] || undefined,
  };
  return Object.fromEntries(Object.entries(design).filter(([, v]) => v !== undefined)) as DesignUpdate;
}

async function download(url: string, path: string): Promise<void> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Download failed (${res.status}): ${url}`);
  await writeFile(path, Buffer.from(await res.arrayBuffer()));
}

async function saveImage(
  hc: Hovercode,
  record: { id?: unknown; svg?: unknown },
  path: string | undefined,
): Promise<string | undefined> {
  if (!path) return undefined;
  if (path.toLowerCase().endsWith('.svg') && typeof record.svg === 'string' && record.svg) {
    await writeFile(path, record.svg);
  } else if (/\.(png|svg)$/i.test(path)) {
    const files = await hc.codes.download(String(record.id));
    await download(path.toLowerCase().endsWith('.png') ? files.png_url : files.svg_url, path);
  } else {
    throw new UsageError('-o must end in .svg or .png');
  }
  return path;
}

function qrContent(flags: Flags, positional: string | undefined): string {
  const type = (flags.type ?? 'url').toLowerCase();
  switch (type) {
    case 'url':
    case 'text':
      return need(positional, 'Missing data: hovercode qr <url-or-text>');
    case 'wifi':
      return payloads.wifi({
        ssid: need(flags.ssid, '--ssid is required for --type wifi'),
        password: flags.password,
        encryption: oneOf(flags.encryption, ['WPA', 'WEP', 'nopass'] as const, 'encryption'),
        hidden: flags.hidden,
      });
    case 'vcard':
      return payloads.vcard({
        first_name: need(flags['first-name'], '--first-name is required for --type vcard'),
        last_name: flags['last-name'],
        company_name: flags.company,
        position: flags.title,
        email: flags.email,
        phone_number: flags.phone,
        mobile_number: flags.mobile,
        website: flags.website,
      });
    case 'email':
      return payloads.email({ to: need(flags.to, '--to is required for --type email'), subject: flags.subject, body: flags.body });
    case 'sms':
      return payloads.sms({ number: need(flags.number, '--number is required for --type sms'), message: flags.message });
    case 'tel':
    case 'phone':
      return payloads.phone(need(flags.number, '--number is required for --type tel'));
    case 'geo':
      return payloads.geo({
        latitude: need(int(flags.lat, 'lat'), '--lat is required for --type geo'),
        longitude: need(int(flags.lng, 'lng'), '--lng is required for --type geo'),
      });
    default:
      throw new UsageError(`Unknown --type ${flags.type}. Use url, text, wifi, vcard, email, sms, tel or geo.`);
  }
}

async function cmdQr(flags: Flags, args: string[]): Promise<unknown> {
  const data = qrContent(flags, args[0]);
  if (flags.dynamic) return cmdCodes(flags, ['create', data]);
  const options: StaticQROptions = {
    color: flags.color,
    background: flags.background,
    eyeColor: flags['eye-color'],
    dotStyle: oneOf(flags.dots, ['square', 'rounded', 'circle'] as const, 'dots'),
    eyeStyle: oneOf(flags.eyes, ['square', 'rounded', 'circle'] as const, 'eyes'),
    logo: flags.logo,
    size: int(flags.size, 'size'),
    margin: int(flags.margin, 'margin'),
    errorCorrection: oneOf(flags.ecl, ['L', 'M', 'Q', 'H'] as const, 'ecl'),
  };
  if (!flags.output) return toSVG(data, options);
  if (flags.output.toLowerCase().endsWith('.png') && (options.logo || options.dotStyle || options.eyeStyle)) {
    process.stderr.write('Note: PNG output uses plain square modules; use .svg to keep dot/eye styles and the logo.\n');
  }
  await toFile(flags.output, data, options);
  return { file: flags.output, data, dynamic: false };
}

async function cmdCodes(flags: Flags, args: string[]): Promise<unknown> {
  const [sub, id] = args;
  const hc = await client(flags);
  switch (sub) {
    case 'create': {
      const data = need(id, 'Missing destination: hovercode codes create <url>');
      const record = await hc.codes.create({
        qr_data: data,
        qr_type: flags.text ? 'Text' : undefined,
        dynamic: !flags.static && !flags.text,
        display_name: flags.name,
        folder: flags.folder,
        template: flags.template,
        domain: flags.domain,
        gps_tracking: flags.gps || undefined,
        size: int(flags.size, 'size'),
        ...apiDesign(flags),
      });
      const file = await saveImage(hc, record, flags.output);
      return file ? { ...record, file } : record;
    }
    case 'list': {
      const include = [flags.scans && 'scans', flags.tags && 'tags'].filter(Boolean) as Array<'scans' | 'tags'>;
      const params = { q: flags.q, folder: flags.folder, include: include.length ? include : undefined, ...period(flags) };
      if (flags.all) {
        const results = [];
        for await (const code of hc.codes.listAll(params)) results.push(code);
        return { count: results.length, results };
      }
      return hc.codes.list({ ...params, page: int(flags.page, 'page'), page_size: int(flags['page-size'], 'page-size') });
    }
    case 'get':
      return hc.codes.get(need(id, 'Missing id: hovercode codes get <id>'));
    case 'update': {
      const params: Parameters<Hovercode['codes']['update']>[1] = {};
      if (flags.url) params.qr_data = flags.url;
      if (flags.name) params.display_name = flags.name;
      if (flags.gps) params.gps_tracking = true;
      if (flags.folder) params.folder = flags.folder;
      if (flags['no-folder']) params.folder = null;
      if (!Object.keys(params).length) throw new UsageError('Nothing to update: pass --url, --name, --folder, --no-folder or --gps');
      return hc.codes.update(need(id, 'Missing id: hovercode codes update <id> --url <url>'), params);
    }
    case 'design': {
      const design = apiDesign(flags);
      if (!Object.keys(design).length) throw new UsageError('Nothing to change: pass design options (see hovercode codes --help)');
      const record = await hc.codes.updateDesign(need(id, 'Missing id: hovercode codes design <id> [options]'), design);
      const file = await saveImage(hc, record, flags.output);
      return file ? { ...record, file } : record;
    }
    case 'analytics':
      return hc.codes.analytics(need(id, 'Missing id: hovercode codes analytics <id>'), period(flags));
    case 'scans':
    case 'activity':
      return hc.codes.activity(need(id, 'Missing id: hovercode codes scans <id>'), {
        page: int(flags.page, 'page'),
        page_size: int(flags['page-size'], 'page-size'),
      });
    case 'download': {
      const files = await hc.codes.download(need(id, 'Missing id: hovercode codes download <id>'));
      if (!flags.output) return files;
      await download(flags.output.toLowerCase().endsWith('.svg') ? files.svg_url : files.png_url, flags.output);
      return { ...files, file: flags.output };
    }
    case 'delete':
      need(id, 'Missing id: hovercode codes delete <id> --yes');
      if (!flags.yes) throw new UsageError('Deleting a code breaks it wherever it is printed. Re-run with --yes to confirm.');
      await hc.codes.delete(id!);
      return { deleted: id };
    default:
      throw new UsageError(HELP.codes);
  }
}

async function cmdLinks(flags: Flags, args: string[]): Promise<unknown> {
  const [sub, id] = args;
  const hc = await client(flags);
  switch (sub) {
    case 'create':
      return hc.links.create({
        link: need(id, 'Missing destination: hovercode links create <url>'),
        slug: flags.slug,
        domain: flags.domain,
        display_name: flags.name,
        gps: flags.gps || undefined,
      });
    case 'list':
      return hc.links.list({ q: flags.q, page: int(flags.page, 'page'), page_size: int(flags['page-size'], 'page-size') });
    case 'get':
      return hc.links.get(need(id, 'Missing id: hovercode links get <id>'));
    case 'update': {
      const params: { link?: string; display_name?: string; gps?: boolean } = {};
      if (flags.url) params.link = flags.url;
      if (flags.name) params.display_name = flags.name;
      if (flags.gps) params.gps = true;
      if (!Object.keys(params).length) throw new UsageError('Nothing to update: pass --url, --name or --gps');
      return hc.links.update(need(id, 'Missing id: hovercode links update <id> --url <url>'), params);
    }
    case 'scans':
    case 'activity':
      return hc.links.activity(need(id, 'Missing id: hovercode links scans <id>'));
    case 'qr': {
      const svg = await hc.links.qrSvg(need(id, 'Missing id: hovercode links qr <id>'));
      if (!flags.output) return svg;
      await writeFile(flags.output, svg);
      return { file: flags.output };
    }
    case 'delete':
      need(id, 'Missing id: hovercode links delete <id> --yes');
      if (!flags.yes) throw new UsageError('Deleting a link breaks it everywhere it is shared. Re-run with --yes to confirm.');
      await hc.links.delete(id!);
      return { deleted: id };
    default:
      throw new UsageError(HELP.links);
  }
}

async function cmdPdf(flags: Flags, args: string[]): Promise<unknown> {
  const [sub, source] = args;
  if (sub !== 'create') throw new UsageError(HELP.pdf);
  const hc = await client(flags);
  const src = need(source, 'Missing PDF: hovercode pdf create <file.pdf|url>');
  const isUrl = /^https?:\/\//.test(src);
  const record = await hc.pdf.create({
    ...(isUrl ? { pdf_url: src } : { pdf_base64: (await readFile(src)).toString('base64') }),
    filename: flags.filename ?? (isUrl ? undefined : src.split(/[\\/]/).pop()),
    display_name: flags.name,
    domain: flags.domain,
  });
  const file = await saveImage(hc, record, flags.output);
  return file ? { ...record, file } : record;
}

async function cmdPages(flags: Flags, args: string[]): Promise<unknown> {
  const [sub, id] = args;
  const hc = await client(flags);
  switch (sub) {
    case 'create': {
      const links = (flags.link ?? []).map((spec) => {
        const [url, ...label] = spec.split('|');
        return label.length ? { url, title: label.join('|') } : { url };
      });
      const page = await hc.pages.create({
        title: need(flags.title, 'Missing --title: hovercode pages create --title <title> --link <url>'),
        links,
        description: flags.description,
        bg_color: flags['bg-color'],
        text_color: flags['text-color'],
        slug: flags.slug,
        domain: flags.domain,
      });
      if (flags.output) {
        if (!flags.output.toLowerCase().endsWith('.svg')) throw new UsageError('-o for pages must be an .svg file');
        await writeFile(flags.output, page.svg);
        return { ...page, file: flags.output };
      }
      return page;
    }
    case 'list':
      return hc.pages.list();
    case 'get':
      return hc.pages.get(need(id, 'Missing id: hovercode pages get <id>'));
    default:
      throw new UsageError(HELP.pages);
  }
}

async function cmdForms(flags: Flags, args: string[]): Promise<unknown> {
  const [sub, id] = args;
  const hc = await client(flags);
  if (sub === 'list') return hc.forms.list({ q: flags.q, page: int(flags.page, 'page') });
  if (sub === 'responses') {
    return hc.forms.responses(need(id, 'Missing id: hovercode forms responses <id>'), { page: int(flags.page, 'page') });
  }
  throw new UsageError(HELP.forms);
}

async function cmdFolders(flags: Flags, args: string[]): Promise<unknown> {
  const [sub, name] = args;
  const hc = await client(flags);
  if (sub === 'list') return hc.folders.list();
  if (sub === 'create') {
    return hc.folders.create({ name: need(name, 'Missing name: hovercode folders create <name>'), parent: flags.parent });
  }
  throw new UsageError(HELP.folders);
}

async function cmdApi(flags: Flags, args: string[]): Promise<unknown> {
  const [method, path] = args;
  if (!method || !path) throw new UsageError(HELP.api);
  const hc = await client(flags);
  const needsWorkspace = path.includes('{workspace}') || (flags.data ?? '').includes('{workspace}');
  const workspace = hc.workspace ?? (needsWorkspace ? (await hc.workspaces.list()).current_workspace : null);
  const fill = (s: string) => (workspace ? s.replaceAll('{workspace}', workspace) : s);
  let body: unknown;
  if (flags.data !== undefined) {
    const raw = flags.data.startsWith('@') ? await readFile(flags.data.slice(1), 'utf8') : flags.data;
    try {
      body = JSON.parse(fill(raw));
    } catch {
      throw new UsageError('--data must be valid JSON (or @file.json)');
    }
  }
  const query: Record<string, string> = {};
  for (const pair of flags.query ?? []) {
    const eq = pair.indexOf('=');
    if (eq < 1) throw new UsageError(`--query must be key=value, got "${pair}"`);
    query[pair.slice(0, eq)] = pair.slice(eq + 1);
  }
  return hc.request(method.toUpperCase(), fill(path), { body, query });
}

async function cmdLogin(flags: Flags): Promise<unknown> {
  let { token } = flags;
  if (!token && process.stdin.isTTY) {
    const rl = createInterface({ input: process.stdin, output: process.stderr });
    process.stderr.write('Find your API token at https://hovercode.com/api/\n');
    token = (await rl.question('API token: ')).trim();
    rl.close();
  }
  if (!token) throw new UsageError(HELP.login);
  // Validates the token and finds its workspaces in one call.
  let listing;
  try {
    const hc = new Hovercode({ token });
    const first = await hc.workspaces.list({ page_size: 200 });
    const results = [];
    if (first.count > first.results.length) for await (const w of hc.workspaces.listAll()) results.push(w);
    listing = { current_workspace: first.current_workspace, results: results.length ? results : first.results };
  } catch (err) {
    // Servers without the workspaces endpoint: fall back to checking an explicit --workspace.
    if (!(err instanceof HovercodeError && err.status === 404 && flags.workspace)) throw err;
    await new Hovercode({ token, workspace: flags.workspace }).folders.list();
    listing = { current_workspace: flags.workspace, results: [{ id: flags.workspace, name: flags.workspace, plan: '' }] };
  }
  const { results, current_workspace } = listing;
  const workspace = flags.workspace ?? current_workspace ?? results[0]?.id;
  const chosen = results.find((w) => w.id === workspace);
  if (!chosen) {
    throw new UsageError(
      `Workspace ${workspace ?? '(none)'} isn't available to this token. Your workspaces:\n` +
        results.map((w) => `  ${w.id}  ${w.name}`).join('\n'),
    );
  }
  const path = configPath();
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, `${JSON.stringify({ token, workspace }, null, 2)}\n`, { mode: 0o600 });
  return {
    saved: path,
    workspace: { id: chosen.id, name: chosen.name, plan: chosen.plan },
    ...(results.length > 1 && {
      other_workspaces: results.filter((w) => w.id !== workspace).map((w) => ({ id: w.id, name: w.name })),
      hint: 'Switch with: hovercode login --token <token> --workspace <id>',
    }),
  };
}

async function run(argv: string[]): Promise<number> {
  let parsed;
  try {
    parsed = parse(argv);
  } catch (err) {
    process.stderr.write(`${(err as Error).message}\nRun "hovercode --help" for usage.\n`);
    return 2;
  }
  const { values: flags, positionals } = parsed;
  const [command, ...args] = positionals;

  if (flags.version) {
    process.stdout.write(`${VERSION}\n`);
    return 0;
  }
  if (!command || command === 'help' || (flags.help && !HELP[command])) {
    process.stdout.write(`${HELP[(command === 'help' && args[0]) || 'main'] ?? HELP.main}\n`);
    return 0;
  }
  if (flags.help) {
    process.stdout.write(`${HELP[command]}\n`);
    return 0;
  }

  try {
    let result: unknown;
    switch (command) {
      case 'qr':
        result = await cmdQr(flags, args);
        break;
      case 'codes':
      case 'code':
        result = await cmdCodes(flags, args);
        break;
      case 'links':
      case 'link':
        result = await cmdLinks(flags, args);
        break;
      case 'pdf':
        result = await cmdPdf(flags, args);
        break;
      case 'pages':
      case 'page':
        result = await cmdPages(flags, args);
        break;
      case 'forms':
        result = await cmdForms(flags, args);
        break;
      case 'folders':
        result = await cmdFolders(flags, args);
        break;
      case 'templates':
        result = await (await client(flags)).templates.list();
        break;
      case 'tags':
        result = await (await client(flags)).tags.list();
        break;
      case 'workspaces':
      case 'workspace': {
        const hc = await client(flags);
        if (args[0] === 'create') {
          result = await hc.workspaces.create({ name: need(args[1], 'Missing name: hovercode workspaces create <name>') });
        } else if (args[0] === 'rename') {
          result = await hc.workspaces.update(need(args[1], 'Missing id: hovercode workspaces rename <id> <name>'), {
            name: need(args[2], 'Missing name: hovercode workspaces rename <id> <name>'),
          });
        } else if (!args[0] || args[0] === 'list') {
          const results = [];
          for await (const w of hc.workspaces.listAll()) results.push(w);
          result = { count: results.length, results };
        } else {
          throw new UsageError(HELP.workspaces);
        }
        break;
      }
      case 'analytics':
        result = await (await client(flags)).analytics({ ...period(flags), top: int(flags.top, 'top') });
        break;
      case 'api':
        result = await cmdApi(flags, args);
        break;
      case 'login':
        result = await cmdLogin(flags);
        break;
      case 'logout':
        await rm(configPath(), { force: true });
        result = { removed: configPath() };
        break;
      default:
        process.stderr.write(`Unknown command "${command}".\n\n${HELP.main}\n`);
        return 2;
    }
    out(result, flags);
    return 0;
  } catch (err) {
    if (err instanceof UsageError) {
      process.stderr.write(`${err.message}\n`);
      return 2;
    }
    if (err instanceof HovercodeError && err.code === 'missing_credentials') {
      process.stderr.write(`${err.message}\nOr run "hovercode login".\n`);
      return 2;
    }
    if (err instanceof HovercodeError) {
      let hint = '';
      if (err.status === 401) hint = '\nCheck your API token (https://hovercode.com/api/), or run "hovercode login".';
      if (err.status === 403 && !err.message.includes('hovercode.com/pricing')) {
        hint = '\nThis may need a plan with API access: https://hovercode.com/pricing/';
      }
      if (err.status === 404) hint = '\nCheck the ID, and that it belongs to your workspace.';
      process.stderr.write(`Error (${err.status || 'network'}): ${err.message}${hint}\n`);
      return 1;
    }
    process.stderr.write(`Error: ${(err as Error).message}\n`);
    return 1;
  }
}

// Keep the module importable (for tests) without running.
export { run };

if (!process.env.VITEST) {
  run(process.argv.slice(2)).then((code) => {
    process.exitCode = code;
  });
}
