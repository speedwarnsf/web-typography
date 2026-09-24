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
} });
const started = performance.now();
const watchdog = setTimeout(() => { console.error('verify-golden: watchdog after 170 s'); process.exit(3); }, 170_000);
watchdog.unref();

const corpus = JSON.parse(await readFile('tests/v4-corpus.json', 'utf8')).paragraphs;
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
/** @typedef {{ id: string, variant: string, tag: string, html: string, width: number, font: string, options: Record<string, unknown> }} Cell */
/** @type {Cell[]} */
const cells = [];
for (const [index, text] of texts.entries()) for (const width of widths) for (const font of fonts) {
  const at = `${index * stride}@${width}/${font}`;
  cells.push({ id: 'default ' + at, variant: 'default', tag: 'p', html: escape(text), width, font, options: {} });
  cells.push({ id: 'rich ' + at, variant: 'rich', tag: 'p', html: linked(text), width, font, options: {} });
  cells.push({ id: 'legacy ' + at, variant: 'legacy', tag: 'p', html: escape(text), width, font, options: { lineBreaks: 'legacy', contour: 'natural' } });
  if (index % 2 === 0) cells.push({ id: 'finishes ' + at, variant: 'finishes', tag: 'p', html: escape(text), width, font, options: { smartQuotes: 'en', opticalHanging: true } });
  if (width <= 320) {
    const title = text.split(' ').slice(0, 9).join(' ');
    cells.push({ id: 'title ' + at, variant: 'title', tag: 'h2', html: escape(title), width: width - 60, font, options: {} });
  }
}

/** Runs in the page: compose each cell with one build and describe the result. */
function compose({ cells, build }) {
  const api = build === 'baseline' ? window.Baseline : window.Typeset;
  // Smart quotes are the one sanctioned change to the characters.
  const plain = text => text.replace(/[\u2018\u2019]/g, "'").replace(/[\u201c\u201d]/g, '"');
  const out = [];
  for (const cell of cells) {
    const el = document.createElement(cell.tag);
    el.style.cssText = `font:18px/1.5 ${cell.font === 'Georgia' ? 'Georgia, serif' : cell.font};width:${cell.width}px;margin:0;text-wrap:wrap`;
    el.innerHTML = cell.html;
    document.body.append(el);
    const native = api.measureLayout(el);
    let result;
    try { result = api.typeset(el, cell.options); } catch (error) { result = { outcome: 'threw ' + error.message, after: native, features: null }; }
    const after = api.measureLayout(el);
    out.push({ id: cell.id, outcome: result.outcome, features: result.features ?? null, markup: el.innerHTML,
      breaks: after.lines.map(line => line.sourceStart), lines: after.lines.map(line => line.text),
      overflow: after.overflow, nativeOrphan: native.lastSingleton, orphan: after.lastSingleton, nativeLines: native.lines.length,
      textIntact: plain(el.textContent) === plain(new DOMParser().parseFromString('<body>' + cell.html, 'text/html').body.textContent) });
    api.restore(el); el.remove();
  }
  return out;
}

/**
 * Constructions a 4.3 rendering change is about. A cell whose text has none
 * of them must be byte-identical to 4.2.0. Returns the reasons that apply.
 * @param {string} html
 * @returns {string[]}
 */
function changeReasons(html) {
  void html;
  return [];
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
    await page.addScriptTag({ content: baseline });
    await page.evaluate(() => { window.Baseline = window.Typeset; });
    await page.addScriptTag({ content: subject });
    /** @type {any[]} */ const base = [], cand = [];
    // Chunks keep each evaluate well inside Playwright's timeout.
    for (let i = 0; i < cells.length; i += 60) {
      const chunk = cells.slice(i, i + 60);
      base.push(...await page.evaluate(compose, { cells: chunk, build: 'baseline' }));
      cand.push(...await page.evaluate(compose, { cells: chunk, build: 'subject' }));
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
    const unexplained = differ.filter(({ cell }) => !changeReasons(cell.html).length);
    report.counts[`${name} ${variant}`] = { cells: pairs.length, changed: differ.length, unexplained: unexplained.length };
    for (const { c, b, cell } of differ) report.changed.push({ browser: name, id: c.id, reasons: changeReasons(cell.html), baseline: { outcome: b.outcome, lines: b.lines }, subject: { outcome: c.outcome, lines: c.lines } });
    check(name, `${variant}: identical to 4.2.0 unless a rendering change applies`, unexplained.length === 0,
      unexplained.length ? unexplained.slice(0, 4).map(({ c, b }) => ({ id: c.id, baseline: [b.outcome, ...b.lines], subject: [c.outcome, ...c.lines] })) : { cells: pairs.length, changed: differ.length });
    const overflow = pairs.filter(({ c }) => c.overflow > .5);
    check(name, `${variant}: no overflow`, !overflow.length, overflow.slice(0, 4).map(({ c }) => ({ id: c.id, overflow: c.overflow })));
    const orphans = pairs.filter(({ c, cell }) => cell.tag === 'p' && c.orphan && !c.nativeOrphan);
    check(name, `${variant}: no new orphan`, !orphans.length, orphans.slice(0, 4).map(({ c }) => ({ id: c.id, lines: c.lines })));
    const damaged = pairs.filter(({ c }) => !c.textIntact || /^threw/.test(c.outcome));
    check(name, `${variant}: source text intact`, !damaged.length, damaged.slice(0, 4).map(({ c }) => ({ id: c.id, outcome: c.outcome })));
  }
}
// Engines must keep agreeing wherever 4.2.0 made the same decision in each.
if (runs.length > 1) {
  const disagreements = [];
  for (const [index, cell] of cells.entries()) {
    const agreed = runs.every(run => JSON.stringify(run.base[index].breaks) === JSON.stringify(runs[0].base[index].breaks) && run.base[index].outcome === runs[0].base[index].outcome);
    const agrees = runs.every(run => JSON.stringify(run.cand[index].breaks) === JSON.stringify(runs[0].cand[index].breaks) && run.cand[index].outcome === runs[0].cand[index].outcome);
    if (agreed && !agrees) disagreements.push({ id: cell.id, ...Object.fromEntries(runs.map(run => [run.name, [run.cand[index].outcome, ...run.cand[index].lines]])) });
  }
  check('all', 'engines agree wherever 4.2.0 agreed', !disagreements.length, disagreements.slice(0, 4));
}
report.summary = { cells: cells.length, engines: runs.map(run => run.name), seconds: Math.round((performance.now() - started) / 1000),
  checks: report.checks.length, failed: report.checks.filter(c => !c.pass).length, errors: report.errors.length,
  changed: Object.fromEntries(Object.entries(report.counts).map(([key, value]) => [key, value.changed])) };
await writeFile(values.out, JSON.stringify(report, null, 2));
console.log(JSON.stringify({ ...report.summary, failures: report.checks.filter(c => !c.pass).slice(0, 8), errors: report.errors.slice(0, 4) }, null, 2));
if (report.summary.failed || report.summary.errors || !runs.length) process.exitCode = 1;
