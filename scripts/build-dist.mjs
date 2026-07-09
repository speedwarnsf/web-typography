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
import { readFile, copyFile } from 'node:fs/promises';
import { execSync } from 'node:child_process';

// One version, owned by the npm package manifest.
const pkg = JSON.parse(await readFile('packages/typeset.us/package.json', 'utf8'));
const V = pkg.version;

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
    js: `/* typeset.us go.js v${V} — generated from src/lib/typeset.ts by scripts/build-dist.mjs; do not edit by hand. https://typeset.us */`,
  },
});

await build({
  ...common,
  entryPoints: ['src/lib/typeset.standalone.ts'],
  outfile: 'public/typeset.min.js',
  banner: {
    js: `/* typeset.us typeset.min.js v${V} — window.Typeset library; generated from src/lib/typeset.ts by scripts/build-dist.mjs; do not edit by hand. https://typeset.us */`,
  },
});

// Framework-agnostic ESM core for bundler consumers (import ... from).
// Built from typeset.core.ts, the live-API entry — the quarantined legacy
// passes in typeset.ts never reach this bundle.
await build({
  ...common,
  format: 'esm',
  entryPoints: ['src/lib/typeset.core.ts'],
  outfile: 'public/typeset.esm.js',
  banner: {
    js: `/* typeset.us typeset.esm.js v${V} — ESM core; generated from src/lib/typeset.ts by scripts/build-dist.mjs; do not edit by hand. https://typeset.us */`,
  },
});

// ── npm package artifacts (packages/typeset.us) ──
const pkgBanner = `/* typeset.us v${V} — MIT © Dustin York. https://typeset.us */`;

await build({
  ...common,
  minify: false, // package consumers minify in their own bundlers
  format: 'esm',
  entryPoints: ['src/lib/typeset.core.ts'],
  outfile: 'packages/typeset.us/dist/index.js',
  banner: { js: pkgBanner },
});

await build({
  ...common,
  minify: false,
  format: 'cjs',
  entryPoints: ['src/lib/typeset.core.ts'],
  outfile: 'packages/typeset.us/dist/index.cjs',
  banner: { js: pkgBanner },
});

await build({
  ...common,
  entryPoints: ['src/lib/typeset.standalone.ts'],
  outfile: 'packages/typeset.us/dist/typeset.global.js',
  banner: { js: pkgBanner },
});

// Type declarations for the live API (emits typeset.core.d.ts + typeset.d.ts).
execSync(
  'npx tsc src/lib/typeset.core.ts --declaration --emitDeclarationOnly ' +
    '--outDir packages/typeset.us/dist --target es2019 --moduleResolution bundler --module esnext --lib es2019,dom --skipLibCheck',
  { stdio: 'inherit' },
);

await copyFile('LICENSE', 'packages/typeset.us/LICENSE');
console.log(`\npackage artifacts built: packages/typeset.us v${V}`);
