// @ts-check
// Test-only React 18.3.1, jsdom and happy-dom for the React suites. The
// repository runs React 19.2.3, and npm cannot install a second react-dom
// beside it (react-dom 18's peer dependency resolves to the root react), so
// these have their own lockfile in tests/react-env and are installed into
// output/react-env on first use. Nothing here ships.
import { spawnSync } from 'node:child_process';
import { copyFile, mkdir, readFile } from 'node:fs/promises';
import { readFileSync } from 'node:fs';
import { resolve, join } from 'node:path';

export const REACT_ENV = resolve('output/react-env');

/** Install the fixture once and return where its packages are. */
export async function ensureReactEnv() {
  const want = /** @type {Record<string, string>} */ (JSON.parse(await readFile('tests/react-env/package.json', 'utf8')).dependencies);
  const modules = join(REACT_ENV, 'node_modules');
  const installed = Object.entries(want).every(([name, version]) => {
    try { return JSON.parse(readFileSync(join(modules, name, 'package.json'), 'utf8')).version === version; } catch { return false; }
  });
  if (!installed) {
    await mkdir(REACT_ENV, { recursive: true });
    for (const file of ['package.json', 'package-lock.json']) await copyFile(join('tests/react-env', file), join(REACT_ENV, file));
    const cache = process.env.npm_config_cache || resolve('output/npm-cache');
    const run = spawnSync('npm', ['ci', '--ignore-scripts', '--no-audit', '--no-fund', '--prefer-offline', '--cache', cache], { cwd: REACT_ENV, encoding: 'utf8', timeout: 240000 });
    if (run.status !== 0) throw new Error('Could not install tests/react-env into output/react-env: ' + (run.stderr || run.stdout).split('\n').slice(-6).join(' '));
  }
  return { modules, react18: join(modules, 'react'), reactDom18: join(modules, 'react-dom'), jsdom: join(modules, 'jsdom'), happyDom: join(modules, 'happy-dom') };
}

/**
 * esbuild plugin: resolve react, react-dom and their subpaths to one React
 * major, including the imports react-dom makes of react.
 * @param {'18' | '19'} major @param {{ react18: string, reactDom18: string }} env
 * @returns {import('esbuild').Plugin}
 */
export function reactMajor(major, env) {
  /** @type {Record<string, string>} */
  const roots = major === '18' ? { react: env.react18, 'react-dom': env.reactDom18 } : { react: resolve('node_modules/react'), 'react-dom': resolve('node_modules/react-dom') };
  return {
    name: 'react-major-' + major,
    setup(build) {
      build.onResolve({ filter: /^react(?:-dom)?(?:\/.*)?$/ }, args => {
        const [, pkg, sub] = /** @type {RegExpMatchArray} */ (args.path.match(/^(react(?:-dom)?)(\/.*)?$/));
        return build.resolve('./' + (sub ? sub.slice(1) : ''), { resolveDir: roots[pkg], kind: args.kind });
      });
    },
  };
}
