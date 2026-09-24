// @ts-check
// Alignment the engine cannot keep is declined (C3). A generated break ends
// its line, so each composed line takes the last-line alignment: justified
// text would turn ragged, and a text-align-last would apply to every line.
// Such paragraphs report native:justify and keep the author's layout under
// every entry point (typeset, mount, go.js, TypesetText, TypesetRichText, the
// legacy renderer), and audit() reports composed output whose alignment has
// since changed. Left, centred and right-aligned text still compose.
import { build } from 'esbuild';
import { readFile, writeFile } from 'node:fs/promises';
import { browsers } from './browsers.mjs';
import { releaseIdentity } from './release-evidence.mjs';
import { reactUnderTest } from './candidate.mjs';

const watchdog = setTimeout(() => { console.error('verify-alignment: watchdog after 170 s'); process.exit(3); }, 170_000);
watchdog.unref();
const bundle = await readFile(process.env.TYPESET_BUNDLE || 'packages/typeset-v4/dist/typeset.global.js', 'utf8');
const go = await readFile(process.env.TYPESET_GO || 'packages/typeset-v4/dist/go.js', 'utf8');
const text = JSON.parse(await readFile('tests/v4-corpus.json', 'utf8')).paragraphs[1];
const RICH = 'The studio archive holds <a href="#archive">eighty-seven HIV and STD prevention campaigns</a>. Three stand for them here: <em>a CDC national testing campaign</em>, a franchise that has run for more than two decades, and PrEP outreach in Ohio.';
const react = await build({ stdin: { contents: `
import React from 'react'; import { createRoot } from 'react-dom/client';
import { TypesetText, TypesetRichText } from './src/lib/v4/typeset.release.react';
const text = ${JSON.stringify(text)};
createRoot(document.getElementById('root')!).render(<>
  <TypesetText id="plain" text={text} style={{ textAlign: 'justify' }} />
  <TypesetRichText id="rich" style={{ textAlign: 'justify' }}>${RICH}</TypesetRichText>
  <TypesetRichText id="rich-left">The studio archive holds <a href="#archive">eighty-seven HIV and STD prevention campaigns</a>. Three stand for them here: <em>a CDC national testing campaign</em>, a franchise that has run for more than two decades, and PrEP outreach in Ohio.</TypesetRichText>
</>);`, loader: 'tsx', resolveDir: process.cwd() }, bundle: true, write: false, format: 'iife', target: 'es2022', plugins: [reactUnderTest()] });

const report = { ...await releaseIdentity(), checks: /** @type {any[]} */ ([]), errors: /** @type {any[]} */ ([]), browsers: /** @type {Record<string, string>} */ ({}) };
const css = 'body{margin:24px}p{font:18px/1.5 Georgia,serif;width:320px;margin:0 0 16px}a{color:#176650}';

/** Runs in the page: every non-last line of a justified paragraph reaches the content edge. */
function flushLines(/** @type {HTMLElement} */ el) {
  const layout = window.Typeset.measureLayout(el);
  const box = el.getBoundingClientRect();
  return layout.lines.length > 2 && layout.lines.slice(0, -1).every((/** @type {any} */ line) => Math.abs(box.right - line.right) <= 1);
}

for (const { name, engine, executablePath } of browsers) {
  const browser = await engine.launch({ executablePath, timeout: 20_000 });
  report.browsers[name] = browser.version();
  const check = (/** @type {string} */ label, /** @type {unknown} */ pass, /** @type {unknown} */ detail) => report.checks.push({ browser: name, label, pass: !!pass, ...(detail === undefined ? {} : { detail }) });
  try {
    const page = await browser.newPage({ viewport: { width: 900, height: 900 } });
    page.setDefaultTimeout(20_000);
    page.on('pageerror', (/** @type {Error} */ error) => report.errors.push({ browser: name, error: error.message }));

    // typeset(), the legacy renderer and audit().
    await page.setContent(`<!doctype html><html lang="en"><head><style>${css}</style></head><body></body></html>`);
    await page.addScriptTag({ content: bundle });
    await page.evaluate(flushLines.toString().replace(/^function flushLines/, 'window.flushLines = function'));
    const direct = await page.evaluate(text => {
      const api = window.Typeset, out = [];
      const make = (/** @type {string} */ style) => { const p = document.createElement('p'); p.style.cssText = style; p.textContent = text; document.body.append(p); return p; };
      for (const [label, style, options] of /** @type {[string, string, any][]} */ ([
        ['justify', 'text-align:justify', {}], ['justify-all', 'text-align:justify-all', {}],
        ['text-align-last justify', 'text-align:left;text-align-last:justify', {}], ['text-align-last center', 'text-align:left;text-align-last:center', {}],
        ['justify, legacy renderer', 'text-align:justify', { lineBreaks: 'legacy' }], ['justify, title mode', 'text-align:justify', { mode: 'title' }],
        ['justify with every finish', 'text-align:justify', { smartQuotes: 'en', opticalHanging: true }],
      ])) {
        const p = make(style);
        if (/justify-all/.test(style) && getComputedStyle(p).textAlign !== 'justify-all') { p.remove(); continue; } // not supported by this engine
        const markup = p.innerHTML, flush = /justify/.test(style) && !/last/.test(style) ? window.flushLines(p) : null;
        const result = api.typeset(p, options);
        out.push({ label, outcome: result.outcome, untouched: p.innerHTML === markup && !p.querySelector('[data-ts-break], [data-ts-track]'), flushBefore: flush, flushAfter: flush === null ? null : window.flushLines(p) });
        api.restore(p); p.remove();
      }
      for (const [label, style] of [['left', 'text-align:left'], ['start', 'text-align:start'], ['center', 'text-align:center'], ['right', 'text-align:right'],
        ['matching text-align-last', 'text-align:left;text-align-last:left'], ['centred with centred last line', 'text-align:center;text-align-last:center']]) {
        const p = make(style);
        const result = api.typeset(p);
        out.push({ label, outcome: result.outcome, composes: true });
        api.restore(p); p.remove();
      }
      const short = make('text-align:justify'); short.textContent = 'One short line.';
      out.push({ label: 'a single justified line', outcome: api.typeset(short).outcome, single: true }); api.restore(short); short.remove();
      // Composed while left-aligned, then justified by a later style change.
      const later = make('text-align:left'); later.id = 'later';
      const composed = api.typeset(later).outcome;
      later.style.textAlign = 'justify';
      const issues = api.auditJSON('#later').issues.filter((/** @type {any} */ issue) => issue.type === 'alignment-lost');
      out.push({ label: 'audit reports alignment lost after composition', composed, issues: issues.length, target: issues[0]?.target });
      api.restore(later);
      const clean = api.auditJSON('#later').issues.filter((/** @type {any} */ issue) => issue.type === 'alignment-lost');
      out.push({ label: 'audit is quiet once the paragraph is native', issues: clean.length });
      return out;
    }, text);
    for (const row of direct) {
      if ('untouched' in row) {
        check(`typeset declines ${row.label}`, row.outcome === 'native:justify' && row.untouched, row);
        if (row.flushBefore !== null) check(`${row.label} keeps every non-last line flush`, row.flushBefore && row.flushAfter, row);
      } else if (row.composes) check(`${row.label} still composes`, row.outcome === 'composed:rich', row);
      else if (row.single) check('a single justified line is native:fits', row.outcome === 'native:fits', row);
      else if ('composed' in row) check(row.label, row.composed === 'composed:rich' && row.issues === 1 && row.target === '#later', row);
      else check(row.label, row.issues === 0, row);
    }

    // mount()
    await page.setContent(`<!doctype html><html lang="en"><head><style>${css}</style></head><body><p id="j" style="text-align:justify">${text}</p><p id="l">${text}</p></body></html>`);
    await page.addScriptTag({ content: bundle });
    const mounted = await page.evaluate(async () => {
      const markup = document.querySelector('#j').innerHTML;
      const controller = window.Typeset.mount(document, 'p');
      await controller.ready;
      const j = /** @type {HTMLElement} */ (document.querySelector('#j')), l = /** @type {HTMLElement} */ (document.querySelector('#l'));
      const out = { outcome: j.dataset.tsOutcome, untouched: j.innerHTML === markup, left: l.dataset.tsOutcome, audit: window.Typeset.auditJSON('#j').errors };
      controller.disconnect();
      return out;
    });
    check('mount() declines a justified paragraph', mounted.outcome === 'native:justify' && mounted.untouched && mounted.audit === 0, mounted);
    check('mount() composes its left-aligned neighbour', mounted.left === 'composed:rich', mounted);

    // go.js
    await page.setContent(`<!doctype html><html lang="en"><head><style>${css}</style></head><body><p id="j" data-typeset style="text-align:justify">${text}</p><p id="l" data-typeset>${text}</p></body></html>`);
    await page.addScriptTag({ content: go });
    const loaded = await page.evaluate(async () => {
      const markup = document.querySelector('#j').innerHTML;
      await window.TypesetReady;
      const j = /** @type {HTMLElement} */ (document.querySelector('#j')), l = /** @type {HTMLElement} */ (document.querySelector('#l'));
      return { outcome: j.dataset.tsOutcome, untouched: !j.querySelector('[data-ts-break], [data-ts-track]'), markup: j.innerHTML === markup, left: l.dataset.tsOutcome };
    });
    check('go.js declines a justified paragraph', loaded.outcome === 'native:justify' && loaded.untouched && loaded.markup, loaded);
    check('go.js composes its left-aligned neighbour', loaded.left === 'composed:rich', loaded);

    // React adapters
    // A static twin of the rich fixture shows the engine's own justified layout.
    await page.setContent(`<!doctype html><html lang="en"><head><style>${css}</style></head><body><div id="root"></div><p id="rich-native" style="text-align:justify">${RICH}</p></body></html>`);
    await page.addScriptTag({ content: bundle });
    await page.evaluate(flushLines.toString().replace(/^function flushLines/, 'window.flushLines = function'));
    await page.addScriptTag({ content: react.outputFiles[0].text });
    await page.waitForFunction(() => ['#plain', '#rich', '#rich-left'].every(id => /** @type {HTMLElement} */ (document.querySelector(id))?.dataset.tsOutcome));
    await page.waitForTimeout(100);
    const adapters = await page.evaluate(() => {
      const edges = (/** @type {string} */ id) => window.Typeset.measureLayout(document.querySelector(id)).lines.map((/** @type {any} */ line) => line.right - document.querySelector(id).getBoundingClientRect().left);
      const twin = edges('#rich-native');
      return Object.fromEntries(['#plain', '#rich', '#rich-left'].map(id => {
        const el = /** @type {HTMLElement} */ (document.querySelector(id));
        // Engines justify a line that ends inside a link differently; the twin is the reference.
        return [id, { outcome: el.dataset.tsOutcome, markers: el.querySelectorAll('[data-ts-break], [data-ts-track]').length, flush: window.flushLines(el),
          asNative: edges(id).length === twin.length && edges(id).every((right, i) => Math.abs(right - twin[i]) <= .5) }];
      }));
    });
    check('TypesetText declines a justified paragraph', adapters['#plain'].outcome === 'native:justify' && !adapters['#plain'].markers && adapters['#plain'].flush, adapters['#plain']);
    check('TypesetRichText declines a justified paragraph', adapters['#rich'].outcome === 'native:justify' && !adapters['#rich'].markers && adapters['#rich'].asNative, adapters['#rich']);
    check('TypesetRichText composes left-aligned text', adapters['#rich-left'].outcome === 'composed:rich', adapters['#rich-left']);
  } catch (error) { report.errors.push({ browser: name, error: String(/** @type {Error} */ (error).stack) }); }
  finally { await browser.close(); }
}
report.summary = { checks: report.checks.length, failed: report.checks.filter(c => !c.pass).length, errors: report.errors.length };
await writeFile('output/alignment.json', JSON.stringify(report, null, 2));
console.log(JSON.stringify({ ...report.summary, failures: report.checks.filter(c => !c.pass).slice(0, 10), errors: report.errors }, null, 2));
if (report.summary.failed || report.summary.errors) process.exitCode = 1;
