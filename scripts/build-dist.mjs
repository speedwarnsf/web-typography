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

// ── Versioned URL + SRI (the receipts) ──
// typeset.us/go.js stays the evergreen civilian alias; go@<version>.js is
// the pinnable artifact with a published integrity hash, so marketplaces,
// enterprises, and agents can verify exactly what they're running.
const { createHash } = await import('node:crypto');
const { writeFile, readdir, unlink } = await import('node:fs/promises');

const goBytes = await readFile('public/go.js');
await writeFile(`public/go@${V}.js`, goBytes);

// A pinned URL is a PROMISE: someone put go@x.y.z.js and its integrity hash
// into their HTML because we told them to, and it has to keep working.
// This step used to delete every other go@*.js so the repo "carries exactly
// one" — which meant each release 404'd every existing pin. Shipping 3.4.0
// took go@3.3.2.js down and stopped composition on york.systems until the
// pin was chased. Old versions are immutable artifacts now: keep them, hash
// them, never rewrite them.
const sri = (buf) => `sha384-${createHash('sha384').update(buf).digest('base64')}`;
const versioned = (await readdir('public'))
  .filter((f) => /^go@\d+\.\d+\.\d+\.js$/.test(f))
  .sort();
const prior = {};
for (const f of versioned) {
  if (f !== `go@${V}.js`) prior[f] = sri(await readFile(`public/${f}`));
}
void unlink; // retained import; nothing is unlinked here by design

const manifest = {
  version: V,
  files: {
    [`go@${V}.js`]: sri(goBytes),
    'typeset.min.js': sri(await readFile('public/typeset.min.js')),
    'typeset.esm.js': sri(await readFile('public/typeset.esm.js')),
    ...prior,
  },
  snippet: `<script src="https://typeset.us/go@${V}.js" integrity="${sri(goBytes)}" crossorigin="anonymous" defer></script>`,
};
await writeFile('public/sri.json', JSON.stringify(manifest, null, 2) + '\n');

// Substitute version/SRI into agent-facing docs (idempotent: matches both
// the __GO_VERSION__/__GO_SRI__ placeholders and any previously-substituted
// concrete values, so re-running after a version bump re-pins everything).
const substituteInto = async (path) => {
  let text;
  try { text = await readFile(path, 'utf8'); } catch { return; }
  const out = text
    .replaceAll('__GO_VERSION__', V)
    .replaceAll('__GO_SRI__', manifest.files[`go@${V}.js`])
    .replace(/go@\d+\.\d+\.\d+\.js/g, `go@${V}.js`)
    .replace(/sha384-[A-Za-z0-9+/=]+/g, manifest.files[`go@${V}.js`]);
  if (out !== text) await writeFile(path, out);
};
for (const p of ['packages/typeset.us/AGENTS.md', 'SKILL.md', 'public/llms.txt', 'docs/for-agents-copy.md', 'docs/agents-canonical.md']) {
  await substituteInto(p);
}

// /for-agents.md — the canonical doc served raw from the site (agents fetch
// markdown; llms.txt and SKILL.md point here).
try {
  await copyFile('docs/for-agents-copy.md', 'public/for-agents.md');
} catch { /* doc not present in partial builds */ }

console.log(`\npackage artifacts built: packages/typeset.us v${V}`);
console.log(`versioned drop-in: public/go@${V}.js  ${manifest.files[`go@${V}.js`]}`);
