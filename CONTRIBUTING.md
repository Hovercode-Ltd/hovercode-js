# Developing hovercode

```bash
npm install
npm test          # unit tests: static codes are rendered and decoded with ZXing/jsQR; the API is mocked
npm run typecheck
npm run build     # dist/ (library, React component and CLI)
```

## Trying changes

```bash
node dist/cli.js qr https://example.com -o /tmp/code.svg     # what `npx hovercode` runs
npm link                                                     # puts a global `hovercode` on your PATH
cd ~/some-app && npm link hovercode                          # import it from another project
```

`npm pack` builds the exact tarball npm would publish; `npm install /path/to/hovercode-0.1.0.tgz` installs it somewhere else as a final check.

The client and CLI read `HOVERCODE_BASE_URL` (default `https://hovercode.com`), so they can point at another API host. Set `XDG_CONFIG_HOME` to a scratch directory to keep a test login separate from your real one.

## The skill and plugin

- **Claude Code plugin** (skill plus the Hovercode MCP server): `claude --plugin-dir /path/to/hovercode-js`, then ask something like "make a QR code for my wifi". `claude plugin validate .` checks the manifests.
- **Skill only:** copy `skills/hovercode` into `~/.claude/skills/` (or a project's `.claude/skills/`).

## Releasing

Bump `version` in `package.json` and `.claude-plugin/plugin.json`, then `npm publish`. `prepublishOnly` runs the typecheck, tests and build first.
