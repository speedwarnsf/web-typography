/**
 * Build the distributable scripts from the real engine so they can never
 * drift from the site again:
 *
 *   public/go.js          — auto-running drop-in (src/lib/go-entry.ts)
 *   public/typeset.min.js — library exposing window.Typeset (typeset.standalone.ts)
 *
 * Run: npm run build:dist
 */
import { build } from 'esbuild';

const common = {
  bundle: true,
  minify: true,
  format: 'iife',
  target: ['es2019'],
  logLevel: 'info',
};

await build({
  ...common,
  entryPoints: ['src/lib/go-entry.ts'],
  outfile: 'public/go.js',
  banner: {
    js: '/* typeset.us go.js v3.0.0 — generated from src/lib/typeset.ts by scripts/build-dist.mjs; do not edit by hand. https://typeset.us */',
  },
});

await build({
  ...common,
  entryPoints: ['src/lib/typeset.standalone.ts'],
  outfile: 'public/typeset.min.js',
  banner: {
    js: '/* typeset.us typeset.min.js v3.0.0 — window.Typeset library; generated from src/lib/typeset.ts by scripts/build-dist.mjs; do not edit by hand. https://typeset.us */',
  },
});
