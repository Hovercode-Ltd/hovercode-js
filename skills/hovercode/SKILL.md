---
name: hovercode
description: Create QR codes and add QR code features to apps. Use when the user wants a QR code (URL, WiFi, vCard, email, SMS, PDF, link-in-bio), a dynamic QR code whose destination can change after printing, QR scan tracking/analytics, short links, or wants to build QR code generation into their own product (a CRM, client portal, multi-tenant SaaS, or QR generator; Node.js, Next.js, React, any backend), including products whose customers each manage their own codes. Static codes are free and generated locally with the `hovercode` npm package or CLI; dynamic codes, tracking and analytics use the Hovercode API.
homepage: https://hovercode.com/api/
metadata:
  openclaw:
    homepage: https://hovercode.com/api/
    requires:
      anyBins: [npx, node]
    install:
      - kind: node
        package: hovercode
        bins: [hovercode]
    envVars:
      - name: HOVERCODE_API_TOKEN
        required: false
        description: Hovercode API token, for dynamic codes, tracking and analytics. Static codes need nothing. From https://hovercode.com/api/
      - name: HOVERCODE_WORKSPACE_ID
        required: false
        description: Optional. Workspace to use; defaults to the account's current workspace.
---

# Hovercode: QR codes for agents and apps

Two kinds of QR code. Pick deliberately:

| | Static | Dynamic |
|---|---|---|
| What it encodes | The data itself | A Hovercode short link that redirects |
| Change destination after printing | No, reprint needed | Yes |
| Scan tracking and analytics | No | Yes (time, location, device; webhooks) |
| Cost | Free, local, no account | Hovercode API token (Business plan, with a free trial) |

Use **dynamic** for anything printed or shared widely (menus, packaging, flyers, posters, business cards, event signage) or when the user asks about scans. Use **static** for one-off or private codes (WiFi at home, a quick link). If unsure, ask, mentioning that only dynamic codes can be edited after printing.

**Dynamic is right but there are no credentials** (the CLI exits 2 with "Not logged in"): don't silently fall back to static. Tell the user why dynamic fits (fix the link or change the destination after printing, see scans) and that it needs a Hovercode API token from https://hovercode.com/api/. Offer a free static code now as the alternative, saying plainly that it can never be changed or tracked once printed. Let them choose.

## Making codes: the CLI

No install needed: `npx hovercode <command>`. Every command has `--help`. On success, stdout is JSON, except `qr` without `-o`, which prints the SVG. On failure, a plain-text message goes to stderr with exit code 2 (bad usage, or not logged in) or 1 (API or network error; the message includes the HTTP status).

Static, free, no account:

```bash
npx hovercode qr https://example.com -o code.svg            # or .png
npx hovercode qr https://example.com --dots circle --eyes rounded --color "#4f46e5" --logo https://example.com/logo.png -o code.svg
npx hovercode qr --type wifi --ssid "Cafe Guest" --password hunter2 -o wifi.png
npx hovercode qr --type vcard --first-name Ada --last-name Lovelace --email ada@example.com -o card.svg
```

Other `--type`s: `email` (`--to --subject --body`), `sms` (`--number --message`), `tel` (`--number`), `geo` (`--lat --lng`). Style: `--dots square|rounded|circle`, `--eyes square|rounded|circle`, `--color`, `--eye-color`, `--background <hex|transparent>`, `--logo`, `--size`. Dot/eye styles and logos are SVG-only; PNG output uses plain square modules. `qr <url> --dynamic` creates a dynamic code instead (same as `codes create`).

Dynamic (needs credentials; see Auth below):

```bash
npx hovercode codes create https://example.com/menu --name "Table menu" -o menu.png
#   -> JSON with "id" and "shortlink_url". Keep the id: you need it to edit or report on the code.
npx hovercode codes update <id> --url https://example.com/winter-menu   # the printed code now goes here
npx hovercode codes analytics <id> --days 30
npx hovercode codes list --scans --q menu
npx hovercode codes design <id> --pattern Circles --eye-style Rounded --frame card --text-caption "Scan me"
npx hovercode pdf create ./menu.pdf -o menu-qr.png                     # hosted PDF behind a dynamic code
npx hovercode pages create --title "Find us" --link "https://instagram.com/acme|Instagram" --link "https://acme.com|Shop"
npx hovercode links create https://example.com/launch --slug launch     # short link (has a QR too)
npx hovercode analytics --days 7                                         # whole workspace
npx hovercode api GET /api/v2/workspace/{workspace}/templates/          # any other endpoint
```

`codes create --static` makes a static code saved in the Hovercode dashboard. Hovercode-rendered design values (`codes create` and `codes design`): `--pattern Original|Circles|Squares|Diamonds|Triangles`, `--eye-style Square|Rounded|Drop|Leaf`, `--frame` (`card`, `border`, `speech-bubble`, `round-frame`, `circle-viewfinder`, ...), `--text-caption` (shown in the frame).

`codes delete <id> --yes` breaks the code wherever it is printed. Confirm with the user first, and suggest `codes update` instead when they want it to point somewhere else.

### Auth

The user needs a Hovercode API token from https://hovercode.com/api/ (Business plan, with a free trial). Then either:
- `npx hovercode login --token <token>` (saved to `~/.config/hovercode/config.json`), or
- the `HOVERCODE_API_TOKEN` environment variable.

The workspace defaults to the account's current one. `npx hovercode workspaces` lists the others; pick one with `--workspace <id>` or `HOVERCODE_WORKSPACE_ID`.

Never ask the user to paste the token into code that runs in a browser.

## Building QR codes into an app: the library

When the user wants QR code generation **inside their product**, install the package rather than hand-rolling API calls:

```bash
npm install hovercode
```

Static codes run anywhere, browser included, with no key:

```ts
import { toSVG, toDataURL, payloads } from 'hovercode';

const svg = toSVG('https://example.com', { dotStyle: 'circle', eyeStyle: 'rounded', color: '#4f46e5', logo: 'https://example.com/logo.png' });
const img = toDataURL(payloads.wifi({ ssid: 'Guest', password: 'secret' }));   // <img src={img}>
```

Node only: `import { toPNG, toFile } from 'hovercode/node'`.

Dynamic codes use the same options plus `dynamic: true`, **server-side only** (API route, server action, backend job):

```ts
import { createQR, Hovercode } from 'hovercode';

// Reads HOVERCODE_API_TOKEN (and optional HOVERCODE_WORKSPACE_ID) from the environment.
const code = await createQR('https://example.com/product/42', { dynamic: true, name: 'Product 42', dotStyle: 'circle' });
// store code.id with your record; show code.svg; code.shortlinkUrl is what it encodes

const hovercode = new Hovercode();
await hovercode.codes.update(code.id, { qr_data: 'https://example.com/product/42-v2' });   // retarget
const stats = await hovercode.codes.analytics(code.id, { days: 30 });                      // scans for your UI
for await (const c of hovercode.codes.listAll({ include: ['scans'] })) { /* sync/report */ }
```

A common product shape: static codes for free users, dynamic codes as a paid feature. Same style options, and only the `dynamic` flag changes. The dynamic code's `svg` is rendered locally from its short link, so both look identical. Pass `design` (Hovercode frames, captions, patterns) or `template` to get Hovercode's own rendering instead.

**Customers who each manage their own codes** (a CRM, client portal, multi-tenant app, or a QR generator product): give each of the app's customers a Hovercode workspace. Workspaces isolate codes, folders, analytics and scan webhooks, and every API call is scoped to one. Don't invent your own scoping on top of one shared workspace.

```ts
const ws = await hovercode.workspaces.create({ name: customer.name });   // on customer signup; store ws.id
const code = await createQR(url, { dynamic: true, client: new Hovercode({ workspace: customer.hovercodeWorkspace }) });
const page = await hovercode.codes.list({ include: ['scans'] }, customer.hovercodeWorkspace);
```

The app's server holds the token and checks that the signed-in customer owns the workspace before every call; the customers never need a Hovercode login. Multiple workspaces need the Business Plus plan, which includes up to 10 (`workspaces.create` returns 403 at the limit). If the user expects more than about 10 customers, tell them to contact Hovercode (https://hovercode.com/contact/) for higher limits before building on this pattern. Full guide: https://hovercode.com/api/#build-qr-codes-into-your-product (markdown: https://hovercode.com/api/markdown/).

**React:** `import { QRCode } from 'hovercode/react'`, then `<QRCode value={...} dotStyle="circle" />`. It renders locally and works with SSR. For a dynamic code, store `code.shortlinkUrl` on the server and pass that as `value`: it looks identical and keeps the token off the client.

Building it well:
- **Create once and persist.** Each `dynamic: true` call creates a new code that counts toward the plan. Store `code.id` and `code.shortlinkUrl` (or `code.svg`) on the record, reuse it, and call `codes.update(id, { qr_data })` when the destination changes. Never create one per page view.
- **Logos:** for `toDataURL` shown via `<img>`, use a `data:` URI logo, because browsers don't load external images inside an SVG used as an image. Inline SVG can use any URL. Hovercode only receives the logo when it is an absolute `https://` URL.
- **Print files:** `await hovercode.codes.download(id)` returns a high-res `png_url` and `svg_url`.
- `new Hovercode()` is safe at module scope: credentials are checked on the first call. Missing credentials throw `HovercodeError` with `code: 'missing_credentials'` and `status: 0`, with no request sent. Treat that as a configuration error, not an upstream failure.
- `createQR` is async in both modes. `toSVG` and `toDataURL` are sync.

Scan webhooks (Business Plus; enable in workspace API settings). Verify against the **raw** body:

```ts
import { parseWebhook } from 'hovercode';

export async function POST(req: Request) {
  const scan = await parseWebhook(await req.text(), req.headers.get('x-signature'), process.env.HOVERCODE_WEBHOOK_SECRET!);
  // scan.qr_code_id, scan.time_utc, scan.location, scan.device
  return new Response('ok');
}
```

Errors throw `HovercodeError` (`status`, `code`, `body`). 429s are retried automatically using `Retry-After`. Rate limits: 120 reads and 60 writes per minute per token.

## Other languages and chat clients

- Any language: plain HTTPS with `Authorization: Token <token>`. Full reference: https://hovercode.com/api/ (OpenAPI: https://hovercode.com/openapi.json).
  ```bash
  curl -X POST https://hovercode.com/api/v2/hovercode/create/ \
    -H "Authorization: Token $HOVERCODE_API_TOKEN" -H "Content-Type: application/json" \
    -d '{"workspace":"'"$HOVERCODE_WORKSPACE_ID"'","qr_data":"https://example.com","dynamic":true}'
  ```
- Chat clients (Claude, ChatGPT, Cursor): the hosted MCP server at `https://hovercode.com/mcp/` (OAuth, no token to copy).

## Gotchas

- Dynamic codes count toward the plan's dynamic-code limit; PDF codes, published forms and landing pages do too.
- `codes update --url` works for Link codes. A static code can't be retargeted: create a dynamic one.
- Big logos hurt scanning: the library caps logo size at 30% and switches to high error correction automatically.
- Give dark-on-light contrast. Light codes on dark backgrounds don't scan on many phones.
