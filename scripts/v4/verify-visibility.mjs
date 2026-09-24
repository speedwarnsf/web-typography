// @ts-check
// C8: text hidden with display:none (a class, the hidden attribute, a closed
// dialog, an inactive tab or stack card) or content-visibility keeps its
// composition, and the first frame after it is shown paints the same line
// boxes as before it was hidden, for mount(), TypesetText and TypesetRichText.
// Nothing may report 'unmeasurable' after the reveal, and no ResizeObserver
// loop error may be reported. Text in a content-visibility:auto section
// composes once scrolled into range (WebKit cached a failure).
import { build } from 'esbuild';
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { browsers } from './browsers.mjs';
import { artifacts } from './candidate.mjs';

const script = await readFile(artifacts.bundle, 'utf8');
const corpus = JSON.parse(await readFile('tests/v4-corpus.json', 'utf8')).paragraphs;
const escape = (/** @type {string} */ text) => text.replace(/&/g, '&amp;').replace(/</g, '&lt;');
const scenarios = ['class', 'hidden', 'dialog', 'tab', 'stack', 'cvhidden'];
const text = (/** @type {number} */ i) => corpus[(i * 7 + 3) % corpus.length];
const container = (/** @type {string} */ id, /** @type {number} */ i) => `<p class="m">${escape(text(i))}</p><div class="react" data-i="${i}"></div>`;
const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><style>
body{margin:0;font:17px/1.45 Georgia,serif}section,dialog{width:340px;padding:8px;margin:0}dialog{position:fixed;top:0;left:400px;border:0}
.off{display:none}.cvh{content-visibility:hidden}
#tabs[data-tab="b"] #tab-a{display:none}#tabs[data-tab="a"] #tab-b{display:none}
#stack>.card:not(:last-child){display:none}
.spacer{height:2600px}#cv{content-visibility:auto;contain-intrinsic-size:auto 400px}
</style></head><body>
<section id="s-class">${container('class', 0)}</section>
<section id="s-hidden">${container('hidden', 1)}</section>
<dialog id="s-dialog">${container('dialog', 2)}</dialog>
<div id="tabs" data-tab="a"><section id="tab-a">${container('tab', 3)}</section><section id="tab-b"><p>Other tab.</p></section></div>
<div id="stack"><section class="card" id="s-stack">${container('stack', 4)}</section></div>
<section id="s-cvhidden">${container('cvhidden', 5)}</section>
<div class="spacer"></div>
<section id="cv"><p class="m" id="cv-p">${escape(text(6))}</p></section>
<script src="/react.js"></script></body></html>`;

const reactFixture = (await build({
  stdin: { contents: `
import { createElement as h } from 'react';
import { createRoot } from 'react-dom/client';
import { flushSync } from 'react-dom';
import { TypesetText, TypesetRichText } from ${JSON.stringify(resolve(artifacts.react))};
const texts = ${JSON.stringify(Array.from({ length: 6 }, (_, i) => text(i + 10)))};
window.renderReact = () => {
  for (const el of document.querySelectorAll('.react')) {
    const t = texts[Number(el.dataset.i)], words = t.split(' ');
    flushSync(() => createRoot(el).render([
      h(TypesetText, { key: 't', text: t, className: 'rt' }),
      h(TypesetRichText, { key: 'r', className: 'rr' }, words.slice(0, 5).join(' ') + ' ', h('a', { href: '#x' }, words.slice(5, 8).join(' ')), ' ' + words.slice(8).join(' ')),
    ]));
  }
};
`, resolveDir: process.cwd(), loader: 'js' },
  bundle: true, minify: true, write: false, format: 'iife', target: 'es2022', define: { 'process.env.NODE_ENV': '"production"' }, logLevel: 'silent',
})).outputFiles[0].text;

/** @type {{ checks: { browser: string, label: string, pass: boolean, detail?: unknown }[], errors: { browser: string, error: string }[] }} */
const report = { checks: [], errors: [] };
for (const { name, engine, executablePath } of browsers) {
  const browser = await engine.launch({ executablePath, timeout: 20000 });
  /** @param {string} label @param {boolean} pass @param {unknown} [detail] */
  const check = (label, pass, detail) => report.checks.push({ browser: name, label, pass: !!pass, detail });
  try {
    const page = await browser.newPage({ viewport: { width: 900, height: 800 } });
    page.setDefaultTimeout(20000);
    await page.route('http://visibility.test/**', route => {
      const path = new URL(route.request().url()).pathname;
      if (path === '/react.js') return route.fulfill({ contentType: 'text/javascript', body: reactFixture });
      return route.fulfill({ contentType: 'text/html; charset=utf-8', body: html });
    });
    await page.goto('http://visibility.test/index.html');
    await page.addScriptTag({ content: script });
    await page.evaluate(async () => {
      const w = /** @type {any} */ (window);
      w.loopErrors = [];
      window.addEventListener('error', event => { if (/ResizeObserver/.test(String(event.message))) w.loopErrors.push(event.message); });
      /** @type {HTMLDialogElement} */ (document.getElementById('s-dialog')).showModal();
      await document.fonts.ready;
      w.renderReact();
      w.controller = w.Typeset.mount(document, 'p.m');
      await w.controller.ready;
      await new Promise(r => setTimeout(r, 400));
      w.snapshot = (/** @type {Element} */ scope) => [...scope.querySelectorAll('.m, .rt, .rr')].map(el => {
        const block = /** @type {HTMLElement} */ (el);
        return { kind: block.classList.contains('m') ? 'mount' : block.classList.contains('rt') ? 'TypesetText' : 'TypesetRichText', outcome: block.dataset.tsOutcome, breaks: block.querySelectorAll('br[data-ts-break]').length, lines: w.Typeset.measureLayout(block).lines.map((/** @type {any} */ line) => line.text) };
      });
    });
    const show = {
      class: ['document.getElementById("s-class").classList.add("off")', 'document.getElementById("s-class").classList.remove("off")'],
      hidden: ['document.getElementById("s-hidden").hidden = true', 'document.getElementById("s-hidden").hidden = false'],
      dialog: ['document.getElementById("s-dialog").close()', 'document.getElementById("s-dialog").showModal()'],
      tab: ['document.getElementById("tabs").dataset.tab = "b"', 'document.getElementById("tabs").dataset.tab = "a"'],
      stack: ['{ const card = document.createElement("section"); card.className = "card"; card.id = "pushed"; card.textContent = "Pushed card."; document.getElementById("stack").append(card); }', 'document.getElementById("pushed").remove()'],
      cvhidden: ['document.getElementById("s-cvhidden").classList.add("cvh")', 'document.getElementById("s-cvhidden").classList.remove("cvh")'],
    };
    for (const scenario of scenarios) {
      const scope = scenario === 'tab' ? '#tab-a' : `#s-${scenario}`;
      const result = await page.evaluate(async ({ scope, hide, reveal }) => {
        const w = /** @type {any} */ (window);
        const root = /** @type {Element} */ (document.querySelector(scope));
        const before = w.snapshot(root);
        (0, eval)(hide);
        await new Promise(r => setTimeout(r, 450));
        const whileHidden = [...root.querySelectorAll('.m, .rt, .rr')].map(el => ({ outcome: /** @type {HTMLElement} */ (el).dataset.tsOutcome, breaks: el.querySelectorAll('br[data-ts-break]').length }));
        // Show, then read what the first frame paints.
        const first = new Promise(resolve => requestAnimationFrame(() => resolve(w.snapshot(root))));
        (0, eval)(reveal);
        const firstFrame = await first;
        await new Promise(r => setTimeout(r, 500));
        return { before, whileHidden, firstFrame, settled: w.snapshot(root) };
      }, { scope, hide: show[/** @type {keyof typeof show} */ (scenario)][0], reveal: show[/** @type {keyof typeof show} */ (scenario)][1] });
      for (const [index, block] of result.before.entries()) {
        const label = `${scenario}: ${block.kind}`;
        const hiddenState = result.whileHidden[index], first = result.firstFrame[index], settled = result.settled[index];
        check(`${label} composes before hiding`, block.outcome === 'composed:rich' && block.breaks > 0, block);
        check(`${label} keeps its composition while hidden`, hiddenState.outcome === block.outcome && hiddenState.breaks === block.breaks, hiddenState);
        check(`${label} paints the same lines in the first frame after it is shown`, JSON.stringify(first.lines) === JSON.stringify(block.lines) && first.outcome !== 'unmeasurable', { before: block.lines.length, first: first.lines.length, outcome: first.outcome });
        check(`${label} stays composed after it is shown`, settled.outcome === 'composed:rich' && JSON.stringify(settled.lines) === JSON.stringify(block.lines), { outcome: settled.outcome, lines: settled.lines.length });
      }
    }
    // Shown at a different width: composed again at the new width.
    const resized = await page.evaluate(async () => {
      const w = /** @type {any} */ (window);
      const section = /** @type {HTMLElement} */ (document.getElementById('s-class'));
      section.classList.add('off');
      await new Promise(r => setTimeout(r, 200));
      section.style.width = '290px';
      section.classList.remove('off');
      const first = await new Promise(resolve => requestAnimationFrame(() => resolve(w.snapshot(section))));
      await new Promise(r => setTimeout(r, 600));
      const settled = w.snapshot(section);
      return { first: first.map((/** @type {any} */ b) => b.kind + ':' + b.outcome), settled: settled.map((/** @type {any} */ b) => ({ kind: b.kind, outcome: b.outcome, intact: b.lines.length === b.breaks + 1 })) };
    });
    check('shown at a new width, every block recomposes for it', resized.settled.every((/** @type {any} */ b) => b.outcome === 'composed:rich' && b.intact), resized);
    check('the mount() block is composed for the new width in the first frame', resized.first[0] === 'mount:composed:rich', resized.first);
    // content-visibility:auto, far below the fold, then scrolled into view.
    const cv = await page.evaluate(async () => {
      const w = /** @type {any} */ (window);
      const p = /** @type {HTMLElement} */ (document.getElementById('cv-p'));
      const before = p.dataset.tsOutcome;
      p.scrollIntoView();
      const t0 = performance.now();
      while (performance.now() - t0 < 3000 && p.dataset.tsOutcome !== 'composed:rich') await new Promise(r => setTimeout(r, 30));
      return { before, after: p.dataset.tsOutcome, ms: Math.round(performance.now() - t0), intact: w.Typeset.measureLayout(p).lines.length === p.querySelectorAll('br[data-ts-break]').length + 1 };
    });
    check('text in a content-visibility:auto section composes once scrolled into range', cv.after === 'composed:rich' && cv.intact && cv.before !== 'native:verification', cv);
    const errors = await page.evaluate(() => /** @type {any} */ (window).loopErrors);
    check('no ResizeObserver loop errors', errors.length === 0, errors);
    await page.close();
  } catch (error) { report.errors.push({ browser: name, error: String(/** @type {Error} */ (error).stack || error) }); }
  finally { await browser.close(); }
}
await writeFile('output/visibility.json', JSON.stringify(report, null, 2));
const failures = report.checks.filter(c => !c.pass);
console.log(JSON.stringify({ checks: report.checks.length, failures, errors: report.errors }, null, 2));
if (failures.length || report.errors.length) process.exitCode = 1;
