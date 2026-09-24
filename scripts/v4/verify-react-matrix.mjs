// @ts-check
// Installs the staged package beside real React and Playwright versions, the
// way an application does, and runs it. Needs the npm registry, so it runs in
// CI and nightly rather than in test:v4.
//
//   node scripts/v4/verify-react-matrix.mjs [--react 18.3.1,19.1] [--skip-browsers]
//   node scripts/v4/verify-react-matrix.mjs --tarball public/releases/4.2.0/typeset.us-4.2.0.tgz
//     (negative control: 4.2.0's peers fail the install checks)
//
// For each React line (18.2, 18.3, 19.0, 19.1, 19.2 and latest) an app with caret
// ranges and a lockfile at that version installs the packed tarball: npm must
// not report ERESOLVE and must leave react and react-dom where they were.
// Then renderToString of both adapters must log nothing, and the server markup
// must hydrate and compose in Chromium, WebKit and Firefox with no console
// errors. Separately, apps that already pin playwright@1.49.1 or use
// @playwright/test install the package without ERESOLVE or a changed
// Playwright, and a strict TypeScript consumer (skipLibCheck false) compiles
// against @types/react 18.3, 19.0 and latest.
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { build } from 'esbuild';
import { browsers } from './browsers.mjs';
import { artifacts } from './candidate.mjs';
import { stagePackage } from './stage-package.mjs';

const { values } = parseArgs({ options: { react: { type: 'string' }, 'skip-browsers': { type: 'boolean', default: false }, keep: { type: 'boolean', default: false }, tarball: { type: 'string' } } });
const npmCache = process.env.npm_config_cache || resolve('output/npm-cache');
/** @type {{ label: string, pass: boolean, browser?: string, detail?: unknown }[]} */
const checks = [];
/** @type {string[]} */
const errors = [];
/** @param {string} label @param {unknown} pass @param {unknown} [detail] @param {string} [browser] */
const check = (label, pass, detail, browser) => { checks.push({ label, pass: !!pass, ...(browser ? { browser } : {}), ...(pass ? {} : { detail }) }); };

/** @param {string[]} args @param {string} cwd */
function npm(args, cwd) {
  const run = spawnSync('npm', [...args, '--cache', npmCache, '--no-audit', '--no-fund', '--ignore-scripts'], { cwd, encoding: 'utf8', timeout: 240000 });
  return { code: run.status, out: (run.stdout || '') + (run.stderr || '') };
}
/** @param {string} spec */
function view(spec) {
  const run = spawnSync('npm', ['view', spec, 'version', '--json', '--cache', npmCache], { encoding: 'utf8', timeout: 60000 });
  const parsed = JSON.parse(run.stdout || 'null');
  return Array.isArray(parsed) ? parsed.at(-1) : parsed;
}
/** @param {string} dir @param {string} name */
async function installedVersion(dir, name) {
  try { return JSON.parse(await readFile(join(dir, 'node_modules', name, 'package.json'), 'utf8')).version; } catch { return null; }
}

const lines = (values.react?.split(',') ?? ['18.2', '18.3', '19.0', '19.1', '19.2', 'latest']);
const reactVersions = lines.map(line => line === 'latest' ? view('react@latest') : /^\d+\.\d+\.\d+$/.test(line) ? line : view(`react@~${line}.0`));
const staged = values.tarball ? { dir: '', version: 'tarball', tarball: resolve(values.tarball) } : await stagePackage({ out: `output/react-matrix-${process.pid}` });
const tarball = /** @type {string} */ (staged.tarball);
const work = await mkdtemp(join(tmpdir(), 'typeset-react-matrix-'));
const report = { version: staged.version, dist: artifacts.dist, tarball, react: reactVersions, work, browsers: /** @type {Record<string, string>} */ ({}), checks, errors };

const SSR = `
import { createElement as h } from 'react';
import { renderToString } from 'react-dom/server';
import { TypesetText, TypesetRichText } from 'typeset.us/react';
const logged = [];
for (const level of ['error', 'warn']) console[level] = (...args) => logged.push(level + ': ' + args.join(' ').slice(0, 300));
const html = renderToString(h('main', null,
  h(TypesetText, { id: 'plain', as: 'p', lang: 'en', text: 'The neighborhood gallery keeps its doors open late on Thursdays, when the letters and the maps come out of their drawers for anyone who asks.' }),
  h(TypesetRichText, { id: 'rich', lang: 'en', smartQuotes: 'en' }, '"Read ', h('strong', null, 'the notes'), ' at ', h('a', { href: '#gallery' }, 'the neighborhood gallery'), '," she said, before the room filled with people who had come to look closely at the letters.')));
process.stdout.write(JSON.stringify({ html, logged }));
`;
const CLIENT = `
import { createElement as h } from 'react';
import { hydrateRoot } from 'react-dom/client';
import { TypesetText, TypesetRichText } from 'typeset.us/react';
window.__hydrate = () => hydrateRoot(document.getElementById('root'), h('main', null,
  h(TypesetText, { id: 'plain', as: 'p', lang: 'en', text: 'The neighborhood gallery keeps its doors open late on Thursdays, when the letters and the maps come out of their drawers for anyone who asks.' }),
  h(TypesetRichText, { id: 'rich', lang: 'en', smartQuotes: 'en' }, '"Read ', h('strong', null, 'the notes'), ' at ', h('a', { href: '#gallery' }, 'the neighborhood gallery'), '," she said, before the room filled with people who had come to look closely at the letters.')));
`;
const CONSUMER_TS = `
import { TypesetText, TypesetRichText } from 'typeset.us/react';
import type { TypesetTextProps } from 'typeset.us/react';
import { mount, auditJSON } from 'typeset.us';
const props: TypesetTextProps = { text: 'A title', as: 'h2', mode: 'title' };
export const a = <TypesetText {...props} />;
export const b = <TypesetRichText lang="en" smartQuotes="en" opticalHanging>Read <a href="/notes"><strong>the notes</strong></a>.</TypesetRichText>;
export const c = mount(document, 'p').ready.then(() => auditJSON('p').pass);
`;

try {
  /** @type {{ version: string, html: string, bundle: string }[]} */
  const apps = [];
  for (const version of reactVersions) {
    const dir = join(work, `react-${version}`);
    await mkdir(dir, { recursive: true });
    await writeFile(join(dir, 'package.json'), JSON.stringify({ name: `react-${version.replace(/\W/g, '-')}-app`, private: true, type: 'module' }));
    // npm saves caret ranges and locks this version, as `npm install react` did in the app.
    const base = npm(['install', '--save', '--save-prefix', '^', `react@${version}`, `react-dom@${version}`], dir);
    if (base.code !== 0) { check(`React ${version}: app installs`, false, base.out.slice(-600)); continue; }
    const add = npm(['install', tarball], dir);
    check(`React ${version}: npm install of the package succeeds without ERESOLVE`, add.code === 0 && !/ERESOLVE/.test(add.out), add.out.slice(-800));
    const react = await installedVersion(dir, 'react'), reactDom = await installedVersion(dir, 'react-dom');
    check(`React ${version}: react and react-dom stay at ${version}`, react === version && reactDom === version, { react, reactDom, npm: add.out.slice(-400) });
    const ls = npm(['ls', '--all'], dir);
    check(`React ${version}: npm ls reports no invalid or unmet peers`, ls.code === 0 && !/UNMET|invalid/.test(ls.out), ls.out.slice(-600));
    if (add.code !== 0) continue;
    await writeFile(join(dir, 'ssr.mjs'), SSR);
    const ssr = spawnSync(process.execPath, ['ssr.mjs'], { cwd: dir, encoding: 'utf8', timeout: 60000 });
    let rendered = { html: '', logged: /** @type {string[]} */ ([]) };
    try { rendered = JSON.parse(ssr.stdout); } catch { rendered.logged.push(ssr.stderr.slice(0, 600)); }
    check(`React ${version}: renderToString of TypesetText and TypesetRichText`, ssr.status === 0 && rendered.html.includes('data-typeset-react') && rendered.html.includes('data-typeset-react-rich') && rendered.html.includes('“Read '), { status: ssr.status, stderr: ssr.stderr.slice(0, 400) });
    check(`React ${version}: server render logs no warnings (no useLayoutEffect warning)`, rendered.logged.length === 0, rendered.logged);
    await writeFile(join(dir, 'client.mjs'), CLIENT);
    const bundled = await build({ entryPoints: [join(dir, 'client.mjs')], absWorkingDir: dir, bundle: true, format: 'iife', write: false, minify: false, logLevel: 'silent', define: { 'process.env.NODE_ENV': '"development"' } });
    apps.push({ version, html: rendered.html, bundle: bundled.outputFiles[0].text });
  }

  if (!values['skip-browsers']) {
    for (const { name, engine, executablePath } of browsers) {
      const browser = await engine.launch({ executablePath, timeout: 20000 });
      report.browsers[name] = browser.version();
      try {
        for (const app of apps) {
          const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
          page.setDefaultTimeout(20000);
          /** @type {string[]} */
          const logged = [];
          page.on('pageerror', error => logged.push('pageerror: ' + error.message));
          page.on('console', message => { if (message.type() === 'error' || message.type() === 'warning') logged.push(message.type() + ': ' + message.text().slice(0, 300)); });
          try {
            await page.setContent(`<!doctype html><html lang="en"><head><style>body{margin:16px;font:18px/1.45 Georgia}main{width:300px}</style></head><body><div id="root">${app.html}</div></body></html>`);
            await page.addScriptTag({ content: app.bundle });
            await page.evaluate(() => /** @type {any} */ (window).__hydrate());
            await page.waitForSelector('#rich[data-typeset-done]');
            await page.waitForFunction(() => !!document.querySelector('#plain')?.getAttribute('data-ts-outcome'));
            await page.waitForTimeout(200);
            const state = await page.evaluate(() => ({
              plain: document.querySelector('#plain')?.getAttribute('data-ts-outcome'),
              rich: document.querySelector('#rich')?.getAttribute('data-ts-outcome'),
              text: document.querySelector('#rich')?.textContent,
              link: document.querySelectorAll('#rich a').length,
            }));
            check(`React ${app.version}: hydrates and composes both adapters`, /^composed/.test(String(state.plain)) && /^composed/.test(String(state.rich)) && state.link === 1 && String(state.text).startsWith('“Read '), state, name);
            check(`React ${app.version}: no hydration errors or warnings`, logged.length === 0, logged, name);
          } catch (error) {
            check(`React ${app.version}: hydrates and composes both adapters`, false, String(/** @type {Error} */ (error).message).slice(0, 400), name);
          } finally { await page.close(); }
        }
      } finally { await browser.close(); }
    }
  }

  // Playwright already in the app: installing typeset.us must not touch it.
  for (const [label, spec, name] of [['playwright@1.49.1 pinned exactly', 'playwright@1.49.1', 'playwright'], ['@playwright/test (latest)', '@playwright/test@latest', '@playwright/test']]) {
    const dir = join(work, 'pw-' + name.replace(/\W/g, '-'));
    await mkdir(dir, { recursive: true });
    await writeFile(join(dir, 'package.json'), JSON.stringify({ name: 'pw-app', private: true }));
    const base = npm(['install', '--save-dev', '--save-exact', spec], dir);
    const before = await installedVersion(dir, name), beforeCore = await installedVersion(dir, 'playwright-core');
    const add = npm(['install', tarball], dir);
    const after = await installedVersion(dir, name), afterCore = await installedVersion(dir, 'playwright-core');
    check(`beside ${label}: npm install succeeds without ERESOLVE`, base.code === 0 && add.code === 0 && !/ERESOLVE/.test(add.out), add.out.slice(-600));
    check(`beside ${label}: Playwright is not upgraded or replaced`, before && before === after && beforeCore === afterCore, { before, after, beforeCore, afterCore });
    const ls = npm(['ls', '--all'], dir);
    // An app without React sees npm's informational 'UNMET OPTIONAL DEPENDENCY react'; it exits 0.
    check(`beside ${label}: npm ls exits 0 with no Playwright peer listed`, ls.code === 0 && !/UNMET.*playwright|invalid/.test(ls.out), ls.out.slice(-500));
  }

  // Type-checking with the consumer's own @types/react, skipLibCheck off.
  for (const [types, react] of [['18.3', '18.3.1'], ['19.0', view('react@~19.0.0')], ['latest', view('react@latest')]]) {
    const typesVersion = types === 'latest' ? view('@types/react@latest') : view(`@types/react@~${types}.0`);
    const domTypes = types === 'latest' ? view('@types/react-dom@latest') : view(`@types/react-dom@~${types}.0`);
    const dir = join(work, `types-${types}`);
    await mkdir(dir, { recursive: true });
    await writeFile(join(dir, 'package.json'), JSON.stringify({ name: 'types-app', private: true, type: 'module' }));
    const add = npm(['install', '--save-exact', `react@${react}`, `react-dom@${react}`, `@types/react@${typesVersion}`, `@types/react-dom@${domTypes}`, 'typescript@5.9.3', tarball], dir);
    if (add.code !== 0) { check(`@types/react ${typesVersion}: installs`, false, add.out.slice(-600)); continue; }
    await writeFile(join(dir, 'consumer.tsx'), CONSUMER_TS);
    const tsc = spawnSync(process.execPath, ['node_modules/typescript/bin/tsc', '--noEmit', '--strict', '--skipLibCheck', 'false', '--target', 'es2022', '--module', 'esnext', '--moduleResolution', 'bundler', '--jsx', 'react-jsx', '--lib', 'es2022,dom,dom.iterable', 'consumer.tsx'], { cwd: dir, encoding: 'utf8', timeout: 120000 });
    check(`@types/react ${typesVersion}: strict consumer compiles with skipLibCheck false`, tsc.status === 0, (tsc.stdout + tsc.stderr).slice(0, 1200));
  }
} catch (error) {
  errors.push(String(/** @type {Error} */ (error).stack || error));
} finally {
  if (!values.keep) await rm(work, { recursive: true, force: true });
  if (staged.dir) {
    await rm(staged.dir, { recursive: true, force: true });
    await rm(staged.dir + '-pack', { recursive: true, force: true });
  }
}
await mkdir('output', { recursive: true });
await writeFile(values.tarball ? 'output/react-matrix-tarball.json' : 'output/react-matrix.json', JSON.stringify(report, null, 2));
const failures = checks.filter(c => !c.pass);
console.log(JSON.stringify({ react: reactVersions, checks: checks.length, failures, errors }, null, 2));
if (failures.length || errors.length) process.exitCode = 1;
