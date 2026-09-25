// @ts-check
// Live regions are never composed (C4).
//
// Assistive technology announces changes inside aria-live regions and the
// status, alert, log, marquee and timer roles (and <output>). 4.2 composed
// paragraphs there and rewrote them on every resize, font load and idle
// pass: 51 mutation records on mount and 180 more across two resizes for one
// status paragraph, and Chrome fired AXLiveRegionChanged for changes that
// altered no words, so screen readers repeated status messages.
//
// Each engine loads a page with prose inside role=status, aria-live=polite
// (with an aria-live=off island, which is not live), role=alert, <output>, an
// empty aria-live under role=status (as if absent: still live) and an unknown
// aria-live value (live in Chromium), paragraphs that contain an inline
// aria-live or role=status span (a result count, a "saved" status), plus a
// control paragraph outside, under mount(), the npm go.js, the website loader
// and both React adapters. A MutationObserver installed before any loader
// counts records inside the regions through composition, a resize, a web
// font load, an idle flush and an app update: there must be none but the
// app's own, while the control paragraph composes. A region that turns live
// later is released; one that stops being live is composed; a composed
// paragraph moved into a live toast is released with the move itself.
// TypesetText in a region keeps the quotes it curled while rendering.
// Regions in shadow DOM count too: text slotted into a component's live
// wrapper (a toast, an alert), a component with a live slot inside a
// paragraph, and text in a shadow root under a live light-DOM region.
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { build } from 'esbuild';
import { browsers } from './browsers.mjs';
import { artifacts } from './candidate.mjs';
import { fixtureFont } from './font-fixture.mjs';

const watchdog = setTimeout(() => { console.error('verify-live-regions: watchdog'); process.exit(3); }, 170_000);
watchdog.unref();

const TEXT = 'It\'s confirmed: your appointment is on Tuesday morning at the county clinic, and a "reminder" with directions will arrive by text message the day before your visit.';
const UPDATE = 'It\'s moved: your appointment is on Thursday morning at the county clinic, and a "reminder" with directions will arrive by text message the day before your visit.';
const COUNT = 'for clinics near you that offer walk-in appointments on weekday evenings and weekends, with interpreters for every visit.';
const scripts = {
  '/typeset.js': await readFile(artifacts.bundle, 'utf8'),
  '/go.js': await readFile(artifacts.go, 'utf8'),
  '/site-go.js': await readFile(artifacts.siteGo, 'utf8'),
  '/react.js': (await build({ stdin: { contents: `
import { createElement as h } from 'react';
import { createRoot } from 'react-dom/client';
import { flushSync } from 'react-dom';
import { TypesetText, TypesetRichText } from ${JSON.stringify(resolve(artifacts.react))};
const text = ${JSON.stringify(TEXT)};
const root = createRoot(document.getElementById('react'));
const tree = (value, count) => h('main', null,
  h('div', { role: 'status', 'data-region': '' }, h(TypesetText, { id: 'rt', lang: 'en', smartQuotes: 'en', text: value })),
  h('div', { 'aria-live': 'polite', 'data-region': '' }, h(TypesetRichText, { id: 'rr', lang: 'en' }, h('span', null, 'Your appointment is ', h('strong', null, 'confirmed'), ' for Tuesday morning at the county clinic, and a reminder with directions will arrive by text message the day before your visit.'))),
  h(TypesetRichText, { id: 'ri', lang: 'en' }, 'Showing ', h('span', { 'aria-live': 'polite', 'data-region': '' }, count), ' ' + ${JSON.stringify(COUNT)}),
  h(TypesetRichText, { id: 'rc', lang: 'en' }, h('span', null, text)));
root.render(tree(text, '12 of 48 results'));
window.update = (value, count) => flushSync(() => root.render(tree(value, count)));
`, resolveDir: process.cwd(), loader: 'js' }, bundle: true, write: false, format: 'iife', target: 'es2022', define: { 'process.env.NODE_ENV': '"production"' }, logLevel: 'silent' })).outputFiles[0].text,
  // Installed before any loader, so it sees every write.
  '/watch.js': `window.records = []; window.watcher = new MutationObserver(list => { for (const r of list) { const el = r.target.nodeType === 1 ? r.target : r.target.parentElement; if (el && el.closest('[data-region]')) window.records.push(r.type + (r.attributeName ? ':' + r.attributeName : '')); } }); window.watcher.observe(document, { subtree: true, childList: true, characterData: true, attributes: true });`,
  // The parser's own insertions are not the engine's: start counting here.
  '/reset.js': `window.watcher.takeRecords(); window.records = [];`,
};
const FONT = `@font-face{font-family:Late;src:url(/late.woff2) format('woff2');font-weight:100 900}`;
const PAGE = (/** @type {string} */ loader) => `<!doctype html><html lang="en"><head><meta charset="utf-8"><script src="/watch.js"></script>
<style>body{margin:16px;background:#fff;font:18px/1.5 Georgia}main,#react{width:300px}p{margin:0 0 14px}.late{font-family:Late,Georgia}</style>
${loader === 'go' ? '<script src="/reset.js" defer></script><script src="/go.js" defer></script>' : loader === 'website' ? '<script src="/reset.js" defer></script><script src="/site-go.js" defer></script>' : loader === 'react' ? '' : '<script src="/typeset.js"></script>'}</head><body><main>
<div role="status" data-region><p id="s1" data-typeset>${TEXT}</p></div>
<div aria-live="polite" data-region><p id="s2" data-typeset>${TEXT}</p></div>
<div role="alert" data-region><p id="s3" data-typeset>${TEXT}</p></div>
<output data-region><p id="s4" data-typeset>${TEXT}</p></output>
<div aria-live="polite"><div aria-live="off"><p id="off" data-typeset>${TEXT}</p></div></div>
<div role="status" data-region><div aria-live=""><p id="s5" data-typeset>${TEXT}</p></div></div>
<div aria-live="false" data-region><p id="s6" data-typeset>${TEXT}</p></div>
<p id="i1" data-typeset>Showing <span aria-live="polite" data-region>12 of 48 results</span> ${COUNT}</p>
<p id="i2" data-typeset>Your changes to the appointment form were <span role="status" data-region>saved</span> a moment ago, and a confirmation with directions will arrive by text message.</p>
<p id="control" data-typeset>${TEXT}</p>
<div id="toast" aria-live="polite"></div><p id="mover" data-typeset>${TEXT}</p>
<div id="later"><p id="l1" data-typeset>${TEXT}</p></div>
<div id="stops" aria-live="assertive"><p id="l2" data-typeset>${TEXT}</p></div>
</main><div id="react"></div>${loader === 'react' ? '<script src="/typeset.js"></script><script src="/reset.js"></script><script src="/react.js"></script>' : ''}</body></html>`;

/** @type {{ browser: string, label: string, pass: boolean, detail?: unknown }[]} */
const checks = [];
/** @type {{ browser: string, error: string }[]} */
const errors = [];
await Promise.all(browsers.map(async config => {
  const browser = await config.engine.launch({ executablePath: config.executablePath, timeout: 20000 });
  /** @param {string} label @param {unknown} pass @param {unknown} [detail] */
  const check = (label, pass, detail) => checks.push({ browser: config.name, label, pass: !!pass, ...(detail === undefined ? {} : { detail }) });
  try {
    for (const loader of ['mount', 'go', 'website', 'react']) {
      const context = await browser.newContext({ viewport: { width: 420, height: 1400 } });
      await context.route('http://live.test/**', route => {
        const path = new URL(route.request().url()).pathname;
        if (path === '/late.woff2') return route.fulfill({ contentType: 'font/woff2', body: fixtureFont });
        if (path in scripts) return route.fulfill({ contentType: 'text/javascript', body: /** @type {Record<string, string>} */ (scripts)[path] });
        return route.fulfill({ contentType: 'text/html; charset=utf-8', body: PAGE(loader) });
      });
      const page = await context.newPage();
      page.setDefaultTimeout(20000);
      page.on('pageerror', error => errors.push({ browser: config.name, error: `${loader}: ${error.message}` }));
      try {
        await page.goto('http://live.test/page');
        if (loader === 'mount') await page.evaluate(async () => { const w = /** @type {any} */ (window); w.watcher.takeRecords(); w.records = []; const c = w.controller = w.Typeset.mount(document, 'main p'); await c.ready; });
        else if (loader === 'react') await page.waitForFunction(() => ['rt', 'rr', 'rc'].every(id => document.getElementById(id)) && document.getElementById('rc')?.dataset.tsOutcome);
        else await page.evaluate(async () => { /** @type {any} */ (window).controller = await /** @type {any} */ (window).TypesetReady; });
        const idle = () => page.evaluate(() => new Promise(resolve => setTimeout(() => requestAnimationFrame(() => resolve(undefined)), 450)));
        await idle();
        const first = await page.evaluate(() => /** @type {any} */ (window).records.length);
        // A resize, a web font applied after ready, an idle flush.
        await page.setViewportSize({ width: 380, height: 1400 });
        await idle();
        await page.evaluate(async css => { const style = document.createElement('style'); style.textContent = css + ' body{--late:1} p{font-family:Late,Georgia}'; document.head.append(style); await document.fonts.load('18px Late'); await document.fonts.ready; }, FONT);
        await idle(); await idle();
        const facts = await page.evaluate(() => {
          const T = /** @type {any} */ (window).Typeset, out = /** @type {Record<string, unknown>} */ ({});
          const outcome = (/** @type {string} */ id) => /** @type {HTMLElement | null} */ (document.getElementById(id))?.dataset.tsOutcome ?? null;
          out.records = /** @type {any} */ (window).records;
          out.breaksInRegions = document.querySelectorAll('[data-region] [data-ts-break]').length;
          out.control = outcome('control');
          out.off = outcome('off');
          out.audit = T.auditJSON('main p').outcomes;
          out.react = { rt: outcome('rt'), rr: outcome('rr'), ri: outcome('ri'), rc: outcome('rc') };
          out.rtText = document.getElementById('rt')?.textContent ?? null;
          return out;
        });
        const where = loader === 'react' ? 'React adapters' : loader === 'go' ? 'the npm go.js' : loader === 'website' ? 'the website loader' : 'mount()';
        const records = /** @type {string[]} */ (facts.records);
        if (loader === 'react') {
          const textRecords = records.filter(r => !r.startsWith('attributes'));
          check(`${where}: no text or node mutation inside live regions across mount, resize, font load and idle`, textRecords.length === 0, textRecords.slice(0, 5));
          check(`${where}: TypesetRichText reports native:live-region inside a region and around one, and still composes outside`, /** @type {any} */ (facts.react).rr === 'native:live-region' && /** @type {any} */ (facts.react).ri === 'native:live-region' && /** @type {any} */ (facts.react).rc === 'composed:rich', facts.react);
          check(`${where}: TypesetText in a live region is left alone, with the quotes it curled`, !/** @type {any} */ (facts.react).rt && !facts.breaksInRegions && typeof facts.rtText === 'string' && !/["']/.test(facts.rtText) && facts.rtText.length === TEXT.length, { .../** @type {object} */ (facts.react), rtText: facts.rtText });
          const rt = await page.evaluate(() => /** @type {any} */ (window).Typeset.typeset(document.getElementById('rt')).outcome);
          check(`${where}: typeset() reports native:live-region`, rt === 'native:live-region', rt);
          // An app update: new TypesetText text, a new count in the inline region.
          const updated = await page.evaluate(async ({ value }) => {
            const w = /** @type {any} */ (window);
            w.watcher.takeRecords(); w.records = [];
            w.update(value, '13 of 48 results');
            await new Promise(resolve => setTimeout(() => requestAnimationFrame(() => resolve(undefined)), 450));
            w.records.push(...w.watcher.takeRecords().map((/** @type {MutationRecord} */ r) => r.type));
            const records = /** @type {string[]} */ (w.records).filter(r => !r.startsWith('attributes'));
            return { records, rt: document.getElementById('rt')?.textContent, ri: /** @type {HTMLElement} */ (document.getElementById('ri')).dataset.tsOutcome, riMarkers: document.querySelectorAll('#ri [data-ts-break]').length };
          }, { value: UPDATE });
          check(`${where}: an app update writes the regions once each, curled, and nothing else`, updated.records.length <= 2 && typeof updated.rt === 'string' && !/["']/.test(updated.rt) && updated.rt.length === UPDATE.length && updated.ri === 'native:live-region' && updated.riMarkers === 0, updated);
        } else {
          check(`${where}: no mutation inside live regions across mount, resize, font load and idle`, records.length === 0 && first === 0, records.slice(0, 5));
          check(`${where}: live-region paragraphs report native:live-region and the control composes`, /** @type {any} */ (facts.audit)['native:live-region'] === 9 && facts.control === 'composed:rich' && facts.off === 'composed:rich', { audit: facts.audit, control: facts.control, off: facts.off });
          // An app update inside the inline regions: only the app's records.
          const app = await page.evaluate(async () => {
            const w = /** @type {any} */ (window);
            w.watcher.takeRecords(); w.records = [];
            /** @type {HTMLElement} */ (document.querySelector('#i1 span')).textContent = '13 of 48 results';
            /** @type {HTMLElement} */ (document.querySelector('#i2 span')).textContent = 'saved again';
            await new Promise(resolve => setTimeout(() => requestAnimationFrame(() => resolve(undefined)), 450));
            w.records.push(...w.watcher.takeRecords().map((/** @type {MutationRecord} */ r) => r.type));
            return { records: w.records, i1: /** @type {HTMLElement} */ (document.getElementById('i1')).querySelectorAll('[data-ts-break]').length };
          });
          check(`${where}: an app update of an inline region is its only mutation`, app.records.length === 2 && app.i1 === 0, app);
          if (loader === 'mount') {
            const turned = await page.evaluate(async () => {
              const wait = () => new Promise(resolve => setTimeout(resolve, 450));
              const l1 = /** @type {HTMLElement} */ (document.getElementById('l1')), l2 = /** @type {HTMLElement} */ (document.getElementById('l2'));
              const composedBefore = l1.dataset.tsOutcome;
              /** @type {HTMLElement} */ (document.getElementById('later')).setAttribute('aria-live', 'polite');
              /** @type {HTMLElement} */ (document.getElementById('stops')).removeAttribute('aria-live');
              await wait();
              return { composedBefore, released: !l1.dataset.tsOutcome && !l1.querySelector('[data-ts-break]'), composed: l2.dataset.tsOutcome, direct: /** @type {any} */ (window).Typeset.typeset(l1).outcome };
            });
            check(`${where}: a region that turns live is released; one that stops is composed`, turned.composedBefore === 'composed:rich' && turned.released && turned.composed === 'composed:rich' && turned.direct === 'native:live-region', turned);
            const moved = await page.evaluate(async () => {
              const p = /** @type {HTMLElement} */ (document.getElementById('mover')), toast = /** @type {HTMLElement} */ (document.getElementById('toast'));
              const before = { outcome: p.dataset.tsOutcome, breaks: p.querySelectorAll('[data-ts-break]').length };
              toast.append(p);
              // The engine's mutation callback runs in this checkpoint, before the next task and frame.
              await Promise.resolve();
              const released = !p.dataset.tsOutcome && !p.querySelector('[data-ts-break]');
              const later = new MutationObserver(() => {});
              later.observe(toast, { subtree: true, childList: true, characterData: true, attributes: true });
              /** @type {HTMLElement} */ (document.querySelector('main')).style.width = '280px';
              await new Promise(resolve => setTimeout(resolve, 450));
              return { before, released, later: later.takeRecords().length };
            });
            check(`${where}: a composed paragraph moved into a live toast is released with the move, and not touched again`, moved.before.outcome === 'composed:rich' && moved.before.breaks > 0 && moved.released && moved.later === 0, moved);
          }
        }
      } catch (error) {
        errors.push({ browser: config.name, error: `${loader}: ${String(/** @type {Error} */ (error).stack || error).split('\n').slice(0, 3).join(' ')}` });
      } finally { await context.close(); }
    }
    // Live regions in open shadow roots, under mount().
    {
      const context = await browser.newContext({ viewport: { width: 420, height: 1400 } });
      const SHADOW = `<!doctype html><html lang="en"><head><meta charset="utf-8"><style>body{margin:16px;font:18px/1.5 Georgia}main{width:300px}p{margin:0 0 14px}</style>
<script>
const define = (name, html) => customElements.define(name, class extends HTMLElement { constructor() { super(); this.attachShadow({ mode: 'open' }).innerHTML = html; } });
define('x-toast', '<div role="status" aria-live="polite"><slot></slot></div>');
define('x-alert', '<div role="alert"><slot></slot></div>');
define('x-count', '<span role="status"><slot></slot></span>');
define('x-plain', '<div><slot></slot></div>');
define('x-card', '<p id="inner">${TEXT.replace(/"/g, '&quot;').replace(/'/g, '&#39;')}</p>');
</script><script src="/typeset.js"></script></head><body><main>
<x-toast><p id="sh1">${TEXT}</p></x-toast>
<x-alert><p id="sh2">${TEXT}</p></x-alert>
<p id="sh4">Showing <x-count>12 of 48 results</x-count> ${COUNT}</p>
<div aria-live="polite"><x-card id="card"></x-card></div>
<x-plain><p id="sh5">${TEXT}</p></x-plain>
</main></body></html>`;
      await context.route('http://live.test/**', route => {
        const path = new URL(route.request().url()).pathname;
        if (path in scripts) return route.fulfill({ contentType: 'text/javascript', body: /** @type {Record<string, string>} */ (scripts)[path] });
        return route.fulfill({ contentType: 'text/html; charset=utf-8', body: SHADOW });
      });
      const page = await context.newPage();
      page.setDefaultTimeout(20000);
      page.on('pageerror', error => errors.push({ browser: config.name, error: `shadow: ${error.message}` }));
      try {
        await page.goto('http://live.test/shadow');
        const facts = await page.evaluate(async () => {
          const w = /** @type {any} */ (window);
          const live = ['sh1', 'sh2', 'sh4'].map(id => /** @type {HTMLElement} */ (document.getElementById(id)));
          const records = /** @type {string[]} */ ([]);
          const watcher = new MutationObserver(list => { for (const r of list) { const el = r.target.nodeType === 1 ? /** @type {Element} */ (r.target) : r.target.parentElement; if (el && live.some(p => p.contains(el))) records.push(r.type); } });
          watcher.observe(document, { subtree: true, childList: true, characterData: true, attributes: true });
          const controller = w.Typeset.mount(document, 'main p');
          await controller.ready;
          await new Promise(resolve => setTimeout(resolve, 300));
          /** @type {HTMLElement} */ (document.querySelector('main')).style.width = '260px';
          await new Promise(resolve => setTimeout(() => requestAnimationFrame(() => resolve(undefined)), 450));
          records.push(...watcher.takeRecords().map(r => r.type));
          const inner = /** @type {HTMLElement} */ (/** @type {ShadowRoot} */ (/** @type {HTMLElement} */ (document.getElementById('card')).shadowRoot).getElementById('inner'));
          return {
            records,
            outcomes: Object.fromEntries(['sh1', 'sh2', 'sh4', 'sh5'].map(id => [id, /** @type {HTMLElement} */ (document.getElementById(id)).dataset.tsOutcome ?? null])),
            breaks: live.reduce((n, p) => n + p.querySelectorAll('[data-ts-break]').length, 0),
            audit: w.Typeset.auditJSON('main p').outcomes,
            inner: w.Typeset.typeset(inner).outcome,
          };
        });
        check('shadow DOM: text slotted into a live toast or alert, and a paragraph with a live slotted count, are never composed or written', facts.records.length === 0 && facts.breaks === 0 && !facts.outcomes.sh1 && !facts.outcomes.sh2 && !facts.outcomes.sh4 && facts.audit['native:live-region'] === 3, facts);
        check('shadow DOM: text in a shadow root under a live light-DOM region reports native:live-region', facts.inner === 'native:live-region', facts.inner);
        check('shadow DOM: text slotted into a component that is not live composes', facts.outcomes.sh5 === 'composed:rich', facts.outcomes);
      } catch (error) {
        errors.push({ browser: config.name, error: `shadow: ${String(/** @type {Error} */ (error).stack || error).split('\n').slice(0, 3).join(' ')}` });
      } finally { await context.close(); }
    }
  } finally { await browser.close(); }
}));

const failures = checks.filter(c => !c.pass);
await writeFile('output/live-regions.json', JSON.stringify({ bundle: artifacts.bundle, checks, errors }, null, 2));
console.log(JSON.stringify({ checks: checks.length, failed: failures.length, failures, errors }, null, 2));
if (failures.length || errors.length) process.exitCode = 1;
