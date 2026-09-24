// @ts-check
// Where a suite finds the artifacts under test. verify-release.mjs sets these
// to the candidate built from src (or, for test:release, to the committed
// dist); run directly, a suite falls back to the committed package.
import { resolve } from 'node:path';

const dist = process.env.TYPESET_DIST || 'packages/typeset-v4/dist';
export const artifacts = {
  dist,
  bundle: process.env.TYPESET_BUNDLE || `${dist}/typeset.global.js`,
  esm: process.env.TYPESET_ESM || `${dist}/index.js`,
  react: process.env.TYPESET_REACT || `${dist}/react.js`,
  go: process.env.TYPESET_GO || `${dist}/go.js`,
  auto: process.env.TYPESET_AUTO || `${dist}/auto.js`,
  styles: process.env.TYPESET_STYLES || `${dist}/styles.css`,
  siteGo: process.env.TYPESET_SITE_GO || 'public/go.js',
};

/**
 * esbuild plugin for React fixtures: an import of the source adapter entry
 * (src/lib/v4/typeset.release.react) resolves to the react.js under test when
 * TYPESET_REACT is set, so fixtures exercise the same bytes as every suite.
 * @returns {import('esbuild').Plugin}
 */
export function reactUnderTest() {
  return {
    name: 'typeset-react-under-test',
    setup(build) {
      if (!process.env.TYPESET_REACT) return;
      build.onResolve({ filter: /typeset\.release\.react$/ }, () => ({ path: resolve(/** @type {string} */ (process.env.TYPESET_REACT)) }));
    },
  };
}

/** The VERSION the artifacts under test should report. */
export async function expectedVersion() {
  const { readFile } = await import('node:fs/promises');
  try {
    const manifest = JSON.parse(await readFile(`${dist}/manifest.json`, 'utf8'));
    if (!manifest.candidate) return manifest.version;
  } catch {}
  return JSON.parse(await readFile('packages/typeset-v4/package.json', 'utf8')).version;
}
