// @ts-check
// C9: never paint double-wrapped text. In print, generated breaks switch off
// (--ts-break-display) and text wraps natively at the paper's width; an
// author can keep a composition with --ts-break-display:inline. During a
// resize, a block narrower than its widest composed line shows its native
// wrapping ([data-ts-stale]) until the size settles and it is recomposed.
// Every sampled frame must be either the intact composition (lines = breaks
// + 1) or the native wrapping (lines = an uncomposed twin's lines). The rules
// come back when a page's own document.adoptedStyleSheets assignment drops them.
import { build } from 'esbuild';
import { execFileSync } from 'node:child_process';
import { readFile, writeFile, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { browsers } from './browsers.mjs';
import { artifacts } from './candidate.mjs';

const script = await readFile(artifacts.bundle, 'utf8');
const shipped = await readFile(artifacts.styles, 'utf8');
const corpus = JSON.parse(await readFile('tests/v4-corpus.json', 'utf8')).paragraphs;
const escape = (/** @type {string} */ text) => text.replace(/&/g, '&amp;').replace(/</g, '&lt;');
const [a, b, c, d] = [corpus[5], corpus[9], corpus[14], corpus[22]].map(escape);
const pair = (/** @type {string} */ text, /** @type {string} */ id, cls = '') => `<p class="t ${cls}" id="${id}">${text}</p><p class="twin" data-no-typeset>${text}</p>`;
const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><style>
body{margin:0;font:17px/1.45 Georgia,serif}.col{width:440px}.fluid{width:44vw}.fixed{width:440px}
.col,.fixed,.fluid{position:relative;padding:0 8px}.twin{position:absolute;visibility:hidden;left:8px;right:8px;top:0;margin:0}
@media print{.col{width:300px}.keep{--ts-break-display:inline}}
</style></head><body>
<div class="col" id="col">${pair(a, 'a')}${pair(b, 'b')}</div>
<div class="fixed">${pair(c, 'k', 'keep')}</div>
<div class="fluid" id="fluid">${pair(d, 'f')}</div>
<div class="col" id="react-col"><div id="app"></div></div>
<script src="/react.js"></script></body></html>`;
const reactFixture = (await build({
  stdin: { contents: `
import { createElement as h } from 'react';
import { createRoot } from 'react-dom/client';
import { flushSync } from 'react-dom';
import { TypesetRichText } from ${JSON.stringify(resolve(artifacts.react))};
const words = ${JSON.stringify(corpus[30])}.split(' ');
window.renderReact = () => flushSync(() => createRoot(document.getElementById('app')).render([
  h(TypesetRichText, { key: 'r', id: 'r' }, words.slice(0, 6).join(' ') + ' ', h('em', null, words.slice(6, 8).join(' ')), ' ' + words.slice(8).join(' ')),
  h('p', { key: 'twin', className: 'twin', 'data-no-typeset': '' }, words.join(' ')),
]));
`, resolveDir: process.cwd(), loader: 'js' },
  bundle: true, minify: true, write: false, format: 'iife', target: 'es2022', define: { 'process.env.NODE_ENV': '"production"' }, logLevel: 'silent',
})).outputFiles[0].text;

let pdftotext = true;
try { execFileSync('pdftotext', ['-v'], { stdio: 'ignore' }); } catch { pdftotext = false; }

/** @type {{ checks: { browser: string, label: string, pass: boolean, detail?: unknown }[], errors: { browser: string, error: string }[] }} */
const report = { checks: [], errors: [] };
const normalize = (/** @type {string} */ css) => css.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\s+/g, '').replace(/;}/g, '}');
report.checks.push({ browser: '-', label: 'dist styles.css carries the rules the engine installs', pass: normalize(shipped).includes(normalize(await (async () => {
  const source = await readFile('src/lib/v4/lifecycle.ts', 'utf8');
  const match = source.match(/export const LIFECYCLE_CSS = ([\s\S]*?);\n/);
  return match ? Function(`return ${match[1]}`)() : '<missing>';
})())) });

// In-page helpers: a composed block and its uncomposed twin.
const helpers = () => {
  const w = /** @type {any} */ (window);
  w.sample = (/** @type {string} */ id) => {
    const el = /** @type {HTMLElement} */ (document.getElementById(id));
    // The twin is absolutely positioned over the same content box, unstyled by the engine.
    let twin = /** @type {HTMLElement} */ (el.nextElementSibling);
    while (twin && !twin.classList.contains('twin')) twin = /** @type {HTMLElement} */ (twin.nextElementSibling);
    const lines = w.Typeset.measureLayout(el).lines.length, breaks = el.querySelectorAll('br[data-ts-break]').length;
    const native = w.Typeset.measureLayout(twin).lines.length, stale = el.hasAttribute('data-ts-stale');
    return { lines, breaks, native, stale, outcome: el.dataset.tsOutcome, ok: stale ? lines === native : el.dataset.tsOutcome !== 'composed:rich' || lines === breaks + 1 };
  };
  w.quiet = async (ms = 300) => { await new Promise(r => setTimeout(r, ms)); await new Promise(r => requestAnimationFrame(() => r(undefined))); };
};

for (const { name, engine, executablePath } of browsers) {
  const browser = await engine.launch({ executablePath, timeout: 20000 });
  /** @param {string} label @param {boolean} pass @param {unknown} [detail] */
  const check = (label, pass, detail) => report.checks.push({ browser: name, label, pass: !!pass, detail });
  try {
    const page = await browser.newPage({ viewport: { width: 1200, height: 900 } });
    page.setDefaultTimeout(20000);
    await page.route('http://print.test/**', route => {
      const path = new URL(route.request().url()).pathname;
      if (path === '/react.js') return route.fulfill({ contentType: 'text/javascript', body: reactFixture });
      return route.fulfill({ contentType: 'text/html; charset=utf-8', body: html });
    });
    await page.goto('http://print.test/index.html');
    await page.addScriptTag({ content: script });
    await page.evaluate(helpers);
    await page.evaluate(async () => {
      const w = /** @type {any} */ (window);
      w.loopErrors = [];
      window.addEventListener('error', event => { if (/ResizeObserver/.test(String(event.message))) w.loopErrors.push(event.message); });
      await document.fonts.ready;
      w.renderReact();
      w.controller = w.Typeset.mount(document, 'p.t');
      await w.controller.ready;
      await w.quiet(400);
    });
    const screen = await page.evaluate(() => ({ markup: [...document.querySelectorAll('p.t, #r')].map(el => el.outerHTML), samples: ['a', 'b', 'k', 'f', 'r'].map(id => /** @type {any} */ (window).sample(id)) }));
    check('fixture composes', screen.samples.every(s => s.outcome === 'composed:rich' && s.ok && s.breaks > 0), screen.samples);

    // Print: native wrapping at the paper's width, an author override, and
    // the screen composition untouched afterwards.
    await page.emulateMedia({ media: 'print' });
    const print = await page.evaluate(async () => {
      const w = /** @type {any} */ (window);
      await w.quiet(100);
      const br = /** @type {HTMLElement} */ (document.querySelector('#a br[data-ts-break]'));
      return { a: w.sample('a'), b: w.sample('b'), keep: w.sample('k'), breakDisplay: getComputedStyle(br).display, keepDisplay: getComputedStyle(/** @type {Element} */ (document.querySelector('#k br[data-ts-break]'))).display };
    });
    check('print wraps natively at the print width', [print.a, print.b].every(s => s.lines === s.native && s.breaks > 0) && print.breakDisplay === 'none', print);
    check('an author print override keeps a composition', print.keepDisplay !== 'none' && print.keep.lines === print.keep.breaks + 1, print.keep);
    if (name === 'chromium') {
      // page.pdf() prints with print media unless another medium is emulated.
      await page.emulateMedia({ media: null });
      const dir = await mkdtemp(join(tmpdir(), 'ts-print-'));
      try {
        const file = join(dir, 'print.pdf');
        await page.pdf({ path: file, format: 'A4' });
        if (!pdftotext) check('A4 PDF prints (pdftotext unavailable: line check skipped)', true);
        else {
          const text = execFileSync('pdftotext', ['-layout', file, '-'], { encoding: 'utf8' });
          const words = print.a.native;
          const first = (await page.evaluate(() => document.getElementById('a')?.textContent?.trim().split(/\s+/).slice(0, 3).join(' '))) || '';
          const lastWord = (await page.evaluate(() => document.getElementById('a')?.textContent?.trim().split(/\s+/).at(-1))) || '';
          const lines = text.split('\n');
          const start = lines.findIndex(line => line.includes(first));
          const end = lines.findIndex((line, i) => i >= start && line.includes(lastWord));
          check('an A4 PDF prints the paragraph in its native lines', start >= 0 && end >= start && end - start + 1 === words, { pdfLines: end - start + 1, native: words });
        }
      } finally { await rm(dir, { recursive: true, force: true }); }
    }

    await page.emulateMedia({ media: 'screen' });
    const back = await page.evaluate(async () => { const w = /** @type {any} */ (window); await w.quiet(300); return { markup: [...document.querySelectorAll('p.t, #r')].map(el => el.outerHTML), samples: ['a', 'b', 'k', 'f', 'r'].map(id => w.sample(id)) }; });
    check('screen output is unchanged after print', JSON.stringify(back.markup) === JSON.stringify(screen.markup) && back.samples.every(s => s.ok && !s.stale), back.samples);
    // A page that assigns document.adoptedStyleSheets (a theme switcher, the
    // MDN example) drops the engine's lifecycle sheet; print still wraps natively.
    await page.evaluate(() => { const sheet = /** @type {any} */ (window).pageSheet = new CSSStyleSheet(); sheet.replaceSync('.theme{color:#111}'); document.adoptedStyleSheets = [sheet]; });
    await page.emulateMedia({ media: 'print' });
    const adopted = await page.evaluate(async () => {
      const w = /** @type {any} */ (window);
      await w.quiet(100);
      const sheets = [...document.adoptedStyleSheets];
      return { a: w.sample('a'), b: w.sample('b'), pageSheetKept: sheets.includes(w.pageSheet), lifecycleSheets: sheets.filter(sheet => [...sheet.cssRules].some(rule => rule.cssText.includes('--ts-break-display'))).length };
    });
    await page.emulateMedia({ media: 'screen' });
    await page.evaluate(() => /** @type {any} */ (window).quiet(300));
    check('print wraps natively after the page replaces document.adoptedStyleSheets', [adopted.a, adopted.b].every(s => s.lines === s.native && s.breaks > 0) && adopted.pageSheetKept && adopted.lifecycleSheets >= 1, adopted);
    // Resize: a container width animated from script, one change per frame.
    const drag = await page.evaluate(async () => {
      const w = /** @type {any} */ (window);
      const col = /** @type {HTMLElement} */ (document.getElementById('col'));
      const samples = [];
      await new Promise(resolve => {
        let i = 0;
        const tick = () => {
          if (i > 0) samples.push(w.sample('a'), w.sample('b'));
          if (i++ >= 32) { resolve(undefined); return; }
          col.style.width = Math.round(340 + 110 * Math.cos(i / 32 * Math.PI * 2)) + 'px';
          requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
      });
      const staleFrames = samples.filter(s => s.stale).length;
      await w.quiet(500);
      return { bad: samples.filter(s => !s.ok), frames: samples.length, staleFrames, settled: [w.sample('a'), w.sample('b')] };
    });
    check('a container resized from script: no double-wrapped frame', drag.bad.length === 0, { bad: drag.bad.slice(0, 3), frames: drag.frames, staleFrames: drag.staleFrames });
    check('the resized container settles composed', drag.settled.every(s => s.outcome === 'composed:rich' && s.ok && !s.stale), drag.settled);

    // Window resize: a vw-wide column.
    await page.evaluate(() => {
      const w = /** @type {any} */ (window);
      w.windowSamples = [];
      w.sampling = true;
      const tick = () => { if (!w.sampling) return; w.windowSamples.push(w.sample('f')); requestAnimationFrame(tick); };
      requestAnimationFrame(tick);
    });
    for (const width of [1150, 1080, 1010, 940, 880, 820, 900, 1000, 1100, 1200]) { await page.setViewportSize({ width, height: 900 }); await page.waitForTimeout(24); }
    const windowResize = await page.evaluate(async () => {
      const w = /** @type {any} */ (window);
      await w.quiet(400);
      w.sampling = false;
      const samples = /** @type {any[]} */ (w.windowSamples);
      return { bad: samples.filter(s => !s.ok), frames: samples.length, settled: w.sample('f') };
    });
    check('a window resize: no double-wrapped frame', windowResize.bad.length === 0, { bad: windowResize.bad.slice(0, 3), frames: windowResize.frames });
    check('the window resize settles composed', windowResize.settled.outcome === 'composed:rich' && windowResize.settled.ok && !windowResize.settled.stale, windowResize.settled);

    // A width change no observer sees coming (a stylesheet rule), and
    // TypesetRichText: the stale mode starts one frame late, never more.
    const unseen = await page.evaluate(async () => {
      const w = /** @type {any} */ (window);
      const sheet = /** @type {CSSStyleSheet} */ (document.styleSheets[0]);
      const index = sheet.insertRule('#col, #react-col { width: 440px }', sheet.cssRules.length);
      const rule = /** @type {CSSStyleRule} */ (sheet.cssRules[index]);
      /** @type {HTMLElement} */ (document.getElementById('col')).style.width = '';
      await w.quiet(400);
      const breaks = /** @type {Element} */ (document.getElementById('r')).querySelectorAll('br[data-ts-break]').length;
      const samples = [];
      let replans = 0;
      const watcher = new MutationObserver(records => { if (records.some(r => [...r.addedNodes].some(n => n.nodeName === 'BR'))) replans++; });
      watcher.observe(/** @type {Element} */ (document.getElementById('r')), { childList: true, subtree: true });
      await new Promise(resolve => {
        let i = 0;
        const tick = () => {
          if (i > 0) samples.push({ css: w.sample('a'), rich: w.sample('r') });
          if (i++ >= 24) { resolve(undefined); return; }
          rule.style.width = Math.round(330 - 4 * i) + 'px';
          requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
      });
      const duringDrag = replans;
      await w.quiet(600);
      watcher.disconnect();
      return { cssBad: samples.filter(s => !s.css.ok).length, richBad: samples.filter(s => !s.rich.ok).length, frames: samples.length, replansDuringDrag: duringDrag, breaksBefore: breaks, settled: [w.sample('a'), w.sample('r')] };
    });
    check('a stylesheet-driven resize: at most the first frame is double-wrapped', unseen.cssBad <= 1, unseen);
    check('TypesetRichText during a resize: at most the first frame is double-wrapped, and it replans once the size settles', unseen.richBad <= 1 && unseen.replansDuringDrag === 0, unseen);
    check('both settle composed', unseen.settled.every(s => s.outcome === 'composed:rich' && s.ok && !s.stale), unseen.settled);
    const errors = await page.evaluate(() => /** @type {any} */ (window).loopErrors);
    check('no ResizeObserver loop errors', errors.length === 0, errors);
    await page.close();
  } catch (error) { report.errors.push({ browser: name, error: String(/** @type {Error} */ (error).stack || error) }); }
  finally { await browser.close(); }
}
await writeFile('output/print-resize.json', JSON.stringify(report, null, 2));
const failures = report.checks.filter(c => !c.pass);
console.log(JSON.stringify({ checks: report.checks.length, failures, errors: report.errors }, null, 2));
if (failures.length || report.errors.length) process.exitCode = 1;
