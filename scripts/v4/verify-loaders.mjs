// @ts-check
import { readFile, writeFile, stat } from 'node:fs/promises';
import { browsers } from './browsers.mjs';
import { artifacts, expectedVersion } from './candidate.mjs';

const version = await expectedVersion();
/** @type {{ browser: string, label: string, pass: boolean, detail?: unknown }[]} */
const checks = [];
/** @type {{ browser: string, error: string }[]} */
const errors = [];
// dist/auto.js is new in 4.3; the committed 4.2.0 dist (test:release) has none.
const hasAuto = await stat(artifacts.auto).then(() => true, () => false);
const loaders = [['package go.js', artifacts.go], ['website go.js', artifacts.siteGo], ...(hasAuto ? [['package auto.js', artifacts.auto]] : [])];
const PROSE = '<html lang="en"><style>body{width:340px;font:19px/1.5 Georgia}</style>'
  + '<h2>The End of Oak Street and the beginning of something else entirely</h2>'
  + '<p>Your browser does not know what a sentence is. It does not know that a thought should not snap in half, or that a word left alone on a line looks abandoned, because it is.</p>'
  + '<ul><li>Photographs from the neighborhood, letters, sketches and annotated maps from the archive.</li></ul>'
  + '<blockquote>It fills each line until the words run out, and calls that typography, which it is not.</blockquote>'
  + '<p data-no-typeset>Excluded text stays untouched, whatever the loader is asked to do with it.</p>'
  + '<p><a href="#x">A linked phrase</a> inside a paragraph keeps its link and its focus when the paragraph is composed.</p></html>';
/** @param {import('playwright').Browser} browser @param {string} html @param {string} content @param {Record<string, string>} [attributes] script data attributes */
async function load(browser, html, content, attributes = {}) {
  const page = await browser.newPage();
  page.setDefaultTimeout(20000);
  /** @type {string[]} */
  const info = [], warnings = [];
  page.on('console', message => { if (message.type() === 'info') info.push(message.text()); if (['warning', 'error'].includes(message.type())) warnings.push(message.text()); });
  await page.setContent(html);
  await page.evaluate(({ content, attributes }) => { const script = document.createElement('script'); Object.assign(script.dataset, attributes); script.textContent = content; document.head.append(script); }, { content, attributes });
  await page.evaluate(() => /** @type {any} */ (window).TypesetReady);
  await page.waitForTimeout(50);
  const state = await page.evaluate(() => [...document.body.querySelectorAll('*')].map(el => ({ tag: el.tagName, outcome: el.getAttribute('data-ts-outcome'), text: el.textContent, html: el.outerHTML })));
  return { page, info, warnings, state };
}
for (const config of browsers) {
  const browser = await config.engine.launch({ executablePath: config.executablePath });
  try {
    for (const [loader, file] of loaders) {
      const content = await readFile(file, 'utf8');
      for (const option of ['default', 'tracking', 'spacing', 'copy']) {
        const page = await browser.newPage();
        page.setDefaultTimeout(20000);
        const label = `${loader} ${option}`;
        /** @param {string} what @param {unknown} pass @param {unknown} [detail] */
        const check = (what, pass, detail) => checks.push({ browser: config.name, label: `${label}: ${what}`, pass: !!pass, ...(pass ? {} : { detail }) });
        try {
          await page.setContent('<html lang="en"><style>p{width:320px;font:20px/1.5 Georgia}</style><p data-typeset>Your browser does not know what a sentence is. It does not know that a thought should not snap in half, or that a word left alone on a line looks abandoned, because it is. It fills each line until the words run out, and calls that typography.</p><p data-no-typeset>Excluded text stays untouched.</p></html>');
          const before = await page.locator('[data-typeset]').textContent();
          await page.evaluate(({ content, option }) => {
            const script = document.createElement('script');
            if (option === 'tracking') script.dataset.typesetTracking = 'false';
            if (option === 'spacing') script.dataset.typesetSpacing = 'false';
            if (option === 'copy') script.dataset.typesetCopy = 'false';
            script.textContent = content; document.head.append(script);
          }, { content, option });
          await page.evaluate(() => /** @type {any} */ (window).TypesetReady);
          const result = await page.evaluate(() => {
            const p = /** @type {HTMLElement} */ (document.querySelector('[data-typeset]'));
            const excluded = /** @type {HTMLElement} */ (document.querySelector('[data-no-typeset]'));
            return { version: /** @type {any} */ (window).Typeset.VERSION, text: p.textContent, outcome: p.dataset.tsOutcome, tracking: p.dataset.tsTracking, spacing: p.dataset.tsSpacing, excluded: excluded.dataset.tsOutcome };
          });
          check('reports VERSION ' + version, result.version === version, result.version);
          check('text unchanged', result.text === before, result.text);
          check('composes rich', result.outcome === 'composed:rich', result.outcome);
          check('data-no-typeset untouched', result.excluded === undefined, result.excluded);
          const trackingOff = option === 'tracking' || option === 'spacing';
          check('tracking ' + (trackingOff ? 'off' : 'applied'), trackingOff ? result.tracking === 'off' : result.tracking === 'applied', result.tracking);
          check('spacing ' + (option === 'spacing' ? 'off' : 'on'), option === 'spacing' ? result.spacing === 'off' : result.spacing !== 'off', result.spacing);
          // The engine copies composed text as its source; data-typeset-copy="false" (4.4) leaves copying to the browser.
          const copied = await page.evaluate(() => {
            const p = /** @type {HTMLElement} */ (document.querySelector('[data-typeset]')), range = document.createRange(), selection = /** @type {Selection} */ (getSelection());
            range.selectNodeContents(p); selection.removeAllRanges(); selection.addRange(range);
            const event = new ClipboardEvent('copy', { bubbles: true, cancelable: true, clipboardData: new DataTransfer() });
            p.dispatchEvent(event); selection.removeAllRanges();
            return { handled: event.defaultPrevented, text: event.clipboardData?.getData('text/plain') };
          });
          check(option === 'copy' ? 'copy left to the browser' : 'copy puts the source text on the clipboard', option === 'copy' ? !copied.handled : copied.handled && copied.text === before, copied);
          await page.evaluate(() => /** @type {any} */ (window).TypesetReady.then((/** @type {any} */ controller) => controller.disconnect()));
          check('disconnect restores text', await page.locator('[data-typeset]').textContent() === before);
          check('disconnect removes markers', await page.locator('[data-ts-track], [data-ts-space], [data-ts-break]').count() === 0);
        } catch (error) {
          errors.push({ browser: config.name, error: label + ': ' + String(/** @type {Error} */ (error).stack || error) });
        } finally { await page.close(); }
      }
    }
  } finally { await browser.close(); }
}
// K6: the npm automatic loader behaves exactly like the website loader, and
// a loader that matches nothing says so once instead of silently idling.
for (const config of browsers) {
  const browser = await config.engine.launch({ executablePath: config.executablePath });
  /** @param {string} what @param {unknown} pass @param {unknown} [detail] */
  const check = (what, pass, detail) => checks.push({ browser: config.name, label: what, pass: !!pass, ...(pass ? {} : { detail }) });
  try {
    const siteGo = await readFile(artifacts.siteGo, 'utf8');
    const packageGo = await readFile(artifacts.go, 'utf8');
    if (hasAuto) {
      const auto = await readFile(artifacts.auto, 'utf8');
      check('package auto.js is the website loader byte for byte', auto === siteGo);
      const a = await load(browser, PROSE, siteGo), b = await load(browser, PROSE, auto);
      check('package auto.js composes the same targets with the same outcomes and text as website go.js', JSON.stringify(a.state) === JSON.stringify(b.state) && a.state.filter(el => /^composed/.test(String(el.outcome))).length >= 3, { site: a.state.filter(el => el.outcome), auto: b.state.filter(el => el.outcome) });
      await a.page.close(); await b.page.close();
      const empty = await load(browser, '<html lang="en"><body><div>Only a div.</div></body></html>', auto);
      check('auto.js on a page without prose logs one console.info naming the selector', empty.info.length === 1 && /no element matches p, li/.test(empty.info[0]), empty.info);
      await empty.page.close();
      const full = await load(browser, PROSE, auto);
      check('auto.js with matching prose logs nothing', full.info.length === 0, full.info);
      await full.page.close();
      // go@4.2.0.js also skipped .demo and [data-no-smooth], typeset.us-internal
      // classes an adopter could not see or override (4.3 rendering change).
      const LONG = 'Your browser does not know what a sentence is. It does not know that a thought should not snap in half, or that a word left alone on a line looks abandoned.';
      const demo = await load(browser, `<html lang="en"><style>body{width:340px;font:19px/1.5 Georgia}</style><main class="demo"><p>${LONG}</p></main><p data-no-smooth>${LONG}</p></html>`, auto);
      check('auto.js composes prose inside .demo and [data-no-smooth]', demo.state.filter(el => el.tag === 'P' && el.outcome === 'composed:rich').length === 2 && demo.info.length === 0, { state: demo.state.filter(el => el.tag === 'P'), info: demo.info });
      await demo.page.close();
    }
    if (hasAuto) {
      const auto = await readFile(artifacts.auto, 'utf8');
      // Quotes (4.4): the auto loader curls quotes only where English is
      // declared; data-typeset-smart-quotes="en" also curls untagged text, as
      // 4.3's default did. 4.3 curled untagged German and French.
      const GERMAN = 'Er sagte: "Hallo Welt" und dann begann der Kurs über gesunde Ernährung, der jeden Dienstag im großen Saal der Klinik stattfindet.';
      const german = await load(browser, `<html><style>body{width:340px;font:19px/1.5 Georgia}</style><p>${GERMAN}</p></html>`, auto);
      const germanP = german.state.find(el => el.tag === 'P');
      check('auto.js leaves the quotes of an untagged German paragraph straight (smartQuotes en-declared)', germanP?.text === GERMAN, germanP);
      await german.page.close();
      const germanEn = await load(browser, `<html><style>body{width:340px;font:19px/1.5 Georgia}</style><p>${GERMAN}</p></html>`, auto, { typesetSmartQuotes: 'en' });
      check('auto.js with data-typeset-smart-quotes="en" curls the untagged paragraph as 4.3 did', germanEn.state.find(el => el.tag === 'P')?.text === GERMAN.replace('"Hallo Welt"', '\u201cHallo Welt\u201d'), germanEn.state.find(el => el.tag === 'P'));
      await germanEn.page.close();
      const english = await load(browser, `<html lang="en"><style>body{width:340px;font:19px/1.5 Georgia}</style><p>"Hello," she said, and the nurse at the front desk looked up from the schedule to ask whether she had an appointment.</p></html>`, auto);
      check('auto.js curls quotes in declared English by default', english.state.find(el => el.tag === 'P')?.text?.startsWith('\u201cHello,\u201d she said'), english.state.find(el => el.tag === 'P'));
      await english.page.close();
      // Coverage (4.4): a Portuguese page stays native as 4.3.1 left it, by
      // default and with data-typeset-coverage="core"; "extended" composes it.
      const PORTUGUESE = '<html lang="pt"><style>body{width:340px;font:19px/1.5 Georgia}</style><p>A clínica oferece testes gratuitos aos sábados, e os resultados chegam por mensagem de texto em até dois dias. Traga um documento com foto e chegue alguns minutos antes da consulta.</p></html>';
      const byDefault = await load(browser, PORTUGUESE, auto), extended = await load(browser, PORTUGUESE, auto, { typesetCoverage: 'extended' }), core = await load(browser, PORTUGUESE, auto, { typesetCoverage: 'core' });
      const ptOutcome = (/** @type {{ state: { tag: string, outcome: string | null }[] }} */ run) => run.state.find(el => el.tag === 'P')?.outcome;
      check('auto.js leaves a lang="pt" paragraph native:language by default and with data-typeset-coverage="core", and composes it with data-typeset-coverage="extended"', ptOutcome(byDefault) === 'native:language' && ptOutcome(core) === 'native:language' && /^composed/.test(String(ptOutcome(extended))), { default: ptOutcome(byDefault), extended: ptOutcome(extended), core: ptOutcome(core) });
      await byDefault.page.close(); await extended.page.close(); await core.page.close();
      // Headings (4.4): data-typeset-headings="false" leaves every heading
      // exactly as authored, with no outcome; paragraphs still compose.
      const withHeadings = await load(browser, PROSE, auto), noHeadings = await load(browser, PROSE, auto, { typesetHeadings: 'false' });
      const heading = (/** @type {{ state: { tag: string, outcome: string | null, html: string }[] }} */ run) => run.state.find(el => el.tag === 'H2');
      const authored = PROSE.match(/<h2>.*?<\/h2>/)?.[0];
      check('auto.js with data-typeset-headings="false" leaves the h2 untouched, with no outcome, and composes the paragraphs', heading(noHeadings)?.outcome === null && heading(noHeadings)?.html === authored
        && noHeadings.state.filter(el => el.tag === 'P' && /^composed/.test(String(el.outcome))).length >= 2 && heading(withHeadings)?.outcome !== null, { withHeadings: heading(withHeadings), noHeadings: heading(noHeadings) });
      await withHeadings.page.close(); await noHeadings.page.close();
      // Notes (4.4): at most two console.info lines, never a warning. Composed
      // text without a lang gets one; a page where nothing composed gets one
      // with the commonest reason. 4.3 said nothing.
      const untagged = await load(browser, PROSE.replace('<html lang="en">', '<html>'), auto);
      check('auto.js on untagged prose logs one console.info: no lang attribute, English line-end preferences are off', untagged.info.length === 1 && /no lang attribute, so English line-end preferences are off; add lang="en" to <html>/.test(untagged.info[0]) && !untagged.warnings.length, untagged.info);
      await untagged.page.close();
      const declined = await load(browser, PROSE.replace('<html lang="en">', '<html lang="ja">'), auto);
      const matched = declined.state.filter(el => el.outcome).length;
      check('auto.js where every block declines logs one console.info naming the commonest outcome', declined.info.length === 1 && new RegExp(`none of the ${matched} matched blocks was composed; most common: native:language \u00d7\\d+; see https://typeset\\.us/docs`).test(declined.info[0]) && !declined.warnings.length, declined.info);
      await declined.page.close();
    }
    const unmarked = await load(browser, PROSE, packageGo);
    check('package go.js without [data-typeset] targets logs one console.info that names [data-typeset] and auto.js', unmarked.info.length === 1 && /no element matches \[data-typeset\]/.test(unmarked.info[0]) && /auto/.test(unmarked.info[0]), unmarked.info);
    check('package go.js without targets composes nothing', unmarked.state.every(el => !el.outcome), unmarked.state.filter(el => el.outcome));
    await unmarked.page.close();
    const marked = await load(browser, PROSE.replace('<p>Your', '<p data-typeset>Your'), packageGo);
    check('package go.js with a [data-typeset] target logs nothing', marked.info.length === 0, marked.info);
    await marked.page.close();
    const markedDeclined = await load(browser, PROSE.replace('<p>Your', '<p data-typeset>Your').replace('<html lang="en">', '<html lang="ja">'), packageGo);
    check('package go.js whose one target declines logs one console.info naming native:language', markedDeclined.info.length === 1 && /typeset\.us go\.js: none of the 1 matched blocks was composed; most common: native:language \u00d71/.test(markedDeclined.info[0]), markedDeclined.info);
    await markedDeclined.page.close();
  } catch (error) {
    errors.push({ browser: config.name, error: 'auto/notice: ' + String(/** @type {Error} */ (error).stack || error) });
  } finally { await browser.close(); }
}

// 4.4: on a server-rendered page the loaders compose after the framework
// hydrates it (hydration.ts). React is simulated here by the keys it sets:
// __reactContainer$ on the root when hydrateRoot() runs, __reactFiber$ on each
// element once its subtree is hydrated (on an ancestor for HTML React never
// hydrates, such as dangerouslySetInnerHTML). Real React 18 and 19 SSR pages
// are the adoption hydration probe's. The hydration wait no longer waits for
// the load event once hydration is seen, and is capped at 10 s from the
// loader's start, not from load. A late load: the page is served from
// PENDING_PAGE with an image whose request is held until release() (a page
// set with setContent() reports load in Chromium with the image pending).
// mount() then waits for document.fonts.ready, which Chromium and WebKit
// resolve only at the load event; Firefox resolves it before.
const PENDING_PAGE = 'http://typeset.test/page.html', PENDING_IMAGE = 'http://typeset.test/pending.gif';
const GIF = Buffer.from('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7', 'base64');
/** @param {import('playwright').Page} page @param {string} html @returns {Promise<() => void>} a release of the held image, which lets the load event come */
async function openPending(page, html) {
  /** @type {import('playwright').Route[]} */
  const held = [];
  await page.route(PENDING_IMAGE, route => { held.push(route); });
  await page.route(PENDING_PAGE, route => route.fulfill({ contentType: 'text/html; charset=utf-8', body: html }));
  await page.goto(PENDING_PAGE, { waitUntil: 'domcontentloaded' });
  return () => { for (const route of held.splice(0)) route.fulfill({ contentType: 'image/gif', body: GIF }).catch(() => {}); };
}
const SERVER = (/** @type {string} */ root, pending = false) => '<html lang="en"><style>p{width:320px;font:20px/1.5 Georgia}</style><body>' + root
  + (pending ? '<img src="' + PENDING_IMAGE + '" alt="" width="1" height="1">' : '')
  + '<p data-typeset>Your browser does not know what a sentence is. It does not know that a thought should not snap in half, or that a word left alone on a line looks abandoned.</p>'
  + '<div class="html"><p data-typeset>It fills each line until the words run out, and calls that typography, which it is not, and a compositor would not either.</p></div></div></body></html>';
const composedAll = (/** @type {(string | null)[]} */ list) => list.every(o => o === 'composed:rich');
for (const config of browsers) {
  const browser = await config.engine.launch({ executablePath: config.executablePath });
  // Opened first and read after the other variants: a marked page that never
  // hydrates, its load event at 11 s. Capped from load, it composed at 21 s.
  const capLabel = 'package go.js hydration (#__next, never hydrated, load event at 11 s)';
  let capRelease = () => {};
  /** @type {ReturnType<typeof setTimeout> | undefined} */
  let capTimer;
  const capPage = await browser.newPage();
  try {
    capRelease = await openPending(capPage, SERVER('<div id="__next">', true));
    await capPage.evaluate(content => {
      const w = /** @type {any} */ (window);
      const script = document.createElement('script');
      script.textContent = content;
      const start = performance.now();
      document.head.append(script);
      w.capResult = w.TypesetReady.then(() => ({ at: Math.round(performance.now() - start), state: document.readyState, outcomes: [...document.querySelectorAll('p[data-typeset]')].map(p => /** @type {HTMLElement} */ (p).dataset.tsOutcome || null) }));
    }, await readFile(artifacts.go, 'utf8'));
    capTimer = setTimeout(() => capRelease(), 11000);
  } catch (error) {
    errors.push({ browser: config.name, error: capLabel + ': ' + String(/** @type {Error} */ (error).stack || error) });
  }
  try {
    for (const [loader, file] of [['package go.js', artifacts.go], ...(hasAuto ? [['package auto.js', artifacts.auto]] : [])]) {
      const content = await readFile(file, 'utf8');
      for (const [variant, root, defer, pending] of /** @type {[string, string, string, boolean][]} */ ([['#__next', '<div id="__next">', '', false], ['#__next, load event pending', '<div id="__next">', '', true], ['#__next, data-typeset-defer="none"', '<div id="__next">', 'none', false], ['no marker, data-typeset-defer="hydration"', '<div id="app">', 'hydration', false]])) {
        const label = `${loader} hydration (${variant})`;
        /** @param {string} what @param {unknown} pass @param {unknown} [detail] */
        const check = (what, pass, detail) => checks.push({ browser: config.name, label: `${label}: ${what}`, pass: !!pass, ...(pass ? {} : { detail }) });
        const page = await browser.newPage();
        page.setDefaultTimeout(20000);
        let release = () => {};
        /** @type {ReturnType<typeof setTimeout> | undefined} */
        let releaseTimer;
        try {
          if (pending) {
            release = await openPending(page, SERVER(root, true));
            // The load event comes at about 1.5 s, after hydration (700 ms).
            releaseTimer = setTimeout(() => release(), 1500);
          } else await page.setContent(SERVER(root));
          const r = await page.evaluate(async ({ content, defer }) => {
            const w = /** @type {any} */ (window);
            const sleep = (/** @type {number} */ ms) => new Promise(resolve => setTimeout(resolve, ms));
            const paragraphs = /** @type {HTMLElement[]} */ ([...document.querySelectorAll('p[data-typeset]')]);
            const outcomes = () => paragraphs.map(p => p.dataset.tsOutcome || null);
            const script = document.createElement('script');
            if (defer) script.dataset.typesetDefer = defer;
            script.textContent = content;
            const start = performance.now();
            document.head.append(script);
            /** @type {string | null} */
            let stateAtReady = null, fontsState = null;
            document.fonts.ready.then(() => { fontsState = document.readyState; });
            const ready = w.TypesetReady.then(() => { stateAtReady = document.readyState; return performance.now() - start; });
            const settled = w.Typeset.whenSettled().then((/** @type {{ settled: boolean }} */ s) => ({ ...s, at: performance.now() - start, outcomes: outcomes() }));
            await sleep(400);
            const beforeRoot = outcomes();
            const root = /** @type {any} */ (document.body.firstElementChild);
            root['__reactContainer$e3'] = {};
            await sleep(300);
            const beforeFiber = outcomes();
            const hydratedAt = performance.now() - start;
            /** @type {any} */ (paragraphs[0])['__reactFiber$e3'] = {};
            /** @type {any} */ (document.querySelector('.html'))['__reactFiber$e3'] = {};
            const readyAt = await Promise.race([ready, sleep(3000).then(() => null)]);
            return { beforeRoot, beforeFiber, hydratedAt, readyAt, stateAtReady, fontsState, settled: await settled, after: outcomes() };
          }, { content, defer });
          const composed = composedAll;
          const untouched = (/** @type {(string | null)[]} */ list) => list.every(o => o === null);
          if (!defer) {
            check('nothing is composed before React hydrates, with the root marked or not', untouched(r.beforeRoot) && untouched(r.beforeFiber), r);
            check('composes once each server-rendered paragraph, or its ancestor, is hydrated', r.readyAt !== null && r.readyAt > r.hydratedAt && composed(r.after), r);
            check('whenSettled() waits for the hydration wait and the composition', r.settled.settled === true && r.settled.at > r.hydratedAt && composed(r.settled.outcomes), r.settled);
            if (pending) check('composes before the load event where document.fonts.ready resolves before it (Firefox; Chromium and WebKit resolve it at load)', r.fontsState !== 'interactive' || r.stateAtReady === 'interactive', r);
          } else {
            check('composes without waiting for hydration', r.readyAt !== null && r.readyAt < 400 && composed(r.beforeRoot), r);
            check('whenSettled() resolves once composed', r.settled.settled === true && composed(r.settled.outcomes), r.settled);
          }
        } catch (error) {
          errors.push({ browser: config.name, error: label + ': ' + String(/** @type {Error} */ (error).stack || error) });
        } finally {
          clearTimeout(releaseTimer);
          release();
          await page.close();
        }
      }
    }
    try {
      const cap = await capPage.evaluate(() => Promise.race([/** @type {any} */ (window).capResult, new Promise(resolve => setTimeout(() => resolve(null), 15000))]));
      const pass = cap !== null && cap.at >= 9900 && cap.at < 12000 && composedAll(cap.outcomes);
      checks.push({ browser: config.name, label: `${capLabel}: composes by 12 s, the 10 s cap running from the loader's start (Chromium and WebKit at load, as document.fonts.ready waits for it)`, pass, ...(pass ? {} : { detail: cap }) });
    } catch (error) {
      errors.push({ browser: config.name, error: capLabel + ': ' + String(/** @type {Error} */ (error).stack || error) });
    }
  } finally {
    clearTimeout(capTimer);
    capRelease();
    await browser.close();
  }
}

const failures = checks.filter(c => !c.pass);
await writeFile('output/loaders.json', JSON.stringify({ version, loaders: Object.fromEntries(loaders), autoLoader: hasAuto ? artifacts.auto : 'absent (dist predates 4.3)', checks, errors }, null, 2));
console.log(JSON.stringify({ version, loaderChecks: checks.length, failures, errors }, null, 2));
if (failures.length || errors.length) process.exitCode = 1;
