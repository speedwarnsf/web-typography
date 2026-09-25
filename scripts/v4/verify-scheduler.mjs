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
//   An app shell's overflow:auto pane: text below its fold is near when it
//   is within a viewport height of the pane, so blocks scrolled in soon after
//   they mount (an entrance animation keeping frames pending) paint composed,
//   never native lines rewrapped a few frames later; with TypesetText, and
//   with mount() once its first pass could have run.
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
// Twelve blocks below a 640 px hero, in a 100vh overflow:auto scroller.
const nestedTexts = corpus.slice(0, 12).map((/** @type {string} */ text) => text.split(' ').slice(0, 60).join(' '));
const nestedFixture = (await build({
  stdin: { contents: `
import { createElement as h } from 'react';
import { createRoot } from 'react-dom/client';
import { flushSync } from 'react-dom';
import { TypesetText } from ${JSON.stringify(resolve(artifacts.react))};
const texts = ${JSON.stringify(nestedTexts)};
window.mountNested = kind => {
  const scroller = document.getElementById('scroller');
  if (kind === 'mount') { for (const text of texts) { const p = document.createElement('p'); p.className = 'r'; p.textContent = text; scroller.insertBefore(p, document.getElementById('tail')); } window.Typeset.mount(scroller, 'p.r'); return; }
  const host = document.createElement('div'); scroller.insertBefore(host, document.getElementById('tail'));
  flushSync(() => createRoot(host).render(texts.map((text, i) => h(TypesetText, { key: i, text, className: 'r' }))));
};
`, resolveDir: process.cwd(), loader: 'js' },
  bundle: true, minify: true, write: false, format: 'iife', target: 'es2022', define: { 'process.env.NODE_ENV': '"production"' }, logLevel: 'silent',
})).outputFiles[0].text;
const nestedPage = `<!doctype html><html lang="en"><head><meta charset="utf-8"><style>html,body{margin:0}body{font:17px/1.45 Georgia,serif}.r{width:360px;margin:0 12px 14px}#scroller{height:100vh;overflow-y:auto}</style></head>
<body><div id="scroller"><div id="hero" style="height:640px;background:#eee"></div><div id="tail" style="height:1600px"></div></div></body></html>`;
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
    // Text in an overflow:auto scroller, scrolled in soon after it mounts.
    // mount() composes nothing before the page's first paint, so its text is
    // scrolled in once its first pass could have run.
    for (const kind of ['react', 'mount']) {
      for (const delay of kind === 'react' ? [0, 300] : [300]) {
        const page = await browser.newPage({ viewport: { width: 400, height: 700 } });
        page.setDefaultTimeout(20000);
        await page.setContent(nestedPage);
        // Observers rooted at a scroll container, to see that none outlives its targets.
        await page.evaluate(() => {
          const w = /** @type {any} */ (window), Native = window.IntersectionObserver;
          w.rootedObservers = [];
          w.IntersectionObserver = class extends Native {
            constructor(/** @type {IntersectionObserverCallback} */ callback, /** @type {IntersectionObserverInit} */ init) {
              super(callback, init);
              if (init?.root) { const record = { live: true }; w.rootedObservers.push(record); const disconnect = this.disconnect.bind(this); this.disconnect = () => { record.live = false; disconnect(); }; }
            }
          };
        });
        await page.addScriptTag({ content: script });
        await page.addScriptTag({ content: nestedFixture });
        await page.evaluate(() => document.fonts.ready);
        const result = await page.evaluate(async ({ kind, delay }) => {
          const w = /** @type {any} */ (window);
          /** Painted line starts of a block, read after layout and before paint. */
          const lines = (/** @type {Element} */ el) => {
            const out = [], range = document.createRange(), walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
            let top = null;
            for (let node = walker.nextNode(); node; node = walker.nextNode()) {
              for (const match of /** @type {Text} */ (node).data.matchAll(/\S+/g)) {
                range.setStart(node, /** @type {number} */ (match.index)); range.setEnd(node, /** @type {number} */ (match.index) + 1);
                const rect = range.getClientRects()[0];
                if (!rect) continue;
                const t = Math.round(rect.top - el.getBoundingClientRect().top);
                if (t !== top) { out.push(match[0]); top = t; }
              }
            }
            return out.join(' ');
          };
          const painted = /** @type {{ i: number, lines: string }[][]} */ ([]);
          let armed = false, frames = 0;
          const tick = document.createElement('div');
          tick.style.cssText = 'position:fixed;left:0;top:0;height:1px;width:1px;visibility:hidden';
          document.body.append(tick);
          new ResizeObserver(() => {
            if (!armed) return;
            painted.push([...document.querySelectorAll('.r')].map((el, i) => ({ i, rect: el.getBoundingClientRect() })).filter(({ rect }) => rect.height > 0 && rect.bottom > 0 && rect.top < innerHeight)
              .map(({ i }) => ({ i, lines: lines(/** @type {Element} */ (document.querySelectorAll('.r')[i])) })));
          }).observe(tick);
          const frame = () => { frames++; tick.style.width = (frames % 2 ? 2 : 1) + 'px'; if (armed && frames < 300) requestAnimationFrame(frame); };
          const t0 = performance.now();
          w.mountNested(kind);
          // An entrance animation keeps frames pending for 700 ms.
          const hero = /** @type {HTMLElement} */ (document.getElementById('hero'));
          const animate = () => { const p = (performance.now() - t0) / 700; hero.style.transform = `translateY(${Math.round(20 * (1 - Math.min(1, p)))}px)`; if (p < 1) requestAnimationFrame(animate); };
          requestAnimationFrame(animate);
          await new Promise(r => setTimeout(r, Math.max(0, delay - (performance.now() - t0))));
          const scroller = /** @type {HTMLElement} */ (document.getElementById('scroller'));
          armed = true; requestAnimationFrame(frame);
          await new Promise(resolve => { let k = 0; const step = () => { scroller.scrollTop += 80; if (++k < 6) requestAnimationFrame(step); else resolve(undefined); }; requestAnimationFrame(step); });
          await new Promise(r => setTimeout(r, 2000));
          armed = false;
          const final = [...document.querySelectorAll('.r')].map(el => lines(el));
          const flashes = painted.flatMap((blocks, f) => blocks.filter(b => b.lines !== final[b.i]).map(b => ({ frame: f, block: b.i })));
          return { frames: painted.length, flashFrames: new Set(flashes.map(x => x.frame)).size, flashBlocks: [...new Set(flashes.map(x => x.block))], composed: [...document.querySelectorAll('.r')].filter(el => /** @type {HTMLElement} */ (el).dataset.tsOutcome).length,
            rootedObservers: w.rootedObservers.length, liveRootedObservers: w.rootedObservers.filter((/** @type {any} */ o) => o.live).length };
        }, { kind, delay });
        check(`${kind === 'react' ? 'TypesetText' : 'mount()'} in an overflow:auto scroller, scrolled in ${delay} ms after mounting: no block paints native lines and is rewrapped`, result.flashFrames === 0 && result.frames > 0 && result.composed === 12, result);
        check(`${kind === 'react' ? 'TypesetText' : 'mount()'} in an overflow:auto scroller: the scroller's observer is released once nothing waits on it`, result.rootedObservers > 0 && result.liveRootedObservers === 0, result);
        await page.close();
      }
    }
  } catch (error) { report.errors.push({ browser: name, error: String(/** @type {Error} */ (error).stack || error) }); }
  finally { await browser.close(); }
}
await writeFile('output/scheduler.json', JSON.stringify(report, null, 2));
const failures = report.checks.filter(c => !c.pass);
console.log(JSON.stringify({ checks: report.checks.length, failures, errors: report.errors }, null, 2));
if (failures.length || report.errors.length) process.exitCode = 1;
