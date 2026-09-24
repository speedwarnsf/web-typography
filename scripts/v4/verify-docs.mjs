// @ts-check
// The docs describe the code and the release they ship with (D1-D6):
//
// - outcomes: every outcome and feature-status code the engine writes is in
//   src/lib/v4/outcomes.ts and nothing there is unused; OUTCOMES.md and
//   docs/outcomes.md are regenerated; `Outcome` supports an exhaustive
//   switch; every option has a documented default.
// - stability: STABILITY.md states the promise; site pages take install
//   lines from public/sri.json; pinned snippets in the docs carry
//   crossorigin and the right integrity (before the cut, the placeholder
//   release-cut fills).
// - community: contributor files and issue forms exist and ask for what a
//   report needs (`--network` also reads GitHub's community profile).
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
  // stability (D4): a written promise, and pinned-first install lines.
  const changelog = await readFile('CHANGELOG.md', 'utf8');
  const target = /^## (\d+\.\d+\.\d+(?:-[\w.]+)?)\b/m.exec(changelog)?.[1] ?? '';
  const released = pkg.version === target;
  const sri = JSON.parse(await readFile('public/sri.json', 'utf8'));
  const stability = await readFile('STABILITY.md', 'utf8').catch(() => '');
  for (const [label, pattern] of /** @type {[string, RegExp][]} */ ([
    ['API names', /API names/], ['auditJSON schemaVersion', /schemaVersion/], ['outcome codes', /Outcome codes/], ['default rendering only for verified defects', /only to fix a\s+verified defect/],
    ['a "Rendering changes" list with golden-diff counts', /"Rendering changes"[\s\S]*number of test\s+paragraphs/], ['exact installs (npm i -E)', /npm i -E typeset\.us@/], ['go.js never moves to 5.0', /never move to 5\.0/], ['release cadence', /two to four weeks/],
  ])) check('stability', `STABILITY.md covers ${label}`, pattern.test(stability));
  check('stability', `the CHANGELOG's first version (${target}) is the package version or the next release`, !!target && (released || /^## \d+\.\d+\.\d+ - Unreleased$/m.test(changelog.split('\n').find(line => line.startsWith(`## ${target}`)) ?? '')), { target, package: pkg.version });
  /** @type {string[]} */
  const hardcoded = [];
  const ALLOWED = new Set(['src/lib/install-snippet.ts', 'src/app/fix/page.tsx', 'src/lib/go-entry.ts', 'src/lib/typeset.standalone.ts']);
  /** @param {string} dir */
  const walk = async dir => {
    for (const entry of await readdir(dir, { withFileTypes: true })) {
      const path = `${dir}/${entry.name}`;
      if (entry.isDirectory()) { if (!['v4', 'vendor'].includes(entry.name)) await walk(path); continue; }
      if (!/\.(tsx?|mjs)$/.test(entry.name) || ALLOWED.has(path)) continue;
      const text = await readFile(path, 'utf8');
      if (/<script src="https:\/\/typeset\.us\/(?:go|typeset)[^"]*"/.test(text)) hardcoded.push(path);
    }
  };
  await walk('src');
  check('stability', 'site pages take install lines from src/lib/install-snippet.ts (public/sri.json), not hard-coded URLs', hardcoded.length === 0, hardcoded);
  const docs = { 'packages/typeset-v4/README.md': await readFile('packages/typeset-v4/README.md', 'utf8'), 'STABILITY.md': stability, 'README.md': await readFile('README.md', 'utf8') };
  for (const [file, text] of Object.entries(docs)) {
    const snippets = [...text.matchAll(/<script src="https:\/\/(?:typeset\.us\/go@|cdn\.jsdelivr\.net\/npm\/typeset\.us@)([\d.]+(?:-[\w.]+)?)(?:\.js|\/dist\/auto\.js)"([^>]*)>/g)];
    const wrong = snippets.filter(([, version, attributes]) => {
      if (!/crossorigin="anonymous"/.test(attributes)) return true;
      const integrity = /integrity="([^"]+)"/.exec(attributes)?.[1];
      if (version !== target) return integrity !== sri.files[`go@${version}.js`];
      return released ? integrity !== sri.files[`go@${version}.js`] : integrity !== 'sha384-FILLED-BY-RELEASE-CUT';
    }).map(m => m[0]);
    check('stability', `${file}: every pinned loader snippet has crossorigin and the right integrity (${released ? 'from sri.json' : 'the release-cut placeholder for ' + target})`, wrong.length === 0, wrong);
  }
  // community (D6): the files GitHub's community profile looks for, and issue
  // forms that ask for what a bad-break report needs.
  const exists = async (/** @type {string} */ path) => readFile(path).then(() => true, () => false);
  const community = ['README.md', 'LICENSE', 'CODE_OF_CONDUCT.md', 'CONTRIBUTING.md', 'SECURITY.md', '.github/pull_request_template.md', '.github/ISSUE_TEMPLATE/bad-break.yml', '.github/ISSUE_TEMPLATE/integration-question.yml', 'ROADMAP.md'];
  const absent = [];
  for (const file of community) if (!await exists(file)) absent.push(file);
  check('community', 'README, LICENSE, code of conduct, contributing guide, security policy, issue forms, PR template and roadmap exist', absent.length === 0, absent);
  const form = await readFile('.github/ISSUE_TEMPLATE/bad-break.yml', 'utf8').catch(() => '');
  const ids = [...form.matchAll(/^\s+id: (\w+)$/gm)].map(m => m[1]);
  check('community', 'the bad-break form asks for URL, width, font, browser, version, auditJSON and a screenshot', ['url', 'width', 'font', 'browser', 'version', 'audit', 'screenshot'].every(id => ids.includes(id)) && /render: json/.test(form), ids);
  const contributing = await readFile('CONTRIBUTING.md', 'utf8').catch(() => '');
  check('community', 'CONTRIBUTING.md covers setup, build:dist, test:v4 with --only, and attaching auditJSON', /npm ci/.test(contributing) && /build:dist/.test(contributing) && /--only/.test(contributing) && /auditJSON/.test(contributing));
  const coc = await readFile('CODE_OF_CONDUCT.md', 'utf8').catch(() => '');
  check('community', 'CODE_OF_CONDUCT.md adopts the Contributor Covenant and names a contact', /Contributor Covenant/.test(coc) && /@typeset\.us/.test(coc));
  if (process.argv.includes('--network')) {
    // After these files reach the default branch: GitHub's own score.
    let health = null;
    try { health = Number(execFileSync('gh', ['api', 'repos/speedwarnsf/web-typography/community/profile', '--jq', '.health_percentage'], { encoding: 'utf8', timeout: 30000 }).trim()); } catch {}
    check('community', "GitHub's community profile scores at least 85%", health !== null && health >= 85, health);
  }
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
