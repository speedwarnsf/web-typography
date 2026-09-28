// @ts-check
// Performance budgets from scripts/v4/budgets.json.
//
//   node scripts/v4/verify-budgets.mjs              size budgets (every PR; part of test:v4)
//   node scripts/v4/verify-budgets.mjs --runtime    also time, observer, listener and write
//                                                   budgets in Chromium at 4x CPU (nightly, release cut)
//   --calibrate [--repeat 3]                        rewrite budgets.json from this measurement
//
// Sizes are gzip bytes of esbuild bundles importing one entry point (see
// bench-sizes.mjs) and of the shipped files; a budget fails on more than 2%
// growth. Counts of observers and listeners created are deterministic and
// must not exceed their budget at all; observe() calls, DOM writes, wall
// times and blocking times get the tolerances recorded in the file. Budgets start at the values measured when
// they were introduced and are lowered as performance work lands.
import { readFile, writeFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { cpus } from 'node:os';
import { parseArgs } from 'node:util';
import { artifacts } from './candidate.mjs';
import { measureSizes } from './bench-sizes.mjs';

const FILE = 'scripts/v4/budgets.json';
const PLATFORM = `${process.platform}-${process.arch}`;
const CPU = cpus()[0]?.model ?? 'unknown';
// A GitHub-hosted runner (TYPESET_HOSTED_RUNNER=1, as in verify-release.mjs).
const HOSTED = process.env.TYPESET_HOSTED_RUNNER === '1';
const { values } = parseArgs({ options: { runtime: { type: 'boolean', default: false }, calibrate: { type: 'boolean', default: false }, repeat: { type: 'string', default: '1' } } });
/** The runtime lane: scenario -> metrics held to a budget. */
const RUNTIME = {
  lane: 'chromium@4x',
  scenarios: {
    'mount-200': ['visibleMs', 'readyMs', 'tbtMs', 'longestTaskMs'],
    'mount-1000': ['visibleMs', 'tbtMs', 'longestTaskMs'],
    'react-plain-38': ['commitMs', 'tbtMs'],
    'react-typeset-38': ['commitMs', 'tbtMs', 'longestTaskMs'],
    'react-rich-38': ['commitMs', 'tbtMs', 'longestTaskMs'],
    storm: ['elapsedMs', 'tbtMs', 'longestTaskMs', 'passes'],
    hidden: ['visibleMs', 'tbtMs', 'longestTaskMs'],
    'late-font': ['settledMs', 'tbtMs', 'longestTaskMs'],
  },
};
// Observers and listeners created are deterministic; observe() calls follow
// the number of idle passes, which varies a little from run to run.
const COUNTS = ['mutationObservers', 'resizeObservers', 'intersectionObservers', 'windowListeners', 'documentListeners', 'fontListeners'];
const CALLS = ['mutationObserve', 'resizeObserve', 'intersectionObserve'];

const budgets = JSON.parse(await readFile(FILE, 'utf8'));
/** @type {{ label: string, pass: boolean, detail?: unknown }[]} */
const checks = [];
/** @param {string} label @param {number} actual @param {number} budget @param {number} allowed */
const hold = (label, actual, budget, allowed) => checks.push({ label, pass: actual <= allowed, detail: { actual, budget, allowed: Math.round(allowed), change: budget ? `${(((actual - budget) / budget) * 100).toFixed(1)}%` : null } });

const sizes = await measureSizes(artifacts.dist);
for (const [name, measured] of Object.entries(sizes)) {
  const budget = budgets.size.gzip[name];
  if (budget === undefined) { checks.push({ label: `size: ${name} has a budget`, pass: false, detail: measured }); continue; }
  hold(`size: ${name} gzip within ${Math.round(budgets.size.tolerance * 100)}% of ${budget} bytes`, measured.gzip, budget, budget * (1 + budgets.size.tolerance));
}

/** @type {Record<string, Record<string, number>> | null} */
let runtime = null;
if (values.runtime) {
  const repeat = Math.max(1, Number(values.repeat));
  /** @type {Record<string, Record<string, number[]>>} */
  const samples = {};
  for (let i = 0; i < repeat; i++) {
    const run = spawnSync(process.execPath, ['scripts/v4/bench-v4.mjs', '--engines', 'chromium', '--cpu', '4', '--only', 'mount,react,storm,hidden,font', '--out', 'output/bench-budget.json', '--label', 'budget'], { stdio: ['ignore', 'ignore', 'inherit'], env: process.env, timeout: 1200000 });
    if (run.status !== 0) checks.push({ label: `runtime: benchmark run ${i + 1} completed`, pass: false, detail: run.status });
    const bench = JSON.parse(await readFile('output/bench-budget.json', 'utf8'));
    const lane = bench.results[RUNTIME.lane] ?? {};
    for (const [scenario, metrics] of Object.entries(RUNTIME.scenarios)) {
      const result = lane[scenario];
      if (!result || result.error) continue;
      const bucket = samples[scenario] ??= {};
      for (const metric of metrics) (bucket[metric] ??= []).push(result[metric]);
      for (const count of [...COUNTS, ...CALLS]) (bucket[count] ??= []).push(result.counts?.[count] ?? 0);
      (bucket.nodeWrites ??= []).push(result.nodeWrites);
    }
  }
  const median = (/** @type {number[]} */ list) => [...list].sort((a, b) => a - b)[Math.floor(list.length / 2)];
  runtime = Object.fromEntries(Object.entries(samples).map(([scenario, metrics]) => [scenario, Object.fromEntries(Object.entries(metrics).map(([metric, list]) => [metric, median(list)]))]));
  // Times depend on the machine, so they are enforced only on the machine the
  // budgets were calibrated on: its platform and CPU. A GitHub-hosted macos-15
  // runner is darwin-arm64 too, but a slower virtual machine, so a hosted run
  // records times whatever it reports. Counts and DOM writes are
  // deterministic and enforced everywhere.
  const on = budgets.calibrated?.runtime ?? {};
  const comparable = !HOSTED && on.platform === PLATFORM && (!on.cpu || on.cpu === CPU);
  const where = `${on.platform}${on.cpu ? ' ' + on.cpu : ''}; this run ${PLATFORM} ${CPU}${HOSTED ? ', hosted runner' : ''}`;
  for (const [scenario, metrics] of Object.entries(RUNTIME.scenarios)) {
    const measured = runtime[scenario], budget = budgets.runtime?.scenarios?.[scenario];
    if (!measured) { checks.push({ label: `runtime: ${RUNTIME.lane} ${scenario} measured`, pass: false }); continue; }
    if (!budget) { checks.push({ label: `runtime: ${RUNTIME.lane} ${scenario} has a budget`, pass: false, detail: measured }); continue; }
    for (const metric of metrics) {
      const allowed = Math.max(budget[metric] * budgets.runtime.timeTolerance, budget[metric] + budgets.runtime.timeFloorMs);
      if (comparable || metric === 'passes') hold(`runtime: ${RUNTIME.lane} ${scenario} ${metric}`, measured[metric], budget[metric], allowed);
      else checks.push({ label: `runtime: ${RUNTIME.lane} ${scenario} ${metric} (recorded; budgets calibrated on ${where})`, pass: true, detail: { actual: measured[metric], budget: budget[metric] } });
    }
    for (const count of COUNTS) hold(`runtime: ${RUNTIME.lane} ${scenario} ${count}`, measured[count], budget[count], budget[count]);
    for (const call of CALLS) hold(`runtime: ${RUNTIME.lane} ${scenario} ${call} calls`, measured[call], budget[call], budget[call] * budgets.runtime.callTolerance);
    hold(`runtime: ${RUNTIME.lane} ${scenario} nodeWrites`, measured.nodeWrites, budget.nodeWrites, budget.nodeWrites * budgets.runtime.writeTolerance);
  }
}

if (values.calibrate) {
  budgets.size.gzip = Object.fromEntries(Object.entries(sizes).map(([name, s]) => [name, s.gzip]));
  if (runtime) budgets.runtime.scenarios = runtime;
  budgets.calibrated = { ...budgets.calibrated, size: { date: new Date().toISOString().slice(0, 10), dist: artifacts.dist.replace(process.cwd() + '/', '') }, ...(runtime ? { runtime: { date: new Date().toISOString().slice(0, 10), dist: artifacts.dist.replace(process.cwd() + '/', ''), repeat: Number(values.repeat), platform: PLATFORM, cpu: CPU } } : {}) };
  await writeFile(FILE, JSON.stringify(budgets, null, 2) + '\n');
  console.log(`Calibrated ${FILE}.`);
}
const failures = checks.filter(c => !c.pass);
await writeFile('output/budget-verification.json', JSON.stringify({ dist: artifacts.dist, sizes, runtime, checks }, null, 2));
console.log(JSON.stringify({ checks: checks.length, failures, sizes: Object.fromEntries(Object.entries(sizes).map(([k, v]) => [k, v.gzip])) }, null, 2));
if (failures.length && !values.calibrate) process.exitCode = 1;
