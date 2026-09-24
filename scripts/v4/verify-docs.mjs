// @ts-check
// The docs describe the code and the release they ship with (D1-D6):
//
// - outcomes: every outcome and feature-status code the engine writes is in
//   src/lib/v4/outcomes.ts and nothing there is unused; OUTCOMES.md and
//   docs/outcomes.md are regenerated; `Outcome` supports an exhaustive
//   switch; every option has a documented default.
//
// Later sections are added by the other docs items. TODO(docs-sync) anchors
// are counted and listed; release-cut refuses to cut while any remain.
import { mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { build } from 'esbuild';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import { renderOutcomes, OUTCOME_FILES } from './outcomes-doc.mjs';

/** @type {{ section: string, label: string, pass: boolean, detail?: unknown }[]} */
const checks = [];
/** @type {string[]} */
const errors = [];
/** @param {string} section @param {string} label @param {unknown} pass @param {unknown} [detail] */
const check = (section, label, pass, detail) => { checks.push({ section, label, pass: !!pass, ...(pass ? {} : { detail }) }); };

// Codes only the retained v3 helpers in typeset.ts write; 4.x entry points
// never report them, so they are not part of `Outcome`.
const LEGACY_V3 = { 'skipped:short': 'src/lib/v4/typeset.ts', 'skipped:non-english': 'src/lib/v4/typeset.ts' };

try {
  // outcomes
  const modulePath = resolve(`output/outcomes-${process.pid}.mjs`);
  await mkdir('output', { recursive: true });
  await build({ entryPoints: ['src/lib/v4/outcomes.ts'], bundle: true, format: 'esm', outfile: modulePath, logLevel: 'silent' });
  const { OUTCOMES, FEATURE_STATUSES } = await import(pathToFileURL(modulePath).href);
  await rm(modulePath, { force: true });
  const listed = new Set([...OUTCOMES, ...Object.values(FEATURE_STATUSES).flat()]);
  /** @type {Map<string, Set<string>>} */
  const found = new Map();
  for (const file of (await readdir('src/lib/v4')).filter(f => /\.tsx?$/.test(f) && !['outcomes.ts', 'outcome-docs.ts'].includes(f))) {
    const text = await readFile(`src/lib/v4/${file}`, 'utf8');
    for (const [, code] of text.matchAll(/['`"]((?:native|composed|skipped|applied):[a-z-]+|composed|unmeasurable)['`"]/g)) {
      if (!found.has(code)) found.set(code, new Set());
      /** @type {Set<string>} */ (found.get(code)).add(file);
    }
  }
  const missing = [...found.keys()].filter(code => !listed.has(code) && !(code in LEGACY_V3));
  check('outcomes', 'every outcome and feature-status code in src/lib/v4 is listed in outcomes.ts', missing.length === 0, missing.map(code => `${code} (${[.../** @type {Set<string>} */ (found.get(code))].join(', ')})`));
  const prefixed = [...listed].filter(code => /:/.test(code) || code === 'composed' || code === 'unmeasurable');
  const unused = prefixed.filter(code => !found.has(code));
  check('outcomes', 'every code in outcomes.ts is written somewhere in the engine', unused.length === 0, unused);
  const legacyElsewhere = Object.entries(LEGACY_V3).filter(([code, file]) => [.../** @type {Set<string>} */ (found.get(code) ?? new Set())].some(f => `src/lib/v4/${f}` !== file));
  check('outcomes', 'v3-only codes (skipped:short, skipped:non-english) appear only in the retained v3 helpers', legacyElsewhere.length === 0, legacyElsewhere);
  const rendered = await renderOutcomes();
  for (const file of OUTCOME_FILES) check('outcomes', `${file} is generated from outcome-docs.ts (npm run docs:outcomes)`, (await readFile(file, 'utf8').catch(() => '')) === rendered);
  const pkg = JSON.parse(await readFile('packages/typeset-v4/package.json', 'utf8'));
  check('outcomes', 'the package publishes OUTCOMES.md', pkg.files.includes('OUTCOMES.md'), pkg.files);

  // A consumer can switch exhaustively over Outcome, and unknown strings still compile.
  const consumer = resolve(`output/outcome-consumer-${process.pid}.ts`);
  await writeFile(consumer, [
    "import type { Outcome, Result, FeatureStatus } from '../src/lib/v4/typeset.release';",
    "import { OUTCOMES } from '../src/lib/v4/typeset.release';",
    'export function label(outcome: Outcome): string {',
    '  switch (outcome) {',
    ...OUTCOMES.map((/** @type {string} */ code) => `    case '${code}': return '${code}';`),
    '    default: { const unreachable: never = outcome; return unreachable; }',
    '  }',
    '}',
    "export const future: Result['outcome'] = 'native:some-future-code';",
    "export const known: Result['outcome'] = OUTCOMES[0];",
    "export const status: FeatureStatus = 'native:spacing-verification';",
    '',
  ].join('\n'));
  try {
    execFileSync('node_modules/.bin/tsc', ['--noEmit', '--strict', '--skipLibCheck', '--target', 'es2022', '--module', 'esnext', '--moduleResolution', 'bundler', '--jsx', 'react-jsx', '--lib', 'es2022,dom,dom.iterable', consumer], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
    check('outcomes', 'a strict consumer switches exhaustively over Outcome, and Result.outcome still accepts other strings', true);
  } catch (error) {
    check('outcomes', 'a strict consumer switches exhaustively over Outcome, and Result.outcome still accepts other strings', false, String(/** @type {{ stdout?: string }} */ (error).stdout).slice(0, 800));
  } finally { await rm(consumer, { force: true }); }

  // Every option documents its default.
  const engine = await readFile('src/lib/v4/typeset.next.ts', 'utf8');
  const options = /export interface Options \{([\s\S]*?)\n\}/.exec(engine)?.[1] ?? '';
  const undocumented = [...options.matchAll(/(\/\*\*[\s\S]*?\*\/\s*)?\n\s*(\w+)\?:/g)].filter(([, doc, name]) => name !== 'text' && !/Default/.test(doc ?? '')).map(m => m[2]);
  check('outcomes', 'every Options field states its default in JSDoc', options && undocumented.length === 0, undocumented);
  check('outcomes', 'the lineBreaks JSDoc names unicode as the default', /Default `'unicode'`/.test(options));
} catch (error) {
  errors.push(String(/** @type {Error} */ (error).stack || error));
}

// Pending docs-sync anchors, listed (release-cut refuses them).
/** @type {string[]} */
const pending = [];
for (const file of ['packages/typeset-v4/README.md', 'packages/typeset-v4/SUPPORT.md', 'packages/typeset-v4/MIGRATION.md', 'packages/typeset-v4/for-agents.md', 'packages/typeset-v4/OUTCOMES.md', 'src/lib/v4/outcomes.ts', 'src/lib/v4/typeset.next.ts', 'CHANGELOG.md', 'STABILITY.md', 'README.md']) {
  const text = await readFile(file, 'utf8').catch(() => '');
  text.split('\n').forEach((line, index) => { if (line.includes('TODO(docs-sync)')) pending.push(`${file}:${index + 1}`); });
}
await writeFile('output/docs-verification.json', JSON.stringify({ checks, errors, pendingDocsSync: pending }, null, 2));
const failures = checks.filter(c => !c.pass);
console.log(JSON.stringify({ checks: checks.length, failures, errors, pendingDocsSync: pending.length }, null, 2));
if (failures.length || errors.length) process.exitCode = 1;
