// @ts-check
// P3: ancestor mutations that leave every line unchanged (a transform
// animation, a class with no styles, a scroll-linked custom property, a fade)
// must not recompose anything, and a translation or fade must not even
// trigger a recheck pass; ancestor changes that do change text metrics (a theme
// font, a vw font size under a window resize, zoom) must recompose, with
// rendered lines equal to generated breaks + 1, and an ancestor scale, which
// moves no line, keeps the composition. Removing unrelated nodes must not scan
// every claimed element. The React adapters (16 TypesetText blocks) must not
// recheck anything during a translate and fade storm on their container, and
// must not recompose in every frame while the container's font size changes
// continuously (a text-size slider, a font-size transition; Chromium at 4x
// CPU): native lines meanwhile, one composition once the size holds.
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { build } from 'esbuild';
import { browsers } from './browsers.mjs';
import { artifacts } from './candidate.mjs';

const script = await readFile(artifacts.bundle, 'utf8');
const corpus = JSON.parse(await readFile('tests/v4-corpus.json', 'utf8')).paragraphs.slice(0, 40);
const escape = (/** @type {string} */ text) => text.replace(/&/g, '&amp;').replace(/</g, '&lt;');
const paragraphs = corpus.map((/** @type {string} */ text, /** @type {number} */ i) => `<p${i % 5 === 0 ? ' class="vw"' : ''}>${escape(text)}</p>`).join('');
const page = `<!doctype html><html lang="en"><head><title>Storms</title><link rel="icon" href="data:,a"><style>
body{margin:0;font:17px/1.5 Georgia,serif}article{width:560px;padding:0 16px}
.theme p{font-size:19px;letter-spacing:.01em}.scaled{transform:scale(.9);transform-origin:0 0}.zoomed{zoom:1.1}
p.vw{font-size:clamp(12px,2.1vw,30px);width:480px}
</style></head><body><div id="shell"><div id="wrap"><article>${paragraphs}</article></div></div>
<article id="notes">${Array.from({ length: 400 }, (_, i) => `<p>Note ${i + 1}.</p>`).join('')}</article><ul id="list"></ul></body></html>`;

// Writes to <head> that change no stylesheet (4.3's first candidates took
// each for a stylesheet change and rechecked every block).
const HEAD_STORM = `frames(20, i => {
  document.title = 'Tick ' + i;
  const script = document.createElement('script'); script.type = 'application/json'; script.textContent = '{}'; document.head.append(script);
  const meta = document.createElement('meta'); meta.name = 'tick'; meta.content = String(i); document.head.append(meta);
  const link = document.createElement('link'); link.rel = 'preconnect'; link.href = 'https://example.invalid/' + i; document.head.append(link);
  document.querySelector('link[rel=icon]').href = 'data:,' + i;
})`;
const reactTexts = corpus.slice(0, 16);
const reactFixture = (await build({
  stdin: { contents: `
import { createElement as h } from 'react';
import { createRoot } from 'react-dom/client';
import { flushSync } from 'react-dom';
import { TypesetText } from ${JSON.stringify(resolve(artifacts.react))};
flushSync(() => createRoot(document.getElementById('app')).render(${JSON.stringify(reactTexts)}.map((text, i) => h(TypesetText, { key: i, text }))));
`, resolveDir: process.cwd(), loader: 'js' },
  bundle: true, minify: true, write: false, format: 'iife', target: 'es2022', define: { 'process.env.NODE_ENV': '"production"' }, logLevel: 'silent',
})).outputFiles[0].text;
const reactPage = `<!doctype html><html lang="en"><head><title>Storms</title><link rel="icon" href="data:,a"><style>body{margin:16px;font:17px/1.5 Georgia,serif}#wrap{width:560px}#wrap.big{font-size:21px}#wrap.ease{transition:font-size 1.2s linear}</style>
<script>
window.styleReads = 0; const read = window.getComputedStyle; window.getComputedStyle = function () { window.styleReads++; return read.apply(this, arguments); };
window.longTasks = []; try { new PerformanceObserver(list => { for (const e of list.getEntries()) window.longTasks.push(Math.round(e.duration)); }).observe({ type: 'longtask' }); } catch {}
</script></head><body><div id="wrap"><div id="app"></div></div><script src="/react.js"></script></body></html>`;

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
      // A ticking title, a tag manager's scripts, a favicon badge: no stylesheet.
      ['20 frames of <head> writes (title, script, meta, preconnect, favicon href)', HEAD_STORM],
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
      // A translation, a fade or a <head> write that adds no stylesheet moves no line: not even a layout-key recheck.
      if (/transform|fade|head/.test(label)) check(`${label}: no recheck pass at all`, result.passes === 0, result);
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
      // A scale moves no line: the composition is kept while it applies. Zoom
      // changes layout and is declined; it is not supported by every engine's
      // computed style, and where it has no effect the text simply stays
      // composed and verified.
      const declined = result.whileApplied.length === 1 && result.whileApplied[0] === 'native:transformed';
      const kept = result.whileApplied.length === 1 && result.whileApplied[0] === 'composed:rich';
      if (cls === 'scaled') check('an ancestor scale keeps the composition while it applies, and after it is removed', kept && result.after >= 30 && result.stale === 0, result);
      else check('an ancestor zoom is declined and recomposed when removed', (declined || !result.whileApplied.includes('native:transformed')) && result.after >= 30 && result.stale === 0, result);
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

    // A container dragged narrower, one width per frame: every composed block
    // changes width, but the settle timer is armed once per change, not once
    // per block (4.3's first candidates set and cleared a timer per block per
    // frame on both the observer and the attribute path).
    const drag = await tab.evaluate(async () => {
      const w = /** @type {any} */ (window);
      await w.quiet();
      const article = /** @type {HTMLElement} */ (document.querySelector('#wrap article'));
      const native = window.setTimeout;
      let timers = 0;
      window.setTimeout = /** @type {any} */ (function (/** @type {any[]} */ ...args) { timers++; return native.apply(window, /** @type {any} */ (args)); });
      try { await w.frames(20, (/** @type {number} */ i) => { article.style.width = (556 - 4 * i) + 'px'; }); }
      finally { window.setTimeout = native; }
      article.style.width = '';
      await w.quiet();
      // Blocks more than a viewport offscreen wait, stale, until they come near.
      const onScreen = [...document.querySelectorAll('#wrap p')].filter(p => { const r = p.getBoundingClientRect(); return r.bottom > 0 && r.top < innerHeight; });
      const intact = onScreen.filter(p => w.Typeset.measureLayout(p).lines.length === p.querySelectorAll('br[data-ts-break]').length + 1 && !p.hasAttribute('data-ts-stale'));
      return { timers, frames: 20, blocks: document.querySelectorAll('#wrap p').length, onScreen: onScreen.length, intact: intact.length };
    });
    check('a 20-frame container drag arms timers per change, not per block (under 5 a frame for 40 blocks)', drag.timers < 5 * drag.frames && drag.onScreen > 0 && drag.intact === drag.onScreen, drag);

    await context.close();

    // The React adapters under the same storms.
    const reactContext = await browser.newContext({ viewport: { width: 1000, height: 800 } });
    const react = await reactContext.newPage();
    react.setDefaultTimeout(20000);
    await react.route('http://storms.test/**', route => new URL(route.request().url()).pathname === '/react.js'
      ? route.fulfill({ contentType: 'text/javascript', body: reactFixture }) : route.fulfill({ contentType: 'text/html; charset=utf-8', body: reactPage }));
    await react.goto('http://storms.test/');
    await react.waitForFunction(() => document.querySelectorAll('#app p[data-ts-outcome]').length === 16);
    await react.waitForTimeout(1500);
    await react.evaluate(() => {
      const w = /** @type {any} */ (window);
      w.frames = (/** @type {number} */ n, /** @type {(i: number) => void} */ step) => new Promise(resolve => {
        let i = 0;
        const tick = () => { step(i); if (++i < n) requestAnimationFrame(tick); else resolve(undefined); };
        requestAnimationFrame(tick);
      });
      w.hosts = () => /** @type {HTMLElement[]} */ ([...document.querySelectorAll('#app p')]);
      w.compositions = 0;
      new MutationObserver(records => {
        const hosts = new Set();
        for (const record of records) if ([...record.addedNodes].some(node => node.nodeName === 'BR')) hosts.add((record.target.nodeType === 1 ? /** @type {Element} */ (record.target) : record.target.parentElement)?.closest('p'));
        w.compositions += hosts.size;
      }).observe(/** @type {HTMLElement} */ (document.getElementById('app')), { subtree: true, childList: true });
      // Composed blocks that paint their composition (not stale, not double-wrapped).
      w.intact = () => w.hosts().filter((/** @type {HTMLElement} */ el) => {
        const range = document.createRange(); range.selectNodeContents(el);
        const tops = new Set([...range.getClientRects()].filter(r => r.width > 0).map(r => Math.round(r.top)));
        return el.dataset.tsOutcome === 'composed:rich' && !el.hasAttribute('data-ts-stale') && tops.size === el.querySelectorAll('br[data-ts-break]').length + 1;
      }).length;
      w.composed = () => w.hosts().filter((/** @type {HTMLElement} */ el) => el.dataset.tsOutcome === 'composed:rich').length;
    });
    const storm = await react.evaluate(async () => {
      const w = /** @type {any} */ (window);
      const wrap = /** @type {HTMLElement} */ (document.getElementById('wrap'));
      w.styleReads = 0;
      await w.frames(60, (/** @type {number} */ i) => { wrap.style.transform = `translateX(${i % 7}px)`; wrap.style.opacity = String(.9 + (i % 10) / 100); });
      wrap.style.transform = ''; wrap.style.opacity = '';
      await new Promise(r => setTimeout(r, 500));
      return { styleReads: w.styleReads, compositions: w.compositions, intact: w.intact() };
    });
    check('React: a translate and fade storm on the container reads no computed style and composes nothing', storm.styleReads < 50 && storm.compositions === 0 && storm.intact === 16, storm);
    const head = await react.evaluate(async run => {
      const w = /** @type {any} */ (window);
      w.styleReads = 0; w.compositions = 0;
      await (0, eval)(run);
      await new Promise(r => setTimeout(r, 500));
      return { styleReads: w.styleReads, compositions: w.compositions, intact: w.intact() };
    }, HEAD_STORM);
    check('React: <head> writes that add no stylesheet (title, script, meta, preconnect, favicon href) read no computed style and compose nothing', head.styleReads < 50 && head.compositions === 0 && head.intact === 16, head);
    if (name === 'chromium') {
      const cdp = await reactContext.newCDPSession(react);
      await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
      const change = (/** @type {string} */ kind) => react.evaluate(async kind => {
        const w = /** @type {any} */ (window);
        const wrap = /** @type {HTMLElement} */ (document.getElementById('wrap'));
        w.compositions = 0; w.longTasks.length = 0;
        if (kind === 'slider') await w.frames(60, (/** @type {number} */ i) => { wrap.style.fontSize = (17 + i * 2 / 60).toFixed(2) + 'px'; });
        else { wrap.classList.add('ease'); wrap.classList.add('big'); }
        await new Promise(r => setTimeout(r, 2500));
        const out = { hosts: w.hosts().length, compositions: w.compositions, longTasks: [...w.longTasks], intact: w.intact(), composed: w.composed(), stale: document.querySelectorAll('#app [data-ts-stale]').length };
        wrap.classList.remove('ease', 'big'); wrap.style.fontSize = '';
        await new Promise(r => setTimeout(r, 2500));
        return out;
      }, kind);
      // The slider: at most 4 compositions a block (4.3 before this check:
      // 466 compositions and 30 or more long tasks) and at most one long
      // task a block. How many long tasks the change's first and final
      // compositions make follows the machine's speed: 2 to 5 on an M2 Pro,
      // 6 on GitHub's macos-15 runner, whose tasks at 4x CPU run about twice
      // as long (55 to 145 ms). A composition every frame makes one per frame.
      const slider = await change('slider');
      check('React at 4x CPU: a text-size slider (60 frames) recomposes each block a few times, not every frame, and ends composed',
        slider.compositions <= 4 * slider.hosts && slider.longTasks.length <= slider.hosts && slider.composed >= 14 && slider.intact === slider.composed && slider.stale === 0, slider);
      // The transition, three times; each must stay within 4 compositions a
      // block and one long task a block and end composed. At 4x CPU the final
      // composition of 16 blocks spans a few frames, and whether 0, 1, 2 or
      // 3 of those tasks cross 50 ms is timing, so one run held to 2 long
      // tasks was flaky: it failed 1 of 4 standalone runs at the gate-4 HEAD
      // (4fd1f3f) and 2 of 4 at c8fe141, with 3 tasks of 50 to 75 ms each
      // time. Calibration, Chromium at 4x on an M2 Pro, load 5 to 7, 10 runs
      // of that one-run check per build: 0 to 3 long tasks (median 1; 3 in 2
      // runs) and 37 to 41 compositions with the rolled-back near observer;
      // 0 to 3 (median 1; 3 in 1 run) and 33 to 46 with the round-2
      // candidate (44e4721). The build before per-frame settling (8bfedc1^)
      // made 1 to 3 and 33 to 50, so no long-task limit separates it here;
      // its slider does (463 to 468 compositions and 59 long tasks, against
      // 26 to 49 and 2 to 5). The limit was 4, the most seen there plus one,
      // until GitHub's macos-15 runner, where tasks at 4x CPU run about twice
      // as long, made 2, 12 and 4 long tasks (54 to 145 ms) in three runs
      // with 47, 47 and 42 compositions, all ending composed. A transition
      // recomposed every frame would add a long task and a composition per
      // block for each of its ~72 frames (1.2 s), so one long task a block
      // still stops it on any machine, and the composition limit does too.
      const transitions = [];
      for (let run = 0; run < 3; run++) transitions.push(await change('transition'));
      check('React at 4x CPU: a font-size transition recomposes each block a few times, not every frame, and ends composed (3 runs)',
        transitions.every(t => t.compositions <= 4 * t.hosts && t.longTasks.length <= t.hosts && t.composed >= 14 && t.intact === t.composed && t.stale === 0), transitions);
      await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });
    }
    await reactContext.close();
  } catch (error) { report.errors.push({ browser: name, error: String(/** @type {Error} */ (error).stack || error) }); }
  finally { await browser.close(); }
}
await writeFile('output/recompose-storms.json', JSON.stringify(report, null, 2));
const failures = report.checks.filter(c => !c.pass);
console.log(JSON.stringify({ checks: report.checks.length, failures, errors: report.errors }, null, 2));
if (failures.length || report.errors.length) process.exitCode = 1;
