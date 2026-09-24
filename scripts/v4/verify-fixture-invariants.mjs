// @ts-check
// The still-valid invariants of the retired v3 Playwright spec
// (tests/engine.spec.ts), asserted on its plain-HTML fixture
// public/go-test.html through the website loader under test, in three engines:
//   - every paragraph is decided (has an outcome), never left pending
//   - data-no-typeset is inviolable
//   - composition preserves every word (no welding, no loss)
//   - links, emphasis and boxed code are the author's own elements, never
//     clones, before and after a width change
//   - an author <br> survives; non-English text is never edited
//   - the quarantined legacy API does not ship
//   - no overflow or nested output in the audit
// Merged words in the accessibility tree are checked by verify-native-ax.mjs.
import { readFile, writeFile } from 'node:fs/promises';
import { browsers } from './browsers.mjs';
import { artifacts } from './candidate.mjs';

// Served without its script tag and web font: the loader is injected after
// the page's original DOM is recorded, and Georgia keeps runs offline.
const html = (await readFile('public/go-test.html', 'utf8')).replace('<script src="/go.js" defer></script>', '');
const loader = await readFile(artifacts.siteGo, 'utf8');
/** @type {{ browser: string, label: string, pass: boolean, detail?: unknown }[]} */
const checks = [];
/** @type {{ browser: string, error: string }[]} */
const errors = [];
for (const { name, engine, executablePath } of browsers) {
  const browser = await engine.launch({ executablePath });
  /** @param {string} label @param {unknown} pass @param {unknown} [detail] */
  const check = (label, pass, detail) => checks.push({ browser: name, label, pass: !!pass, ...(pass ? {} : { detail }) });
  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
    page.setDefaultTimeout(20000);
    page.on('pageerror', error => errors.push({ browser: name, error: error.message }));
    await page.route('**/*', route => route.request().url() === 'http://fixture.test/go-test.html' ? route.fulfill({ contentType: 'text/html; charset=utf-8', body: html }) : route.abort());
    await page.goto('http://fixture.test/go-test.html');
    await page.evaluate(() => {
      const w = /** @type {any} */ (window);
      const words = (/** @type {Element} */ el) => (el.textContent || '').match(/[\p{L}\p{N}]+/gu) || [];
      w.before = [...document.querySelectorAll('p, li, h2')].map(el => ({ el, text: el.textContent, words: words(el) }));
      w.authored = { anchors: [...document.querySelectorAll('#rich-link a, #rich-mixed a')].map(a => ({ a, href: a.getAttribute('href'), text: a.textContent })),
        ems: [...document.querySelectorAll('#rich-mixed em')], code: document.querySelector('#rich-chip code'), br: document.querySelector('#br-weld br') };
    });
    await page.evaluate(source => { const script = document.createElement('script'); script.textContent = source; document.head.append(script); }, loader);
    await page.evaluate(() => /** @type {any} */ (window).TypesetReady.then((/** @type {any} */ c) => c.ready));
    const state = async () => page.evaluate(() => {
      const w = /** @type {any} */ (window);
      const words = (/** @type {Element} */ el) => (el.textContent || '').match(/[\p{L}\p{N}]+/gu) || [];
      const control = /** @type {HTMLElement} */ (document.querySelector('p[data-no-typeset]'));
      const audit = w.Typeset.auditJSON('p, li, h2');
      return {
        undecided: [...document.querySelectorAll('p:not([data-no-typeset])')].filter(p => !(/** @type {HTMLElement} */ (p)).dataset.tsOutcome).map(p => p.id || p.textContent?.slice(0, 40)),
        control: { text: control.textContent, outcome: control.dataset.tsOutcome, markers: control.querySelectorAll('[data-ts-break], [data-ts-space], [data-ts-track], [data-ts-hang]').length, same: control.textContent === w.before.find((/** @type {any} */ b) => b.el === control).text },
        welded: w.before.filter((/** @type {any} */ b) => words(b.el).join(' ') !== b.words.join(' ')).map((/** @type {any} */ b) => ({ id: b.el.id, before: b.words.length, after: words(b.el).length })),
        anchors: w.authored.anchors.map((/** @type {any} */ x) => ({ connected: x.a.isConnected && !!x.a.closest('#rich-link, #rich-mixed'), href: x.a.getAttribute('href') === x.href, text: x.a.textContent === x.text })),
        anchorCount: document.querySelectorAll('#rich-link a, #rich-mixed a').length,
        ems: w.authored.ems.every((/** @type {Element} */ em) => em.isConnected) && document.querySelectorAll('#rich-mixed em').length === w.authored.ems.length,
        code: w.authored.code.isConnected && document.querySelectorAll('#rich-chip code').length === 1 && w.authored.code.textContent === 'text-wrap: pretty',
        br: w.authored.br.isConnected && document.querySelectorAll('#br-weld br:not([data-ts-break])').length === 1,
        foreign: ['lang-de', 'lang-ru', 'lang-fr'].filter(id => { const el = /** @type {Element} */ (document.getElementById(id)); return el.textContent !== w.before.find((/** @type {any} */ b) => b.el === el).text; }),
        nav: { styled: document.getElementById('nav-list')?.classList.contains('ts-styled'), padding: getComputedStyle(/** @type {Element} */ (document.getElementById('nav-list'))).paddingLeft },
        legacy: ['smoothRag', 'smoothRagSpans', 'optimizeBreaks', 'shapeRag', 'fixRag', 'postRenderFix'].filter(k => k in w.Typeset),
        hard: audit.issues.filter((/** @type {{ type: string }} */ i) => ['overflow', 'nested-output'].includes(i.type)),
        composed: Object.entries(audit.outcomes).filter(([k]) => k.startsWith('composed')).reduce((n, [, v]) => n + Number(v), 0),
      };
    });
    for (const [phase, width] of /** @type {[string, number][]} */ ([['initial', 1280], ['after resize to 375px', 375]])) {
      if (width !== 1280) {
        await page.setViewportSize({ width, height: 800 });
        await page.waitForTimeout(400);
        await page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))));
      }
      const s = await state();
      check(`${phase}: every paragraph is decided`, s.undecided.length === 0, s.undecided);
      check(`${phase}: some paragraphs compose`, s.composed >= 6, s.composed);
      check(`${phase}: data-no-typeset paragraph is untouched`, s.control.same && s.control.outcome === undefined && s.control.markers === 0 && s.control.text?.includes('"quotes"') && s.control.text?.includes('--'), s.control);
      check(`${phase}: every word preserved`, s.welded.length === 0, s.welded);
      check(`${phase}: author links are the same elements with the same href and text`, s.anchors.length >= 2 && s.anchors.every(a => a.connected && a.href && a.text) && s.anchorCount === s.anchors.length, s.anchors);
      check(`${phase}: nested emphasis is the author's own`, s.ems);
      check(`${phase}: boxed code chip is never cloned or split`, s.code);
      check(`${phase}: author <br> survives`, s.br);
      check(`${phase}: non-English text is never edited`, s.foreign.length === 0, s.foreign);
      check(`${phase}: author-styled nav list is not restyled`, !s.nav.styled && s.nav.padding === '0px', s.nav);
      check(`${phase}: quarantined legacy API does not ship`, s.legacy.length === 0, s.legacy);
      check(`${phase}: audit finds no overflow or nested output`, s.hard.length === 0, s.hard);
    }
  } catch (error) {
    errors.push({ browser: name, error: String(/** @type {Error} */ (error).stack || error) });
  } finally { await browser.close(); }
}
const failures = checks.filter(c => !c.pass);
await writeFile('output/fixture-invariants.json', JSON.stringify({ loader: artifacts.siteGo, checks, errors }, null, 2));
console.log(JSON.stringify({ checks: checks.length, failures, errors }, null, 2));
if (failures.length || errors.length) process.exitCode = 1;
