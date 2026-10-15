import { readFileSync } from 'node:fs';
import { defineConfig } from 'tsup';

const { version } = JSON.parse(readFileSync('./package.json', 'utf8'));

export default defineConfig([
  {
    entry: { index: 'src/index.ts', node: 'src/node.ts', react: 'src/react.ts' },
    external: ['react'],
    format: ['esm', 'cjs'],
    dts: true,
    clean: true,
    target: 'es2022',
  },
  {
    entry: { cli: 'src/cli.ts' },
    format: ['esm'],
    target: 'node20',
    banner: { js: '#!/usr/bin/env node' },
    define: { __VERSION__: JSON.stringify(version) },
  },
]);
