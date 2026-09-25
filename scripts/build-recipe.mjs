// @ts-check
// The one build recipe for typeset.us artifacts. build-candidate.mjs (every
// development build and every test run) and release-cut.mjs (the only
// script that writes a release) both call these functions, so a candidate is
// compiled exactly the way a release is. Every path is resolved against
// `root`, which lets release-cut build a staged copy of the tree, and lets a
// dry run at an old tag reproduce that tag's published bytes.
import { build } from 'esbuild';
import { execFileSync } from 'node:child_process';
import { readdir, readFile, writeFile, copyFile, mkdir, rm } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { join } from 'node:path';

/** @param {Uint8Array} bytes */
export const sri = bytes => 'sha384-' + createHash('sha384').update(bytes).digest('base64');
/** @param {Uint8Array} bytes */
export const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');

// The bind-weight research hook (typeset.ts bindWeights) is compiled out of
// every artifact. process.env.NODE_ENV is left for the consumer's bundler
// (esbuild would otherwise bake in "development" or "production"), so the
// React adapter's development warnings follow the application's build. A
// source that mentions neither name builds unchanged.
const common = { bundle: true, target: 'es2022', minify: false, sourcemap: true, define: { __TYPESET_BIND_OVERRIDE__: 'undefined', 'process.env.NODE_ENV': 'process.env.NODE_ENV' } };

/**
 * The npm package's dist/: ESM with a shared chunk, CJS, and the two IIFEs.
 * `distDir` must sit three directories below `root` (packages/typeset-v4/dist
 * or output/candidate/dist) so source-map paths match the published maps.
 * @param {{ root: string, distDir: string, plugins?: import('esbuild').Plugin[] }} options
 */
export async function buildPackageDist({ root, distDir, plugins = [] }) {
  const base = { ...common, absWorkingDir: root, plugins, logLevel: /** @type {const} */ ('warning') };
  await build({ ...base, entryPoints: { index: 'src/lib/v4/typeset.release.ts', react: 'src/lib/v4/typeset.release.react.tsx' }, format: 'esm', splitting: true, external: ['react'], outdir: distDir, chunkNames: 'shared-[hash]' });
  await build({ ...base, entryPoints: ['src/lib/v4/typeset.release.ts'], format: 'cjs', outfile: `${distDir}/index.cjs` });
  await build({ ...base, entryPoints: ['src/lib/v4/typeset.release.standalone.ts'], format: 'iife', minify: true, outfile: `${distDir}/typeset.global.js` });
  await build({ ...base, entryPoints: ['src/lib/v4/typeset.go.ts'], format: 'iife', minify: true, outfile: `${distDir}/go.js` });
  await copyFile(join(root, 'src/lib/v4/typeset-lists.css'), join(root, distDir, 'styles.css'));
}

/**
 * TypeScript declarations for the public entry points, with relative imports
 * rewritten to explicit .js specifiers, written into dist/.
 * @param {{ root: string, distDir: string, declarationDir: string, tsc?: string }} options
 */
export async function emitDeclarations({ root, distDir, declarationDir, tsc = join(root, 'node_modules/.bin/tsc') }) {
  await rm(join(root, declarationDir), { recursive: true, force: true });
  execFileSync(tsc, ['src/lib/v4/typeset.release.ts', 'src/lib/v4/typeset.release.react.tsx', '--declaration', '--emitDeclarationOnly', '--outDir', declarationDir, '--target', 'es2022', '--moduleResolution', 'bundler', '--module', 'esnext', '--lib', 'es2022,dom,dom.iterable', '--skipLibCheck', '--strict', '--jsx', 'react-jsx'], { cwd: root, stdio: 'inherit' });
  for (const file of await readdir(join(root, declarationDir))) {
    if (!file.endsWith('.d.ts')) continue;
    let text = await readFile(join(root, declarationDir, file), 'utf8');
    text = text.replace(/(from\s+['"])(\.\.?\/[^'"]+)(['"])/g, (m, a, b, c) => a + (b.endsWith('.js') ? b : b + '.js') + c);
    await writeFile(join(root, distDir, file), text);
  }
}

/**
 * manifest.json: byte count and SRI for every file in dist/.
 * @param {{ root: string, distDir: string, version: string, extra?: Record<string, unknown> }} options
 */
export async function writeManifest({ root, distDir, version, extra = {} }) {
  /** @type {Record<string, { bytes: number, integrity: string }>} */
  const artifacts = {};
  for (const file of (await readdir(join(root, distDir))).sort()) {
    if (file === 'manifest.json') continue;
    const bytes = await readFile(join(root, distDir, file));
    artifacts[file] = { bytes: bytes.length, integrity: sri(bytes) };
  }
  await writeFile(join(root, distDir, 'manifest.json'), JSON.stringify({ version, ...extra, artifacts }, null, 2) + '\n');
}

/**
 * The website aliases: the automatic loader (go.js), typeset.min.js,
 * typeset.esm.js and typeset.css. `siteDir` is public/ at release time and
 * output/candidate/site for a candidate.
 * @param {{ root: string, distDir: string, siteDir: string, version: string, plugins?: import('esbuild').Plugin[] }} options
 */
export async function buildSite({ root, distDir, siteDir, version, plugins = [] }) {
  const base = { ...common, absWorkingDir: root, plugins, sourcemap: false, logLevel: /** @type {const} */ ('warning') };
  await mkdir(join(root, siteDir), { recursive: true });
  await build({ ...base, entryPoints: ['src/lib/v4/typeset.website-go.ts'], format: 'iife', minify: true, outfile: `${siteDir}/go.js`, banner: { js: `/* typeset.us ${version}; automatic website loader. MIT. https://typeset.us */` } });
  await copyFile(join(root, distDir, 'typeset.global.js'), join(root, siteDir, 'typeset.min.js'));
  await copyFile(join(root, distDir, 'typeset.global.js.map'), join(root, siteDir, 'typeset.global.js.map'));
  await build({ ...base, entryPoints: ['src/lib/v4/typeset.release.ts'], format: 'esm', minify: true, outfile: `${siteDir}/typeset.esm.js` });
  await copyFile(join(root, distDir, 'styles.css'), join(root, siteDir, 'typeset.css'));
}

/** Files copied from the package directory into public/releases/<v>/ beside dist/. */
export const ARCHIVED_PACKAGE_FILES = ['README.md', 'MIGRATION.md', 'SUPPORT.md', 'for-agents.md', 'capabilities.json', 'LICENSE', 'THIRD-PARTY-LICENSES.txt', 'UNICODE-LICENSE.txt'];

/**
 * Generated package files that are copies of repository sources.
 * @param {{ root: string, packageDir: string }} options
 */
export async function copyPackageFiles({ root, packageDir }) {
  await copyFile(join(root, 'LICENSE'), join(root, packageDir, 'LICENSE'));
  for (const file of ['THIRD-PARTY-LICENSES.txt', 'UNICODE-LICENSE.txt']) await copyFile(join(root, 'vendor/unicode', file), join(root, packageDir, file));
  await copyFile(join(root, packageDir, 'for-agents.md'), join(root, packageDir, 'AGENTS.md'));
}

/**
 * Compare two dotted versions (prerelease sorts before its release).
 * @param {string} a @param {string} b
 */
export function compareVersions(a, b) {
  const parse = (/** @type {string} */ v) => { const [core, pre = ''] = v.split('-'); return { parts: core.split('.').map(Number), pre }; };
  const x = parse(a), y = parse(b);
  for (let i = 0; i < 3; i++) if (x.parts[i] !== y.parts[i]) return x.parts[i] - y.parts[i];
  if (x.pre === y.pre) return 0;
  if (!x.pre) return 1;
  if (!y.pre) return -1;
  return x.pre < y.pre ? -1 : 1;
}
