// @ts-check
// test:v4 — every suite, against the engine as it is in src/.
//
//   npm run test:v4                         build the candidate, run every suite
//   npm run test:v4 -- --only spacing,cli   run the named suites
//   npm run test:release                    the same suites against the committed packages/typeset-v4/dist
//   node scripts/v4/verify-release.mjs --prebuilt   use the TYPESET_* paths already in the environment
//   --verbose streams each suite's output; --timeout <s> changes the per-suite watchdog (180 s);
//   --list prints the suites; --strict treats known failures and
//   speed-calibrated checks as failures.
//
// The candidate is built first by build-candidate.mjs and every suite loads it
// through TYPESET_DIST, TYPESET_BUNDLE, TYPESET_ESM, TYPESET_REACT, TYPESET_GO,
// TYPESET_AUTO, TYPESET_STYLES and TYPESET_SITE_GO. Each suite gets a
// watchdog; failures are summarised by suite, browser and check. scripts/v4/known-failures.json lists
// checks that are expected to fail until a named plan item lands; such a
// suite reports XFAIL, and fails as XPASS once those checks pass, so the entry
// has to be removed in the change that fixes them. On a GitHub-hosted runner
// (TYPESET_HOSTED_RUNNER=1) a failing check listed in
// scripts/v4/speed-calibrated.json, whose result follows the machine's speed,
// makes its suite SLOW: reported with its detail, not a failure. Everywhere
// else, including release-cut's staged run, those checks are enforced.
import { spawn } from 'node:child_process';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { buildCandidate } from '../build-candidate.mjs';
import { SUITES } from './suites.mjs';


const { values } = parseArgs({ options: {
  only: { type: 'string' }, release: { type: 'boolean', default: false }, prebuilt: { type: 'boolean', default: false },
  verbose: { type: 'boolean', default: false }, timeout: { type: 'string', default: '180' }, list: { type: 'boolean', default: false },
  strict: { type: 'boolean', default: false },
} });
if (values.list) {
  for (const suite of SUITES) console.log(suite.name.padEnd(28) + (suite.note ?? ''));
  process.exit(0);
}
const wanted = values.only?.split(',').map(s => s.trim()).filter(Boolean);
const selected = wanted ? SUITES.filter(s => wanted.some(w => s.name === w || s.name.startsWith('verify-' + w) || s.name.startsWith(w))) : SUITES;
if (!selected.length) throw new Error(`--only ${values.only} matches no suite; use --list.`);
const timeoutMs = Number(values.timeout) * 1000;

/** @type {Record<string, string>} */
let env;
let mode;
let headline;
if (values.prebuilt) {
  if (!process.env.TYPESET_DIST || !process.env.TYPESET_BUNDLE) throw new Error('--prebuilt needs TYPESET_DIST and TYPESET_BUNDLE in the environment.');
  env = {};
  mode = process.env.TYPESET_RELEASE_STAGING ? 'staged-release' : 'prebuilt';
  headline = `${mode} ${process.env.TYPESET_DIST}`;
} else if (values.release) {
  const dist = resolve('packages/typeset-v4/dist');
  env = { TYPESET_DIST: dist, TYPESET_BUNDLE: `${dist}/typeset.global.js`, TYPESET_ESM: `${dist}/index.js`, TYPESET_REACT: `${dist}/react.js`, TYPESET_GO: `${dist}/go.js`, TYPESET_AUTO: `${dist}/auto.js`, TYPESET_STYLES: `${dist}/styles.css`, TYPESET_SITE_GO: resolve('public/go.js') };
  mode = 'release';
  const { version } = JSON.parse(await readFile(`${dist}/manifest.json`, 'utf8'));
  headline = `release: committed packages/typeset-v4/dist ${version}`;
} else {
  const built = await buildCandidate();
  env = built.env;
  mode = 'candidate';
  const { identity } = built;
  headline = `candidate ${identity.version} from ${identity.commit ? identity.commit.slice(0, 12) : 'untracked tree'}${identity.dirty ? ' + uncommitted engine changes' : ''}, built in ${(built.ms / 1000).toFixed(1)} s`;
}
console.log(`test:v4 ${headline}`);

/** @typedef {{ script: string, label: string, browser?: string, awaiting: string, reason: string, modes?: string[] }} KnownFailure */
/** @type {KnownFailure[]} */
const known = values.strict ? [] : JSON.parse(await readFile('scripts/v4/known-failures.json', 'utf8')).entries.filter((/** @type {KnownFailure} */ k) => !k.modes || k.modes.includes(mode));
/** @typedef {{ script: string, label: string, browser?: string, reason: string, observed: string }} SpeedCalibrated */
const hosted = process.env.TYPESET_HOSTED_RUNNER === '1';
/** @type {SpeedCalibrated[]} */
const calibrated = hosted && !values.strict ? JSON.parse(await readFile('scripts/v4/speed-calibrated.json', 'utf8')).entries : [];
if (calibrated.length) console.log(`Hosted runner: ${calibrated.length} speed-calibrated checks (scripts/v4/speed-calibrated.json) are reported, not enforced.`);

/** @param {import('./suites.mjs').Suite} suite */
function run(suite) {
  return new Promise(accept => {
    const started = performance.now();
    const child = spawn(process.execPath, [`scripts/v4/${suite.name}.mjs`], { env: { ...process.env, ...env, FORCE_COLOR: '0' }, stdio: ['ignore', 'pipe', 'pipe'], detached: true });
    /** @type {string[]} */
    const lines = [];
    let partial = { out: '', err: '' };
    const take = (/** @type {'out' | 'err'} */ stream, /** @type {Buffer} */ chunk) => {
      const text = partial[stream] + chunk.toString('utf8');
      const parts = text.split('\n');
      partial[stream] = parts.pop() ?? '';
      for (const line of parts) { lines.push(line); if (values.verbose) console.log(`[${suite.name}] ${line}`); }
    };
    child.stdout.on('data', chunk => take('out', chunk));
    child.stderr.on('data', chunk => take('err', chunk));
    let timedOut = false;
    // A suite may declare a longer minimum; --timeout still raises every suite.
    const watchdog = setTimeout(() => { timedOut = true; try { process.kill(-(/** @type {number} */ (child.pid)), 'SIGKILL'); } catch {} }, Math.max(timeoutMs, (suite.timeout ?? 0) * 1000));
    child.on('exit', code => {
      clearTimeout(watchdog);
      for (const rest of [partial.out, partial.err]) if (rest) lines.push(rest);
      // Browsers a killed suite launched share its process group.
      if (timedOut) { try { process.kill(-(/** @type {number} */ (child.pid)), 'SIGKILL'); } catch {} }
      accept({ code, timedOut, ms: performance.now() - started, lines });
    });
  });
}

/** @param {unknown} value */
const brief = value => { const text = typeof value === 'string' ? value : JSON.stringify(value); return text && text.length > 220 ? text.slice(0, 217) + '...' : text; };
/** @param {{ label: string, browser?: string }} entry @param {{ label?: string, browser?: string }} check */
const matches = (entry, check) => new RegExp(entry.label).test(String(check.label ?? '')) && (!entry.browser || entry.browser === check.browser);

await mkdir('output', { recursive: true });
const results = [];
for (const suite of selected) {
  if (suite.report) await rm(suite.report, { force: true });
  const outcome = /** @type {{ code: number | null, timedOut: boolean, ms: number, lines: string[] }} */ (await run(suite));
  /** @type {{ checks?: { label?: string, browser?: string, pass?: boolean, passed?: boolean, detail?: unknown }[], errors?: unknown[] } | null} */
  let report = null;
  if (suite.report) { try { report = JSON.parse(await readFile(suite.report, 'utf8')); } catch {} }
  const checks = (report?.checks ?? []).map(c => ({ ...c, pass: c.pass ?? c.passed ?? false }));
  const failing = checks.filter(c => !c.pass);
  const errors = report?.errors ?? [];
  const entries = known.filter(k => k.script === suite.name);
  const speed = calibrated.filter(k => k.script === suite.name);
  const knownFailing = failing.filter(c => entries.some(e => matches(e, c)));
  const slow = failing.filter(c => !entries.some(e => matches(e, c)) && speed.some(e => matches(e, c)));
  const unexpected = failing.filter(c => !entries.some(e => matches(e, c)) && !speed.some(e => matches(e, c)));
  const fixed = entries.filter(e => { const covered = checks.filter(c => matches(e, c)); return covered.length > 0 && covered.every(c => c.pass); });
  let status;
  if (outcome.timedOut) status = 'TIMEOUT';
  else if (fixed.length) status = 'XPASS';
  else if (outcome.code === 0) status = 'PASS';
  else if (report && !errors.length && !unexpected.length && knownFailing.length) status = 'XFAIL';
  else if (report && !errors.length && !unexpected.length && slow.length) status = 'SLOW';
  else status = 'FAIL';
  const result = { name: suite.name, file: `scripts/v4/${suite.name}.mjs`, status, exitCode: outcome.code, ms: Math.round(outcome.ms), checks: checks.length, failed: failing.length, knownFailures: knownFailing.length, awaiting: [...new Set(entries.filter(e => knownFailing.some(c => matches(e, c))).map(e => e.awaiting))], unexpected: unexpected.map(c => ({ browser: c.browser, label: c.label, detail: brief(c.detail) })), slow: slow.map(c => ({ browser: c.browser, label: c.label, detail: brief(c.detail) })), errors: errors.map(brief), fixedKnownFailures: fixed.map(e => e.label) };
  results.push(result);
  const seconds = (outcome.ms / 1000).toFixed(1).padStart(6) + ' s';
  const counts = checks.length ? `${checks.length} checks${failing.length ? `, ${failing.length} failed` : ''}` : '';
  console.log(`${status.padEnd(7)} ${suite.name.padEnd(28)} ${seconds}  ${counts}${status === 'XFAIL' ? ` (known, awaiting ${result.awaiting.join(', ')})` : ''}`);
  if (slow.length) for (const c of slow) console.log(`        slow      ${(c.browser ?? '-').padEnd(9)} ${c.label}${c.detail === undefined ? '' : '  ' + brief(c.detail)}`);
  if (status === 'XPASS') console.log(`        Checks listed in scripts/v4/known-failures.json now pass (${fixed.map(e => e.awaiting).join(', ')}); remove those entries.`);
  if (status === 'FAIL' || status === 'TIMEOUT') {
    if (status === 'TIMEOUT') console.log(`        ${result.file} was killed after ${Math.max(Number(values.timeout), suite.timeout ?? 0)} s.`);
    for (const c of unexpected.slice(0, 25)) console.log(`        ${(c.browser ?? '-').padEnd(9)} ${c.label}${c.detail === undefined ? '' : '  ' + brief(c.detail)}`);
    if (unexpected.length > 25) console.log(`        ... ${unexpected.length - 25} more in ${suite.report}`);
    for (const e of errors.slice(0, 5)) console.log(`        error     ${brief(e)}`);
    if (!unexpected.length && !errors.length) for (const line of outcome.lines.slice(-30)) console.log(`        | ${line}`);
  }
}
const failed = results.filter(r => ['FAIL', 'TIMEOUT', 'XPASS'].includes(r.status));
const summary = { mode, headline, generated: new Date().toISOString(), hosted, suites: results.length, passed: results.filter(r => r.status === 'PASS').length, knownFailing: results.filter(r => r.status === 'XFAIL').length, slow: results.filter(r => r.status === 'SLOW').length, failed: failed.length, checks: results.reduce((n, r) => n + r.checks, 0), results };
await writeFile('output/test-v4-summary.json', JSON.stringify(summary, null, 2));
console.log(`\n${summary.suites} suites: ${summary.passed} passed, ${summary.knownFailing} known failing, ${summary.slow ? `${summary.slow} slow on this hosted runner (speed-calibrated checks reported, not enforced), ` : ''}${summary.failed} failed; ${summary.checks.toLocaleString('en-US')} checks. Details: output/test-v4-summary.json`);
if (failed.length) process.exitCode = 1;
