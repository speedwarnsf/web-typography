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
//   never native lines rewrapped a few frames later, even when the page
//   scrolls them in within the frame after mounting, before the pane's
//   IntersectionObserver first reports; with TypesetText, and with mount()
//   once its first pass could have run. The nearest container
//   that scrolls is the text's scrollport from the time it registers, so
//   FAQ answers in closed <details>, text pushed down by content loaded
//   above it and the rows of a virtualized list placed with a transform
//   are near once they are within a viewport height of the pane.
//   Known limitation (CHANGELOG 4.3.0, SUPPORT.md; a 4.4 item): a container
//   that scrolls only horizontally counts too, so under an overflow-x:hidden
//   app root (its overflow-y computes to auto) or in a horizontal carousel
//   row every block is near, and offscreen blocks there may compose during
//   a screen push. Those checks assert what 4.3.0 guarantees there: every
//   block gets an outcome and paints what it reports, never double-wrapped.
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
  texts.slice(4).map((text, i) => h(TypesetText, { key: 'o' + i, text, className: 'r' })),
  h('footer', { className: 'reveal' }, 'Footer')))); };
// The same 44 offscreen blocks in 11 horizontal carousel rows, 400 px apart.
window.mountCarousels = () => { const root = createRoot(document.getElementById('app')); flushSync(() => root.render(h('div', null,
  texts.slice(0, 4).map((text, i) => h(TypesetText, { key: 'v' + i, text, className: 'r' })),
  h('div', { style: { height: '3000px' } }),
  Array.from({ length: 11 }, (_, row) => h('div', { key: 'row' + row, className: 'row' },
    texts.slice(4 + row * 4, 8 + row * 4).map((text, i) => h(TypesetText, { key: i, text, className: 'r' }))))))); };
// Twelve FAQ answers, two blocks each, in closed <details> in a scroll pane.
const answers = ${JSON.stringify(corpus.filter((/** @type {string} */ text) => text.length > 250).slice(0, 24))};
window.mountFaq = () => { const root = createRoot(document.getElementById('pane')); flushSync(() => root.render(h('div', null,
  Array.from({ length: 12 }, (_, i) => h('details', { key: i }, h('summary', null, 'Question ' + (i + 1)),
    h(TypesetText, { lang: 'en', text: answers[2 * i] }), h(TypesetText, { lang: 'en', text: answers[2 * i + 1] })))))); };
// Three blocks at the top of a pane, below content that has not loaded yet.
const comments = ${JSON.stringify(corpus.filter((/** @type {string} */ text) => text.length > 200 && text.length < 400).slice(0, 3))};
window.mountComments = () => { const root = createRoot(document.getElementById('list')); flushSync(() => root.render(comments.map((text, i) => h(TypesetText, { key: i, lang: 'en', text })))); };
// Eight rows of a virtualized list, 200 px each, laid out as TanStack
// Virtual lays them out: every row absolute at the top of the list and moved
// to its offset with transform: translateY.
const rows = ${JSON.stringify(corpus.filter((/** @type {string} */ text) => text.length > 250 && text.length < 450).slice(0, 8))};
window.mountVirtual = () => { const root = createRoot(document.getElementById('inner')); flushSync(() => root.render(rows.map((text, i) => h('div', { key: i, className: 'row',
  style: { position: 'absolute', top: 0, left: 0, width: '100%', height: '200px', transform: 'translateY(' + i * 200 + 'px)' } }, h(TypesetText, { lang: 'en', text }))))); };
`, resolveDir: process.cwd(), loader: 'js' },
  bundle: true, minify: true, write: false, format: 'iife', target: 'es2022', define: { 'process.env.NODE_ENV': '"production"' }, logLevel: 'silent',
})).outputFiles[0].text;
// The benchmark's screen push (bench-v4.mjs react-K-38): 38 blocks, one in
// four a paragraph, under 15 wrappers, pushed from a click.
const pushFixture = (await build({
  stdin: { contents: `
import { createElement as h, useState, useLayoutEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { TypesetText, TypesetRichText } from ${JSON.stringify(resolve(artifacts.react))};
const labels = ['Daily tip', 'Breathe', 'Sleep better tonight', 'Your streak', 'Hydration', 'Move for five minutes', 'Check in', 'Journal', 'Gratitude', 'Mindful minute'];
const para = 'Small habits compound: a short walk after lunch, a glass of water before coffee, and two minutes of slow breathing before bed.';
function block(kind, i) {
  const long = i % 4 === 3, text = long ? para : labels[i % labels.length], style = { display: 'block', width: '300px' };
  if (kind === 'typeset') return h(TypesetText, { key: i, text, as: long ? 'p' : 'span', style });
  return h(TypesetRichText, { key: i, as: long ? 'p' : 'span', style }, long ? h('span', null, 'Small habits compound: ', h('a', { href: '#walk' }, 'a short walk after lunch'), ', a glass of water before coffee, and two minutes of slow breathing before bed.') : text);
}
function Screen({ kind }) {
  useLayoutEffect(() => { window.committed = true; }, []);
  let tree = h('div', null, Array.from({ length: 38 }, (_, i) => block(kind, i)));
  for (let d = 0; d < 15; d++) tree = h('div', { className: 'view' }, tree);
  return tree;
}
function App() {
  const [kind, setKind] = useState(null);
  return h('div', null, h('button', { id: 'push', onClick: () => setKind(window.pushKind) }, 'Push screen'), kind && h(Screen, { kind }));
}
createRoot(document.getElementById('app')).render(h(App));
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
    // A cold screen push at 4x CPU (a mid-range phone): the document's first
    // composition pays one-time setup, which must not push on-screen blocks
    // past the visible budget into the next frame. Every on-screen block is
    // composed in the first frame that paints the new screen. (The RC painted
    // 8 of 15 on-screen hosts native and rewrapped them a frame later.)
    if (name === 'chromium') for (const kind of ['typeset', 'rich']) {
      const page = await browser.newPage({ viewport: { width: 1280, height: 844 } });
      page.setDefaultTimeout(20000);
      await page.setContent('<!doctype html><html lang="en"><body style="margin:16px;font:17px/1.45 Georgia"><div id="app"></div></body></html>');
      await page.addScriptTag({ content: pushFixture });
      const cdp = await page.context().newCDPSession(page);
      await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
      await page.evaluate(async kind => {
        const w = /** @type {any} */ (window);
        await document.fonts.ready;
        w.pushKind = kind; w.firstFrame = null; w.frames = 0;
        // Each frame, after layout and before paint: the hosts on screen and
        // whether each has an outcome yet.
        const tick = document.createElement('div');
        tick.style.cssText = 'position:fixed;left:0;top:0;height:1px;width:1px;visibility:hidden';
        document.body.append(tick);
        new ResizeObserver(() => {
          if (!w.committed || w.firstFrame) return;
          const hosts = /** @type {HTMLElement[]} */ ([...document.querySelectorAll('[data-typeset-react], [data-typeset-react-rich]')]).filter(el => { const r = el.getBoundingClientRect(); return r.height > 0 && r.top < innerHeight && r.bottom > 0; });
          w.firstFrame = { onScreen: hosts.length, uncomposed: hosts.filter(el => !el.dataset.tsOutcome).length };
        }).observe(tick);
        const loop = () => { w.frames++; tick.style.width = (w.frames % 2 ? 2 : 1) + 'px'; if (w.frames < 600 && !w.firstFrame) requestAnimationFrame(loop); };
        requestAnimationFrame(loop);
      }, kind);
      await page.click('#push');
      await page.waitForFunction(() => /** @type {any} */ (window).firstFrame, null, { timeout: 20000 });
      const result = await page.evaluate(() => /** @type {any} */ (window).firstFrame);
      await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });
      check(`${kind === 'typeset' ? 'TypesetText' : 'TypesetRichText'} at 4x CPU: a cold screen push paints every on-screen block composed in its first frame`, result.onScreen >= 12 && result.uncomposed === 0, result);
      await page.close();
    }
    // Known limitation (4.4): offscreen text in a wrapper that scrolls only
    // horizontally, an app root with overflow-x:hidden (its overflow-y
    // computes to auto) or horizontal carousel rows, also with a reveal
    // transform on the footer after the commit or a CSS entrance animation on
    // the cards. The wrapper is taken as the text's scrollport, so blocks
    // thousands of pixels below the fold count as near and compose in the
    // animation frames of a screen push (44 of 44 under the app root and 22
    // in the carousel rows in Chromium and Firefox; WebKit composes far text
    // on its 50 ms timer either way). That costs frames, not correctness:
    // every block gets an outcome and paints what it reports (its composed
    // lines, or native lines), never double-wrapped. Four fixes that
    // measured such text against the window (85d20d3, f0d01ac, b5532e1,
    // 6d8dd22) each broke text that a real pane hides, so 4.3.0 keeps the
    // round-2 rule and these checks hold it to that guarantee.
    for (const [layout, effect] of [['overflow-x:hidden app root', ''], ['carousel rows', ''], ['overflow-x:hidden app root', 'a reveal transform after the commit'], ['carousel rows', 'a CSS entrance animation on the cards']]) {
      const page = await browser.newPage({ viewport: { width: 900, height: 800 } });
      page.setDefaultTimeout(20000);
      await page.setContent(`<!doctype html><html lang="en"><head><meta charset="utf-8"><style>body{margin:0;font:17px/1.45 Georgia,serif}#app{width:420px;padding:0 12px}#slide{position:fixed;top:0;left:0;width:40px;height:40px;background:#ccc}${layout === 'carousel rows' ? '.row{display:flex;gap:12px;overflow-x:auto;margin-bottom:400px}.row>.r{flex:0 0 200px;margin:0}.row.enter>.r{animation:up .6s ease-out both}@keyframes up{from{transform:translateY(30px);opacity:0}}' : '#app{overflow-x:hidden}'}</style></head><body><div id="slide"></div><div id="app"></div></body></html>`);
      await page.evaluate(() => {
        const w = /** @type {any} */ (window), Native = window.IntersectionObserver;
        w.rootedObservers = 0;
        w.IntersectionObserver = class extends Native {
          constructor(/** @type {IntersectionObserverCallback} */ callback, /** @type {IntersectionObserverInit} */ init) { super(callback, init); if (init?.root) w.rootedObservers++; }
        };
      });
      await page.addScriptTag({ content: reactFixture });
      const result = await page.evaluate(async ([layout, effect]) => {
        const w = /** @type {any} */ (window);
        await document.fonts.ready;
        const slide = /** @type {HTMLElement} */ (document.getElementById('slide'));
        const t0 = performance.now();
        let during = -1;
        const far = () => /** @type {HTMLElement[]} */ ([...document.querySelectorAll('.r')]).filter(el => el.getBoundingClientRect().top > 2 * innerHeight);
        const animate = () => {
          const t = performance.now() - t0;
          slide.style.transform = `translateX(${Math.min(1, t / 900) * 600}px)`;
          if (t < 900) requestAnimationFrame(animate); else during = far().filter(el => el.dataset.tsOutcome).length;
        };
        requestAnimationFrame(animate);
        if (layout === 'carousel rows') w.mountCarousels(); else w.mountReact();
        if (effect.startsWith('a reveal')) {
          const footer = /** @type {HTMLElement} */ (document.querySelector('.reveal'));
          footer.style.transform = 'translateY(60px)';
          setTimeout(() => { footer.style.transform = ''; }, 150);
        }
        if (effect.startsWith('a CSS entrance')) requestAnimationFrame(() => { for (const row of document.querySelectorAll('.row')) row.classList.add('enter'); });
        const hosts = /** @type {HTMLElement[]} */ ([...document.querySelectorAll('.r')]);
        // Text declined under the cards' entrance transform (native:transformed)
        // composes once the animation ends.
        while (performance.now() - t0 < 15000 && (during < 0 || !hosts.every(el => el.dataset.tsOutcome && el.dataset.tsOutcome !== 'native:transformed'))) await new Promise(r => setTimeout(r, 50));
        // A block paints what it reports: not stale, and a composed one shows
        // one line per generated break plus one (never double-wrapped).
        const paints = (/** @type {HTMLElement} */ el) => {
          if (el.hasAttribute('data-ts-stale')) return false;
          if (!el.dataset.tsOutcome?.startsWith('composed')) return true;
          const range = document.createRange(); range.selectNodeContents(el);
          const tops = new Set([...range.getClientRects()].filter(r => r.width > 0).map(r => Math.round(r.top)));
          return tops.size === el.querySelectorAll('br[data-ts-break]').length + 1;
        };
        return { hosts: hosts.length, far: far().length, composed: hosts.filter(el => el.dataset.tsOutcome).length, composedRich: hosts.filter(el => el.dataset.tsOutcome?.startsWith('composed')).length,
          paintsComposition: hosts.filter(paints).length, outcomes: hosts.reduce((/** @type {Record<string, number>} */ n, el) => { const o = el.dataset.tsOutcome || '(none)'; n[o] = (n[o] || 0) + 1; return n; }, {}),
          farComposedDuringSlide: during, rootedObservers: w.rootedObservers, idleCallbacks: typeof window.requestIdleCallback === 'function' };
      }, [layout, effect]);
      const setting = effect ? `${layout} with ${effect}` : layout;
      // farComposedDuringSlide records the limitation's cost; it is not
      // asserted. rootedObservers > 0 pins the 4.3.0 rule, so a change to it
      // has to update this check and the documented limitation together.
      // composedRich is recorded, not asserted: WebKit, which composes far
      // text on its timer while the cards' entrance animation runs, reports
      // about half the cards native:verification (native lines) on every 4.3
      // build, the round-2 candidate included.
      check(`React adapters in ${setting} (known limitation: the wrapper counts as the scrollport, so offscreen blocks may compose during a screen push): every block gets an outcome and paints what it reports, never double-wrapped`,
        result.rootedObservers > 0 && result.far >= 40 && result.composed === result.hosts && result.paintsComposition === result.hosts, result);
      await page.close();
    }
    // A pane that overflows only after its hosts registered: FAQ answers in
    // closed <details> in a 600 px overflow-y:auto pane, all opened, then
    // the pane scrolled one pane height while a frame loop keeps frames
    // pending. The pane is the hosts' scrollport from the time they register,
    // overflowing or not, so the answers below its fold are near once open.
    // A build that took only an overflowing pane as the scrollport measured
    // them against the window, which the pane clips: one of the two blocks
    // brought on screen painted native lines ('unmeasurable') in the first
    // frame after the jump, in 3 of 3 runs in Chromium and Firefox (4.2.0 and
    // 4.3.0: none).
    for (let run = 0; run < 3; run++) {
      const page = await browser.newPage({ viewport: { width: 800, height: 900 } });
      page.setDefaultTimeout(20000);
      await page.setContent('<!doctype html><html lang="en"><head><meta charset="utf-8"><style>body{margin:0;font:18px/1.5 Georgia,serif}p{margin:0 0 12px}#spin{width:20px;height:20px;background:#000;animation:spin 1s linear infinite}@keyframes spin{to{transform:rotate(360deg)}}</style></head><body><div id="pane" style="height:600px;overflow-y:auto;width:420px"></div><div id="spin"></div></body></html>');
      await page.addScriptTag({ content: reactFixture });
      await page.evaluate(() => /** @type {any} */ (window).mountFaq());
      await page.waitForFunction(() => document.querySelectorAll('[data-typeset-react]').length === 24);
      await page.waitForTimeout(700);
      const result = await page.evaluate(async () => {
        const pane = /** @type {HTMLElement} */ (document.getElementById('pane'));
        const frame = () => new Promise(resolve => requestAnimationFrame(() => resolve(undefined)));
        let live = true;
        (function loop() { if (live) requestAnimationFrame(loop); })();
        const overflowBefore = pane.scrollHeight > pane.clientHeight + 1;
        for (const details of document.querySelectorAll('details')) details.open = true;
        await frame(); await frame(); await frame();
        const box = pane.getBoundingClientRect();
        const band = /** @type {HTMLElement[]} */ ([...document.querySelectorAll('[data-typeset-react]')]).filter(el => { const top = el.getBoundingClientRect().top; return top >= box.bottom && top < box.bottom + pane.clientHeight; });
        pane.scrollTop = pane.clientHeight;
        await frame();
        const firstFrame = band.map(el => el.dataset.tsOutcome || '(none)');
        live = false;
        return { overflowBefore, overflowAfter: pane.scrollHeight > pane.clientHeight + 1, band: band.length, firstFrame };
      });
      check(`TypesetText in a pane that overflows after it registers (FAQ answers in closed <details>), run ${run + 1}: every block scrolled in one pane height paints composed in the first frame`,
        !result.overflowBefore && result.overflowAfter && result.band >= 2 && result.firstFrame.every(outcome => outcome.startsWith('composed')), result);
      await page.close();
    }
    // A pane 2000 px down a page that scrolls the window, with three blocks
    // at its top that do not overflow it when they register. Content above
    // them then loads (900 px), so the pane hides them; nothing else
    // changes, so no host is observed again and none changes intersection.
    // The window is scrolled to the pane, and 8 frames later the pane to the
    // text, while a frame loop keeps frames pending. The pane is their
    // scrollport from the time they register, so they stay near it. Builds
    // that measured them against the window until the pane hid them painted
    // all 3 native in the jump's frame in Chromium and Firefox (4.2.0 and
    // 4.3.0: none).
    for (let run = 0; run < 3; run++) {
      const page = await browser.newPage({ viewport: { width: 800, height: 900 } });
      page.setDefaultTimeout(20000);
      await page.setContent('<!doctype html><html lang="en"><head><meta charset="utf-8"><style>body{margin:0;font:16px/1.4 Georgia,serif}p{margin:0 0 10px}</style></head><body><div style="height:2000px"></div><div id="pane" style="height:600px;overflow-y:auto;width:420px"><div id="pre"></div><div id="list"></div></div><div style="height:2000px"></div></body></html>');
      await page.addScriptTag({ content: reactFixture });
      const result = await page.evaluate(async () => {
        const w = /** @type {any} */ (window);
        const frame = () => new Promise(resolve => requestAnimationFrame(() => resolve(undefined)));
        let live = true;
        (function loop() { if (live) requestAnimationFrame(loop); })();
        await document.fonts.ready;
        w.mountComments();
        const pane = /** @type {HTMLElement} */ (document.getElementById('pane'));
        const hosts = /** @type {HTMLElement[]} */ ([...document.querySelectorAll('[data-typeset-react]')]);
        const overflowAtMount = pane.scrollHeight > pane.clientHeight + 1;
        await new Promise(r => setTimeout(r, 150));
        /** @type {HTMLElement} */ (document.getElementById('pre')).style.height = '900px';
        await new Promise(r => setTimeout(r, 100));
        scrollTo(0, 1900);
        for (let i = 0; i < 8; i++) await frame();
        // What the jump's own frame paints: the observer reports after that
        // frame's animation callbacks and layout, before it paints.
        /** @type {string[] | null} */
        let painted = null;
        const tick = document.createElement('div');
        tick.style.cssText = 'position:fixed;left:0;top:0;height:1px;width:1px;visibility:hidden';
        document.body.append(tick);
        new ResizeObserver(() => { if (tick.style.width === '2px' && !painted) painted = hosts.map(el => el.dataset.tsOutcome || '(none)'); }).observe(tick);
        await frame();
        pane.scrollTop = 900; tick.style.width = '2px';
        await frame(); await frame();
        live = false;
        const box = pane.getBoundingClientRect();
        return { overflowAtMount, onScreen: hosts.filter(el => { const r = el.getBoundingClientRect(); return r.top < box.bottom && r.bottom > box.top; }).length, painted };
      });
      check(`TypesetText in a pane far down the page that hides it only after it registers (content loaded above it), run ${run + 1}: scrolled to once the pane is on screen, every block paints composed in the jump's frame`,
        !result.overflowAtMount && result.onScreen === 3 && !!result.painted && result.painted.every(outcome => outcome.startsWith('composed')), result);
      await page.close();
    }
    // The same pane inside an app shell (a 100vh overflow-y:auto root that
    // clips it), brought to 300 px below the shell's fold after the content
    // above the text loaded; 8 frames later one frame scrolls the shell to
    // the pane and the pane to the text. A build that rechecked such panes
    // only as they crossed the window's near line painted all 3 native in
    // that frame in Chromium and Firefox, 3 of 3 runs (4.2.0 and 4.3.0: none).
    for (let run = 0; run < 3; run++) {
      const page = await browser.newPage({ viewport: { width: 800, height: 900 } });
      page.setDefaultTimeout(20000);
      await page.setContent('<!doctype html><html lang="en"><head><meta charset="utf-8"><style>body{margin:0;font:16px/1.4 Georgia,serif}p{margin:0 0 10px}#app{height:100vh;overflow-y:auto}</style></head><body><div id="app"><div style="height:2000px"></div><div id="pane" style="height:600px;overflow-y:auto;width:420px"><div id="pre"></div><div id="list"></div></div><div style="height:2000px"></div></div></body></html>');
      await page.addScriptTag({ content: reactFixture });
      const result = await page.evaluate(async () => {
        const w = /** @type {any} */ (window);
        const frame = () => new Promise(resolve => requestAnimationFrame(() => resolve(undefined)));
        let live = true;
        (function loop() { if (live) requestAnimationFrame(loop); })();
        await document.fonts.ready;
        w.mountComments();
        const shell = /** @type {HTMLElement} */ (document.getElementById('app'));
        const pane = /** @type {HTMLElement} */ (document.getElementById('pane'));
        const hosts = /** @type {HTMLElement[]} */ ([...document.querySelectorAll('[data-typeset-react]')]);
        const overflowAtMount = pane.scrollHeight > pane.clientHeight + 1;
        await new Promise(r => setTimeout(r, 150));
        /** @type {HTMLElement} */ (document.getElementById('pre')).style.height = '900px';
        await new Promise(r => setTimeout(r, 100));
        const paneTop = () => pane.getBoundingClientRect().top - shell.getBoundingClientRect().top;
        shell.scrollTop += paneTop() - shell.clientHeight - 300;
        for (let i = 0; i < 8; i++) await frame();
        const paneTopBefore = Math.round(paneTop());
        /** @type {string[] | null} */
        let painted = null;
        const tick = document.createElement('div');
        tick.style.cssText = 'position:fixed;left:0;top:0;height:1px;width:1px;visibility:hidden';
        document.body.append(tick);
        new ResizeObserver(() => { if (tick.style.width === '2px' && !painted) painted = hosts.map(el => el.dataset.tsOutcome || '(none)'); }).observe(tick);
        await frame();
        shell.scrollTop += paneTop() - 100; pane.scrollTop = 900; tick.style.width = '2px';
        await frame(); await frame();
        live = false;
        const box = pane.getBoundingClientRect();
        return { overflowAtMount, paneTopBefore, fold: shell.clientHeight, onScreen: hosts.filter(el => { const r = el.getBoundingClientRect(); return r.top < box.bottom && r.bottom > box.top && r.top < innerHeight; }).length, painted };
      });
      check(`TypesetText in a pane in an app shell that hides it only after it registers (content loaded above it), run ${run + 1}: brought on screen from below the shell's fold by one jump, every block paints composed in the jump's frame`,
        !result.overflowAtMount && result.paneTopBefore > result.fold && result.onScreen === 3 && !!result.painted && result.painted.every(outcome => outcome.startsWith('composed')), result);
      await page.close();
    }
    // A virtualized list in a 600 px overflow-y:auto pane that nearly fills
    // an 800 x 660 window: rows 0 to 2 on screen, rows 3 to 7 the overscan
    // below the pane's fold, each placed with transform: translateY
    // (TanStack Virtual's layout). 400 ms after mounting, with a frame loop keeping frames
    // pending, one frame scrolls the pane one pane height. The rows within a
    // pane height of its fold are near there and compose before the jump. A
    // build that subtracted the rows' translation when deciding whether the
    // pane hid them measured rows 4 to 6 against the window: 2 of the 3 rows
    // brought on screen painted native in the jump's frame, 3 of 3 runs in
    // Chromium and Firefox (4.2.0 and 4.3.0: none).
    for (let run = 0; run < 3; run++) {
      const page = await browser.newPage({ viewport: { width: 800, height: 660 } });
      page.setDefaultTimeout(20000);
      await page.setContent('<!doctype html><html lang="en"><head><meta charset="utf-8"><style>body{margin:0;font:18px/1.5 Georgia,serif}p{margin:0 0 12px}.row{overflow:hidden}#spin{width:20px;height:20px;background:#000;animation:spin 1s linear infinite}@keyframes spin{to{transform:rotate(360deg)}}</style></head><body><div id="pane" style="height:600px;overflow-y:auto;width:420px;position:relative"><div id="inner" style="position:relative;height:20000px"></div></div><div id="spin"></div></body></html>');
      await page.addScriptTag({ content: reactFixture });
      const result = await page.evaluate(async () => {
        const w = /** @type {any} */ (window);
        const frame = () => new Promise(resolve => requestAnimationFrame(() => resolve(undefined)));
        let live = true;
        (function loop() { if (live) requestAnimationFrame(loop); })();
        await document.fonts.ready;
        w.mountVirtual();
        await new Promise(r => setTimeout(r, 400));
        const pane = /** @type {HTMLElement} */ (document.getElementById('pane'));
        const box = pane.getBoundingClientRect();
        const band = /** @type {HTMLElement[]} */ ([...document.querySelectorAll('[data-typeset-react]')]).filter(el => { const top = el.getBoundingClientRect().top; return top >= box.bottom && top < box.bottom + pane.clientHeight; });
        /** @type {string[] | null} */
        let painted = null;
        const tick = document.createElement('div');
        tick.style.cssText = 'position:fixed;left:0;top:0;height:1px;width:1px;visibility:hidden';
        document.body.append(tick);
        new ResizeObserver(() => { if (tick.style.width === '2px' && !painted) painted = band.map(el => el.dataset.tsOutcome || '(none)'); }).observe(tick);
        await frame();
        pane.scrollTop = pane.clientHeight; tick.style.width = '2px';
        await frame(); await frame();
        live = false;
        return { band: band.length, painted };
      });
      check(`TypesetText in a virtualized list whose rows a transform places, run ${run + 1}: rows within a pane height below its fold paint composed in the frame of a jump that brings them on screen`,
        result.band >= 2 && !!result.painted && result.painted.every(outcome => outcome.startsWith('composed')), result);
      await page.close();
    }
    // Text in an overflow:auto scroller, scrolled in soon after it mounts:
    // from an animation frame requested right after mounting (delay -1: the
    // first frame, after the adapters' own frame work), from one requested
    // after a 0 ms timer (the first or the second frame, as the timer and the
    // frame fall), and 300 ms on. The first block below the pane's fold comes
    // on screen in the first scroll frame. The pane's IntersectionObserver
    // first reports in a task after a rendering update, and until 4.3.1 the
    // adapters knew no block below the fold was near before that report: in
    // the first frame, and in the second when the report came late, block 1
    // painted native lines and was rewrapped a frame later (delay -1: every
    // run in the three engines on the M2 Pro; delay 0: every WebKit run on
    // GitHub's macos-15 runners, and 4 of 20 Chromium runs on the M2 Pro).
    // mount() composes nothing before the page's first paint, so its text is
    // scrolled in once its first pass could have run.
    // The frames are watched for 2 s after the scroll. The watcher's own
    // animation frame runs throughout, which leaves every idle period shorter
    // than the adapters' LONG_IDLE_MS, so the blocks more than a pane height
    // below its fold after the scroll (10 and 11 at 400 x 700) compose on
    // idle timeouts, one per IDLE_TIMEOUT_MS (1 s), by design (WebKit, with
    // no idle callbacks, uses a timer). In Chromium and Firefox on the M2 Pro
    // block 11 composed 2,083 to 2,156 ms after mounting, 37 to 48 ms before
    // the watch ended, and a hosted runner once ended the watch with a block
    // still waiting (Firefox, CI 36478408446 attempt 1: composed 11, no
    // flash, the pane's observer still observing). Neither block is on screen
    // or within a pane height of it, so neither can flash. Whether every
    // block ends composed, and the pane's observer released, is read once
    // the watcher's frames stop (up to 3 s more), and the blocks still
    // waiting when the watch ended are reported. Each frame's lines are
    // compared with the lines as they end then, so a block painted native
    // through the watch and composed after it is still a flash.
    for (const kind of ['react', 'mount']) {
      for (const delay of kind === 'react' ? [-1, 0, 300] : [300]) {
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
          if (delay >= 0) await new Promise(r => setTimeout(r, Math.max(0, delay - (performance.now() - t0))));
          const scroller = /** @type {HTMLElement} */ (document.getElementById('scroller'));
          armed = true; requestAnimationFrame(frame);
          await new Promise(resolve => { let k = 0; const step = () => { scroller.scrollTop += 80; if (++k < 6) requestAnimationFrame(step); else resolve(undefined); }; requestAnimationFrame(step); });
          await new Promise(r => setTimeout(r, 2000));
          armed = false;
          const blocks = () => /** @type {HTMLElement[]} */ ([...document.querySelectorAll('.r')]);
          // Blocks not yet composed as the watch ends, by how far their top is
          // below the pane's fold, in pane heights.
          const pane = scroller.getBoundingClientRect();
          const waiting = blocks().map((el, i) => ({ i, el })).filter(({ el }) => !el.dataset.tsOutcome)
            .map(({ i, el }) => ({ i, panes: Math.round((el.getBoundingClientRect().top - pane.bottom) / pane.height * 100) / 100 }));
          for (let k = 0; k < 60 && !blocks().every(el => el.dataset.tsOutcome); k++) await new Promise(r => setTimeout(r, 50));
          // Lines as they end, so a block painted native throughout the watch
          // and composed only after it still counts as a flash.
          const final = blocks().map(el => lines(el));
          const flashes = painted.flatMap((blocks, f) => blocks.filter(b => b.lines !== final[b.i]).map(b => ({ frame: f, block: b.i })));
          return { frames: painted.length, flashFrames: new Set(flashes.map(x => x.frame)).size, flashAt: [...new Set(flashes.map(x => x.frame))].slice(0, 4), flashBlocks: [...new Set(flashes.map(x => x.block))], waiting, composed: blocks().filter(el => el.dataset.tsOutcome).length,
            rootedObservers: w.rootedObservers.length, liveRootedObservers: w.rootedObservers.filter((/** @type {any} */ o) => o.live).length };
        }, { kind, delay });
        check(`${kind === 'react' ? 'TypesetText' : 'mount()'} in an overflow:auto scroller, scrolled in ${delay < 0 ? 'the frame' : `${delay} ms`} after mounting: no block paints native lines and is rewrapped`, result.flashFrames === 0 && result.frames > 0 && result.composed === 12, result);
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
