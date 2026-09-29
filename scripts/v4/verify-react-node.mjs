// @ts-check
// The React adapters outside a browser.
//
//   node scripts/v4/verify-react-node.mjs
//
// TypeScript contract: tests/react/types.tsx, a consumer of typeset.us/react,
// compiles against the candidate's declarations with @types/react 18.3 and
// 19.2 and skipLibCheck off (as="div"/"li"/"td", refs, onResult, priority).
//
// Test runners (K4): the candidate, staged as an installed package, is
// imported (ESM) and required (CommonJS, react.cjs) under jsdom and
// happy-dom, the DOM emulations of Jest and Vitest, with React 18.3.1 and
// 19.2.3. Both adapters render with act(), keep their text and links,
// resolve refs, and report native:environment instead of throwing; typeset(),
// mount() and auditJSON() do the same.
import { mkdir, writeFile, rm, cp, symlink, copyFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { resolve, join } from 'node:path';
import { buildCandidate } from '../build-candidate.mjs';
import { artifacts } from './candidate.mjs';
import { releaseIdentity } from './release-evidence.mjs';
import { ensureReactEnv } from './react-env.mjs';

const env = await ensureReactEnv();
const report = { ...await releaseIdentity(), checks: /** @type {{ label: string, pass: boolean, detail?: unknown }[]} */ ([]), errors: /** @type {string[]} */ ([]) };
/** @param {string} label @param {unknown} pass @param {unknown} [detail] */
const check = (label, pass, detail) => report.checks.push({ label, pass: !!pass, ...(pass ? {} : { detail }) });

// Declarations: the artifacts under test when they ship them (a release),
// else, like the React fixtures when TYPESET_REACT is unset, the source,
// built with --types into its own directory.
let declarations = resolve(artifacts.dist);
const { existsSync } = await import('node:fs');
if (!process.env.TYPESET_DIST || !existsSync(join(declarations, 'typeset.release.react.d.ts'))) {
  const built = await buildCandidate({ out: 'output/react-types', types: true, label: 'react-types' });
  declarations = built.env.TYPESET_DIST;
}
const work = resolve('output/react-node');
await rm(work, { recursive: true, force: true });
await mkdir(work, { recursive: true });
for (const [major, types] of /** @type {const} */ ([['18', join(env.modules, '@types/react')], ['19', resolve('node_modules/@types/react')]])) {
  const config = {
    compilerOptions: {
      baseUrl: work, strict: true, noEmit: true, skipLibCheck: false, target: 'es2022', module: 'esnext', moduleResolution: 'bundler', jsx: 'react-jsx',
      lib: ['es2022', 'dom', 'dom.iterable'], types: [], typeRoots: [],
      paths: {
        'typeset.us/react': [join(declarations, 'typeset.release.react.d.ts')],
        'typeset.us': [join(declarations, 'typeset.release.d.ts')],
        react: [types], 'react/*': [types + '/*'],
      },
    },
    files: [resolve('tests/react/types.tsx')],
  };
  const file = join(work, `tsconfig.react${major}.json`);
  await writeFile(file, JSON.stringify(config, null, 2));
  const run = spawnSync(process.execPath, [resolve('node_modules/typescript/bin/tsc'), '-p', file], { encoding: 'utf8', timeout: 120000 });
  check(`TypeScript: typeset.us/react with @types/react ${major} accepts wider hosts, refs, onResult and priority, and rejects the rest`, run.status === 0, (run.stdout + run.stderr).split('\n').filter(Boolean).slice(0, 12));
}

// The script-tag entries' globals, through the package's own exports map:
// typeset.us/auto and typeset.us/go declare window.Typeset and TypesetReady,
// typeset.us/global window.Typeset.
{
  const consumer = join(work, 'globals');
  await mkdir(join(consumer, 'node_modules/typeset.us'), { recursive: true });
  await cp(declarations, join(consumer, 'node_modules/typeset.us/dist'), { recursive: true });
  await copyFile('packages/typeset-v4/package.json', join(consumer, 'node_modules/typeset.us/package.json'));
  for (const [entry, body] of /** @type {const} */ ([['auto', 'const c = await window.TypesetReady; c.refresh(); window.Typeset.auditJSON();'],
    ['go', 'const c = await window.TypesetReady; c.disconnect(); window.Typeset.auditJSON();'], ['global', 'window.Typeset.typeset(document.body);']])) {
    await writeFile(join(consumer, `${entry}.ts`), `import 'typeset.us/${entry}';\n${body}\nexport {};\n`);
    await writeFile(join(consumer, `tsconfig.${entry}.json`), JSON.stringify({ compilerOptions: { strict: true, noEmit: true, skipLibCheck: false, target: 'es2022', module: 'esnext', moduleResolution: 'bundler', lib: ['es2022', 'dom'], types: [] }, files: [`${entry}.ts`] }, null, 2));
    const run = spawnSync(process.execPath, [resolve('node_modules/typescript/bin/tsc'), '-p', join(consumer, `tsconfig.${entry}.json`)], { encoding: 'utf8', timeout: 120000 });
    check(`TypeScript: import 'typeset.us/${entry}' types the globals it sets`, run.status === 0, (run.stdout + run.stderr).split('\n').filter(Boolean).slice(0, 6));
  }
}

// ---------- test runners: jsdom and happy-dom ----------
const lanes = resolve('output/react-node/lanes');
await rm(lanes, { recursive: true, force: true });
for (const major of ['18', '19']) {
  const consumer = join(lanes, 'react' + major);
  const modules = join(consumer, 'node_modules');
  await mkdir(join(modules, 'typeset.us'), { recursive: true });
  await cp(resolve(artifacts.dist), join(modules, 'typeset.us/dist'), { recursive: true });
  await copyFile('packages/typeset-v4/package.json', join(modules, 'typeset.us/package.json'));
  const from = major === '18' ? env.modules : resolve('node_modules');
  for (const name of ['react', 'react-dom', 'scheduler']) await symlink(join(from, name), join(modules, name), 'dir');
  await copyFile('tests/react/dom-lane.cjs', join(consumer, 'dom-lane.cjs'));
  for (const emulation of ['jsdom', 'happy-dom']) for (const format of ['esm', 'cjs']) {
    const lane = `React ${major}, ${emulation}, ${format === 'cjs' ? "require('typeset.us/react')" : "import 'typeset.us/react'"}`;
    const run = spawnSync(process.execPath, [join(consumer, 'dom-lane.cjs'), emulation, format, env.modules], { cwd: consumer, encoding: 'utf8', timeout: 60000 });
    /** @type {any} */
    let seen = null;
    try { seen = JSON.parse(run.stdout.trim().split('\n').at(-1) || 'null'); } catch {}
    if (!seen) { check(`${lane}: the lane ran`, false, (run.stderr || run.stdout).slice(0, 600)); continue; }
    const text = 'Hello world, this is a paragraph composed in a test runner.';
    check(`${lane}: runs the expected React and loads every entry`, seen.react?.startsWith(major + '.') && seen.entries?.core === 'function' && seen.entries?.text === 'object' && seen.entries?.rich === 'object', seen);
    check(`${lane}: rendering, updating and unmounting both adapters throws nothing`, !seen.errors.length && seen.unmounted, seen.errors);
    check(`${lane}: the text stays readable, links and emphasis included`, seen.rendered?.text === text && seen.rendered?.rich === 'Hello world, with a link.' && seen.rendered?.richLink && seen.updated === 'Updated text.', seen.rendered);
    check(`${lane}: both adapters report native:environment, to the DOM and onResult`, seen.rendered?.textOutcome === 'native:environment' && seen.rendered?.richOutcome === 'native:environment'
      && seen.results?.some((/** @type {string[]} */ r) => r[0] === 'text' && r[1] === 'native:environment') && seen.results?.some((/** @type {string[]} */ r) => r[0] === 'rich' && r[1] === 'native:environment'), { rendered: seen.rendered, results: seen.results });
    check(`${lane}: whenSettled() from typeset.us and typeset.us/react resolves { settled: true } at once`, seen.settled?.core === true && seen.settled?.react === true && seen.settled.ms < 200, seen.settled);
    check(`${lane}: refs resolve to the host elements`, seen.refs?.text && seen.refs?.rich, seen.refs);
    check(`${lane}: typeset(), mount() and auditJSON() report native:environment and do not throw`, seen.typeset === 'native:environment' && seen.mount === 'native:environment' && seen.audit === 'boolean', seen);
    check(`${lane}: no console errors`, !seen.consoleErrors.length, seen.consoleErrors.slice(0, 4));
  }
}

const summary = { checks: report.checks.length, failed: report.checks.filter(c => !c.pass).length, errors: report.errors.length };
await mkdir('output', { recursive: true });
await writeFile('output/react-node.json', JSON.stringify({ ...report, summary }, null, 2));
console.log(JSON.stringify({ ...summary, failures: report.checks.filter(c => !c.pass).slice(0, 12), errors: report.errors }, null, 2));
if (summary.failed || summary.errors) process.exitCode = 1;
