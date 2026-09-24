// @ts-check
// Development build. Compiles the engine from src/ into output/candidate/
// (gitignored) with the release recipe, and nothing else: it never writes
// packages/ or public/, never pins, never packs and never bumps a version.
// Every suite in test:v4 runs against this candidate. Releases are cut only
// by scripts/release-cut.mjs.
//
//   node scripts/build-candidate.mjs              dist/ and site/ (about 1 s)
//   node scripts/build-candidate.mjs --types      also emit .d.ts files
import { readFile, writeFile, rm, mkdir, readdir } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildPackageDist, emitDeclarations, writeManifest, buildSite } from './build-recipe.mjs';

export const CANDIDATE = 'output/candidate';

/** @param {string[]} args */
function git(args) {
  try { return execFileSync('git', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim(); }
  catch { return ''; }
}

/** Hash of every engine source file, so evidence can name exactly what was built. */
async function sourceDigest(root = process.cwd()) {
  const hash = createHash('sha256');
  for (const dir of ['src/lib/v4', 'src/vendor']) {
    for (const file of (await readdir(join(root, dir))).sort()) {
      hash.update(dir + '/' + file + '\0');
      hash.update(await readFile(join(root, dir, file)));
    }
  }
  return hash.digest('hex');
}

/**
 * Build the candidate. Returns the paths suites should load, which
 * verify-release.mjs passes on as TYPESET_* environment variables.
 * @param {{ out?: string, types?: boolean, plugins?: import('esbuild').Plugin[], label?: string }} [options]
 */
export async function buildCandidate({ out = CANDIDATE, types = false, plugins = [], label } = {}) {
  const root = process.cwd();
  const started = performance.now();
  const { version } = JSON.parse(await readFile('packages/typeset-v4/package.json', 'utf8'));
  const distDir = `${out}/dist`, siteDir = `${out}/site`;
  if (distDir.split('/').length !== 3) throw new Error(`The candidate dist must sit three directories deep, like packages/typeset-v4/dist (got ${distDir}).`);
  await rm(out, { recursive: true, force: true });
  await mkdir(distDir, { recursive: true });
  const commit = git(['rev-parse', 'HEAD']);
  const dirty = git(['status', '--porcelain', '--', 'src/lib/v4', 'src/vendor']) !== '';
  const identity = {
    version: `${version}-candidate`,
    base: version,
    commit: commit || null,
    dirty,
    sourceSHA256: await sourceDigest(root),
    ...(label ? { label } : {}),
  };
  await buildPackageDist({ root, distDir, version: identity.version, plugins });
  if (types) await emitDeclarations({ root, distDir, declarationDir: `${out}/declarations` });
  await writeManifest({ root, distDir, version: identity.version, extra: { candidate: true } });
  await buildSite({ root, distDir, siteDir, version: identity.version, plugins });
  await writeFile(`${out}/identity.json`, JSON.stringify(identity, null, 2) + '\n');
  const abs = (/** @type {string} */ p) => resolve(root, p);
  return {
    identity,
    ms: Math.round(performance.now() - started),
    env: {
      TYPESET_CANDIDATE: abs(out),
      TYPESET_DIST: abs(distDir),
      TYPESET_BUNDLE: abs(`${distDir}/typeset.global.js`),
      TYPESET_ESM: abs(`${distDir}/index.js`),
      TYPESET_REACT: abs(`${distDir}/react.js`),
      TYPESET_GO: abs(`${distDir}/go.js`),
      TYPESET_AUTO: abs(`${distDir}/auto.js`),
      TYPESET_STYLES: abs(`${distDir}/styles.css`),
      TYPESET_SITE_GO: abs(`${siteDir}/go.js`),
    },
  };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const result = await buildCandidate({ types: process.argv.includes('--types') });
  const { identity } = result;
  console.log(`Built candidate ${identity.version} from ${identity.commit ? identity.commit.slice(0, 12) : 'an untracked tree'}${identity.dirty ? ' with uncommitted engine changes' : ''} into ${CANDIDATE}/ in ${result.ms} ms. packages/ and public/ are untouched.`);
}
