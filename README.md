# hovercode

QR codes for JavaScript, the command line and AI agents.

- **Free static QR codes**, generated locally: SVG or PNG, custom colors, dot and eye styles, logos, plus payload builders for WiFi, vCard, email, SMS, phone and location. No account, no network, works in the browser.
- **Dynamic QR codes** through the [Hovercode API](https://hovercode.com/api/), with the same options: change where a printed code points, track scans (time, location, device), read analytics and receive scan webhooks.
- **A CLI** (`npx hovercode`) and an **agent skill**, so Claude Code, Cursor, Codex and OpenClaw can make codes for you.

```bash
npm install hovercode
```

## Static QR codes (free)

```ts
import { toSVG, toDataURL, payloads } from 'hovercode';

const svg = toSVG('https://example.com');

const styled = toSVG('https://example.com', {
  dotStyle: 'circle',      // 'square' | 'rounded' | 'circle'
  eyeStyle: 'rounded',     // 'square' | 'rounded' | 'circle'
  color: '#4f46e5',
  eyeColor: '#e11d48',
  background: '#ffffff',   // or 'transparent'
  logo: 'https://example.com/logo.png',  // error correction switches to H automatically
  size: 512,
});

// <img src={...}> anywhere, including React and the browser
const wifi = toDataURL(payloads.wifi({ ssid: 'Cafe Guest', password: 'hunter2' }));
```

Payload builders: `payloads.wifi`, `payloads.vcard`, `payloads.email`, `payloads.sms`, `payloads.phone`, `payloads.geo`.

In Node, `hovercode/node` adds PNG and file output:

```ts
import { toPNG, toFile } from 'hovercode/node';

const png = await toPNG('https://example.com', { size: 1024 });
await toFile('code.svg', 'https://example.com', { dotStyle: 'circle' });
```

Drawing it yourself (canvas, PDF, React Native)? `toMatrix(data)` returns the module grid.

## Dynamic QR codes

A static code's content is fixed once printed. A dynamic code encodes a short link, so you can change the destination at any time and see every scan. Pass `dynamic: true` with the same options:

```ts
import { createQR, Hovercode } from 'hovercode';

// Server-side. Reads HOVERCODE_API_TOKEN.
const code = await createQR('https://example.com/menu', {
  dynamic: true,
  name: 'Table menu',
  dotStyle: 'circle',
  color: '#4f46e5',
});
code.id;           // keep this to edit the code or read its analytics
code.shortlinkUrl; // what the QR encodes
code.svg;

const hovercode = new Hovercode();
await hovercode.codes.update(code.id, { qr_data: 'https://example.com/winter-menu' });
const stats = await hovercode.codes.analytics(code.id, { days: 30 });
```

Get your API token at [hovercode.com/api](https://hovercode.com/api/). API access is on the Business plan, with a free trial. Codes go into the account's current workspace unless you pass `workspace` (or set `HOVERCODE_WORKSPACE_ID`); `hovercode.workspaces.list()` shows them all.

## Adding QR codes to your product

Building a CRM, client portal, ordering system, event app or QR generator? This is the full pattern.

**1. Free and paid tiers with one flag.** Style options are shared, and a dynamic code's `svg` is rendered locally from its short link, so static and dynamic codes look identical:

```ts
const code = await createQR(url, { dynamic: user.isPro, ...brandStyle });
```

Each dynamic call creates a new code that counts toward your plan. Create it once, store `code.id` and `code.shortlinkUrl`, and use `codes.update` when the destination changes. Pass `design` (Hovercode frames, captions, patterns) or `template` to get Hovercode's own rendering instead.

**2. One workspace per customer.** If your customers each manage their own QR codes, give each one a Hovercode workspace. Codes, folders, analytics and scan webhooks stay separate, and every API call is scoped to one workspace:

```ts
const hovercode = new Hovercode();

// When a customer signs up in your product
const ws = await hovercode.workspaces.create({ name: customer.name });
await db.customer.update({ id: customer.id, hovercodeWorkspace: ws.id });

// Everything for that customer passes their workspace
const code = await createQR(url, { dynamic: true, client: new Hovercode({ workspace: customer.hovercodeWorkspace }) });
const page = await hovercode.codes.list({ include: ['scans'] }, customer.hovercodeWorkspace);
```

Your server holds the API token and decides which workspace a signed-in customer may see; your customers never need a Hovercode login. Multiple workspaces are on the Business Plus plan, which includes up to 10. [Talk to us](https://hovercode.com/contact/) if you're building a platform and need more. Full guide: [Build QR codes into your product](https://hovercode.com/api/#build-qr-codes-into-your-product).

**3. Show the codes in React.** `<QRCode>` renders locally, in the browser or during SSR. For a dynamic code, pass its stored `shortlinkUrl`, so the token never reaches the browser:

```tsx
import { QRCode } from 'hovercode/react';

<QRCode value={listing.qrShortlinkUrl} dotStyle="circle" eyeStyle="rounded" color="#4f46e5" size={200} />
```

### The client

`new Hovercode({ token?, workspace?, baseUrl?, timeoutMs?, maxRetries? })` covers the [whole API](https://hovercode.com/api/):

| | |
|---|---|
| `codes` | `create`, `get`, `update`, `updateDesign`, `delete`, `list`, `listAll` (async iterator), `analytics`, `activity`, `download`, `addTags`, `removeTag` |
| `links` | `create`, `get`, `update`, `delete`, `list`, `qrSvg`, `activity` |
| `pdf` | `create` (host a PDF behind a dynamic code) |
| `pages` | `create`, `get`, `list` (link-in-bio pages with their own QR) |
| `forms` | `list`, `responses` |
| `workspaces` | `list`, `listAll`, `create`, `update` (one per customer of your product) |
| `folders`, `templates`, `tags` | list and manage |
| `analytics()` | workspace-wide stats |
| `request(method, path, { body, query })` | any other endpoint |

Errors throw `HovercodeError` with `status`, `code` and `body`. A `code` of `missing_credentials` means no request was sent. Rate-limited requests (429) are retried after `Retry-After`. The client refuses to run in a browser, because it would expose your token.

### Scan webhooks

```ts
import { parseWebhook } from 'hovercode';

// Next.js route handler: pass the raw body, not re-serialised JSON.
export async function POST(req: Request) {
  const scan = await parseWebhook(await req.text(), req.headers.get('x-signature'), process.env.HOVERCODE_WEBHOOK_SECRET!);
  console.log(scan.qr_code_id, scan.location, scan.device);
  return new Response('ok');
}
```

## CLI

```bash
npx hovercode qr https://example.com -o code.svg                    # static, free
npx hovercode qr --type wifi --ssid "Cafe Guest" --password hunter2 -o wifi.png

npx hovercode login                                                  # API token
npx hovercode codes create https://example.com/menu -o menu.png     # dynamic
npx hovercode codes update <id> --url https://example.com/new
npx hovercode codes analytics <id> --days 30
npx hovercode pdf create ./menu.pdf
npx hovercode --help
```

Commands print JSON, so they're easy to script and for agents to read.

## For AI agents

- **Skill:** [`skills/hovercode/SKILL.md`](skills/hovercode/SKILL.md) teaches an agent when to use static or dynamic codes, the CLI, and how to build QR features into an app.
  - Any agent (Claude Code, Cursor, Codex, ...): `npx skills add Hovercode-Ltd/hovercode-js`
  - Claude Code plugin (skill plus the Hovercode MCP server): `/plugin install hovercode --marketplace Hovercode-Ltd/hovercode-js`
  - OpenClaw: install `hovercode` from [ClawHub](https://clawhub.ai)
- **MCP:** chat clients (Claude, ChatGPT, Cursor) can use the hosted server at `https://hovercode.com/mcp/`. See [hovercode-mcp](https://github.com/Hovercode-Ltd/hovercode-mcp).

## License

MIT © Hovercode Ltd
