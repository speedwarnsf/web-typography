// @ts-check
// The React adapters outside a browser.
//
//   node scripts/v4/verify-react-node.mjs
//
// TypeScript contract: tests/react/types.tsx, a consumer of typeset.us/react,
// compiles against the candidate's declarations with @types/react 18.3 and
// 19.2 and skipLibCheck off (as="div"/"li"/"td", refs, onResult, priority).
import { mkdir, writeFile, rm } from 'node:fs/promises';
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

const summary = { checks: report.checks.length, failed: report.checks.filter(c => !c.pass).length, errors: report.errors.length };
await mkdir('output', { recursive: true });
await writeFile('output/react-node.json', JSON.stringify({ ...report, summary }, null, 2));
console.log(JSON.stringify({ ...summary, failures: report.checks.filter(c => !c.pass), errors: report.errors }, null, 2));
if (summary.failed || summary.errors) process.exitCode = 1;
