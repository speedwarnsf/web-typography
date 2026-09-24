// @ts-check
// Golden composition: the build under test against the published 4.2.0 build,
// cell by cell, in the same page of each engine.
//
//   node scripts/v4/verify-golden.mjs              every corpus paragraph, 3 engines in parallel (about 35 s)
//   --stride 4 samples every fourth paragraph      --engines chromium,webkit
//   --out <file>                                   --baseline <typeset.global.js> (default: the published 4.2.0)
//
// A cell is one paragraph at one width in one font, composed with one set of
// options. For every cell the suite records what each build produced: the
// outcome, the finish features and the element's markup after composition,
// which carries every break, spacing marker and tracking run. Cells must be
// byte-identical to 4.2.0 unless the text contains a construction a 4.3
// rendering change (CHANGELOG, "Rendering changes") is about; those cells are
// counted and must still keep the paragraph's promises: no overflow, no new
// orphan, and the same decision in every engine where 4.2.0 agreed.
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { parseArgs } from 'node:util';
import { browsers } from './browsers.mjs';
import { releaseIdentity } from './release-evidence.mjs';
import { installFixtureFont } from './font-fixture.mjs';

const { values } = parseArgs({ options: {
  stride: { type: 'string', default: '1' },
  engines: { type: 'string' },
  out: { type: 'string', default: 'output/golden.json' },
  baseline: { type: 'string', default: 'public/releases/4.2.0/typeset.global.js' },
  dump: { type: 'string' },
  // Sweep bind weights without a rebuild (typeset.ts bindWeights), e.g. '{"pair":1.5}'.
  bind: { type: 'string' },
} });
const started = performance.now();
const watchdog = setTimeout(() => { console.error('verify-golden: watchdog after 170 s'); process.exit(3); }, 170_000);
watchdog.unref();

const corpus = JSON.parse(await readFile('tests/v4-corpus.json', 'utf8')).paragraphs;
/** @type {{ id: string, text: string }[]} */
const adversarial = JSON.parse(await readFile('tests/v4-corpus-adversarial.json', 'utf8')).paragraphs;
const baseline = await readFile(values.baseline, 'utf8');
const subject = await readFile(process.env.TYPESET_BUNDLE || 'packages/typeset-v4/dist/typeset.global.js', 'utf8');
const stride = Math.max(1, Number(values.stride) || 1);
const report = { ...await releaseIdentity(), baseline: values.baseline, stride, checks: /** @type {any[]} */ ([]), errors: /** @type {any[]} */ ([]), browsers: /** @type {Record<string, string>} */ ({}), counts: /** @type {Record<string, any>} */ ({}), changed: /** @type {any[]} */ ([]) };

const texts = corpus.filter((/** @type {string} */ _, /** @type {number} */ i) => i % stride === 0);
const widths = [240, 320, 400, 560];
const fonts = ['Georgia', 'TypesetFixture'];
/** @param {string} text */
const escape = text => text.replace(/&/g, '&amp;').replace(/</g, '&lt;');
/** A link and emphasis inside the paragraph, as authors write them. @param {string} text */
function linked(text) {
  const words = text.split(' ');
  if (words.length < 12) return escape(text);
  const html = words.map(escape);
  html[3] = '<a href="#golden">' + html[3] + ' ' + html[4] + '</a>'; html[4] = '';
  html[8] = '<em>' + html[8] + '</em>';
  return html.filter(Boolean).join(' ');
}
/** @typedef {{ id: string, variant: string, tag: string, html: string, width: number, font: string, options: Record<string, unknown>, style?: string }} Cell */
/** @type {Cell[]} */
const cells = [];
for (const [index, text] of texts.entries()) for (const width of widths) for (const font of fonts) {
  const at = `${index * stride}@${width}/${font}`;
  cells.push({ id: 'default ' + at, variant: 'default', tag: 'p', html: escape(text), width, font, options: {} });
  cells.push({ id: 'rich ' + at, variant: 'rich', tag: 'p', html: linked(text), width, font, options: {} });
  cells.push({ id: 'legacy ' + at, variant: 'legacy', tag: 'p', html: escape(text), width, font, options: { lineBreaks: 'legacy', contour: 'natural' } });
  if (index % 2 === 0) cells.push({ id: 'finishes ' + at, variant: 'finishes', tag: 'p', html: escape(text), width, font, options: { smartQuotes: 'en', opticalHanging: true } });
  if (index % 2 === 1) cells.push({ id: 'justified ' + at, variant: 'justified', tag: 'p', html: escape(text), width, font, options: {}, style: 'text-align:justify' });
  if (width <= 320) {
    const title = text.split(' ').slice(0, 9).join(' ');
    cells.push({ id: 'title ' + at, variant: 'title', tag: 'h2', html: escape(title), width: width - 60, font, options: {} });
  }
}

for (const { id, text } of adversarial) for (const width of widths) for (const font of fonts) {
  const at = `${id}@${width}/${font}`;
  cells.push({ id: 'adversarial ' + at, variant: 'adversarial', tag: 'p', html: escape(text), width, font, options: {} });
  cells.push({ id: 'adversarial-legacy ' + at, variant: 'adversarial-legacy', tag: 'p', html: escape(text), width, font, options: { lineBreaks: 'legacy', contour: 'natural' } });
}

/** Runs in the page: compose each cell with one build and describe the result. */
function compose({ cells, build, baseline }) {
  const api = build === 'baseline' ? window.Baseline : window.Typeset;
  // Smart quotes are the one sanctioned change to the characters.
  const plain = text => text.replace(/[\u2018\u2019]/g, "'").replace(/[\u201c\u201d]/g, '"');
  // Line review items of the audit under test, by type: the build under
  // test judges the native layout, its own output and 4.2.0's output alike.
  const lineTypes = ['weak-line-end', 'stranded-opener', 'bound-split', 'split-ellipsis', 'line-initial-punctuation', 'orphan', 'first-singleton'];
  const review = el => {
    const counts = {};
    if (build !== 'subject') return counts;
    for (const issue of window.Typeset.audit('#golden-cell')) if (lineTypes.includes(issue.type)) counts[issue.type] = (counts[issue.type] || 0) + 1;
    return counts;
  };
  const out = [];
  for (const [index, cell] of cells.entries()) {
    const el = document.createElement(cell.tag);
    el.id = 'golden-cell';
    el.style.cssText = `font:18px/1.5 ${cell.font === 'Georgia' ? 'Georgia, serif' : cell.font};width:${cell.width}px;margin:0;text-wrap:wrap;${cell.style || ''}`;
    el.innerHTML = cell.html;
    document.body.append(el);
    const native = api.measureLayout(el);
    const nativeReview = review(el);
    let result;
    try { result = api.typeset(el, cell.options); } catch (error) { result = { outcome: 'threw ' + error.message, after: native, features: null }; }
    const after = api.measureLayout(el);
    const record = { id: cell.id, outcome: result.outcome, features: result.features ?? null, markup: el.innerHTML,
      breaks: after.lines.map(line => line.sourceStart), lines: after.lines.map(line => line.text), nativeText: native.lines.map(line => line.text),
      overflow: after.overflow, nativeOrphan: native.lastSingleton, orphan: after.lastSingleton, nativeLines: native.lines.length,
      textIntact: plain(el.textContent) === plain(new DOMParser().parseFromString('<body>' + cell.html, 'text/html').body.textContent),
      review: { native: nativeReview, subject: review(el), baseline: {} } };
    api.restore(el);
    if (build === 'subject' && baseline?.[index]) {
      // 4.2.0's output, rendered as it was, judged by the same audit.
      el.innerHTML = baseline[index].markup;
      el.dataset.tsOutcome = baseline[index].outcome;
      record.review.baseline = review(el);
    }
    el.remove();
    out.push(record);
  }
  return out;
}

/**
 * The 4.3 rendering changes that apply to a cell. A cell none of them applies
 * to must be byte-identical to 4.2.0.
 * @param {Cell} cell
 * @returns {string[]}
 */
function changeReasons(cell) {
  const reasons = [];
  // C3: justified text is declined instead of composed ragged.
  if (/text-align:\s*justify/.test(cell.style || '')) reasons.push('justify');
  // C13, English text: abbreviations end no sentence; numbers and units,
  // honorifics and names, labels and numbers, and words and letter
  // designators are bound; of the single letters only the article and the
  // pronoun "I" pay the letter penalty. Deliberately broader than the
  // engine's own lists.
  const words = cell.html.replace(/<[^>]+>/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').split(/\s+/u).filter(Boolean);
  const bare = (/** @type {string} */ word) => word.replace(/^[("'\u201C\u2018[]+/u, '').replace(/[.,;:!?"'\u201D\u2019)\]]+$/u, '');
  for (const [i, word] of words.entries()) {
    const next = words[i + 1] ?? '', previous = words[i - 1] ?? '';
    const core = word.replace(/^[("'\u201C\u2018[]+/u, '').replace(/["'\u201D\u2019)\]]+$/u, '');
    if (/^(?:Mr|Mrs|Ms|Mx|Dr|Prof|Rev|St|Mt|Jr|Sr|vs|etc|e\.g|i\.e|E\.g|I\.e|a\.m|p\.m|p|pp|Fig|fig|No|Vol|Ch|Inc|Ltd|Co|(?:\p{Lu}\.)+\p{Lu}|[B-HJ-Z])\.$/u.test(core)) reasons.push('abbreviation');
    const letter = bare(word);
    const designated = letter === 'A' ? /^(?:type|grade|class|size|plan|part|vitamin|hepatitis|blood|group|section|model|exhibit|appendix|schedule|title|category|level|phase|stage|tier|zone|option|list|team)$/iu.test(previous)
      : /^\p{Lu}\p{L}*$/u.test(previous) && !/[.!?:]["'\u201D\u2019)]*$/u.test(words[i - 2] ?? '.');
    if (/^\p{L}$/u.test(letter) && letter !== 'a' && (!['A', 'I'].includes(letter) || designated)) reasons.push('single letter');
    if (/^[$€£¥]?\d/u.test(word) && /^(?:[\p{L}°%‰µμ]{1,4}|a\.m|p\.m|million|billion|trillion|percent)$/u.test(bare(next))) reasons.push('number and unit');
    if (/^(?:table|figure|chapter|section|page|part|step|room|level|grade|stage|phase|type|class|category|tier|zone|appendix|exhibit|schedule|version)$/iu.test(bare(word)) && /^\d|^[IVX]{2,}/u.test(next)) reasons.push('label and number');
  }
  return [...new Set(reasons)];
}


/** @param {{ name: string, engine: any, executablePath?: string }} config */
async function runEngine({ name, engine, executablePath }) {
  const browser = await engine.launch({ executablePath, timeout: 20_000 });
  report.browsers[name] = browser.version();
  try {
    const page = await browser.newPage({ viewport: { width: 1200, height: 900 } });
    page.setDefaultTimeout(20_000);
    page.on('pageerror', (/** @type {Error} */ error) => report.errors.push({ browser: name, error: error.message }));
    await page.setContent('<!doctype html><html lang="en"><head><meta charset="utf-8"><style>body{margin:24px}a{color:#176650}</style></head><body></body></html>');
    await installFixtureFont(page);
    if (values.bind) await page.evaluate(bind => { globalThis.__TYPESET_BIND__ = JSON.parse(bind); }, values.bind);
    await page.addScriptTag({ content: baseline });
    await page.evaluate(() => { window.Baseline = window.Typeset; });
    await page.addScriptTag({ content: subject });
    /** @type {any[]} */ const base = [], cand = [];
    // Chunks keep each evaluate well inside Playwright's timeout.
    for (let i = 0; i < cells.length; i += 60) {
      const chunk = cells.slice(i, i + 60);
      const done = await page.evaluate(compose, { cells: chunk, build: 'baseline' });
      base.push(...done);
      cand.push(...await page.evaluate(compose, { cells: chunk, build: 'subject', baseline: done.map(({ markup, outcome }) => ({ markup, outcome })) }));
    }
    return { name, base, cand };
  } finally { await browser.close(); }
}

const engines = values.engines?.split(',') ?? browsers.map(b => b.name);
await mkdir('output', { recursive: true });
const runs = (await Promise.allSettled(browsers.filter(b => engines.includes(b.name)).map(runEngine)))
  .flatMap((outcome, i) => {
    if (outcome.status === 'fulfilled') return [outcome.value];
    report.errors.push({ browser: engines[i], error: String(outcome.reason?.stack || outcome.reason) });
    return [];
  });

const check = (/** @type {string} */ browser, /** @type {string} */ label, /** @type {unknown} */ pass, /** @type {unknown} */ detail) =>
  report.checks.push({ browser, label, pass: !!pass, ...(detail === undefined ? {} : { detail }) });
const byId = new Map(cells.map(cell => [cell.id, cell]));
for (const { name, base, cand } of runs) {
  const variants = [...new Set(cells.map(cell => cell.variant))];
  for (const variant of variants) {
    const pairs = cand.map((c, i) => ({ c, b: base[i], cell: /** @type {Cell} */ (byId.get(c.id)) })).filter(p => p.cell.variant === variant);
    const differ = pairs.filter(({ c, b }) => c.outcome !== b.outcome || c.markup !== b.markup || JSON.stringify(c.features) !== JSON.stringify(b.features));
    const unexplained = differ.filter(({ cell }) => !changeReasons(cell).length);
    report.counts[`${name} ${variant}`] = { cells: pairs.length, changed: differ.length, unexplained: unexplained.length };
    for (const { c, b, cell } of differ) report.changed.push({ browser: name, id: c.id, reasons: changeReasons(cell), baseline: { outcome: b.outcome, lines: b.lines }, subject: { outcome: c.outcome, lines: c.lines } });
    check(name, `${variant}: identical to 4.2.0 unless a rendering change applies`, unexplained.length === 0,
      unexplained.length ? unexplained.slice(0, 4).map(({ c, b }) => ({ id: c.id, baseline: [b.outcome, ...b.lines], subject: [c.outcome, ...c.lines] })) : { cells: pairs.length, changed: differ.length });
    const overflow = pairs.filter(({ c }) => c.overflow > .5);
    check(name, `${variant}: no overflow`, !overflow.length, overflow.slice(0, 4).map(({ c }) => ({ id: c.id, overflow: c.overflow })));
    const orphans = pairs.filter(({ c, cell }) => cell.tag === 'p' && c.orphan && !c.nativeOrphan);
    check(name, `${variant}: no new orphan`, !orphans.length, orphans.slice(0, 4).map(({ c }) => ({ id: c.id, lines: c.lines })));
    if (variant === 'justified') {
      const composed = pairs.filter(({ c }) => !/^native:(justify|fits)$/.test(c.outcome) || /data-ts-(break|track)/.test(c.markup));
      check(name, 'justified: declined and untouched', !composed.length, composed.slice(0, 4).map(({ c }) => ({ id: c.id, outcome: c.outcome })));
    }
    const damaged = pairs.filter(({ c }) => !c.textIntact || /^threw/.test(c.outcome));
    check(name, `${variant}: source text intact`, !damaged.length, damaged.slice(0, 4).map(({ c }) => ({ id: c.id, outcome: c.outcome })));
  }
}
// Engines keep agreeing wherever 4.2.0 made the same decision in each. Where
// a rendering change applies, near-equal costs can settle differently in each
// engine's text metrics, as they already do in some 4.2.0 cells: those cells
// may not disagree more often than 4.2.0's engines do across the corpus.
if (runs.length > 1) {
  const same = (/** @type {'base' | 'cand'} */ which, /** @type {number} */ index) => runs.every(run => JSON.stringify(run[which][index].breaks) === JSON.stringify(runs[0][which][index].breaks) && run[which][index].outcome === runs[0][which][index].outcome);
  const unchanged = [], changed = { cells: 0, before: 0, after: 0 }, corpus = { cells: 0, before: 0 };
  for (const [index, cell] of cells.entries()) {
    if (cell.variant === 'justified') continue;
    const reasons = changeReasons(cell).length > 0;
    if (!cell.variant.startsWith('adversarial')) { corpus.cells++; corpus.before += +!same('base', index); }
    if (reasons) { changed.cells++; changed.before += +!same('base', index); changed.after += +!same('cand', index); }
    else if (same('base', index) && !same('cand', index)) unchanged.push({ id: cell.id, ...Object.fromEntries(runs.map(run => [run.name, [run.cand[index].outcome, ...run.cand[index].lines]])) });
  }
  report.counts.crossEngine = { corpus, changed };
  check('all', 'engines agree wherever 4.2.0 agreed and no change applies', !unchanged.length, unchanged.slice(0, 4));
  check('all', 'engines disagree no more often where a change applies than 4.2.0 does across the corpus',
    changed.after / Math.max(1, changed.cells) <= corpus.before / Math.max(1, corpus.cells), { corpus, changed });
}
if (values.dump) await writeFile(values.dump, JSON.stringify({ cells, runs }));
report.summary = { cells: cells.length, engines: runs.map(run => run.name), seconds: Math.round((performance.now() - started) / 1000),
  checks: report.checks.length, failed: report.checks.filter(c => !c.pass).length, errors: report.errors.length,
  changed: Object.fromEntries(Object.entries(report.counts).map(([key, value]) => [key, value.changed])) };
await writeFile(values.out, JSON.stringify(report, null, 2));
console.log(JSON.stringify({ ...report.summary, failures: report.checks.filter(c => !c.pass).slice(0, 8), errors: report.errors.slice(0, 4) }, null, 2));
if (report.summary.failed || report.summary.errors || !runs.length) process.exitCode = 1;
