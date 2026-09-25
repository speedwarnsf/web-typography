// @ts-check
// C10: machine translation. Translators segment text at element boundaries
// and hold references to the Text nodes they fill, so composed text must step
// aside: engine markers removed and wrappers unwrapped, with no Text node
// split, merged, edited or removed by the engine, and no recomposition until
// the translation ends. Signals: the root's translated-ltr/rtl class (Google,
// Chrome), a <font> wrapper inside composed text, and Edge's _msttexthash.
// TypesetRichText freezes, also when its column narrows while the translator
// holds its Text nodes. The page bundles mount() and the React adapters as
// one engine copy. The live Google Translate smoke test needs the network and
// is not part of this offline suite.
import { build } from 'esbuild';
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { browsers } from './browsers.mjs';
import { artifacts } from './candidate.mjs';

const corpus = JSON.parse(await readFile('tests/v4-corpus.json', 'utf8')).paragraphs;
const escape = (/** @type {string} */ text) => text.replace(/&/g, '&amp;').replace(/</g, '&lt;');
const rich = (/** @type {string} */ text) => { const w = escape(text).split(' '); return `${w.slice(0, 5).join(' ')} <a href="#x">${w.slice(5, 8).join(' ')}</a> ${w.slice(8, 12).join(' ')} <em>${w.slice(12, 14).join(' ')}</em> ${w.slice(14).join(' ')}`; };
const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><style>body{margin:0;font:17px/1.45 Georgia,serif}.col{width:420px;padding:0 8px}</style></head><body>
<div class="col" id="col"><p class="t" id="p1">${rich(corpus[5])}</p><p class="t" id="p2">${escape(corpus[9])}</p><p class="t" id="p3">${rich(corpus[14])}</p></div>
<div class="col" id="react-col"><div id="app"></div></div><script src="/react.js"></script></body></html>`;
const reactFixture = (await build({
  stdin: { contents: `
import { createElement as h } from 'react';
import { createRoot } from 'react-dom/client';
import { flushSync } from 'react-dom';
import { TypesetText, TypesetRichText } from ${JSON.stringify(resolve(artifacts.react))};
import * as Typeset from ${JSON.stringify(resolve(artifacts.esm))};
// One engine copy for the page, as in an app that bundles both entries.
window.Typeset = Typeset;
const words = ${JSON.stringify(corpus[30])}.split(' ');
window.renderReact = () => flushSync(() => createRoot(document.getElementById('app')).render([
  h(TypesetText, { key: 't', id: 'rt', text: ${JSON.stringify(corpus[22])} }),
  h(TypesetRichText, { key: 'r', id: 'rr' }, words.slice(0, 6).join(' ') + ' ', h('em', null, words.slice(6, 8).join(' ')), ' ' + words.slice(8).join(' ')),
]));
`, resolveDir: process.cwd(), loader: 'js' },
  bundle: true, minify: true, write: false, format: 'iife', target: 'es2022', define: { 'process.env.NODE_ENV': '"production"' }, logLevel: 'silent',
})).outputFiles[0].text;

// In-page: an audit observer and a translator stand-in.
const helpers = () => {
  const w = /** @type {any} */ (window);
  w.frames = async (n = 3) => { for (let i = 0; i < n; i++) await new Promise(r => requestAnimationFrame(() => r(undefined))); await new Promise(r => setTimeout(r, 60)); };
  w.hosts = () => /** @type {HTMLElement[]} */ ([...document.querySelectorAll('p.t, #rt')]);
  w.texts = () => w.hosts().flatMap((/** @type {HTMLElement} */ host) => { const out = []; const walker = document.createTreeWalker(host, NodeFilter.SHOW_TEXT); let node; while ((node = walker.nextNode())) out.push(node); return out; });
  w.auditLog = [];
  w.audit = new MutationObserver(records => { w.auditLog.push(...records); });
  w.audit.observe(document.body, { subtree: true, childList: true, characterData: true });
  /** Records since the last call. A Text node moved out of an unwrapped
   * wrapper is removed and re-added; removedText counts those removed and not
   * re-added (split, merged or deleted), editedText any change to text data. */
  w.engineRecords = () => {
    const records = /** @type {MutationRecord[]} */ ([...w.auditLog, ...w.audit.takeRecords()]);
    w.auditLog = [];
    const removed = new Set(), added = new Set();
    for (const r of records) { for (const n of r.removedNodes) if (n.nodeType === 3) removed.add(n); for (const n of r.addedNodes) if (n.nodeType === 3) added.add(n); }
    return { removedText: [...removed].filter(n => !added.has(n) || !n.isConnected).length, addedText: [...added].filter(n => !removed.has(n)).length, moved: [...removed].filter(n => added.has(n)).length, editedText: records.filter(r => r.type === 'characterData').length, records: records.length };
  };
  w.state = () => w.hosts().map((/** @type {HTMLElement} */ el) => ({ id: el.id, outcome: el.dataset.tsOutcome, markers: el.querySelectorAll('[data-ts-break], [data-ts-track], .ts-line').length }));
  // What Google Translate does to a Text node: <font><font>translation</font></font>.
  w.translate = () => {
    const saved = [];
    for (const node of w.texts()) {
      if (!node.data.trim()) continue;
      const outer = document.createElement('font'), inner = document.createElement('font');
      outer.style.verticalAlign = 'inherit'; inner.style.verticalAlign = 'inherit';
      inner.textContent = node.data.replace(/\b(\w)(\w*)/g, (_m, a, b) => a.toUpperCase() + b);
      outer.append(inner);
      saved.push([outer, node]);
      node.replaceWith(outer);
    }
    w.saved = saved;
  };
  w.untranslate = () => { for (const [font, node] of w.saved) font.replaceWith(node); };
};

/** @type {{ checks: { browser: string, label: string, pass: boolean, detail?: unknown }[], errors: { browser: string, error: string }[] }} */
const report = { checks: [], errors: [] };
for (const { name, engine, executablePath } of browsers) {
  const browser = await engine.launch({ executablePath, timeout: 20000 });
  /** @param {string} label @param {boolean} pass @param {unknown} [detail] */
  const check = (label, pass, detail) => report.checks.push({ browser: name, label, pass: !!pass, detail });
  const open = async () => {
    const page = await browser.newPage({ viewport: { width: 1000, height: 900 } });
    page.setDefaultTimeout(20000);
    await page.route('http://translate.test/**', route => {
      const path = new URL(route.request().url()).pathname;
      if (path === '/react.js') return route.fulfill({ contentType: 'text/javascript', body: reactFixture });
      return route.fulfill({ contentType: 'text/html; charset=utf-8', body: html });
    });
    await page.goto('http://translate.test/index.html');
    await page.evaluate(async () => {
      const w = /** @type {any} */ (window);
      await document.fonts.ready;
      w.renderReact();
      w.controller = w.Typeset.mount(document, 'p.t');
      await w.controller.ready;
      await new Promise(r => setTimeout(r, 400));
    });
    await page.evaluate(helpers);
    return page;
  };
  try {
    // Google/Chrome: the root class.
    {
      const page = await open();
      const result = await page.evaluate(async () => {
        const w = /** @type {any} */ (window);
        const composed = w.state();
        const texts = w.texts();
        const richBefore = /** @type {HTMLElement} */ (document.getElementById('rr')).innerHTML;
        w.engineRecords();
        document.documentElement.classList.add('translated-ltr');
        await w.frames();
        const stepAside = { ...w.engineRecords(), connected: texts.every((/** @type {Text} */ t) => t.isConnected && w.hosts().some((/** @type {HTMLElement} */ h) => h.contains(t))), state: w.state() };
        w.translate();
        w.engineRecords();
        // Width and font changes during translation must not bring composition back.
        /** @type {HTMLElement} */ (document.getElementById('col')).style.width = '380px';
        /** @type {HTMLElement} */ (document.getElementById('react-col')).style.width = '380px';
        await w.frames(6);
        await new Promise(r => setTimeout(r, 300));
        const during = { ...w.engineRecords(), state: w.state(), richUnchanged: /** @type {HTMLElement} */ (document.getElementById('rr')).innerHTML === richBefore };
        w.untranslate();
        document.documentElement.classList.remove('translated-ltr');
        await w.frames();
        await new Promise(r => setTimeout(r, 600));
        return { composed, stepAside, during, after: w.state(), richOutcome: /** @type {HTMLElement} */ (document.getElementById('rr')).dataset.tsOutcome };
      });
      check('fixture composes with markers and wrappers', result.composed.every((/** @type {any} */ s) => s.outcome === 'composed:rich' && s.markers > 0), result.composed);
      check('translated-ltr: markers removed, no Text node removed, merged or edited', result.stepAside.removedText === 0 && result.stepAside.addedText === 0 && result.stepAside.editedText === 0 && result.stepAside.connected && result.stepAside.state.every((/** @type {any} */ s) => s.outcome === 'native:translated' && s.markers === 0), result.stepAside);
      check('while translated: no recomposition and no engine edits to text', result.during.removedText === 0 && result.during.addedText === 0 && result.during.editedText === 0 && result.during.state.every((/** @type {any} */ s) => s.markers === 0), result.during);
      check('TypesetRichText freezes while translated', result.during.richUnchanged, result.during);
      check('translation ended: the current DOM is composed again', result.after.every((/** @type {any} */ s) => s.outcome === 'composed:rich' && s.markers > 0) && result.richOutcome === 'composed:rich', result.after);
      await page.close();
    }
    // The translator fills TypesetRichText's Text nodes too, then the column
    // narrows below the widest composed line (a rotation, a sidebar, a fluid
    // layout). The adapter stays frozen: a re-render would make React remove
    // Text nodes the translator replaced, and unmount the whole root.
    {
      const page = await open();
      /** @type {string[]} */
      const pageErrors = [];
      page.on('pageerror', error => pageErrors.push(error.message));
      const result = await page.evaluate(async () => {
        const w = /** @type {any} */ (window);
        const rr = /** @type {HTMLElement} */ (document.getElementById('rr'));
        const composed = { outcome: rr.dataset.tsOutcome, breaks: rr.querySelectorAll('br[data-ts-break]').length };
        document.documentElement.classList.add('translated-ltr');
        await w.frames();
        const app = /** @type {HTMLElement} */ (document.getElementById('app'));
        const walker = document.createTreeWalker(app, NodeFilter.SHOW_TEXT);
        /** @type {Text[]} */
        const nodes = [];
        let node;
        while ((node = walker.nextNode())) nodes.push(/** @type {Text} */ (node));
        /** @type {[HTMLElement, Text][]} */
        const saved = [];
        for (const text of nodes) {
          if (!text.data.trim()) continue;
          const outer = document.createElement('font'), inner = document.createElement('font');
          inner.textContent = text.data.toUpperCase();
          outer.append(inner); saved.push([outer, text]); text.replaceWith(outer);
        }
        const frozen = rr.innerHTML;
        /** @type {HTMLElement} */ (document.getElementById('react-col')).style.width = '240px';
        await w.frames(6);
        await new Promise(r => setTimeout(r, 400));
        const during = { children: app.childElementCount, rr: !!document.getElementById('rr'), unchanged: document.getElementById('rr')?.innerHTML === frozen, stale: document.getElementById('rr')?.hasAttribute('data-ts-stale') };
        for (const [font, text] of saved) font.replaceWith(text);
        document.documentElement.classList.remove('translated-ltr');
        await w.frames();
        await new Promise(r => setTimeout(r, 600));
        const after = document.getElementById('rr');
        return { composed, during, after: { outcome: after?.dataset.tsOutcome, breaks: after?.querySelectorAll('br[data-ts-break]').length ?? 0 } };
      });
      check('TypesetRichText under a translator: a narrower column keeps the root mounted and the adapter frozen', result.composed.outcome === 'composed:rich' && result.composed.breaks > 0
        && result.during.children === 2 && result.during.rr && result.during.unchanged && !result.during.stale && !pageErrors.length, { ...result, pageErrors: pageErrors.slice(0, 3) });
      check('TypesetRichText under a translator: show original recomposes at the new width', result.after.outcome === 'composed:rich' && result.after.breaks > result.composed.breaks, result.after);
      await page.close();
    }
    // A <font> wrapper inside composed text, with no root class.
    {
      const page = await open();
      const result = await page.evaluate(async () => {
        const w = /** @type {any} */ (window);
        const host = /** @type {HTMLElement} */ (document.getElementById('p2'));
        const texts = w.texts();
        const node = /** @type {Text} */ ([...host.childNodes].find(n => n.nodeType === 3 && /\w/.test(/** @type {Text} */ (n).data)));
        const font = document.createElement('font');
        node.replaceWith(font); font.append(node);
        w.engineRecords();
        await w.frames();
        return { ...w.engineRecords(), connected: texts.every((/** @type {Text} */ t) => t.isConnected), state: w.state() };
      });
      check('a <font> wrapper: every host steps aside without touching Text nodes', result.removedText === 0 && result.addedText === 0 && result.editedText === 0 && result.connected && result.state.every((/** @type {any} */ s) => s.outcome === 'native:translated' && s.markers === 0), result);
      await page.close();
    }
    // Edge: _msttexthash on a host.
    {
      const page = await open();
      const result = await page.evaluate(async () => {
        const w = /** @type {any} */ (window);
        const texts = w.texts();
        w.engineRecords();
        /** @type {HTMLElement} */ (document.getElementById('p3')).setAttribute('_msttexthash', '1234567');
        await w.frames();
        return { ...w.engineRecords(), connected: texts.every((/** @type {Text} */ t) => t.isConnected), state: w.state() };
      });
      check('an _msttexthash attribute: every host steps aside without touching Text nodes', result.removedText === 0 && result.addedText === 0 && result.editedText === 0 && result.connected && result.state.every((/** @type {any} */ s) => s.outcome === 'native:translated' && s.markers === 0), result);
      await page.close();
    }
  } catch (error) { report.errors.push({ browser: name, error: String(/** @type {Error} */ (error).stack || error) }); }
  finally { await browser.close(); }
}
await writeFile('output/translation.json', JSON.stringify(report, null, 2));
const failures = report.checks.filter(c => !c.pass);
console.log(JSON.stringify({ checks: report.checks.length, failures, errors: report.errors }, null, 2));
if (failures.length || report.errors.length) process.exitCode = 1;
