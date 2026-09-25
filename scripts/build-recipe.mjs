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
import { IMMUTABLE_SITE_FILE } from './v4/ledger.mjs';

/** @param {Uint8Array} bytes */
export const sri = bytes => 'sha384-' + createHash('sha384').update(bytes).digest('base64');
/** @param {Uint8Array} bytes */
export const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');

const common = { bundle: true, target: 'es2022', minify: false, sourcemap: true };
// The bind-weight research hook (typeset.ts bindWeights) is compiled out of
// every artifact; bind-harness.mjs builds its own research loader. Development
// checks (src/lib/v4/validate.ts) and the React adapter's development warnings
// run when process.env.NODE_ENV is not "production". The module builds leave
// the expression for the consumer's bundler (esbuild would otherwise bake in
// its own default); the script-tag builds, which no bundler sees, keep the
// checks. A source that mentions none of these names builds unchanged.
const moduleEnv = { __TYPESET_BIND_OVERRIDE__: 'undefined', 'process.env.NODE_ENV': 'process.env.NODE_ENV' };
const scriptEnv = { __TYPESET_BIND_OVERRIDE__: 'undefined', 'process.env.NODE_ENV': '"development"' };

/**
 * Files the package's exports map names, so the recipe builds exactly what
 * the package at `root` ships: 4.2.0's package.json has no react.cjs, .d.cts
 * or global.d.ts, and a dry run at that tag still reproduces its bytes.
 * @param {string} root
 */
async function exported(root) {
  try { return JSON.stringify(JSON.parse(await readFile(join(root, 'packages/typeset-v4/package.json'), 'utf8')).exports ?? {}); }
  catch { return '{}'; }
}

/**
 * How a release line is built. A release is cut with the recipe for its
 * version, so a dry run at an older tag (release-cut --root) still
 * reproduces that tag's published bytes; candidates always use the current
 * recipe.
 *
 * 4.2: unminified ESM and CJS, minified browser IIFEs, and every file has a
 *      source map that embeds all engine sources (73% of the 2.57 MB
 *      unpacked package).
 * 4.3: ESM and CJS stay unminified, readable and mapless: consumers' bundlers
 *      minify them, and stack traces already name real functions. (Minified
 *      modules would need maps; maps that embed sources are 1.3 MB, and maps
 *      without sources make webpack's source-map-loader warn once per missing
 *      file.) typeset.global.js and go.js keep maps without embedded sources,
 *      for stack traces; third-party license comments are kept at the end of
 *      every bundle. dist/auto.js is the automatic website loader, the same
 *      bytes as typeset.us/go@<v>.js, so npm, jsDelivr and typeset.us serve
 *      one file with one SRI hash.
 * @typedef {{ line: string, moduleMaps: boolean, iifeSourcesContent: boolean, autoLoader: boolean, archivedFiles: string[] }} Recipe
 */
/** @type {Record<string, Recipe>} */
export const RECIPES = {
  '4.2': {
    line: '4.2', moduleMaps: true, iifeSourcesContent: true, autoLoader: false,
    archivedFiles: ['README.md', 'MIGRATION.md', 'SUPPORT.md', 'for-agents.md', 'capabilities.json', 'LICENSE', 'THIRD-PARTY-LICENSES.txt', 'UNICODE-LICENSE.txt'],
  },
  '4.3': {
    line: '4.3', moduleMaps: false, iifeSourcesContent: false, autoLoader: true,
    archivedFiles: ['README.md', 'MIGRATION.md', 'SUPPORT.md', 'SECURITY.md', 'OUTCOMES.md', 'for-agents.md', 'capabilities.json', 'LICENSE', 'THIRD-PARTY-LICENSES.txt', 'UNICODE-LICENSE.txt', 'before-after.png'],
  },
};
export const CURRENT_RECIPE = RECIPES['4.3'];

/**
 * The recipe a version was (or will be) cut with.
 * @param {string} version
 */
export function recipeFor(version) {
  const [major, minor] = version.split('-')[0].split('.').map(Number);
  return major === 4 && minor <= 2 ? RECIPES['4.2'] : CURRENT_RECIPE;
}

/**
 * The npm package's dist/: ESM with a shared chunk, CJS, and the IIFEs.
 * `distDir` must sit three directories below `root` (packages/typeset-v4/dist
 * or output/candidate/dist) so source-map paths match the published maps.
 * @param {{ root: string, distDir: string, version: string, plugins?: import('esbuild').Plugin[], recipe?: Recipe }} options
 */
export async function buildPackageDist({ root, distDir, version, plugins = [], recipe = CURRENT_RECIPE }) {
  const base = { ...common, absWorkingDir: root, plugins, logLevel: /** @type {const} */ ('warning'), ...(recipe.line === '4.2' ? {} : { legalComments: /** @type {const} */ ('eof') }) };
  const modules = { ...base, sourcemap: recipe.moduleMaps, define: moduleEnv };
  const iife = { ...base, format: /** @type {const} */ ('iife'), minify: true, sourcesContent: recipe.iifeSourcesContent, define: scriptEnv };
  await build({ ...modules, entryPoints: { index: 'src/lib/v4/typeset.release.ts', react: 'src/lib/v4/typeset.release.react.tsx' }, format: 'esm', splitting: true, external: ['react', 'react-dom'], outdir: distDir, chunkNames: 'shared-[hash]' });
  await build({ ...modules, entryPoints: ['src/lib/v4/typeset.release.ts'], format: 'cjs', outfile: `${distDir}/index.cjs` });
  // CommonJS React entry for require() and Jest. It bundles its own engine
  // copy, as index.cjs does; an app should load one format, not both.
  if ((await exported(root)).includes('react.cjs')) {
    await build({ ...modules, entryPoints: ['src/lib/v4/typeset.release.react.tsx'], format: 'cjs', external: ['react', 'react-dom'], outfile: `${distDir}/react.cjs` });
  }
  await build({ ...iife, entryPoints: ['src/lib/v4/typeset.release.standalone.ts'], outfile: `${distDir}/typeset.global.js` });
  await build({ ...iife, entryPoints: ['src/lib/v4/typeset.go.ts'], outfile: `${distDir}/go.js` });
  if (recipe.autoLoader) await build({ ...iife, ...autoLoader(version), outfile: `${distDir}/auto.js` });
  await copyFile(join(root, 'src/lib/v4/typeset-lists.css'), join(root, distDir, 'styles.css'));
}

/**
 * The automatic website loader: every prose block, with English quotes and
 * optical hanging. No source map, so the file is identical wherever it is
 * served.
 * @param {string} version
 */
function autoLoader(version) {
  return { entryPoints: ['src/lib/v4/typeset.website-go.ts'], sourcemap: false, banner: { js: `/* typeset.us ${version}; automatic website loader. MIT. https://typeset.us */` } };
}

/**
 * TypeScript declarations for the public entry points, with relative imports
 * rewritten to explicit .js specifiers, written into dist/.
 * @param {{ root: string, distDir: string, declarationDir: string, tsc?: string }} options
 */
export async function emitDeclarations({ root, distDir, declarationDir, tsc = join(root, 'node_modules/.bin/tsc') }) {
  await rm(join(root, declarationDir), { recursive: true, force: true });
  execFileSync(tsc, ['src/lib/v4/typeset.release.ts', 'src/lib/v4/typeset.release.react.tsx', '--declaration', '--emitDeclarationOnly', '--outDir', declarationDir, '--target', 'es2022', '--moduleResolution', 'bundler', '--module', 'esnext', '--lib', 'es2022,dom,dom.iterable', '--skipLibCheck', '--strict', '--jsx', 'react-jsx'], { cwd: root, stdio: 'inherit' });
  const exports = await exported(root);
  for (const file of await readdir(join(root, declarationDir))) {
    if (!file.endsWith('.d.ts')) continue;
    let text = await readFile(join(root, declarationDir, file), 'utf8');
    text = text.replace(/(from\s+['"])(\.\.?\/[^'"]+)(['"])/g, (m, a, b, c) => a + (b.endsWith('.js') ? b : b + '.js') + c);
    await writeFile(join(root, distDir, file), text);
    // CommonJS twins: under "require" TypeScript reads .d.cts as CommonJS, so
    // CJS consumers are not told the package is ESM-only (FalseESM).
    if (exports.includes('.d.cts')) await writeFile(join(root, distDir, file.replace(/\.d\.ts$/, '.d.cts')), text.replace(/(from\s+['"]\.\.?\/[^'"]+)\.js(['"])/g, '$1.cjs$2'));
  }
  // Globals set by the script-tag builds (./global and ./go).
  if (exports.includes('global.d.ts')) {
    await writeFile(join(root, distDir, 'global.d.ts'), `import type * as Typeset from './typeset.release.js';
declare global {
  interface Window {
    /** The API, set by typeset.us/global (dist/typeset.global.js) and typeset.us/go (dist/go.js). */
    Typeset: typeof Typeset;
  }
}
export {};
`);
    await writeFile(join(root, distDir, 'go.d.ts'), `import type { Controller } from './typeset.release.js';
import './global.js';
declare global {
  interface Window {
    /** Set by typeset.us/go: resolves with the page's controller once it has mounted. */
    TypesetReady: Promise<Controller>;
  }
}
export {};
`);
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
 * output/candidate/site for a candidate. From 4.3 the loader is dist/auto.js.
 * @param {{ root: string, distDir: string, siteDir: string, version: string, plugins?: import('esbuild').Plugin[], recipe?: Recipe }} options
 */
export async function buildSite({ root, distDir, siteDir, version, plugins = [], recipe = CURRENT_RECIPE }) {
  const base = { ...common, absWorkingDir: root, plugins, sourcemap: false, logLevel: /** @type {const} */ ('warning') };
  await mkdir(join(root, siteDir), { recursive: true });
  if (recipe.autoLoader) await copyFile(join(root, distDir, 'auto.js'), join(root, siteDir, 'go.js'));
  else await build({ ...base, define: scriptEnv, entryPoints: ['src/lib/v4/typeset.website-go.ts'], format: 'iife', minify: true, outfile: `${siteDir}/go.js`, banner: { js: `/* typeset.us ${version}; automatic website loader. MIT. https://typeset.us */` } });
  await copyFile(join(root, distDir, 'typeset.global.js'), join(root, siteDir, 'typeset.min.js'));
  await copyFile(join(root, distDir, 'typeset.global.js.map'), join(root, siteDir, 'typeset.global.js.map'));
  await build({ ...base, define: scriptEnv, entryPoints: ['src/lib/v4/typeset.release.ts'], format: 'esm', minify: true, outfile: `${siteDir}/typeset.esm.js` });
  await copyFile(join(root, distDir, 'styles.css'), join(root, siteDir, 'typeset.css'));
}

/** Files copied from the package directory into public/releases/<v>/ beside dist/ (the current recipe's list). */
export const ARCHIVED_PACKAGE_FILES = CURRENT_RECIPE.archivedFiles;

/**
 * Generated package files that are copies of repository sources. From 4.3 the
 * package also carries the repository's SECURITY.md.
 * @param {{ root: string, packageDir: string, recipe?: Recipe }} options
 */
export async function copyPackageFiles({ root, packageDir, recipe = CURRENT_RECIPE }) {
  await copyFile(join(root, 'LICENSE'), join(root, packageDir, 'LICENSE'));
  if (recipe.line !== '4.2') await copyFile(join(root, 'SECURITY.md'), join(root, packageDir, 'SECURITY.md'));
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

/**
 * The major line the unversioned website aliases (go.js, typeset.min.js,
 * typeset.esm.js, typeset.css) follow. A 5.0 cut writes go@5.js and its own
 * pins but never moves these, so no site on go.js is restyled by a major.
 */
export const EVERGREEN_MAJOR = 4;

/**
 * public/sri.json: integrity hashes for immutable paths only
 * (IMMUTABLE_SITE_FILE), loaders first, each in version order.
 * @param {{ root: string, version: string, go: Uint8Array, advisories?: unknown[] }} options
 */
export async function sriIndex({ root, version, go, advisories }) {
  const names = (await readdir(join(root, 'public'))).filter(f => IMMUTABLE_SITE_FILE.test(f));
  const key = (/** @type {string} */ name) => { const match = /^(go|typeset)@(\d+\.\d+\.\d+)\.(?:(min|esm)\.)?js$/.exec(name); return /** @type {RegExpExecArray} */ (match); };
  names.sort((a, b) => {
    const x = key(a), y = key(b);
    if (x[1] !== y[1]) return x[1] === 'go' ? -1 : 1;
    return compareVersions(x[2], y[2]) || String(x[3] ?? '').localeCompare(String(y[3] ?? ''));
  });
  /** @type {Record<string, string>} */
  const files = {};
  for (const name of names) files[name] = sri(await readFile(join(root, 'public', name)));
  return {
    version,
    note: 'Integrity hashes for immutable files only. go.js, go@<major>.js, typeset.min.js and typeset.esm.js change with each release and have none; pin a versioned file instead.',
    files,
    snippet: `<script src="https://typeset.us/go@${version}.js" integrity="${sri(go)}" crossorigin="anonymous" defer></script>`,
    ...(advisories ? { advisories } : {}),
  };
}

/**
 * The versioned website copy of typeset.global.js. Its source map comment
 * points at the release archive, whose map never changes.
 * @param {Uint8Array} bytes typeset.min.js as built
 * @param {string} version
 */
export function pinnedGlobal(bytes, version) {
  const text = Buffer.from(bytes).toString('utf8');
  const comment = '//# sourceMappingURL=typeset.global.js.map';
  if (!text.includes(comment)) return Buffer.from(bytes);
  return Buffer.from(text.replace(comment, `//# sourceMappingURL=/releases/${version}/typeset.global.js.map`), 'utf8');
}
