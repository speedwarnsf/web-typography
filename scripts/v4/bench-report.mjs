// @ts-check
// Renders docs/BENCHMARKS.md from a bench-v4.mjs result, so the published
// numbers are always the output of the benchmark rather than prose.
//
//   node scripts/v4/bench-report.mjs <bench.json> [--out docs/BENCHMARKS.md]
import { readFile, writeFile } from 'node:fs/promises';
import { parseArgs } from 'node:util';

const { values, positionals } = parseArgs({ allowPositionals: true, options: { out: { type: 'string', default: 'docs/BENCHMARKS.md' } } });
if (!positionals[0]) throw new Error('Usage: bench-report.mjs <bench.json> [--out file]');
const bench = JSON.parse(await readFile(positionals[0], 'utf8'));
const lanes = Object.keys(bench.results);
/** @param {unknown} v */
const n = v => typeof v === 'number' ? v.toLocaleString('en-US') : v === null || v === undefined ? '-' : String(v);
/** @param {unknown} v */
const ms = v => typeof v === 'number' ? `${v.toLocaleString('en-US')} ms` : '-';
/** @param {string[]} head @param {unknown[][]} rows */
const table = (head, rows) => [`| ${head.join(' | ')} |`, `|${head.map(() => '---').join('|')}|`, ...rows.map(r => `| ${r.join(' | ')} |`)].join('\n');
/** @param {Record<string, number> | undefined} o */
const outcomes = o => o ? Object.entries(o).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${v} ${k}`).join(', ') : '-';
/** @param {string} lane @param {string} key */
const get = (lane, key) => /** @type {any} */ (bench.results[lane]?.[key]);

const perParagraph = [];
for (const lane of lanes) for (const size of [50, 200, 1000]) {
  const r = get(lane, `typesetAll-${size}`);
  if (!r || r.error) continue;
  perParagraph.push([lane, size, r.composed, ms(r.perParagraph.median), ms(r.perParagraph.p95), ms(r.perParagraph.max), ms(r.totalMs)]);
}
const mounts = [];
for (const lane of lanes) for (const size of [50, 200, 1000]) {
  const r = get(lane, `mount-${size}`);
  if (!r || r.error) { if (r?.error) mounts.push([lane, size, 'did not finish', '', '', '', '', '', '', '']); continue; }
  mounts.push([lane, size, ms(r.visibleMs), ms(r.readyMs), n(r.passes), `${n(r.longTasks)} / ${ms(r.tbtMs)}`, ms(r.longestTaskMs), ms(r.gapBlockingMs), n(r.nodeWrites), `${r.counts.mutationObservers} / ${r.counts.resizeObservers} / ${r.counts.intersectionObservers} (${n(r.counts.mutationObserve)} MO observe)`]);
}
const react = [];
for (const lane of lanes) for (const kind of ['plain', 'typeset', 'rich']) for (const size of [38, 1000]) {
  const r = get(lane, `react-${kind}-${size}`);
  if (!r || r.error) continue;
  const label = { plain: 'plain React', typeset: 'TypesetText', rich: 'TypesetRichText' }[kind];
  react.push([lane, `${size} ${label}`, ms(r.commitMs), ms(r.inpProxyMs), `${n(r.longTasks)} / ${ms(r.tbtMs)}`, ms(r.longestTaskMs), `${r.counts.mutationObservers} / ${r.counts.resizeObservers} / ${r.counts.intersectionObservers}`, n(r.counts.mutationObserve), `${r.counts.windowListeners} / ${r.counts.fontListeners}`, outcomes(r.outcomes)]);
}
const lifecycle = [];
for (const lane of lanes) {
  const s = get(lane, 'storm'), h = get(lane, 'hidden'), f = get(lane, 'late-font');
  if (s && !s.error) lifecycle.push([lane, '30 ancestor class toggles, 200 paragraphs', `${n(s.passes)} passes, ${n(s.compositions)} recompositions`, ms(s.elapsedMs), `${n(s.longTasks)} / ${ms(s.tbtMs)}`, n(s.nodeWrites)]);
  if (h && !h.error) lifecycle.push([lane, 'display:none, then shown (200)', `${n(h.compositions)} compositions; visible composed in ${ms(h.visibleMs)}`, ms(h.visibleMs), `${n(h.longTasks)} / ${ms(h.tbtMs)}`, n(h.nodeWrites)]);
  if (f && !f.error) lifecycle.push([lane, 'web font applied after ready (200)', `${n(f.compositions)} recompositions; ${f.staleAfterFont} of ${f.composed} stale afterwards`, ms(f.settledMs), `${n(f.longTasks)} / ${ms(f.tbtMs)}`, n(f.nodeWrites)]);
}
/** Sentences computed from the data, so they cannot drift from the tables. */
const reading = [];
{
  const m200 = get('chromium@4x', 'mount-200'), m1000 = get('chromium@4x', 'mount-1000');
  const longest = Math.max(...lanes.flatMap(lane => [50, 200, 1000].map(size => get(lane, `mount-${size}`)?.longestTaskMs ?? 0)));
  if (m200 && !m200.error) reading.push(`Composition runs on the main thread. \`mount()\` composes the first viewport first and yields after about 8 ms of work, but a single paragraph can exceed a frame: at 4x CPU its long tasks reach ${ms(longest)}, and a 200-paragraph page accumulates ${ms(m200.tbtMs)} of blocking time${m1000 && !m1000.error ? ` (${ms(m1000.tbtMs)} for 1,000 paragraphs, which take ${ms(m1000.readyMs)} to finish)` : ''}.`);
  const plain = get('chromium@1x', 'react-plain-38'), text = get('chromium@1x', 'react-typeset-38'), text4 = get('chromium@4x', 'react-typeset-38'), plain4 = get('chromium@4x', 'react-plain-38');
  if (plain && text && !text.error) reading.push(`One \`mount()\` creates one observer of each kind however many paragraphs it owns. Each React block creates its own controller: 38 TypesetText blocks create ${text.counts.mutationObservers} MutationObservers with ${n(text.counts.mutationObserve)} observe calls, ${text.counts.resizeObservers} ResizeObservers and ${text.counts.windowListeners} window listeners, and commit in ${ms(text.commitMs)} against ${ms(plain.commitMs)} for plain React${text4 && plain4 ? ` (${ms(text4.commitMs)} against ${ms(plain4.commitMs)} at 4x)` : ''}, although ${text.outcomes?.['native:fits'] ?? 0} of the 38 end as native:fits.`);
  const wkFont = get('webkit@1x', 'late-font');
  if (wkFont && !wkFont.error) reading.push(wkFont.staleAfterFont ? `WebKit does not recompose after a web font that CSS applies late: ${wkFont.staleAfterFont} of ${wkFont.composed} composed paragraphs were left with breaks measured for the old font.` : 'After a late web font, every composed paragraph was recomposed in each engine.');
  const storm = get('chromium@1x', 'storm');
  if (storm && !storm.error) reading.push(`Toggling a class on an ancestor 30 times re-ran composition ${n(storm.compositions)} times over 200 paragraphs whose layout the class does not change.`);
  reading.push('Budgets in `scripts/v4/budgets.json` hold the size, count and time values measured when they were introduced (sizes on every change; time, observer and write counts nightly and at release cut) and are lowered as the 4.3 performance work lands.');
}
const sizes = bench.sizes ? Object.entries(bench.sizes).map(([name, s]) => [name, n(/** @type {any} */ (s).min), n(/** @type {any} */ (s).gzip), n(/** @type {any} */ (s).brotli)]) : [];
const env = bench.environment ?? {};
const text = `# Benchmarks

*Generated by \`scripts/v4/bench-report.mjs\` from \`scripts/v4/bench-v4.mjs\` (${bench.label}, ${bench.generated.slice(0, 10)}).
${env.cpu ?? 'unknown CPU'}, ${env.cores ?? '?'} cores, ${env.platform}-${env.arch}, Node ${env.node}; load average ${env.loadAverageAtStart?.[0] ?? '?'} at start. Playwright's
Chromium headless shell ${env.browsers?.['chromium@1x'] ?? ''} and WebKit ${env.browsers?.['webkit@1x'] ?? ''}. Chromium runs at 1x and at 4x CPU through CDP
\`Emulation.setCPUThrottlingRate\` (a mid-range phone proxy); WebKit runs unthrottled.
Article paragraphs of 25 to 200 words from the corpus, Georgia 18px at a 650px
measure, one in five with a link and emphasis. Reproduce with \`npm run bench\`,
then \`node scripts/v4/bench-report.mjs output/bench-v4.json\`.*

These numbers replace the 3.x figures (about 1.6 ms per paragraph) that were
published here, in SKILL.md and in the essay until 4.3. They describe
${bench.label === '4.2.0' ? 'the published 4.2.0 build' : `the ${bench.label} build`}: one composition costs several
milliseconds, and the React adapters pay for one controller per block.

## Cost per paragraph

\`Typeset.typesetAll('article p')\` in one synchronous call; per-paragraph
\`durationMs\` from its results.

${table(['Lane', 'Paragraphs', 'Composed', 'Median', 'p95', 'Max', 'Total'], perParagraph)}

## mount() on a page

\`Typeset.mount(document, 'article p')\` after \`fonts.ready\`. *Visible* is the
time until every paragraph in the first viewport has an outcome; *ready* is
when every paragraph has been composed. Long tasks come from Chromium's
longtask API; *frame gaps* is the blocking time seen as animation-frame gaps
over 50 ms, the measure available in WebKit. Observers are
MutationObserver / ResizeObserver / IntersectionObserver instances created.

${table(['Lane', 'Paragraphs', 'Visible', 'Ready', 'Idle passes', 'Long tasks / TBT', 'Longest task', 'Frame-gap blocking', 'DOM mutation records', 'Observers created'], mounts)}

## React screen push

A trusted click renders a screen of blocks under 15 wrapper elements: short
labels, with one block in four a paragraph (a link in TypesetRichText).
*Commit* runs from the click handler to the screen's layout effect, which
includes the adapters' synchronous composition; *INP proxy* is the largest
Event Timing duration of the click (Chromium only).

${table(['Lane', 'Blocks', 'Commit', 'INP proxy', 'Long tasks / TBT', 'Longest task', 'Observers (MO / RO / IO)', 'MO observe calls', 'Window / font listeners', 'Outcomes'], react)}

## Lifecycle

${table(['Lane', 'Scenario', 'Work', 'Time to settle', 'Long tasks / TBT', 'DOM mutation records'], lifecycle)}

## Bundle size

esbuild bundles (minified, tree-shaken) importing one entry point from the
package, React external, and the shipped browser files. Bytes.

${table(['What a consumer imports', 'Minified', 'gzip', 'brotli'], sizes)}

## Reading the numbers

${reading.map(line => '- ' + line).join('\n')}
${bench.errors?.length ? `\nScenarios that did not finish: ${bench.errors.join('; ')}.\n` : ''}`;
await writeFile(values.out, text);
console.log(`Wrote ${values.out} from ${positionals[0]}.`);
