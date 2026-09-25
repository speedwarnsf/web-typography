// @ts-check
// C7: composed text must follow text metrics, not only width. Each trigger
// below changes glyph advances without resizing the column; afterwards every
// composed block must render exactly its composed lines (lines = breaks + 1)
// once two frames and an idle period have passed and the controller's batches
// (8 ms each) have run, and auditJSON must report no stale-layout. The audit
// itself is checked against a known stale layout. The React adapters meet the
// triggers that change no DOM and fire no event too. Ancestor transforms do
// not move lines: a composition survives a drawer scaling the page behind it,
// and text declined while a transform animates (a dialog's @starting-style
// entry, a card inserted with element.animate()) composes once it ends.
import { build } from 'esbuild';
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { browsers } from './browsers.mjs';
import { artifacts } from './candidate.mjs';
import { fixtureFont } from './font-fixture.mjs';

const script = await readFile(artifacts.bundle, 'utf8');
const corpus = JSON.parse(await readFile('tests/v4-corpus.json', 'utf8')).paragraphs;
const escape = (/** @type {string} */ text) => text.replace(/&/g, '&amp;').replace(/</g, '&lt;');
const texts = corpus.slice(3, 9).map(escape);
const body = (/** @type {string} */ cls = '') => `<main class="col ${cls}">${texts.map((t, i) => i === 2 ? `<p class="t">${t.split(' ').slice(0, 6).join(' ')} <a href="#x">${t.split(' ').slice(6, 9).join(' ')}</a> <em>${t.split(' ').slice(9, 11).join(' ')}</em> ${t.split(' ').slice(11).join(' ')}</p>` : `<p class="t">${t}</p>`).join('')}</main>`;
const css = `body{margin:0}.col{width:380px;padding:8px;font-family:Georgia,serif;line-height:1.45}
.col.fixture{font-family:TypesetFixture,Georgia,serif;font-weight:350;transition:font-weight .3s,letter-spacing .3s}
.col.fixture.heavy{font-weight:720;letter-spacing:.03em}
@font-face{font-family:LateSwap;src:url(/late.woff2) format('woff2');font-display:swap}
.col.late{font-family:LateSwap,Georgia,serif}`;
const pageHTML = (/** @type {string} */ cls = '', /** @type {string} */ extra = '') => `<!doctype html><html lang="en"><head><meta charset="utf-8"><style>${css}</style>${extra}</head><body>${body(cls)}</body></html>`;

const reactFixture = (await build({
  stdin: { contents: `
import { createElement as h } from 'react';
import { createRoot } from 'react-dom/client';
import { TypesetText, TypesetRichText } from ${JSON.stringify(resolve(artifacts.react))};
const texts = ${JSON.stringify(corpus.slice(3, 7))};
createRoot(document.getElementById('app')).render(h('main', { className: document.body.dataset.col || 'col late' },
  texts.map((text, i) => i % 2 ? h(TypesetText, { key: i, text, className: 'r' })
    : h(TypesetRichText, { key: i, className: 'r' }, text.split(' ').slice(0, 5).join(' ') + ' ', h('a', { href: '#x' }, text.split(' ').slice(5, 8).join(' ')), ' ' + text.split(' ').slice(8).join(' ')))));
`, resolveDir: process.cwd(), loader: 'js' },
  bundle: true, minify: true, write: false, format: 'iife', target: 'es2022', define: { 'process.env.NODE_ENV': '"production"' }, logLevel: 'silent',
})).outputFiles[0].text;

/** @type {{ checks: { browser: string, label: string, pass: boolean, detail?: unknown }[], errors: { browser: string, error: string }[] }} */
const report = { checks: [], errors: [] };
// Milliseconds after settle() until every composed block is intact again: the
// remaining batches of a multi-paragraph recomposition, not a missed trigger.
const within = (/** @type {number | null} */ ms) => ms !== null && ms <= 400;

// In-page helpers: rendered-line checks and the timing contract.
const helpers = () => {
  const w = /** @type {any} */ (window);
  w.blocks = (/** @type {string} */ selector) => /** @type {HTMLElement[]} */ ([...document.querySelectorAll(selector)]);
  w.stale = (/** @type {string} */ selector) => w.blocks(selector).filter((/** @type {HTMLElement} */ el) => {
    if (el.dataset.tsOutcome !== 'composed:rich') return false;
    return w.Typeset.measureLayout(el).lines.length !== el.querySelectorAll('br[data-ts-break]').length + 1;
  }).map((/** @type {HTMLElement} */ el) => ({ lines: w.Typeset.measureLayout(el).lines.length, breaks: el.querySelectorAll('br[data-ts-break]').length }));
  w.frame = () => new Promise(resolve => requestAnimationFrame(() => resolve(undefined)));
  // Two frames, then an idle flush (capped): the controller's scheduling
  // contract for work nobody is waiting on.
  w.settle = async () => {
    await w.frame(); await w.frame();
    await new Promise(resolve => typeof requestIdleCallback === 'function' ? requestIdleCallback(resolve, { timeout: 250 }) : setTimeout(resolve, 50));
    await w.frame();
  };
  // After settle(): poll until nothing is stale; report how long that took.
  w.until = async (/** @type {string} */ selector, limit = 1500) => {
    const t0 = performance.now();
    while (performance.now() - t0 < limit) {
      if (!w.stale(selector).length && w.blocks(selector).some((/** @type {HTMLElement} */ el) => el.dataset.tsOutcome === 'composed:rich')) return Math.round(performance.now() - t0);
      await w.frame();
    }
    return null;
  };
  w.staleAudit = (/** @type {string} */ selector) => w.Typeset.auditJSON(selector).issues.filter((/** @type {any} */ issue) => issue.type === 'stale-layout').length;
};

for (const { name, engine, executablePath } of browsers) {
  const browser = await engine.launch({ executablePath, timeout: 20000 });
  /** @param {string} label @param {boolean} pass @param {unknown} [detail] */
  const check = (label, pass, detail) => report.checks.push({ browser: name, label, pass: !!pass, detail });
  /** @param {string} html @param {{ mount?: boolean, react?: boolean }} [options] */
  const open = async (html, { mount = true, react = false } = {}) => {
    const page = await browser.newPage({ viewport: { width: 900, height: 900 } });
    page.setDefaultTimeout(20000);
    await page.route('http://reflow.test/**', async route => {
      const path = new URL(route.request().url()).pathname;
      if (path === '/late.woff2') { await new Promise(r => setTimeout(r, 1200)); return route.fulfill({ contentType: 'font/woff2', body: fixtureFont }); }
      if (path === '/fixture.woff2') return route.fulfill({ contentType: 'font/woff2', body: fixtureFont });
      if (path === '/engine.js') return route.fulfill({ contentType: 'text/javascript', body: script });
      if (path === '/react.js') return route.fulfill({ contentType: 'text/javascript', body: reactFixture });
      return route.fulfill({ contentType: 'text/html; charset=utf-8', body: html });
    });
    await page.goto('http://reflow.test/index.html');
    if (!react) await page.addScriptTag({ url: '/engine.js' });
    await page.evaluate(helpers);
    if (mount) await page.evaluate(async () => { const w = /** @type {any} */ (window); w.controller = w.Typeset.mount(document, 'p.t'); await w.controller.ready; });
    return page;
  };
  try {
    // 1. The WCAG 1.4.12 text-spacing bookmarklet: a <style> with !important overrides.
    {
      const page = await open(pageHTML());
      const result = await page.evaluate(async () => {
        const w = /** @type {any} */ (window);
        const before = w.stale('p.t').length;
        const style = document.createElement('style');
        style.textContent = '*{line-height:1.5!important;letter-spacing:.12em!important;word-spacing:.16em!important}p{margin-bottom:2em!important}';
        document.head.append(style);
        await w.settle();
        const settled = w.stale('p.t');
        return { before, staleAfterSettle: settled.length, ms: await w.until('p.t'), audit: w.staleAudit('p.t') };
      });
      check('text-spacing overrides: composed lines within 2 frames and an idle flush', result.before === 0 && within(result.ms) && result.audit === 0, result);
      await page.close();
    }
    // 2. A rule changed through the CSSOM: no DOM mutation at all, as when a
    // browser font-size setting or text-only zoom changes computed sizes.
    {
      const page = await open(pageHTML());
      const result = await page.evaluate(async () => {
        const w = /** @type {any} */ (window);
        const sheet = /** @type {CSSStyleSheet} */ (document.styleSheets[0]);
        sheet.insertRule('.col p.t{font-size:18.5px}', sheet.cssRules.length);
        await w.settle();
        return { staleAfterSettle: w.stale('p.t').length, ms: await w.until('p.t'), audit: w.staleAudit('p.t') };
      });
      check('a CSSOM font-size change with no mutation: composed lines within 2 frames and an idle flush', within(result.ms) && result.audit === 0, result);
      await page.close();
    }
    // 3. Chromium's browser font-size setting (Page.setFontSizes).
    if (name === 'chromium') {
      const page = await open(pageHTML());
      const cdp = await page.context().newCDPSession(page);
      await page.evaluate(() => { for (const p of document.querySelectorAll('p.t')) /** @type {HTMLElement} */ (p).style.fontSize = 'medium'; });
      await page.evaluate(async () => { const w = /** @type {any} */ (window); await w.settle(); await w.until('p.t'); });
      await cdp.send('Page.setFontSizes', { fontSizes: { standard: 21 } });
      const result = await page.evaluate(async () => {
        const w = /** @type {any} */ (window);
        await w.settle();
        return { staleAfterSettle: w.stale('p.t').length, fontSize: getComputedStyle(document.querySelector('p.t')).fontSize, ms: await w.until('p.t'), audit: w.staleAudit('p.t') };
      });
      check('the browser font-size setting: composed lines within 2 frames and an idle flush', result.fontSize === '21px' && within(result.ms) && result.audit === 0, result);
      await page.close();
    }
    // 4. A class that transitions font-weight and letter-spacing.
    {
      const page = await open(pageHTML('fixture', '<link rel="preload" href="/fixture.woff2" as="font" crossorigin>'), { mount: false });
      await page.evaluate(async () => {
        const face = new FontFace('TypesetFixture', 'url(/fixture.woff2)', { weight: '100 900' });
        document.fonts.add(face); await face.load(); await document.fonts.ready;
        const w = /** @type {any} */ (window); w.controller = w.Typeset.mount(document, 'p.t'); await w.controller.ready;
      });
      const result = await page.evaluate(async () => {
        const w = /** @type {any} */ (window);
        const col = /** @type {HTMLElement} */ (document.querySelector('.col'));
        const ended = new Promise(resolve => col.addEventListener('transitionend', resolve, { once: true }));
        col.classList.add('heavy');
        await ended;
        await w.settle();
        return { staleAfterSettle: w.stale('p.t').length, ms: await w.until('p.t'), audit: w.staleAudit('p.t'), weight: getComputedStyle(document.querySelector('p.t')).fontWeight };
      });
      check('a font-weight and letter-spacing transition: composed lines within 2 frames and an idle flush of its end', within(result.ms) && result.audit === 0, result);
      await page.close();
    }
    // 5. A swap font a stylesheet requests after mount, delivered 1.2 s later
    // (WebKit fires no loading events for it).
    {
      const page = await open(pageHTML());
      const result = await page.evaluate(async () => {
        const w = /** @type {any} */ (window);
        const col = /** @type {HTMLElement} */ (document.querySelector('.col'));
        col.classList.add('late');
        const t0 = performance.now();
        while (![...document.fonts].some(face => face.family.replace(/["']/g, '') === 'LateSwap' && face.status === 'loaded')) {
          if (performance.now() - t0 > 8000) return { timeout: true };
          await new Promise(r => setTimeout(r, 10));
        }
        await w.settle();
        return { staleAfterSettle: w.stale('p.t').length, ms: await w.until('p.t'), audit: w.staleAudit('p.t') };
      });
      check('a late swap font requested by a stylesheet: composed lines within 2 frames and an idle flush of its load', !result.timeout && within(result.ms) && result.audit === 0, result);
      await page.close();
    }
    // 6. Both React adapters rendered before their swap font arrives.
    {
      const page = await open('<!doctype html><html lang="en"><head><meta charset="utf-8"><style>' + css + '</style></head><body><div id="app"></div><script src="/react.js"></script></body></html>', { mount: false, react: true });
      await page.waitForSelector('.r[data-ts-outcome]');
      const result = await page.evaluate(async () => {
        const w = /** @type {any} */ (window);
        const t0 = performance.now();
        const before = document.fonts.status;
        while (![...document.fonts].some(face => face.family.replace(/["']/g, '') === 'LateSwap' && face.status === 'loaded')) {
          if (performance.now() - t0 > 8000) return { timeout: true };
          await new Promise(r => setTimeout(r, 10));
        }
        return { before };
      });
      await page.addScriptTag({ url: '/engine.js' });
      const settled = await page.evaluate(async () => {
        const w = /** @type {any} */ (window);
        await w.settle();
        const outcomes = w.blocks('.r').map((/** @type {HTMLElement} */ el) => el.dataset.tsOutcome);
        return { outcomes, staleAfterSettle: w.stale('.r').length, ms: await w.until('.r'), audit: w.staleAudit('.r') };
      });
      check('TypesetText and TypesetRichText rendered before their font: composed lines within 2 frames and an idle flush of its load', !result.timeout && within(settled.ms) && settled.audit === 0 && settled.outcomes.some((/** @type {string} */ o) => o === 'composed:rich'), { ...result, ...settled });
      await page.close();
    }
    // 7. Both React adapters under triggers that change no DOM and fire no
    // event: a CSSOM rule with the text-spacing values, the browser font-size
    // setting (Chromium), and a FontFace loaded by script, then added to
    // document.fonts. Only a same-width height change of the host shows them.
    for (const trigger of ['insertRule', ...(name === 'chromium' ? ['setFontSizes'] : []), 'fontface']) {
      const page = await open('<!doctype html><html lang="en"><head><meta charset="utf-8"><style>' + css + '.col.face .r{font-family:ScriptFace,Georgia,serif}</style></head><body data-col="col"><div id="app"></div><script src="/react.js"></script></body></html>', { mount: false, react: true });
      await page.waitForSelector('.r[data-ts-outcome]');
      await page.addScriptTag({ url: '/engine.js' });
      const before = await page.evaluate(async trigger => {
        const w = /** @type {any} */ (window);
        await w.settle();
        const ms = await w.until('.r');
        if (trigger !== 'fontface') return { ms };
        // The family first, while its face is not in the set yet.
        w.face = new FontFace('ScriptFace', 'url(/fixture.woff2)', { weight: '100 900' });
        await w.face.load();
        /** @type {HTMLElement} */ (document.querySelector('main')).classList.add('face');
        await w.settle();
        return { ms, fallback: await w.until('.r') };
      }, trigger);
      const cdp = trigger === 'setFontSizes' ? await page.context().newCDPSession(page) : null;
      if (cdp) await cdp.send('Page.setFontSizes', { fontSizes: { standard: 21 } });
      const result = await page.evaluate(async trigger => {
        const w = /** @type {any} */ (window);
        const lines = () => w.blocks('.r').map((/** @type {HTMLElement} */ el) => w.Typeset.measureLayout(el).lines.length).join(',');
        const start = lines();
        if (trigger === 'insertRule') {
          const sheet = /** @type {CSSStyleSheet} */ (document.styleSheets[0]);
          sheet.insertRule('.col .r{letter-spacing:.12em!important;word-spacing:.16em!important}', sheet.cssRules.length);
        } else if (trigger === 'fontface') document.fonts.add(w.face);
        await w.settle();
        return { start, staleAfterSettle: w.stale('.r').length, ms: await w.until('.r'), audit: w.staleAudit('.r'), fontSize: getComputedStyle(/** @type {Element} */ (document.querySelector('.r'))).fontSize,
          outcomes: w.blocks('.r').map((/** @type {HTMLElement} */ el) => el.dataset.tsOutcome) };
      }, trigger);
      check(`React adapters, ${trigger === 'insertRule' ? 'a CSSOM text-spacing rule' : trigger === 'setFontSizes' ? 'the browser font-size setting' : 'a FontFace added by script'}: composed lines within 2 frames and an idle flush`,
        within(before.ms) && within(result.ms) && result.audit === 0 && result.outcomes.filter((/** @type {string} */ o) => o === 'composed:rich').length >= 2 && (trigger !== 'setFontSizes' || result.fontSize === '21px'), { before, ...result });
      await page.close();
    }
    // 7b. Font faces that finish one after another are one-off changes, not
    // a continuous metric change: two faces of a family no host uses, loaded
    // 60 ms apart, must not show any composed host native lines. (The first
    // round-2 candidate marked every visible host data-ts-stale for about
    // 110 ms and then recomposed the same lines.)
    {
      const page = await open('<!doctype html><html lang="en"><head><meta charset="utf-8"><style>' + css + '</style></head><body data-col="col"><div id="app"></div><script src="/react.js"></script></body></html>', { mount: false, react: true });
      await page.waitForSelector('.r[data-ts-outcome]');
      await page.addScriptTag({ url: '/engine.js' });
      const result = await page.evaluate(async () => {
        const w = /** @type {any} */ (window);
        await w.settle();
        const ready = await w.until('.r');
        /** @type {string[]} */
        const stale = [];
        new MutationObserver(records => { for (const record of records) if (/** @type {Element} */ (record.target).hasAttribute('data-ts-stale')) stale.push(/** @type {Element} */ (record.target).tagName); })
          .observe(/** @type {HTMLElement} */ (document.getElementById('app')), { subtree: true, attributes: true, attributeFilter: ['data-ts-stale'] });
        const first = new FontFace('UnusedOne', 'url(/fixture.woff2?one)'), second = new FontFace('UnusedTwo', 'url(/fixture.woff2?two)');
        document.fonts.add(first); document.fonts.add(second);
        const loads = [first.load().catch(() => null)];
        await new Promise(r => setTimeout(r, 60));
        loads.push(second.load().catch(() => null));
        await Promise.all(loads);
        await new Promise(r => setTimeout(r, 400));
        await w.settle();
        return { ready, stale, ms: await w.until('.r'), faces: [first.status, second.status], outcomes: w.blocks('.r').map((/** @type {HTMLElement} */ el) => el.dataset.tsOutcome) };
      });
      check('React adapters: two faces of an unused family finishing 60 ms apart show no host native lines', within(result.ready) && result.stale.length === 0 && within(result.ms)
        && result.faces.every((/** @type {string} */ s) => s === 'loaded') && result.outcomes.filter((/** @type {string} */ o) => o === 'composed:rich').length >= 2, result);
      await page.close();
    }
    // 8. The audit catches a stale layout: composed, released, then respaced.
    {
      const page = await open(pageHTML());
      const result = await page.evaluate(async () => {
        const w = /** @type {any} */ (window);
        w.controller.disconnect(false);
        const clean = w.staleAudit('p.t');
        /** @type {HTMLElement} */ (document.querySelector('.col')).style.letterSpacing = '.06em';
        await w.frame();
        return { clean, stale: w.staleAudit('p.t'), measuredStale: w.stale('p.t').length, pass: w.Typeset.auditJSON('p.t').pass };
      });
      check('auditJSON reports stale-layout for a composition whose metrics changed', result.clean === 0 && result.stale > 0 && result.stale === result.measuredStale && result.pass === false, result);
      await page.close();
    }
    // 9. Ancestor transforms: a background-scale drawer, a @starting-style
    // dialog and an element.animate() scale-in, with mount() and the React adapters.
    {
      const transformCSS = '<style>#wrap{transform-origin:50% 0;transition:transform .4s}#dlg{padding:0;border:0;transition:transform .3s}@starting-style{#dlg[open]{transform:scale(.95)}}</style>';
      const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><style>${css}</style>${transformCSS}</head><body data-col="col"><div id="wrap">${body()}</div><dialog id="dlg"><main class="col"><p class="t">${texts[0]}</p><p class="t">${texts[1]}</p></main></dialog><div id="host"></div><div id="app"></div></body></html>`;
      for (const kind of ['mount', 'react']) {
        const page = await open(html, kind === 'react' ? { mount: false, react: true } : {});
        if (kind === 'react') {
          await page.addScriptTag({ url: '/react.js' });
          await page.waitForFunction(() => document.querySelectorAll('.r[data-ts-outcome="composed:rich"]').length >= 2);
          await page.addScriptTag({ url: '/engine.js' });
          // Rendered inside the page's wrapper and, once more, inside the dialog.
          await page.evaluate(() => { const app = /** @type {HTMLElement} */ (document.getElementById('app')); /** @type {HTMLElement} */ (document.getElementById('wrap')).append(app); });
        }
        const selector = kind === 'react' ? '#wrap .r' : '#wrap p.t';
        const result = await page.evaluate(async ({ selector, kind }) => {
          const w = /** @type {any} */ (window);
          const sleep = (/** @type {number} */ ms) => new Promise(resolve => setTimeout(resolve, ms));
          const snap = (/** @type {string} */ sel) => w.blocks(sel).map((/** @type {HTMLElement} */ el) => el.dataset.tsOutcome + ':' + el.querySelectorAll('br[data-ts-break]').length).join(',');
          await sleep(300);
          const wrap = /** @type {HTMLElement} */ (document.getElementById('wrap'));
          const before = snap(selector);
          wrap.style.transform = 'scale(0.94)';
          await sleep(700);
          const open = snap(selector);
          wrap.style.transform = '';
          await sleep(900);
          const closed = snap(selector);
          const out = /** @type {Record<string, unknown>} */ ({ before, open, closed, staleAfterClose: w.stale(selector).length });
          if (kind === 'mount') {
            /** @type {HTMLDialogElement} */ (document.getElementById('dlg')).showModal();
            await sleep(1000);
            out.dialog = snap('#dlg p.t');
            /** @type {HTMLDialogElement} */ (document.getElementById('dlg')).close();
            const card = document.createElement('main');
            card.className = 'col';
            card.innerHTML = '<p class="t">' + /** @type {HTMLElement} */ (document.querySelector('#wrap p.t')).textContent + '</p>';
            /** @type {HTMLElement} */ (document.getElementById('host')).append(card);
            card.animate([{ transform: 'scale(.92)' }, { transform: 'none' }], { duration: 300 });
            await sleep(1000);
            out.inserted = snap('#host p.t');
          }
          return out;
        }, { selector, kind });
        const where = kind === 'react' ? 'React adapters' : 'mount()';
        check(`${where}: a composition is kept while a drawer scales the page behind it and after it closes`, !!result.before && !String(result.before).includes('native') && result.open === result.before && result.closed === result.before && result.staleAfterClose === 0, result);
        if (kind === 'mount') {
          check(`${where}: text in a @starting-style dialog composes once its entry transition ends`, /^composed:rich:\d+,composed:rich:\d+$/.test(String(result.dialog)) && !String(result.dialog).includes(':0'), result.dialog);
          check(`${where}: text in a card inserted with an element.animate() scale-in composes once it ends`, /^composed:rich:[1-9]\d*$/.test(String(result.inserted)), result.inserted);
        }
        await page.close();
      }
      // TypesetText in a @starting-style dialog, mounted closed.
      {
        const dialogApp = `<!doctype html><html lang="en"><head><meta charset="utf-8"><style>${css}</style>${transformCSS}</head><body data-col="col"><dialog id="dlg"><div id="app"></div></dialog></body></html>`;
        const page = await open(dialogApp, { mount: false, react: true });
        await page.addScriptTag({ url: '/react.js' });
        const result = await page.evaluate(async () => {
          const sleep = (/** @type {number} */ ms) => new Promise(resolve => setTimeout(resolve, ms));
          await sleep(500);
          /** @type {HTMLDialogElement} */ (document.getElementById('dlg')).showModal();
          await sleep(1200);
          return [...document.querySelectorAll('#dlg .r')].map(el => /** @type {HTMLElement} */ (el).dataset.tsOutcome + ':' + el.querySelectorAll('br[data-ts-break]').length);
        });
        check('React adapters: text in a @starting-style dialog composes once its entry transition ends', result.length === 4 && result.every(s => /^composed:rich:[1-9]/.test(s)), result);
        await page.close();
      }
    }
  } catch (error) { report.errors.push({ browser: name, error: String(/** @type {Error} */ (error).stack || error) }); }
  finally { await browser.close(); }
}
await writeFile('output/reflow-triggers.json', JSON.stringify(report, null, 2));
const failures = report.checks.filter(c => !c.pass);
console.log(JSON.stringify({ checks: report.checks.length, failures, errors: report.errors }, null, 2));
if (failures.length || report.errors.length) process.exitCode = 1;
