// @ts-check
// P2: the scheduler must not starve on a busy page, visible text goes first,
// and a resize recomposes what is on or near the screen while offscreen
// blocks wait until they come near.
//   Busy page: a requestAnimationFrame loop burns 12 ms of every frame.
//   Visible paragraphs are composed within 500 ms of mount(), and
//   throughput stays above one block per 200 ms.
//   1000 paragraphs, container resized: only blocks within about a viewport
//   are recomposed; offscreen blocks keep native wrapping or their old
//   composition until scrolled near; no visible frame is double-wrapped.
//   React adapters during an animation (a screen push): offscreen blocks
//   compose in idle callbacks, but never in the short idle periods left in
//   animation frames, where a composition on a slow device drops frames.
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { build } from 'esbuild';
import { browsers } from './browsers.mjs';
import { artifacts } from './candidate.mjs';

const script = await readFile(artifacts.bundle, 'utf8');
const corpus = JSON.parse(await readFile('tests/v4-corpus.json', 'utf8')).paragraphs;
const escape = (/** @type {string} */ text) => text.replace(/&/g, '&amp;').replace(/</g, '&lt;');
const busyPage = `<!doctype html><html lang="en"><head><meta charset="utf-8"><style>body{margin:0;font:17px/1.45 Georgia,serif}article{width:560px;padding:0 12px}</style></head>
<body><article>${Array.from({ length: 60 }, (_, i) => `<p>${escape(corpus[i % corpus.length])}</p>`).join('')}</article></body></html>`;
// Short paragraphs keep 1000 compositions affordable in every engine.
const short = (/** @type {number} */ i) => escape(corpus[i % corpus.length].split(' ').slice(0, 26 + (i % 9)).join(' '));
const reactFixture = (await build({
  stdin: { contents: `
import { createElement as h } from 'react';
import { createRoot } from 'react-dom/client';
import { flushSync } from 'react-dom';
import { TypesetText } from ${JSON.stringify(resolve(artifacts.react))};
const texts = ${JSON.stringify(corpus.slice(0, 48))};
window.mountReact = () => { const root = createRoot(document.getElementById('app')); flushSync(() => root.render(h('div', null,
  texts.slice(0, 4).map((text, i) => h(TypesetText, { key: 'v' + i, text, className: 'r' })),
  h('div', { style: { height: '4000px' } }),
  texts.slice(4).map((text, i) => h(TypesetText, { key: 'o' + i, text, className: 'r' }))))); };
`, resolveDir: process.cwd(), loader: 'js' },
  bundle: true, minify: true, write: false, format: 'iife', target: 'es2022', define: { 'process.env.NODE_ENV': '"production"' }, logLevel: 'silent',
})).outputFiles[0].text;
// Idle callbacks, observed before React loads: how much idle time each was
// given, and whether an adapter composed during it.
const idleProbe = () => {
  const w = /** @type {any} */ (window);
  w.idleLog = [];
  const request = window.requestIdleCallback;
  if (typeof request !== 'function') return;
  window.requestIdleCallback = (callback, options) => request.call(window, deadline => {
    const count = () => document.querySelectorAll('.r[data-ts-outcome]').length;
    const remaining = deadline.timeRemaining(), before = count();
    callback(deadline);
    w.idleLog.push({ remaining, timedOut: deadline.didTimeout, composed: count() - before, animating: !!w.animating });
  }, options);
};
const manyPage = `<!doctype html><html lang="en"><head><meta charset="utf-8"><style>body{margin:0;font:16px/1.4 Georgia,serif}article{width:420px;padding:0 12px}p{margin:0 0 8px}</style></head>
<body><article id="doc">${Array.from({ length: 1000 }, (_, i) => `<p>${short(i)}</p>`).join('')}</article></body></html>`;

/** @type {{ checks: { browser: string, label: string, pass: boolean, detail?: unknown }[], errors: { browser: string, error: string }[] }} */
const report = { checks: [], errors: [] };
for (const { name, engine, executablePath } of browsers) {
  const browser = await engine.launch({ executablePath, timeout: 20000 });
  /** @param {string} label @param {boolean} pass @param {unknown} [detail] */
  const check = (label, pass, detail) => report.checks.push({ browser: name, label, pass: !!pass, detail });
  try {
    // Busy page.
    {
      const page = await browser.newPage({ viewport: { width: 900, height: 800 } });
      page.setDefaultTimeout(20000);
      await page.setContent(busyPage);
      await page.addScriptTag({ content: script });
      const result = await page.evaluate(async () => {
        const w = /** @type {any} */ (window);
        await document.fonts.ready;
        let running = true;
        const burn = () => { const t = performance.now(); while (performance.now() - t < 12) { /* busy */ } if (running) requestAnimationFrame(burn); };
        requestAnimationFrame(burn);
        await new Promise(r => setTimeout(r, 100));
        const paragraphs = /** @type {HTMLElement[]} */ ([...document.querySelectorAll('article p')]);
        const visible = paragraphs.filter(p => { const box = p.getBoundingClientRect(); return box.top < innerHeight && box.bottom > 0; });
        const t0 = performance.now();
        const controller = w.Typeset.mount(document, 'article p');
        let visibleMs = null;
        while (performance.now() - t0 < 30000) {
          if (visibleMs === null && visible.every(p => p.dataset.tsOutcome)) visibleMs = Math.round(performance.now() - t0);
          if (paragraphs.every(p => p.dataset.tsOutcome)) break;
          await new Promise(r => setTimeout(r, 20));
        }
        const readyMs = Math.round(performance.now() - t0);
        running = false;
        return { visible: visible.length, visibleMs, readyMs, blocks: paragraphs.length, processed: paragraphs.filter(p => p.dataset.tsOutcome).length, passes: controller.stats.passes, perBlockMs: Math.round(readyMs / paragraphs.length) };
      });
      check('busy page: visible paragraphs composed within 500 ms', result.visibleMs !== null && result.visibleMs <= 500, result);
      check('busy page: more than one block per 200 ms', result.processed === result.blocks && result.readyMs / 200 < result.blocks, result);
      await page.close();
    }
    // 1000 paragraphs, resized.
    {
      const page = await browser.newPage({ viewport: { width: 900, height: 800 } });
      page.setDefaultTimeout(20000);
      await page.setContent(manyPage);
      await page.addScriptTag({ content: script });
      const setup = await page.evaluate(async () => {
        const w = /** @type {any} */ (window);
        await document.fonts.ready;
        w.controller = w.Typeset.mount(document, 'article p');
        const t0 = performance.now();
        await w.controller.ready;
        return { readyMs: Math.round(performance.now() - t0), composed: document.querySelectorAll('p[data-ts-outcome="composed:rich"]').length };
      });
      const result = await page.evaluate(async () => {
        const w = /** @type {any} */ (window);
        const doc = /** @type {HTMLElement} */ (document.getElementById('doc'));
        const paragraphs = /** @type {HTMLElement[]} */ ([...doc.querySelectorAll('p')]);
        const onScreen = () => paragraphs.filter(p => { const box = p.getBoundingClientRect(); return box.bottom > 0 && box.top < innerHeight; });
        const intact = (/** @type {HTMLElement} */ p) => p.hasAttribute('data-ts-stale') || p.dataset.tsOutcome !== 'composed:rich' || w.Typeset.measureLayout(p).lines.length === p.querySelectorAll('br[data-ts-break]').length + 1;
        const before = w.controller.stats.compositions;
        const samples = [];
        await new Promise(resolve => {
          let i = 0;
          const tick = () => {
            if (i > 0) samples.push(onScreen().filter(p => !intact(p)).length);
            if (i++ >= 12) { resolve(undefined); return; }
            doc.style.width = (420 - 5 * i) + 'px';
            requestAnimationFrame(tick);
          };
          requestAnimationFrame(tick);
        });
        await new Promise(r => setTimeout(r, 900));
        const afterResize = w.controller.stats.compositions - before;
        const visibleAfter = onScreen();
        const visibleComposed = visibleAfter.every(p => !p.hasAttribute('data-ts-stale') && intact(p));
        const far = paragraphs.slice(600, 640);
        const farStale = far.filter(p => p.hasAttribute('data-ts-stale')).length;
        far[20].scrollIntoView();
        await new Promise(r => setTimeout(r, 900));
        const nearNow = onScreen();
        return { samples: samples.filter(n => n > 0).length, frames: samples.length, afterResize, visibleComposed, farStale, scrolledComposed: nearNow.every(p => !p.hasAttribute('data-ts-stale') && intact(p)), scrolledCompositions: w.controller.stats.compositions - before - afterResize };
      });
      check('1000 paragraphs compose', setup.composed > 900, setup);
      check('resize: no visible frame is double-wrapped', result.samples === 0, result);
      check('resize: only blocks near the screen are recomposed', result.afterResize > 0 && result.afterResize < 200 && result.visibleComposed, result);
      check('resize: offscreen blocks are composed once scrolled near', result.scrolledCompositions > 0 && result.scrolledComposed && result.farStale > 0, result);
      await page.close();
    }
    // React adapters during an animation.
    {
      const page = await browser.newPage({ viewport: { width: 900, height: 800 } });
      page.setDefaultTimeout(20000);
      await page.setContent('<!doctype html><html lang="en"><head><meta charset="utf-8"><style>body{margin:0;font:17px/1.45 Georgia,serif}#app{width:420px;padding:0 12px}#slide{position:fixed;top:0;left:0;width:40px;height:40px;background:#ccc}</style></head><body><div id="slide"></div><div id="app"></div></body></html>');
      await page.evaluate(idleProbe);
      await page.addScriptTag({ content: reactFixture });
      const cdp = name === 'chromium' ? await page.context().newCDPSession(page) : null;
      await cdp?.send('Emulation.setCPUThrottlingRate', { rate: 4 });
      const result = await page.evaluate(async () => {
        const w = /** @type {any} */ (window);
        await document.fonts.ready;
        // A 900 ms slide, one inline style write per frame, as a screen push animates.
        w.animating = true;
        const slide = /** @type {HTMLElement} */ (document.getElementById('slide'));
        const t0 = performance.now();
        const animate = () => { const t = performance.now() - t0; slide.style.transform = `translateX(${Math.min(1, t / 900) * 600}px)`; if (t < 900) requestAnimationFrame(animate); else w.animating = false; };
        requestAnimationFrame(animate);
        w.mountReact();
        const hosts = /** @type {HTMLElement[]} */ ([...document.querySelectorAll('.r')]);
        while (performance.now() - t0 < 15000 && !hosts.every(el => el.dataset.tsOutcome)) await new Promise(r => setTimeout(r, 50));
        const during = w.idleLog.filter((/** @type {any} */ e) => e.animating && e.composed);
        return { hosts: hosts.length, composed: hosts.filter(el => el.dataset.tsOutcome).length, idleCallbacks: w.idleLog.length,
          shortIdleCompositions: w.idleLog.filter((/** @type {any} */ e) => e.composed && !e.timedOut && e.remaining < 20).length, during: during.length, sample: w.idleLog.filter((/** @type {any} */ e) => e.composed).slice(0, 6) };
      });
      await cdp?.send('Emulation.setCPUThrottlingRate', { rate: 1 });
      check('React adapters: every offscreen block composes after the animation', result.composed === result.hosts, result);
      if (result.idleCallbacks) check('React adapters: no composition in an idle period shorter than 20 ms (the rest of an animation frame)', result.shortIdleCompositions === 0, result);
      await page.close();
    }
  } catch (error) { report.errors.push({ browser: name, error: String(/** @type {Error} */ (error).stack || error) }); }
  finally { await browser.close(); }
}
await writeFile('output/scheduler.json', JSON.stringify(report, null, 2));
const failures = report.checks.filter(c => !c.pass);
console.log(JSON.stringify({ checks: report.checks.length, failures, errors: report.errors }, null, 2));
if (failures.length || report.errors.length) process.exitCode = 1;
