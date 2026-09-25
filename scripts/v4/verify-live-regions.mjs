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
// (with an aria-live=off island, which is not live), role=alert and <output>,
// plus a control paragraph outside, under mount(), the npm go.js, the website
// loader and both React adapters. A MutationObserver installed before any
// loader counts records inside the regions through composition, a resize, a
// web font load and an idle flush: there must be none, while the control
// paragraph composes. A region that turns live later is released; one that
// stops being live is composed.
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { build } from 'esbuild';
import { browsers } from './browsers.mjs';
import { artifacts } from './candidate.mjs';
import { fixtureFont } from './font-fixture.mjs';

const watchdog = setTimeout(() => { console.error('verify-live-regions: watchdog'); process.exit(3); }, 170_000);
watchdog.unref();

const TEXT = 'Your appointment is confirmed for Tuesday morning at the county clinic, and a reminder with directions will arrive by text message the day before your visit.';
const scripts = {
  '/typeset.js': await readFile(artifacts.bundle, 'utf8'),
  '/go.js': await readFile(artifacts.go, 'utf8'),
  '/site-go.js': await readFile(artifacts.siteGo, 'utf8'),
  '/react.js': (await build({ stdin: { contents: `
import { createElement as h } from 'react';
import { createRoot } from 'react-dom/client';
import { TypesetText, TypesetRichText } from ${JSON.stringify(resolve(artifacts.react))};
const text = ${JSON.stringify(TEXT)};
createRoot(document.getElementById('react')).render(h('main', null,
  h('div', { role: 'status', 'data-region': '' }, h(TypesetText, { id: 'rt', lang: 'en', smartQuotes: 'en', text })),
  h('div', { 'aria-live': 'polite', 'data-region': '' }, h(TypesetRichText, { id: 'rr', lang: 'en' }, h('span', null, 'Your appointment is ', h('strong', null, 'confirmed'), ' for Tuesday morning at the county clinic, and a reminder with directions will arrive by text message the day before your visit.'))),
  h(TypesetRichText, { id: 'rc', lang: 'en' }, h('span', null, text))));
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
<p id="control" data-typeset>${TEXT}</p>
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
          out.react = { rt: outcome('rt'), rr: outcome('rr'), rc: outcome('rc') };
          return out;
        });
        const where = loader === 'react' ? 'React adapters' : loader === 'go' ? 'the npm go.js' : loader === 'website' ? 'the website loader' : 'mount()';
        const records = /** @type {string[]} */ (facts.records);
        if (loader === 'react') {
          const textRecords = records.filter(r => !r.startsWith('attributes'));
          check(`${where}: no text or node mutation inside live regions across mount, resize, font load and idle`, textRecords.length === 0, textRecords.slice(0, 5));
          check(`${where}: TypesetRichText reports native:live-region and still composes outside`, /** @type {any} */ (facts.react).rr === 'native:live-region' && /** @type {any} */ (facts.react).rc === 'composed:rich', facts.react);
          check(`${where}: TypesetText in a live region is left alone`, !/** @type {any} */ (facts.react).rt && !facts.breaksInRegions, facts.react);
          const rt = await page.evaluate(() => /** @type {any} */ (window).Typeset.typeset(document.getElementById('rt')).outcome);
          check(`${where}: typeset() reports native:live-region`, rt === 'native:live-region', rt);
        } else {
          check(`${where}: no mutation inside live regions across mount, resize, font load and idle`, records.length === 0 && first === 0, records.slice(0, 5));
          check(`${where}: live-region paragraphs report native:live-region and the control composes`, /** @type {any} */ (facts.audit)['native:live-region'] === 5 && facts.control === 'composed:rich' && facts.off === 'composed:rich', { audit: facts.audit, control: facts.control, off: facts.off });
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
          }
        }
      } catch (error) {
        errors.push({ browser: config.name, error: `${loader}: ${String(/** @type {Error} */ (error).stack || error).split('\n').slice(0, 3).join(' ')}` });
      } finally { await context.close(); }
    }
  } finally { await browser.close(); }
}));

const failures = checks.filter(c => !c.pass);
await writeFile('output/live-regions.json', JSON.stringify({ bundle: artifacts.bundle, checks, errors }, null, 2));
console.log(JSON.stringify({ checks: checks.length, failed: failures.length, failures, errors }, null, 2));
if (failures.length || errors.length) process.exitCode = 1;
