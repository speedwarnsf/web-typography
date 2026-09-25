// @ts-check
// The candidate as an installed package in real test runners and package
// linters (CI; installs from the npm registry):
//
//   node scripts/v4/verify-test-runners.mjs
//
// The package is staged from packages/typeset-v4 (metadata, docs, bin) and a
// candidate built from src with declarations, then packed. A fresh consumer
// installs the tarball with pinned tools and runs:
//   - Vitest 5 with jsdom and with happy-dom, and Jest 30 with
//     jest-environment-jsdom (CommonJS, react.cjs), each rendering both React
//     adapters through Testing Library: no throw, readable text, links kept,
//     refs on the host, outcome native:environment;
//   - @arethetypeswrong/cli --pack and publint --strict, which must be clean.
import { cp, mkdir, mkdtemp, rm, writeFile, copyFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { buildCandidate } from '../build-candidate.mjs';
import { releaseIdentity } from './release-evidence.mjs';

const TOOLS = { vitest: '5.0.1', jsdom: '29.1.1', 'happy-dom': '20.14.5', '@testing-library/react': '16.3.3', react: '19.2.3', 'react-dom': '19.2.3',
  jest: '30.5.2', 'jest-environment-jsdom': '30.5.2', '@arethetypeswrong/cli': '0.18.5', publint: '0.3.24' };
const report = { ...await releaseIdentity(), tools: TOOLS, checks: /** @type {{ label: string, pass: boolean, detail?: unknown }[]} */ ([]), errors: /** @type {string[]} */ ([]) };
/** @param {string} label @param {unknown} pass @param {unknown} [detail] */
const check = (label, pass, detail) => report.checks.push({ label, pass: !!pass, ...(pass ? {} : { detail }) });
const cache = process.env.npm_config_cache || resolve('output/npm-cache');
/** @param {string} command @param {string[]} args @param {string} cwd */
const run = (command, args, cwd) => spawnSync(command, args, { cwd, encoding: 'utf8', timeout: 300000, env: { ...process.env, npm_config_cache: cache, CI: '1', FORCE_COLOR: '0' } });

try {
  // 1. Stage and pack the candidate package.
  const built = await buildCandidate({ out: 'output/runners-candidate', types: true, label: 'test-runners' });
  const stage = resolve('output/runners/typeset.us');
  await rm(resolve('output/runners'), { recursive: true, force: true });
  await mkdir(stage, { recursive: true });
  const pkg = 'packages/typeset-v4';
  for (const file of ['package.json', 'README.md', 'MIGRATION.md', 'SUPPORT.md', 'for-agents.md', 'AGENTS.md', 'capabilities.json', 'LICENSE', 'THIRD-PARTY-LICENSES.txt', 'UNICODE-LICENSE.txt']) await copyFile(join(pkg, file), join(stage, file));
  await cp(join(pkg, 'bin'), join(stage, 'bin'), { recursive: true });
  await cp(built.env.TYPESET_DIST, join(stage, 'dist'), { recursive: true });
  const packed = run('npm', ['pack', '--json', '--ignore-scripts', '--pack-destination', resolve('output/runners')], stage);
  const tarball = resolve('output/runners', JSON.parse(packed.stdout)[0].filename);

  // 2. A consumer with the tools, installed fresh.
  const consumer = await mkdtemp(join(tmpdir(), 'typeset-runners-'));
  await writeFile(join(consumer, 'package.json'), JSON.stringify({ name: 'typeset-runner-consumer', private: true, type: 'module' }, null, 2));
  const install = run('npm', ['install', '--ignore-scripts', '--no-audit', '--no-fund', '--save-exact', ...Object.entries(TOOLS).map(([name, version]) => `${name}@${version}`), tarball], consumer);
  check('the packed candidate and the pinned tools install', install.status === 0, (install.stderr || '').split('\n').slice(-8));

  // 3. Package linters.
  // The module entries in every resolution mode, node10 and CommonJS included.
  const attw = run('npx', ['--no-install', 'attw', '--pack', stage, '--entrypoints', '.', './react', '--format', 'table-flipped'], consumer);
  check('@arethetypeswrong/cli --pack: "." and "./react" resolve with matching types in node10, node16 (CJS and ESM) and bundler (no FalseESM)', attw.status === 0, (attw.stdout + attw.stderr).split('\n').slice(0, 30));
  // The script-tag builds are browser scripts, never require()d; their types
  // declare the globals they set.
  const scripts = run('npx', ['--no-install', 'attw', '--pack', stage, '--entrypoints', './global', './go', '--profile', 'esm-only', '--format', 'table-flipped'], consumer);
  check('@arethetypeswrong/cli --pack: "./global" and "./go" have types (ESM and bundler resolution)', scripts.status === 0, (scripts.stdout + scripts.stderr).split('\n').slice(0, 30));
  const publint = run('npx', ['--no-install', 'publint', '--strict', stage], consumer);
  check('publint --strict is clean', publint.status === 0 && !/Warnings?:|Errors?:/.test(publint.stdout), (publint.stdout + publint.stderr).split('\n').slice(0, 30));

  // 4. Component tests, written without JSX so no transform is needed.
  const body = (/** @type {string} */ load) => `${load}
test('TypesetText and TypesetRichText render in a DOM test environment', async () => {
  const ref = React.createRef(), richRef = React.createRef();
  const results = [];
  const { container, unmount } = render(React.createElement('div', null,
    React.createElement(TypesetText, { id: 'text', lang: 'en', ref, text: 'Hello world, composed in a test runner.', onResult: r => results.push(r.outcome) }),
    React.createElement(TypesetRichText, { id: 'rich', lang: 'en', ref: richRef }, 'Hello ', React.createElement('a', { href: '#x' }, 'a link'), '.')));
  await new Promise(resolve => setTimeout(resolve, 20));
  const text = container.querySelector('#text'), rich = container.querySelector('#rich');
  expect(text.textContent).toBe('Hello world, composed in a test runner.');
  expect(rich.textContent).toBe('Hello a link.');
  expect(rich.querySelector('a[href="#x"]')).not.toBeNull();
  expect(text.getAttribute('data-ts-outcome')).toBe('native:environment');
  expect(rich.getAttribute('data-ts-outcome')).toBe('native:environment');
  expect(ref.current).toBe(text);
  expect(richRef.current).toBe(rich);
  expect(results).toContain('native:environment');
  unmount();
});
`;
  await writeFile(join(consumer, 'adapters.test.js'), body(`import * as React from 'react';
import { render } from '@testing-library/react';
import { expect, test } from 'vitest';
import { TypesetText, TypesetRichText } from 'typeset.us/react';`));
  await mkdir(join(consumer, 'jest'), { recursive: true });
  await writeFile(join(consumer, 'jest/adapters.test.cjs'), body(`const React = require('react');
const { render } = require('@testing-library/react');
const { TypesetText, TypesetRichText } = require('typeset.us/react');`));
  await writeFile(join(consumer, 'jest.config.cjs'), `module.exports = { testEnvironment: 'jsdom', roots: ['<rootDir>/jest'], testMatch: ['**/*.test.cjs'], transform: {} };\n`);
  for (const environment of ['jsdom', 'happy-dom']) {
    const vitest = run('npx', ['--no-install', 'vitest', 'run', '--environment', environment, 'adapters.test.js'], consumer);
    check(`Vitest ${TOOLS.vitest} with ${environment}: both adapters render, keep their text and report native:environment`, vitest.status === 0, (vitest.stdout + vitest.stderr).split('\n').filter(l => /✓|×|FAIL|Error|expected|Tests/.test(l)).slice(0, 20));
  }
  const jest = run('npx', ['--no-install', 'jest', '--ci', '--config', 'jest.config.cjs'], consumer);
  check(`Jest ${TOOLS.jest} with jest-environment-jsdom (require, react.cjs): both adapters render, keep their text and report native:environment`, jest.status === 0, (jest.stdout + jest.stderr).split('\n').filter(l => /✓|✕|FAIL|PASS|Error|Expected|Received|Tests:/.test(l)).slice(0, 20));
  await rm(consumer, { recursive: true, force: true });
} catch (error) {
  report.errors.push(String(/** @type {Error} */ (error).stack || error));
}
const summary = { checks: report.checks.length, failed: report.checks.filter(c => !c.pass).length, errors: report.errors.length };
await mkdir('output', { recursive: true });
await writeFile('output/test-runners.json', JSON.stringify({ ...report, summary }, null, 2));
console.log(JSON.stringify({ ...summary, failures: report.checks.filter(c => !c.pass), errors: report.errors }, null, 2));
if (summary.failed || summary.errors) process.exitCode = 1;
