// @ts-check
// Typeset 4 benchmark: what composition costs a page, measured on the built
// artifacts rather than on source.
//
//   node scripts/v4/bench-v4.mjs                              the candidate (TYPESET_DIST) or committed dist
//   node scripts/v4/bench-v4.mjs --dist public/releases/4.2.0 --label 4.2.0 --out <file>
//   --engines chromium,webkit   --cpu 1,4   --only mount,react,storm,hidden,font,typesetAll,sizes
//
// Scenarios (Chromium at 1x and 4x CPU through CDP; WebKit unthrottled):
//   mount-N          Typeset.mount(document, 'article p') over 50, 200 and 1000 article paragraphs
//   typesetAll-N     per-paragraph cost (median, p95) from typesetAll() results
//   react-K-N        a screen push of N TypesetText / TypesetRichText / plain React blocks
//                    under 15 wrappers, from a trusted click (Event Timing INP proxy)
//   storm            30 class toggles on an ancestor of 200 mounted paragraphs, one per frame
//   hidden           200 mounted paragraphs inside display:none, then shown
//   late-font        a web font applied after mount() is ready, loaded 1.2 s late
// Each records wall times, long tasks and total blocking time (Chromium's
// longtask API, and a portable animation-frame gap probe for WebKit), observers
// and listeners created, and DOM mutation records (node writes).
// sizes: min+gzip+brotli of esbuild bundles importing only mount, only
// TypesetText, only smartQuotes, and of the shipped files.
import { build } from 'esbuild';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { resolve, join, dirname } from 'node:path';
import { parseArgs } from 'node:util';
import { cpus, loadavg } from 'node:os';
import { browsers } from './browsers.mjs';
import { artifacts } from './candidate.mjs';
import { measureSizes } from './bench-sizes.mjs';

const { values } = parseArgs({ options: {
  dist: { type: 'string' }, label: { type: 'string' }, out: { type: 'string' },
  engines: { type: 'string', default: 'chromium,webkit' }, cpu: { type: 'string', default: '1,4' },
  only: { type: 'string' },
} });
const dist = resolve(values.dist ?? artifacts.dist);
const label = values.label ?? (process.env.TYPESET_DIST ? 'candidate' : 'committed dist');
const only = values.only?.split(',');
const want = (/** @type {string} */ name) => !only || only.includes(name);
const rates = values.cpu.split(',').map(Number);
const started = Date.now();
// Other work on the machine skews wall times; the load is recorded with the results.
const startLoad = loadavg().map(n => +n.toFixed(2));
const watchdog = setTimeout(() => { console.error('bench-v4: watchdog after 20 min'); process.exit(3); }, 20 * 60 * 1000);
watchdog.unref();

// ---------- page fixtures ----------
const corpus = JSON.parse(await readFile('tests/v4-corpus.json', 'utf8')).paragraphs;
/** Article paragraphs of 25 to 200 words; one in five carries a link and emphasis. @param {number} n */
function paragraphs(n) {
  const out = [];
  let k = 0;
  for (let i = 0; i < n; i++) {
    const text = Array.from({ length: 1 + (i % 4) }, () => corpus[(k++) % corpus.length]).join(' ').replace(/&/g, '&amp;').replace(/</g, '&lt;');
    if (i % 5 !== 2) { out.push(text); continue; }
    const w = text.split(' ');
    if (w.length > 8) { w[3] = '<a href="#x">' + w[3] + ' ' + w[4] + '</a>'; w.splice(4, 1); w[6] = '<em>' + w[6] + '</em>'; }
    out.push(w.join(' '));
  }
  return out;
}
/** @param {number} n @param {{ hidden?: boolean, css?: string }} [options] */
function articlePage(n, { hidden = false, css = '' } = {}) {
  let open = '', close = '';
  for (let d = 0; d < 6; d++) { open += `<div class="w${d}">`; close = '</div>' + close; }
  const body = paragraphs(n).map(p => '<p>' + p + '</p>').join('\n');
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><style>body{margin:0;font:18px/1.5 Georgia,serif;color:#222;background:#fff}article{max-width:650px;margin:0 auto;padding:0 16px}.w3.alt{outline:1px solid transparent}${css}</style></head><body><div id="root">${open}<main${hidden ? ' id="gate" style="display:none"' : ''}><article><h1>Benchmark article</h1>${body}</article></main>${close}</div></body></html>`;
}

// Installed before any page script: counts what the engine creates.
const instrument = () => {
  const w = /** @type {any} */ (window);
  const counts = { mutationObservers: 0, mutationObserve: 0, resizeObservers: 0, resizeObserve: 0, intersectionObservers: 0, intersectionObserve: 0, windowListeners: 0, documentListeners: 0, fontListeners: 0 };
  const bench = w.__bench = { counts, longTasks: /** @type {{ start: number, duration: number }[]} */ ([]), events: /** @type {{ name: string, start: number, duration: number }[]} */ ([]), NativeMO: window.MutationObserver };
  /** @param {string} name @param {string} made @param {string} observed */
  const wrap = (name, made, observed) => {
    const Original = w[name];
    if (!Original) return;
    w[name] = class extends Original {
      constructor(/** @type {any[]} */ ...args) { super(...args); /** @type {any} */ (counts)[made]++; }
      observe(/** @type {any[]} */ ...args) { /** @type {any} */ (counts)[observed]++; return super.observe(...args); }
    };
  };
  wrap('MutationObserver', 'mutationObservers', 'mutationObserve');
  wrap('ResizeObserver', 'resizeObservers', 'resizeObserve');
  wrap('IntersectionObserver', 'intersectionObservers', 'intersectionObserve');
  const add = EventTarget.prototype.addEventListener;
  EventTarget.prototype.addEventListener = function (/** @type {any[]} */ ...args) {
    if (this === window) counts.windowListeners++;
    else if (this === document) counts.documentListeners++;
    else if (this === document.fonts) counts.fontListeners++;
    return add.apply(this, /** @type {any} */ (args));
  };
  try { new PerformanceObserver(list => { for (const e of list.getEntries()) bench.longTasks.push({ start: e.startTime, duration: e.duration }); }).observe({ type: 'longtask', buffered: true }); } catch {}
  try { new PerformanceObserver(list => { for (const e of list.getEntries()) bench.events.push({ name: e.name, start: e.startTime, duration: e.duration }); }).observe(/** @type {any} */ ({ type: 'event', buffered: true, durationThreshold: 16 })); } catch {}
};

// In-page measurement helpers, evaluated once per page.
const helpers = () => {
  const w = /** @type {any} */ (window);
  const bench = w.__bench;
  w.__measure = {
    begin() {
      for (const key of Object.keys(bench.counts)) bench.counts[key] = 0;
      const state = { t0: performance.now(), writes: 0, gaps: /** @type {number[]} */ ([]), running: true, last: performance.now() };
      const writes = new bench.NativeMO((/** @type {MutationRecord[]} */ records) => { state.writes += records.length; });
      writes.observe(document.documentElement, { subtree: true, childList: true, attributes: true, characterData: true });
      // Frame gaps show a blocked main thread in every engine. (A task-based
      // probe would keep the event loop busy and starve requestIdleCallback,
      // which the scheduler under test relies on.)
      const frame = () => { const now = performance.now(); if (now - state.last > 50) state.gaps.push(now - state.last); state.last = now; if (state.running) requestAnimationFrame(frame); };
      requestAnimationFrame(frame);
      return {
        state,
        async end() {
          await new Promise(r => setTimeout(r, 50));
          state.running = false;
          writes.takeRecords().forEach(() => state.writes++);
          writes.disconnect();
          const t1 = performance.now();
          const tasks = bench.longTasks.filter((/** @type {any} */ t) => t.start + t.duration > state.t0 && t.start < t1);
          return {
            longTasks: tasks.length,
            tbtMs: Math.round(tasks.reduce((/** @type {number} */ s, /** @type {any} */ t) => s + Math.max(0, t.duration - 50), 0)),
            longestTaskMs: Math.round(Math.max(0, ...tasks.map((/** @type {any} */ t) => t.duration))),
            gapBlockingMs: Math.round(state.gaps.reduce((s, g) => s + Math.max(0, g - 50), 0)),
            longestGapMs: Math.round(Math.max(0, ...state.gaps)),
            nodeWrites: state.writes,
            counts: { ...bench.counts },
          };
        },
      };
    },
    visible(/** @type {string} */ selector) {
      return [...document.querySelectorAll(selector)].filter(el => { const r = el.getBoundingClientRect(); return r.bottom > 0 && r.top < innerHeight && r.height > 0; });
    },
    async until(/** @type {() => boolean} */ test, timeout = 60000) {
      const t0 = performance.now();
      while (!test()) { if (performance.now() - t0 > timeout) return false; await new Promise(r => requestAnimationFrame(() => r(undefined))); }
      return true;
    },
    async quiet(/** @type {any} */ controller, ms = 500, timeout = 60000) {
      const t0 = performance.now();
      let passes = controller.stats.passes, since = performance.now();
      while (performance.now() - t0 < timeout) {
        await new Promise(r => setTimeout(r, 100));
        if (controller.stats.passes !== passes) { passes = controller.stats.passes; since = performance.now(); }
        else if (performance.now() - since >= ms) return true;
      }
      return false;
    },
  };
};

const engineText = await readFile(join(dist, 'typeset.global.js'), 'utf8');
const fontBytes = await readFile('lab/fraunces-latin-variable.woff2');
async function reactFixture() {
  const contents = `
import { createElement as h, useState, useLayoutEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { TypesetText, TypesetRichText } from ${JSON.stringify(join(dist, 'react.js'))};
const labels = ['Daily tip', 'Breathe', 'Sleep better tonight', 'Your streak', 'Hydration', 'Move for five minutes', 'Check in', 'Journal', 'Gratitude', 'Mindful minute'];
const para = 'Small habits compound: a short walk after lunch, a glass of water before coffee, and two minutes of slow breathing before bed.';
function block(kind, i) {
  const long = i % 4 === 3, text = long ? para : labels[i % labels.length];
  const style = { display: 'block', width: '300px' };
  if (kind === 'plain') return h(long ? 'p' : 'span', { key: i, style }, text);
  if (kind === 'typeset') return h(TypesetText, { key: i, text, as: long ? 'p' : 'span', style });
  return h(TypesetRichText, { key: i, as: long ? 'p' : 'span', style }, long ? h('span', null, 'Small habits compound: ', h('a', { href: '#walk' }, 'a short walk after lunch'), ', a glass of water before coffee, and two minutes of slow breathing before bed.') : text);
}
function Screen({ n, kind }) {
  useLayoutEffect(() => { window.__committed = performance.now(); }, []);
  let tree = h('div', null, Array.from({ length: n }, (_, i) => block(kind, i)));
  for (let d = 0; d < 15; d++) tree = h('div', { className: 'view' }, tree);
  return tree;
}
function App() {
  const [screen, setScreen] = useState(null);
  return h('div', null, h('button', { id: 'push', onClick: () => { window.__clicked = performance.now(); setScreen(window.__next); } }, 'Push screen'), screen && h(Screen, { key: screen.n + screen.kind, ...screen }));
}
createRoot(document.getElementById('app')).render(h(App));
`;
  const result = await build({ stdin: { contents, resolveDir: process.cwd(), loader: 'js' }, bundle: true, minify: true, write: false, format: 'iife', target: 'es2022', define: { 'process.env.NODE_ENV': '"production"' }, logLevel: 'silent' });
  return result.outputFiles[0].text;
}
const reactText = await reactFixture();

/**
 * @template T
 * @param {Promise<T>} promise @param {number} ms @param {string} what
 * @returns {Promise<T>}
 */
const within = (promise, ms, what) => {
  /** @type {ReturnType<typeof setTimeout> | undefined} */
  let timer;
  // Cleared on settle: a pending timer would hold the process open for the full limit after the last scenario.
  return Promise.race([promise, new Promise((_, reject) => { timer = setTimeout(() => reject(new Error(`${what} exceeded ${ms / 1000} s`)), ms); })]).finally(() => clearTimeout(timer));
};

/** @param {import('playwright').Browser} browser @param {string} engineName @param {number} rate @param {string} html */
async function openPage(browser, engineName, rate, html) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 844 } });
  page.setDefaultTimeout(20000);
  await page.addInitScript(instrument);
  await page.route('http://bench.test/**', async route => {
    const path = new URL(route.request().url()).pathname;
    if (path === '/late.woff2') { await new Promise(r => setTimeout(r, 1200)); return route.fulfill({ contentType: 'font/woff2', body: fontBytes }); }
    if (path === '/react.js') return route.fulfill({ contentType: 'text/javascript', body: reactText });
    return route.fulfill({ contentType: 'text/html; charset=utf-8', body: html });
  });
  await page.goto('http://bench.test/index.html', { waitUntil: 'load', timeout: 60000 });
  await page.evaluate(() => document.fonts.ready);
  await page.evaluate(helpers);
  if (engineName === 'chromium' && rate > 1) {
    const cdp = await page.context().newCDPSession(page);
    await cdp.send('Emulation.setCPUThrottlingRate', { rate });
  }
  return page;
}
/** @param {import('playwright').Page} page */
const loadEngine = page => page.evaluate(source => { const s = document.createElement('script'); s.textContent = source; document.head.append(s); }, engineText);

/** @param {number[]} values */
const quantiles = values => {
  const sorted = [...values].sort((a, b) => a - b);
  const at = (/** @type {number} */ q) => sorted.length ? sorted[Math.min(sorted.length - 1, Math.floor(q * sorted.length))] : 0;
  return { median: +at(0.5).toFixed(2), p95: +at(0.95).toFixed(2), max: +(sorted.at(-1) ?? 0).toFixed(2), total: Math.round(sorted.reduce((a, b) => a + b, 0)) };
};

/** @type {Record<string, unknown>} */
const results = {};
/** @type {Record<string, string>} */
const versions = {};
/** @type {string[]} */
const errors = [];
const plan = [];
for (const name of values.engines.split(',')) for (const rate of name === 'chromium' ? rates : [1]) plan.push({ name, rate });

for (const { name, rate } of plan) {
  const config = browsers.find(b => b.name === name);
  if (!config) continue;
  const browser = await config.engine.launch({ executablePath: config.executablePath, timeout: 20000 });
  const key = `${name}@${rate}x`;
  versions[key] = browser.version();
  /** @type {Record<string, unknown>} */
  const lane = results[key] = {};
  /** @param {string} scenario @param {() => Promise<unknown>} run @param {number} [limit] */
  const scenario = async (scenario, run, limit = 120000) => {
    try { lane[scenario] = await within(run(), limit, `${key} ${scenario}`); process.stderr.write(`${key} ${scenario} done\n`); }
    catch (error) { errors.push(`${key} ${scenario}: ${String(/** @type {Error} */ (error).message).split('\n')[0]}`); lane[scenario] = { error: true }; }
  };
  try {
    // mount()
    if (want('mount')) for (const n of [50, 200, 1000]) {
      await scenario(`mount-${n}`, async () => {
        const page = await openPage(browser, name, rate, articlePage(n));
        try {
          await loadEngine(page);
          return await page.evaluate(async () => {
            const w = /** @type {any} */ (window), m = w.__measure;
            const run = m.begin();
            const t0 = run.state.t0;
            const controller = w.Typeset.mount(document, 'article p');
            const visible = m.visible('article p');
            await m.until(() => visible.every((/** @type {HTMLElement} */ el) => el.dataset.tsOutcome), 120000);
            const visibleMs = performance.now() - t0;
            await controller.ready;
            const readyMs = performance.now() - t0;
            const measured = await run.end();
            const outcomes = /** @type {Record<string, number>} */ ({});
            for (const el of document.querySelectorAll('article p')) { const o = /** @type {HTMLElement} */ (el).dataset.tsOutcome || 'none'; outcomes[o] = (outcomes[o] || 0) + 1; }
            return { paragraphs: document.querySelectorAll('article p').length, visible: visible.length, visibleMs: Math.round(visibleMs), readyMs: Math.round(readyMs), passes: controller.stats.passes, compositions: controller.stats.compositions, maxBatchMs: Math.round(controller.stats.maxBatchMs), outcomes, ...measured };
          });
        } finally { await page.close(); }
      }, 180000);
    }
    // typesetAll(): per-paragraph cost
    if (want('typesetAll')) for (const n of rate > 1 || name !== 'chromium' ? [50, 200] : [50, 200, 1000]) {
      await scenario(`typesetAll-${n}`, async () => {
        const page = await openPage(browser, name, rate, articlePage(n));
        try {
          await loadEngine(page);
          return await page.evaluate(() => {
            const w = /** @type {any} */ (window);
            const t0 = performance.now();
            const results = w.Typeset.typesetAll('article p');
            const totalMs = performance.now() - t0;
            return { paragraphs: results.length, totalMs: Math.round(totalMs), perParagraphMs: results.map((/** @type {any} */ r) => r.durationMs), composed: results.filter((/** @type {any} */ r) => r.outcome.startsWith('composed')).length };
          });
        } finally { await page.close(); }
      }, 180000);
      const entry = /** @type {any} */ (lane[`typesetAll-${n}`]);
      if (entry?.perParagraphMs) { entry.perParagraph = quantiles(entry.perParagraphMs); delete entry.perParagraphMs; }
    }
    // React screen push from a trusted click
    if (want('react')) for (const kind of ['plain', 'typeset', 'rich']) for (const n of rate > 1 || name !== 'chromium' ? [38] : [38, 1000]) {
      await scenario(`react-${kind}-${n}`, async () => {
        const page = await openPage(browser, name, rate, '<!doctype html><html lang="en"><body style="margin:16px;font:17px/1.45 Georgia"><div id="app"></div><script src="/react.js"></script></body></html>');
        try {
          await page.waitForSelector('#push');
          await page.evaluate(({ n, kind }) => { const w = /** @type {any} */ (window); w.__next = { n, kind }; w.__run = w.__measure.begin(); }, { n, kind });
          await page.click('#push', { timeout: 120000 });
          await page.waitForFunction(() => /** @type {any} */ (window).__committed, null, { timeout: 120000 });
          await page.waitForTimeout(1500);
          return await page.evaluate(async () => {
            const w = /** @type {any} */ (window);
            const measured = await w.__run.end();
            const clicks = w.__bench.events.filter((/** @type {any} */ e) => ['pointerdown', 'pointerup', 'click', 'mousedown', 'mouseup'].includes(e.name) && e.start >= w.__run.state.t0 - 1);
            const outcomes = /** @type {Record<string, number>} */ ({});
            for (const el of document.querySelectorAll('[data-typeset-react], [data-typeset-react-rich]')) { const o = /** @type {HTMLElement} */ (el).dataset.tsOutcome || 'none'; outcomes[o] = (outcomes[o] || 0) + 1; }
            return { commitMs: Math.round(w.__committed - w.__clicked), inpProxyMs: clicks.length ? Math.round(Math.max(...clicks.map((/** @type {any} */ e) => e.duration))) : null, outcomes, ...measured };
          });
        } finally { await page.close(); }
      }, 180000);
    }
    // Ancestor class toggle storm
    if (want('storm')) await scenario('storm', async () => {
      const page = await openPage(browser, name, rate, articlePage(200));
      try {
        await loadEngine(page);
        return await page.evaluate(async () => {
          const w = /** @type {any} */ (window), m = w.__measure;
          const controller = w.Typeset.mount(document, 'article p');
          await controller.ready;
          await m.quiet(controller, 300);
          const before = { passes: controller.stats.passes, compositions: controller.stats.compositions };
          const run = m.begin();
          const wrapper = /** @type {HTMLElement} */ (document.querySelector('.w3'));
          for (let i = 0; i < 30; i++) { wrapper.classList.toggle('alt'); await new Promise(r => requestAnimationFrame(r)); }
          const drained = await m.quiet(controller, 500, 90000);
          const elapsedMs = performance.now() - run.state.t0;
          const measured = await run.end();
          return { toggles: 30, drained, elapsedMs: Math.round(elapsedMs), passes: controller.stats.passes - before.passes, compositions: controller.stats.compositions - before.compositions, ...measured };
        });
      } finally { await page.close(); }
    }, 180000);
    // hidden -> shown
    if (want('hidden')) await scenario('hidden', async () => {
      const page = await openPage(browser, name, rate, articlePage(200, { hidden: true }));
      try {
        await loadEngine(page);
        return await page.evaluate(async () => {
          const w = /** @type {any} */ (window), m = w.__measure;
          const controller = w.Typeset.mount(document, 'article p');
          await controller.ready;
          await m.quiet(controller, 300);
          const hiddenOutcomes = /** @type {Record<string, number>} */ ({});
          for (const el of document.querySelectorAll('article p')) { const o = /** @type {HTMLElement} */ (el).dataset.tsOutcome || 'none'; hiddenOutcomes[o] = (hiddenOutcomes[o] || 0) + 1; }
          const before = { compositions: controller.stats.compositions };
          const run = m.begin();
          /** @type {HTMLElement} */ (document.getElementById('gate')).style.display = 'block';
          const visible = m.visible('article p');
          const composedVisible = await m.until(() => visible.every((/** @type {HTMLElement} */ el) => /^(composed|native:(fits|break-policy|quality|verification|no-candidate))/.test(el.dataset.tsOutcome || '')), 30000);
          const visibleMs = performance.now() - run.state.t0;
          await m.quiet(controller, 500, 60000);
          const measured = await run.end();
          return { hiddenOutcomes, composedVisible, visibleMs: Math.round(visibleMs), compositions: controller.stats.compositions - before.compositions, ...measured };
        });
      } finally { await page.close(); }
    }, 180000);
    // A web font applied after mount() is ready
    if (want('font')) await scenario('late-font', async () => {
      const page = await openPage(browser, name, rate, articlePage(200));
      try {
        await loadEngine(page);
        return await page.evaluate(async () => {
          const w = /** @type {any} */ (window), m = w.__measure;
          const controller = w.Typeset.mount(document, 'article p');
          await controller.ready;
          await m.quiet(controller, 300);
          const before = { passes: controller.stats.passes, compositions: controller.stats.compositions };
          const run = m.begin();
          const style = document.createElement('style');
          style.textContent = "@font-face{font-family:BenchLate;src:url(/late.woff2) format('woff2');font-display:swap}article p{font-family:BenchLate,Georgia,serif}";
          document.head.append(style);
          // Wait for the face itself: FontFaceSet.check() can report true before a
          // CSS-connected face has even started loading (WebKit).
          await m.until(() => [...document.fonts].some(face => face.family.replace(/["']/g, '') === 'BenchLate' && face.status === 'loaded'), 15000);
          const loadedMs = performance.now() - run.state.t0;
          await m.quiet(controller, 800, 60000);
          const settledMs = performance.now() - run.state.t0;
          const measured = await run.end();
          // Composed paragraphs whose rendered lines no longer match their breaks.
          let stale = 0, composed = 0;
          for (const el of document.querySelectorAll('article p')) {
            if (!(/** @type {HTMLElement} */ (el).dataset.tsOutcome || '').startsWith('composed')) continue;
            composed++;
            const lines = w.Typeset.measureLayout(el).lines.length, breaks = el.querySelectorAll('br[data-ts-break]').length;
            if (lines !== breaks + 1) stale++;
          }
          return { fontLoadedMs: Math.round(loadedMs), settledMs: Math.round(settledMs), passes: controller.stats.passes - before.passes, compositions: controller.stats.compositions - before.compositions, composed, staleAfterFont: stale, ...measured };
        });
      } finally { await page.close(); }
    }, 180000);
  } catch (error) {
    errors.push(`${key}: ${String(/** @type {Error} */ (error).stack || error)}`);
  } finally { await browser.close(); }
}

const output = {
  label, dist, generated: new Date().toISOString(), seconds: 0,
  environment: { node: process.version, platform: process.platform, arch: process.arch, cpu: cpus()[0]?.model, cores: cpus().length, loadAverageAtStart: startLoad, loadAverageAtEnd: loadavg().map(n => +n.toFixed(2)), browsers: versions },
  sizes: want('sizes') ? await measureSizes(dist) : undefined,
  results, errors,
};
output.seconds = Math.round((Date.now() - started) / 1000);
const out = values.out ?? 'output/bench-v4.json';
await mkdir(dirname(out), { recursive: true });
await writeFile(out, JSON.stringify(output, null, 2));
console.log(JSON.stringify({ label, out, seconds: output.seconds, sizes: output.sizes, errors }, null, 2));
if (errors.length) process.exitCode = 1;
