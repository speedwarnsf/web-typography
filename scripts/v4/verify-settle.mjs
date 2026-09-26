// @ts-check
// Settling (P6): every integration reaches a quiet page and stays there. A
// block whose box is sized by its own content (a flex item without flex-1 or
// min-w-0, w-fit, inline-block, an auto table cell or grid track, a float, an
// absolutely positioned box without a width, a dialog) narrows to its
// composed lines. That change is the composition's own. If it counts as a
// resize, the block switches between composed and native lines without end:
// the 4.3.0 release candidate's TypesetText and TypesetRichText did so on
// newworldadvertising.org/awards at 7 of 8 widths, hundreds of DOM changes a
// second, where 4.2.0 settled.
//
// For mount(), the typeset.us loader (go.js), TypesetText and
// TypesetRichText, in Chromium, WebKit and Firefox, at 320, 375, 768 and
// 1280 px and after a resize from each, on a page holding every layout of the
// matrix (the /awards card among them): 2 s after the page is ready (or the
// resize ends) and every block has been scrolled near, no DOM mutation and no
// outcome change for 3 s. With smartQuotes="en" every block shows educated
// quotes in every sampled frame once it is processed: composed, declined,
// stale while the window resizes, waiting offscreen.
//
//   node scripts/v4/verify-settle.mjs [--only chromium] [--adapter text,rich] [--width 375] [--layout awards]
import { build } from 'esbuild';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { parseArgs } from 'node:util';
import { browsers } from './browsers.mjs';
import { artifacts, reactUnderTest } from './candidate.mjs';
import { releaseIdentity } from './release-evidence.mjs';

const { values } = parseArgs({ options: { only: { type: 'string' }, adapter: { type: 'string' }, width: { type: 'string' }, layout: { type: 'string' }, verbose: { type: 'boolean', default: false } } });
const ADAPTERS = /** @type {const} */ (['mount', 'go', 'text', 'rich']).filter(a => !values.adapter || values.adapter.split(',').includes(a));
const RESIZES = /** @type {[number, number][]} */ ([[320, 360], [375, 335], [768, 700], [1280, 1180]]).filter(([w]) => !values.width || values.width.split(',').includes(String(w)));
const HEIGHT = 900;
const WAIT_MS = 2000, QUIET_MS = 3000;

/** Every text has straight quotes or apostrophes, so education shows in each. */
const TEXTS = {
  award: 'The National Gay Media Association\'s Ad Pop Award recognizes advertising agencies for outstanding creative production and media planning in a campaign that reaches audiences across the country.',
  w3: 'The W3 Awards honor creative excellence on the web, and recognize the creative and marketing professionals behind the year\'s award winning sites, videos and marketing programs.',
  habit: '"Small habits compound quietly," she said. A glass of water before coffee and ten minutes of daylight before screens will change the shape of an ordinary week.',
  rest: 'Rest isn\'t a reward for finishing everything on your list; it\'s the condition that makes the list possible, and the body keeps its own \'ledger\' of what it\'s owed.',
  title: 'American Public Health Association\'s "Best Campaign" Award',
  webby: 'The Webby Awards\' "People\'s Voice"',
  fits: 'It\'s "fine," she said.',
};
/** @typedef {{ tag?: string, text?: keyof typeof TEXTS, mode?: string, cls?: string, decor?: string, component?: boolean }} HostSpec */

/** The matrix. `hosts(...)` marks a container whose children are the blocks. */
const LAYOUTS = /** @type {{ id: string, html: (hosts: (...specs: HostSpec[]) => string) => string }[]} */ ([
  // newworldadvertising.org/awards before its layout fix: an icon beside a
  // shrink-to-fit column holding a heading and a description.
  { id: 'awards', html: hosts => `<article class="card"><div class="row"><span class="badge"><span class="icon"></span></span><div ${hosts({ tag: 'h2', text: 'title', mode: 'title', cls: 'card-title' }, { tag: 'p', text: 'award', cls: 'card-text' })}></div></div></article>` },
  { id: 'block', html: hosts => `<div ${hosts({ text: 'w3' })}></div>` },
  { id: 'flex-item', html: hosts => `<div class="row"><span class="icon"></span><div ${hosts({ text: 'w3' })}></div></div>` },
  { id: 'flex-host-item', html: hosts => `<div class="row" ${hosts({ decor: 'icon' }, { text: 'habit' })}></div>` },
  { id: 'fit-content', html: hosts => `<div class="fit" ${hosts({ text: 'rest' })}></div>` },
  { id: 'host-fit-content', html: hosts => `<div ${hosts({ text: 'award', cls: 'fit' })}></div>` },
  { id: 'inline-block', html: hosts => `<div class="ib" ${hosts({ text: 'habit' })}></div>` },
  { id: 'host-inline-block', html: hosts => `<div ${hosts({ text: 'w3', cls: 'ib' })}></div>` },
  { id: 'table-cell', html: hosts => `<table><tr><td ${hosts({ text: 'award' })}></td><td>Short cell</td></tr></table>` },
  { id: 'table-two-cells', html: hosts => `<table><tr><td ${hosts({ text: 'rest' })}></td><td ${hosts({ text: 'habit' })}></td></tr></table>` },
  { id: 'grid-auto', html: hosts => `<div class="grid-auto"><div ${hosts({ text: 'rest' })}></div><div ${hosts({ text: 'w3' })}></div></div>` },
  { id: 'grid-min-content', html: hosts => `<div class="grid-min"><div ${hosts({ tag: 'h3', text: 'webby', mode: 'title' })}></div><div ${hosts({ text: 'habit' })}></div></div>` },
  { id: 'float', html: hosts => `<div class="float" ${hosts({ text: 'award' })}></div><div class="clear"></div>` },
  { id: 'absolute', html: hosts => `<div class="abs-wrap"><div class="abs" ${hosts({ text: 'rest' })}></div></div>` },
  { id: 'flex-column-center', html: hosts => `<div class="col-center" ${hosts({ tag: 'h3', text: 'webby', mode: 'title' }, { text: 'habit' })}></div>` },
  { id: 'nested-scrollers', html: hosts => `<div class="scroll-outer"><div class="pad"></div><div class="scroll-inner"><div class="ib" ${hosts({ text: 'rest' })}></div></div><div class="ib" ${hosts({ text: 'award' })}></div></div>` },
  { id: 'details', html: hosts => `<details open><summary>Details</summary><div class="fit" ${hosts({ text: 'w3' })}></div></details>` },
  { id: 'dialog', html: hosts => `<div class="dialog-wrap"><dialog open ${hosts({ text: 'habit' })}></dialog></div>` },
  // Declined blocks still show educated quotes: one line, justified text, and
  // (TypesetRichText) a component child, which keeps the paragraph native.
  { id: 'declines', html: hosts => `<div ${hosts({ text: 'fits' }, { text: 'rest', cls: 'justify' }, { text: 'habit', component: true })}></div>` },
].filter(layout => !values.layout || values.layout.split(',').includes(layout.id)));

const CSS = `body{margin:16px;font:18px/1.5 Georgia,serif;color:#111;background:#fff}
section{margin:0 0 28px}p,h2,h3{margin:0}h2{font-size:24px}h3{font-size:21px}
.card{padding:20px;background:#f3efe6}.row{display:flex;align-items:flex-start;gap:16px}
.badge{margin-top:4px;padding:8px;background:#e8c547}.icon{display:block;flex:none;width:22px;height:22px;background:#222}
.card-title{font:900 30px/1.25 Georgia,serif}.card-text{margin-top:12px;font:600 16px/28px Georgia,serif;max-width:56rem}
.fit{width:fit-content}.ib{display:inline-block}table{border-collapse:collapse}td{vertical-align:top;padding:4px 8px;border:1px solid #ccc}
.grid-auto{display:grid;grid-template-columns:auto auto;gap:12px}.grid-min{display:grid;grid-template-columns:min-content auto;gap:12px}
.float{float:left;max-width:100%}.clear{clear:both}.abs-wrap{position:relative;height:17em}.abs{position:absolute;top:0;left:0}
.col-center{display:flex;flex-direction:column;align-items:center;gap:8px}
.scroll-outer{height:240px;overflow:auto;border:1px solid #ccc}.pad{height:90px}.scroll-inner{max-height:170px;overflow:auto}
.dialog-wrap{position:relative;height:18em}.justify{text-align:justify;margin-top:8px}`;

const escape = (/** @type {string} */ text) => text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
/** Static markup of one block, as mount() and the loader find it. `rich` wraps the third to fifth words in <em>. */
const staticHost = (/** @type {HostSpec} */ spec, /** @type {boolean} */ rich) => {
  if (spec.decor) return `<span class="${spec.decor}" aria-hidden="true"></span>`;
  const tag = spec.tag || 'p', text = TEXTS[/** @type {keyof typeof TEXTS} */ (spec.text)], words = text.split(' ');
  const inner = rich && words.length >= 8 ? escape(words.slice(0, 2).join(' ')) + ' <em>' + escape(words.slice(2, 5).join(' ')) + '</em> ' + escape(words.slice(5).join(' ')) : escape(text);
  return `<${tag} data-settle=""${spec.cls ? ` class="${spec.cls}"` : ''}${spec.mode ? ` data-typeset-mode="${spec.mode}"` : ''}>${inner}</${tag}>`;
};
/** @param {'mount' | 'go' | 'text' | 'rich'} adapter */
function pageHTML(adapter) {
  const react = adapter === 'text' || adapter === 'rich';
  /** @type {string[]} */
  const inner = [];
  /** @type {(...specs: HostSpec[]) => string} */
  const hosts = (...specs) => {
    inner.push(react ? '' : specs.map(spec => staticHost(spec, adapter === 'go')).join(''));
    return `data-hosts='${JSON.stringify(specs)}' data-fill="${inner.length - 1}"`;
  };
  // Static adapters: the blocks are in the HTML, inside their containers.
  const body = LAYOUTS.map(layout => `<section data-layout="${layout.id}">${layout.html(hosts)}</section>`).join('\n')
    .replace(/ data-fill="(\d+)"([^>]*)>/g, (_match, index, rest) => rest + '>' + inner[Number(index)]);
  const scripts = adapter === 'mount' ? '<script src="/typeset.global.js"></script><script>window.settleController = Typeset.mount(document, "[data-settle]", { smartQuotes: "en", opticalHanging: true }); window.settleReady = true;</script>'
    : adapter === 'go' ? '<script src="/go.js" data-typeset-selector="[data-settle]"></script><script>window.settleReady = true;</script>'
    : `<script>window.SETTLE_TEXTS = ${JSON.stringify(TEXTS)};</script><script src="/app.js"></script>`;
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><style>${CSS}</style></head><body>${body}${scripts}</body></html>`;
}

// In the page from the first script on: straight quotes in a processed block,
// sampled every animation frame, and a quiet-window meter.
const INSTRUMENT = () => {
  const w = /** @type {any} */ (window);
  const react = /[?&]adapter=(text|rich)\b/.test(location.search);
  w.__settle = { phase: 'load', straight: [], frames: 0, staleFrames: 0, declinedFrames: 0 };
  const sample = () => {
    const log = w.__settle;
    log.frames++;
    let stale = false, declined = false;
    for (const host of document.querySelectorAll('[data-settle]')) {
      // mount() and the loader educate a block when they first process it;
      // before that it is the page's own markup.
      const processed = react || host.hasAttribute('data-ts-outcome') || host.hasAttribute('data-ts-stale');
      if (!processed) continue;
      stale ||= host.hasAttribute('data-ts-stale');
      declined ||= (host.getAttribute('data-ts-outcome') || '').startsWith('native:');
      if (!/['"]/.test(host.textContent || '')) continue;
      if (log.straight.length < 200) log.straight.push({ phase: log.phase, layout: host.closest('[data-layout]')?.getAttribute('data-layout'), outcome: host.getAttribute('data-ts-outcome'), stale: host.hasAttribute('data-ts-stale'), text: (host.textContent || '').slice(0, 60) });
      else log.overflow = true;
    }
    if (stale) log.staleFrames++;
    if (declined) log.declinedFrames++;
    requestAnimationFrame(sample);
  };
  requestAnimationFrame(sample);
  const sleep = (/** @type {number} */ ms) => new Promise(resolve => setTimeout(resolve, ms));
  const state = () => Array.from(document.querySelectorAll('[data-settle]'), host => (host.getAttribute('data-ts-outcome') || '-') + (host.hasAttribute('data-ts-stale') ? '+stale' : ''));
  /** Wait `wait` ms, then count every DOM mutation and outcome change for `quiet` ms. */
  w.__quietWindow = async (/** @type {number} */ wait, /** @type {number} */ quiet) => {
    await sleep(wait);
    const before = state();
    /** @type {Record<string, number>} */
    const layouts = {};
    let mutations = 0, outcomeWrites = 0;
    const take = (/** @type {MutationRecord[]} */ records) => {
      for (const record of records) {
        mutations++;
        const target = record.target.nodeType === 1 ? /** @type {Element} */ (record.target) : record.target.parentElement;
        const layout = target?.closest('[data-layout]')?.getAttribute('data-layout') || '-';
        layouts[layout] = (layouts[layout] || 0) + 1;
        if (record.type === 'attributes' && ['data-ts-outcome', 'data-ts-stale'].includes(record.attributeName || '')) outcomeWrites++;
      }
    };
    const observer = new MutationObserver(take);
    observer.observe(document.documentElement, { subtree: true, childList: true, characterData: true, attributes: true });
    await sleep(quiet);
    take(observer.takeRecords());
    observer.disconnect();
    const after = state();
    const hosts = Array.from(document.querySelectorAll('[data-settle]'));
    const changed = after.map((value, i) => value !== before[i] ? { layout: hosts[i]?.closest('[data-layout]')?.getAttribute('data-layout'), before: before[i], after: value } : null).filter(Boolean);
    /** @type {Record<string, number>} */
    const outcomes = {};
    for (const value of after) outcomes[value] = (outcomes[value] || 0) + 1;
    // For a failure: what the blocks of each busy layout do, frame by frame.
    /** @type {Record<string, string[]>} */
    const timeline = {};
    const busy = Object.keys(layouts).filter(layout => layout !== '-').slice(0, 3);
    if (busy.length) {
      const started = performance.now();
      for (let i = 0; i < 40; i++) {
        for (const layout of busy) {
          const line = Array.from(document.querySelectorAll(`[data-layout="${layout}"] [data-settle]`), host => {
            const box = host.getBoundingClientRect();
            return `${box.width.toFixed(1)}px ${host.getAttribute('data-ts-outcome') || '-'}${host.hasAttribute('data-ts-stale') ? '+stale' : ''} ${host.querySelectorAll('br[data-ts-break]').length}br top ${Math.round(box.top)}`;
          }).join(' | ');
          const list = timeline[layout] ??= [];
          if (!list.length || !list[list.length - 1].endsWith(line)) list.push(`${Math.round(performance.now() - started)}ms ${line}`);
        }
        await new Promise(resolve => requestAnimationFrame(resolve));
      }
    }
    return { mutations, outcomeWrites, layouts, changed, outcomes, hosts: hosts.length, ...(busy.length ? { timeline } : {}) };
  };
  /** Bring every block near once (mount() composes offscreen text when it comes within a viewport), then return to the top. */
  w.__scrollThrough = async () => {
    const frame = () => new Promise(resolve => requestAnimationFrame(() => resolve(undefined)));
    for (let y = 0; y < document.documentElement.scrollHeight; y += Math.round(innerHeight * .8)) { scrollTo(0, y); await frame(); await frame(); await sleep(30); }
    for (const scroller of document.querySelectorAll('.scroll-outer, .scroll-inner')) { scroller.scrollTop = scroller.scrollHeight; await frame(); await sleep(30); scroller.scrollTop = 0; }
    scrollTo(0, 0);
    await frame();
  };
};

const app = (await build({ entryPoints: ['tests/settle/app.tsx'], bundle: true, write: false, format: 'iife', target: 'es2022', jsx: 'automatic', define: { 'process.env.NODE_ENV': '"production"' }, plugins: [reactUnderTest()], logLevel: 'error' })).outputFiles[0].text;
const files = { '/app.js': app, '/typeset.global.js': await readFile(artifacts.bundle, 'utf8'), '/go.js': await readFile(artifacts.siteGo, 'utf8') };

const report = { ...await releaseIdentity(), widths: RESIZES, layouts: LAYOUTS.map(l => l.id), browsers: /** @type {Record<string, string>} */ ({}), checks: /** @type {{ browser: string, label: string, pass: boolean, detail?: unknown }[]} */ ([]), errors: /** @type {{ browser: string, error: string }[]} */ ([]) };
const selected = browsers.filter(b => !values.only || values.only.split(',').includes(b.name));

await Promise.all(selected.map(async config => {
  const browser = await config.engine.launch({ executablePath: config.executablePath, timeout: 20000 });
  report.browsers[config.name] = browser.version();
  /** @param {string} label @param {unknown} pass @param {unknown} [detail] */
  const check = (label, pass, detail) => {
    report.checks.push({ browser: config.name, label, pass: !!pass, ...(pass ? {} : { detail }) });
    if (values.verbose) process.stderr.write(`${config.name} ${label}: ${pass ? 'ok' : 'FAIL ' + JSON.stringify(detail).slice(0, 600)}\n`);
  };
  try {
    for (const adapter of ADAPTERS) {
      const name = { mount: 'mount()', go: 'go.js', text: 'TypesetText', rich: 'TypesetRichText' }[adapter];
      for (const [width, resized] of RESIZES) {
        const page = await browser.newPage({ viewport: { width, height: HEIGHT } });
        page.setDefaultTimeout(30000);
        /** @type {string[]} */
        const pageErrors = [];
        page.on('pageerror', error => pageErrors.push(error.message));
        await page.addInitScript(INSTRUMENT);
        const html = pageHTML(adapter);
        await page.route('http://settle.test/**', route => {
          const path = new URL(route.request().url()).pathname;
          const body = /** @type {Record<string, string>} */ (files)[path];
          return body ? route.fulfill({ contentType: 'text/javascript', body }) : route.fulfill({ contentType: 'text/html; charset=utf-8', body: html });
        });
        await page.goto(`http://settle.test/?adapter=${adapter}`);
        await page.waitForFunction(() => /** @type {any} */ (window).settleReady);
        await page.evaluate(async () => {
          const w = /** @type {any} */ (window);
          await document.fonts.ready;
          await (w.settleController?.ready ?? w.TypesetReady);
          await w.__scrollThrough();
        });
        const loaded = await page.evaluate(({ wait, quiet }) => /** @type {any} */ (window).__quietWindow(wait, quiet), { wait: WAIT_MS, quiet: QUIET_MS });
        check(`${name} at ${width}px: no DOM mutation or outcome change from 2 s to 5 s after the page is ready`, loaded.mutations === 0 && loaded.changed.length === 0, loaded);
        // A window resize in five steps, one every 40 ms, as a drag delivers it.
        await page.evaluate(() => { /** @type {any} */ (window).__settle.phase = 'resize'; });
        for (let step = 1; step <= 5; step++) {
          await page.setViewportSize({ width: Math.round(width + (resized - width) * step / 5), height: HEIGHT });
          await page.waitForTimeout(40);
        }
        await page.evaluate(async () => {
          const w = /** @type {any} */ (window);
          await new Promise(resolve => setTimeout(resolve, 300));
          w.__settle.phase = 'after-resize';
          await w.__scrollThrough();
        });
        const after = await page.evaluate(({ wait, quiet }) => /** @type {any} */ (window).__quietWindow(wait, quiet), { wait: WAIT_MS, quiet: QUIET_MS });
        check(`${name} at ${width}px resized to ${resized}px: no DOM mutation or outcome change from 2 s to 5 s after the resize`, after.mutations === 0 && after.changed.length === 0, after);
        const composed = Object.entries(after.outcomes).filter(([outcome]) => outcome.startsWith('composed')).reduce((sum, [, n]) => sum + /** @type {number} */ (n), 0);
        check(`${name} at ${width}px: at least a third of the blocks end composed, so the matrix exercises composition`, composed * 3 >= after.hosts, after.outcomes);
        const quotes = await page.evaluate(() => /** @type {any} */ (window).__settle);
        // A narrower window leaves composed lines too long: some frames must
        // show blocks stale, or the check saw no fallback state.
        check(`${name} at ${width}px: with smartQuotes="en" no processed block shows a straight quote in any sampled frame (load, stale while resizing, declined, waiting offscreen)`,
          quotes.frames > 60 && quotes.declinedFrames > 0 && (resized > width || quotes.staleFrames > 0) && quotes.straight.length === 0,
          { frames: quotes.frames, staleFrames: quotes.staleFrames, declinedFrames: quotes.declinedFrames, straight: quotes.straight.slice(0, 6), total: quotes.straight.length });
        check(`${name} at ${width}px: no page errors`, pageErrors.length === 0, pageErrors.slice(0, 3));
        await page.close();
      }
    }
  } catch (error) {
    report.errors.push({ browser: config.name, error: String(/** @type {Error} */ (error).stack || error) });
  } finally { await browser.close(); }
}));

const summary = { checks: report.checks.length, failed: report.checks.filter(c => !c.pass).length, errors: report.errors.length };
await mkdir('output', { recursive: true });
await writeFile('output/settle.json', JSON.stringify({ ...report, summary }, null, 2));
console.log(JSON.stringify({ ...summary, failures: report.checks.filter(c => !c.pass).slice(0, 40).map(c => `${c.browser} ${c.label}`), errors: report.errors.slice(0, 5) }, null, 2));
if (!report.checks.length || summary.failed || summary.errors) process.exitCode = 1;
