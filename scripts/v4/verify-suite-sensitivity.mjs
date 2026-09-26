// @ts-check
// Proves test:v4 exercises the candidate built from src rather than bytes it
// never touched. Two mutations are compiled into scratch candidates (the tree
// is never edited) and the suites are run against each:
//
//   penalty  flips the weak line-end penalty to a reward in every measure
//            profile. Every composition suite must change its result: fail,
//            or record different evidence than the unmutated baseline.
//   canary   makes typeset() throw. Every suite that loads the engine must fail.
//
//   node scripts/v4/verify-suite-sensitivity.mjs [--mode penalty|canary|both] [--only a,b]
//   --recheck re-evaluates the last run's saved reports in output/sensitivity/ without running suites.
// Takes several minutes; it is a periodic sanity check, not part of test:v4.
import { spawnSync } from 'node:child_process';
import { cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { parseArgs } from 'node:util';
import { buildCandidate } from '../build-candidate.mjs';
import { SUITES } from './suites.mjs';

const { values } = parseArgs({ options: { mode: { type: 'string', default: 'both' }, only: { type: 'string' }, recheck: { type: 'boolean', default: false } } });
// Suites that do not load the engine at all.
const ENGINE_FREE = new Set(['verify-ledger', 'verify-immutable-4.2', 'verify-ledger-guards']);
// Behaviour suites assert lifecycle, ownership, loaders, interaction,
// clipboard, accessibility and text preservation rather than where lines
// break, so a penalty change is not expected to move them (verify-acceptance's
// evidence was identical under the weak-end mutation). The canary must still
// fail every one of them.
// verify-alignment asserts outcomes and untouched markup for declined
// (justified) text, which no break penalty reaches, and verify-settle that
// pages go quiet, wherever the lines break.
const BEHAVIOUR = new Set(['verify-acceptance', 'verify-native-ax', 'verify-loaders', 'verify-controller', 'verify-mount-ownership', 'verify-wrap-ownership', 'verify-cli', 'verify-fixture-invariants', 'verify-alignment', 'verify-settle']);
const saved = values.recheck ? JSON.parse(await readFile('output/suite-sensitivity.json', 'utf8')) : null;
const engineSuites = saved ? saved.suites : SUITES.map(s => s.name).filter(n => !ENGINE_FREE.has(n)).filter(n => !values.only || values.only.split(',').some(w => n.startsWith('verify-' + w) || n === w));

/** @param {string} file @param {RegExp} pattern @param {string} replacement @param {number} count @returns {import('esbuild').Plugin} */
const mutate = (file, pattern, replacement, count) => ({
  name: 'sensitivity-mutation',
  setup(build) {
    build.onLoad({ filter: new RegExp('/' + file.replace(/[./]/g, c => '\\' + c) + '$') }, async args => {
      const source = await readFile(args.path, 'utf8');
      const found = source.match(new RegExp(pattern.source, 'g'))?.length ?? 0;
      if (found !== count) throw new Error(`Mutation expected ${count} matches of ${pattern} in ${file}, found ${found}.`);
      return { contents: source.replace(new RegExp(pattern.source, 'g'), replacement), loader: 'ts' };
    });
  },
});

/** Evidence with volatile fields removed, so two runs of one build compare equal. @param {unknown} report */
function fingerprint(report) {
  const volatile = /^(generated|ms|duration|durationMs|elapsed|time|timestamp|url|artifactSHA256|bundleSHA256|sourceSHA256|commit|dirty|version|base|label|browsers|consumer|verificationToken|loader|maxBatchMs|startup|scroll)$/;
  // Fixture servers listen on ephemeral ports, which also appear in absolutised links.
  const text = JSON.stringify(report, (key, value) => volatile.test(key) ? undefined : typeof value === 'number' ? Math.round(value * 100) / 100 : typeof value === 'string' ? value.replace(/127\.0\.0\.1:\d+/g, 'fixture-host') : value);
  return createHash('sha256').update(text).digest('hex');
}

/** Recompute fingerprints and statuses from the reports a previous run saved. @param {string} tag */
async function savedRun(tag) {
  const statuses = tag === 'canary' ? saved.modes.canary.suites : saved.modes.penalty[{ baseline: 'baseline', 'baseline-repeat': 'repeat', penalty: 'mutant' }[tag] ?? tag];
  /** @type {Record<string, { status: string, fingerprint: string | null }>} */
  const suites = {};
  for (const name of engineSuites) {
    let print = null;
    try { print = fingerprint(JSON.parse(await readFile(`output/sensitivity/${tag}/${name}.json`, 'utf8'))); } catch {}
    suites[name] = { status: statuses?.[name]?.status, fingerprint: print };
  }
  return { exit: null, suites, log: [] };
}

/** @param {Record<string, string>} env @param {string} tag */
async function runSuites(env, tag) {
  if (values.recheck) return savedRun(tag);
  const run = spawnSync(process.execPath, ['scripts/v4/verify-release.mjs', '--prebuilt', '--strict', '--only', engineSuites.join(',')], { env: { ...process.env, ...env }, encoding: 'utf8', timeout: 1800000 });
  const summary = JSON.parse(await readFile('output/test-v4-summary.json', 'utf8'));
  await mkdir(`output/sensitivity/${tag}`, { recursive: true });
  /** @type {Record<string, { status: string, fingerprint: string | null }>} */
  const suites = {};
  for (const result of summary.results) {
    const suite = SUITES.find(s => s.name === result.name);
    let print = null;
    if (suite?.report) {
      try {
        await cp(suite.report, `output/sensitivity/${tag}/${result.name}.json`);
        print = fingerprint(JSON.parse(await readFile(suite.report, 'utf8')));
      } catch {}
    }
    suites[result.name] = { status: result.status, fingerprint: print };
  }
  return { exit: run.status, suites, log: run.stdout.split('\n').filter(Boolean) };
}

if (!values.recheck) await rm('output/sensitivity', { recursive: true, force: true });
/** @type {{ label: string, pass: boolean, detail?: unknown }[]} */
const checks = [];
const report = { suites: engineSuites, modes: /** @type {Record<string, unknown>} */ ({}), checks };
if (values.mode === 'penalty' || values.mode === 'both') {
  const baseline = values.recheck ? { env: {} } : await buildCandidate({ out: 'output/sensitivity-base' });
  const before = await runSuites(baseline.env, 'baseline');
  // A second unmutated run shows which reports are deterministic; for the
  // rest only a change of pass/fail status counts.
  const repeat = await runSuites(baseline.env, 'baseline-repeat');
  const mutant = values.recheck ? { env: {} } : await buildCandidate({ out: 'output/sensitivity-penalty', label: 'weakEndPenalty negated', plugins: [mutate('src/lib/v4/typeset.ts', /weakEndPenalty: (\d+),/, 'weakEndPenalty: -$1,', 4)] });
  const after = await runSuites(mutant.env, 'penalty');
  report.modes.penalty = { baseline: before.suites, repeat: repeat.suites, mutant: after.suites, log: after.log };
  for (const name of engineSuites) {
    const a = before.suites[name], b = after.suites[name];
    const stable = !!a && repeat.suites[name]?.fingerprint === a.fingerprint;
    const changed = !!a && !!b && (a.status !== b.status || (stable && a.fingerprint !== b.fingerprint));
    const expected = !BEHAVIOUR.has(name);
    checks.push({ label: `penalty: ${name} ${expected ? 'changes result' : '(behaviour suite) result recorded'}`, pass: expected ? changed : true, detail: { baseline: a, mutant: b, deterministic: stable, changed } });
  }
}
if (values.mode === 'canary' || values.mode === 'both') {
  const canary = values.recheck ? { env: {} } : await buildCandidate({ out: 'output/sensitivity-canary', label: 'typeset() throws', plugins: [mutate('src/lib/v4/typeset.next.ts', /export function typeset\(([^)]*)\)([^{]*)\{/, 'export function typeset($1)$2{ throw new Error("sensitivity canary");', 1)] });
  const result = await runSuites(canary.env, 'canary');
  report.modes.canary = { suites: result.suites, log: result.log };
  for (const name of engineSuites) checks.push({ label: `canary: ${name} fails`, pass: !!result.suites[name] && result.suites[name].status !== 'PASS', detail: result.suites[name] });
}
await rm('output/sensitivity-base', { recursive: true, force: true });
await rm('output/sensitivity-penalty', { recursive: true, force: true });
await rm('output/sensitivity-canary', { recursive: true, force: true });
await writeFile('output/suite-sensitivity.json', JSON.stringify(report, null, 2));
const failures = checks.filter(c => !c.pass);
for (const c of checks) console.log(`${c.pass ? 'ok  ' : 'FAIL'} ${c.label}${c.pass ? '' : '  ' + JSON.stringify(c.detail).slice(0, 200)}`);
console.log(`${checks.length} checks, ${failures.length} failed. Details: output/suite-sensitivity.json`);
if (failures.length) process.exitCode = 1;
