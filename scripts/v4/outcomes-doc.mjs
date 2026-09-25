// @ts-check
// Renders src/lib/v4/outcome-docs.ts as packages/typeset-v4/OUTCOMES.md (in
// the npm package) and docs/outcomes.md. `--check` fails instead of writing
// when either file is out of date (verify-docs runs it).
//
//   node scripts/v4/outcomes-doc.mjs [--check]
import { build } from 'esbuild';
import { readFile, writeFile, rm } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';

export const OUTCOME_FILES = ['packages/typeset-v4/OUTCOMES.md', 'docs/outcomes.md'];

/** The generated Markdown. */
export async function renderOutcomes() {
  const out = resolve(`output/outcome-docs-${process.pid}.mjs`);
  await build({ entryPoints: ['src/lib/v4/outcome-docs.ts'], bundle: true, format: 'esm', platform: 'neutral', outfile: out, logLevel: 'silent' });
  const { OUTCOME_DOCS, OUTCOME_GROUPS, FEATURE_DOCS } = await import(pathToFileURL(out).href + '?' + Date.now());
  await rm(out, { force: true });
  /** @param {string} text */
  const cell = text => text.replace(/\|/g, '\\|');
  const lines = [
    '# Outcomes',
    '',
    '<!-- Generated from src/lib/v4/outcome-docs.ts by scripts/v4/outcomes-doc.mjs. Edit that file, then run npm run docs:outcomes. -->',
    '',
    'Every element Typeset looks at gets an outcome: `result.outcome` from',
    '`typeset()`, and `data-ts-outcome` on the element. `auditJSON()` counts',
    'them. Excluded content and live regions get no attribute: `typeset()`',
    'returns `skipped:excluded` or `native:live-region` for them, and',
    '`auditJSON()` counts them as `excluded` and `native:live-region`.',
    'A `native:` outcome is not an error: it means Typeset left the',
    "browser's layout in place, and says why. The TypeScript types are",
    '`Outcome` and `FeatureStatus`, and `OUTCOMES` lists every code at runtime.',
    '',
    '"Expected" means the outcome is a normal result that needs no action.',
    '',
  ];
  for (const [group, description] of Object.entries(OUTCOME_GROUPS)) {
    const rows = Object.entries(OUTCOME_DOCS).filter(([, row]) => /** @type {{ group: string }} */ (row).group === group);
    lines.push(`## ${group[0].toUpperCase()}${group.slice(1)}`, '', description, '', '| Outcome | What happened | Expected | What to do |', '| --- | --- | --- | --- |');
    for (const [code, row] of rows) {
      const r = /** @type {{ meaning: string, expected: boolean, action: string }} */ (row);
      lines.push(`| \`${code}\` | ${cell(r.meaning)} | ${r.expected ? 'Yes' : 'No'} | ${cell(r.action)} |`);
    }
    lines.push('');
  }
  lines.push('## Finishing features', '', 'Composed text can also get finishing passes. Each reports its own status in',
    '`result.features` and in `data-ts-quotes`, `data-ts-hanging`, `data-ts-spacing`',
    'and `data-ts-tracking`. A failed pass is rolled back on its own; the',
    'composed breaks stay.', '');
  for (const [feature, statuses] of Object.entries(FEATURE_DOCS)) {
    lines.push(`### ${feature}`, '', '| Status | Meaning |', '| --- | --- |');
    for (const [status, meaning] of Object.entries(/** @type {Record<string, string>} */ (statuses))) lines.push(`| \`${status}\` | ${cell(meaning)} |`);
    lines.push('');
  }
  return lines.join('\n');
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const text = await renderOutcomes();
  const stale = [];
  for (const file of OUTCOME_FILES) {
    const current = await readFile(file, 'utf8').catch(() => '');
    if (current !== text) stale.push(file);
    if (!process.argv.includes('--check')) await writeFile(file, text);
  }
  if (process.argv.includes('--check') && stale.length) { console.error('Out of date: ' + stale.join(', ') + '. Run npm run docs:outcomes.'); process.exitCode = 1; }
  else console.log(process.argv.includes('--check') ? 'Outcome docs are current.' : 'Wrote ' + OUTCOME_FILES.join(' and '));
}
