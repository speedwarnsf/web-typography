// @ts-check
// P3: ancestor mutations that leave every line unchanged (a transform
// animation, a class with no styles, a scroll-linked custom property, a fade)
// must not recompose anything, and a translation or fade must not even
// trigger a recheck pass; ancestor changes that do change text metrics (a theme
// font, a vw font size under a window resize, scale, zoom) must recompose, with
// rendered lines equal to generated breaks + 1. Removing unrelated nodes must
// not scan every claimed element.
import { readFile, writeFile } from 'node:fs/promises';
import { browsers } from './browsers.mjs';
import { artifacts } from './candidate.mjs';

const script = await readFile(artifacts.bundle, 'utf8');
const corpus = JSON.parse(await readFile('tests/v4-corpus.json', 'utf8')).paragraphs.slice(0, 40);
const escape = (/** @type {string} */ text) => text.replace(/&/g, '&amp;').replace(/</g, '&lt;');
const paragraphs = corpus.map((/** @type {string} */ text, /** @type {number} */ i) => `<p${i % 5 === 0 ? ' class="vw"' : ''}>${escape(text)}</p>`).join('');
const page = `<!doctype html><html lang="en"><head><style>
body{margin:0;font:17px/1.5 Georgia,serif}article{width:560px;padding:0 16px}
.theme p{font-size:19px;letter-spacing:.01em}.scaled{transform:scale(.9);transform-origin:0 0}.zoomed{zoom:1.1}
p.vw{font-size:clamp(12px,2.1vw,30px);width:480px}
</style></head><body><div id="shell"><div id="wrap"><article>${paragraphs}</article></div></div>
<article id="notes">${Array.from({ length: 400 }, (_, i) => `<p>Note ${i + 1}.</p>`).join('')}</article><ul id="list"></ul></body></html>`;

/** @type {{ checks: { browser: string, label: string, pass: boolean, detail?: unknown }[], errors: { browser: string, error: string }[] }} */
const report = { checks: [], errors: [] };
for (const { name, engine, executablePath } of browsers) {
  const browser = await engine.launch({ executablePath, timeout: 20000 });
  try {
    const context = await browser.newContext({ viewport: { width: 1100, height: 900 } });
    const tab = await context.newPage();
    tab.setDefaultTimeout(20000);
    await tab.setContent(page);
    // Time every MutationObserver callback the engine registers.
    await tab.evaluate(() => {
      const w = /** @type {any} */ (window), Native = window.MutationObserver;
      w.observerMs = 0;
      w.MutationObserver = class extends Native {
        constructor(/** @type {MutationCallback} */ callback) { super((records, observer) => { const t0 = performance.now(); try { callback(records, observer); } finally { w.observerMs += performance.now() - t0; } }); }
      };
    });
    await tab.addScriptTag({ content: script });
    await tab.evaluate(async () => {
      const w = /** @type {any} */ (window);
      w.controller = w.Typeset.mount(document, 'article p');
      await w.controller.ready;
      w.frames = (/** @type {number} */ n, /** @type {(i: number) => void} */ step) => new Promise(resolve => {
        let i = 0;
        const tick = () => { step(i); if (++i < n) requestAnimationFrame(tick); else resolve(undefined); };
        requestAnimationFrame(tick);
      });
      // Wait until the controller has been idle for 400 ms.
      w.quiet = async () => {
        let passes = w.controller.stats.passes, since = performance.now();
        const start = performance.now();
        while (performance.now() - start < 15000) {
          await new Promise(r => setTimeout(r, 50));
          if (w.controller.stats.passes !== passes) { passes = w.controller.stats.passes; since = performance.now(); }
          else if (performance.now() - since > 400) return true;
        }
        return false;
      };
      w.stale = () => [...document.querySelectorAll('#wrap p')].filter(el => {
        const p = /** @type {HTMLElement} */ (el);
        return p.dataset.tsOutcome === 'composed:rich' && w.Typeset.measureLayout(p).lines.length !== p.querySelectorAll('br[data-ts-break]').length + 1;
      }).length;
      w.composed = () => document.querySelectorAll('#wrap p[data-ts-outcome="composed:rich"]').length;
      await w.quiet();
    });
    /** @param {string} label @param {boolean} pass @param {unknown} [detail] */
    const check = (label, pass, detail) => report.checks.push({ browser: name, label, pass: !!pass, detail });
    const initial = await tab.evaluate(() => ({ composed: /** @type {any} */ (window).composed(), stale: /** @type {any} */ (window).stale() }));
    check('fixture composes', initial.composed >= 30 && initial.stale === 0, initial);

    // Storms: nothing about any line changes.
    for (const [label, run] of /** @type {[string, string][]} */ ([
      ['60 frames of an ancestor transform animation', `frames(60, i => { document.getElementById('wrap').style.transform = 'translate(' + (i % 12) + 'px, ' + (i % 5) + 'px)'; })`],
      ['30 toggles of a body class with no styles', `frames(30, () => document.body.classList.toggle('menu-open'))`],
      ['60 frames of a scroll-linked custom property on html', `frames(60, i => document.documentElement.style.setProperty('--scroll', String(i / 60)))`],
      ['60 frames of an ancestor fade and slide', `frames(60, i => { const s = document.getElementById('shell').style; s.opacity = String(1 - i / 120); s.translate = (i % 7) + 'px 0'; })`],
    ])) {
      const result = await tab.evaluate(async run => {
        const w = /** @type {any} */ (window);
        const before = w.controller.stats.compositions, passes = w.controller.stats.passes;
        const html = [...document.querySelectorAll('article p')].map(p => p.innerHTML).join('');
        await (0, eval)(run);
        await w.quiet();
        return { compositions: w.controller.stats.compositions - before, passes: w.controller.stats.passes - passes, unchanged: html === [...document.querySelectorAll('article p')].map(p => p.innerHTML).join(''), stale: w.stale() };
      }, run);
      check(`${label}: 0 compositions`, result.compositions === 0 && result.unchanged && result.stale === 0, result);
      // A translation or fade moves no line: not even a layout-key recheck.
      if (/transform|fade/.test(label)) check(`${label}: no recheck pass at all`, result.passes === 0, result);
    }
    await tab.evaluate(() => { const wrap = /** @type {HTMLElement} */ (document.getElementById('wrap')); wrap.style.transform = ''; document.documentElement.style.removeProperty('--scroll'); const shell = /** @type {HTMLElement} */ (document.getElementById('shell')); shell.style.opacity = ''; shell.style.translate = ''; });

    // Changes that alter text metrics through an ancestor.
    const theme = await tab.evaluate(async () => {
      const w = /** @type {any} */ (window);
      const before = w.controller.stats.compositions;
      document.body.classList.add('theme');
      await w.quiet();
      const after = { compositions: w.controller.stats.compositions - before, stale: w.stale(), composed: w.composed() };
      document.body.classList.remove('theme');
      await w.quiet();
      return { ...after, restoredStale: w.stale() };
    });
    check('an ancestor theme class that changes descendant fonts recomposes', theme.compositions > 0 && theme.stale === 0 && theme.restoredStale === 0 && theme.composed >= 30, theme);

    const before = await tab.evaluate(() => /** @type {any} */ (window).controller.stats.compositions);
    await tab.setViewportSize({ width: 1300, height: 900 });
    await tab.evaluate(() => /** @type {any} */ (window).quiet());
    await tab.setViewportSize({ width: 900, height: 900 });
    const vw = await tab.evaluate(async before => {
      const w = /** @type {any} */ (window);
      await w.quiet();
      return { compositions: w.controller.stats.compositions - before, stale: w.stale(), vw: [...document.querySelectorAll('p.vw')].map(p => /** @type {HTMLElement} */ (p).dataset.tsOutcome) };
    }, before);
    check('vw font sizes under a window resize recompose', vw.compositions > 0 && vw.stale === 0, vw);

    for (const cls of ['scaled', 'zoomed']) {
      const result = await tab.evaluate(async cls => {
        const w = /** @type {any} */ (window);
        const wrap = /** @type {HTMLElement} */ (document.getElementById('wrap'));
        wrap.classList.add(cls);
        await w.quiet();
        const outcomes = [...new Set([...document.querySelectorAll('#wrap p')].map(p => /** @type {HTMLElement} */ (p).dataset.tsOutcome))];
        wrap.classList.remove(cls);
        await w.quiet();
        return { whileApplied: outcomes, after: w.composed(), stale: w.stale() };
      }, cls);
      // Zoom is not supported by every engine's computed style; where it has no
      // effect the text simply stays composed and verified.
      const declined = result.whileApplied.length === 1 && result.whileApplied[0] === 'native:transformed';
      check(`an ancestor ${cls === 'scaled' ? 'scale' : 'zoom'} is declined and recomposed when removed`, (declined || (cls === 'zoomed' && !result.whileApplied.includes('native:transformed'))) && result.after >= 30 && result.stale === 0, result);
    }

    // Unrelated removals: the engine's observer callbacks while a list of 1000
    // nodes is replaced (timers are coarse in WebKit and Gecko; mean of 20).
    const removal = await tab.evaluate(async () => {
      const w = /** @type {any} */ (window);
      const list = /** @type {HTMLElement} */ (document.getElementById('list'));
      const fill = () => { const frag = document.createDocumentFragment(); for (let i = 0; i < 1000; i++) { const li = document.createElement('li'); li.textContent = 'Item ' + i; frag.append(li); } list.append(frag); };
      let total = 0;
      for (let round = 0; round < 20; round++) {
        fill();
        await new Promise(r => setTimeout(r, 10));
        w.observerMs = 0;
        list.replaceChildren();
        await new Promise(r => setTimeout(r, 0));
        total += w.observerMs;
      }
      return { overheadMs: +(total / 20).toFixed(3), owned: document.querySelectorAll('article p[data-typeset-done]').length };
    });
    check('removing 1000 unrelated nodes costs the controller under 1 ms', removal.overheadMs < 1, removal);
    await context.close();
  } catch (error) { report.errors.push({ browser: name, error: String(/** @type {Error} */ (error).stack || error) }); }
  finally { await browser.close(); }
}
await writeFile('output/recompose-storms.json', JSON.stringify(report, null, 2));
const failures = report.checks.filter(c => !c.pass);
console.log(JSON.stringify({ checks: report.checks.length, failures, errors: report.errors }, null, 2));
if (failures.length || report.errors.length) process.exitCode = 1;
