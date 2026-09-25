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
/** @param {import('playwright').Browser} browser @param {string} html @param {string} content */
async function load(browser, html, content) {
  const page = await browser.newPage();
  page.setDefaultTimeout(20000);
  /** @type {string[]} */
  const info = [];
  page.on('console', message => { if (message.type() === 'info') info.push(message.text()); });
  await page.setContent(html);
  await page.evaluate(content => { const script = document.createElement('script'); script.textContent = content; document.head.append(script); }, content);
  await page.evaluate(() => /** @type {any} */ (window).TypesetReady);
  await page.waitForTimeout(50);
  const state = await page.evaluate(() => [...document.body.querySelectorAll('*')].map(el => ({ tag: el.tagName, outcome: el.getAttribute('data-ts-outcome'), text: el.textContent })));
  return { page, info, state };
}
for (const config of browsers) {
  const browser = await config.engine.launch({ executablePath: config.executablePath });
  try {
    for (const [loader, file] of loaders) {
      const content = await readFile(file, 'utf8');
      for (const option of ['default', 'tracking', 'spacing']) {
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
          check('tracking ' + (option === 'default' ? 'applied' : 'off'), option === 'default' ? result.tracking === 'applied' : result.tracking === 'off', result.tracking);
          check('spacing ' + (option === 'spacing' ? 'off' : 'on'), option === 'spacing' ? result.spacing === 'off' : result.spacing !== 'off', result.spacing);
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
    const unmarked = await load(browser, PROSE, packageGo);
    check('package go.js without [data-typeset] targets logs one console.info that names [data-typeset] and auto.js', unmarked.info.length === 1 && /no element matches \[data-typeset\]/.test(unmarked.info[0]) && /auto/.test(unmarked.info[0]), unmarked.info);
    check('package go.js without targets composes nothing', unmarked.state.every(el => !el.outcome), unmarked.state.filter(el => el.outcome));
    await unmarked.page.close();
    const marked = await load(browser, PROSE.replace('<p>Your', '<p data-typeset>Your'), packageGo);
    check('package go.js with a [data-typeset] target logs nothing', marked.info.length === 0, marked.info);
    await marked.page.close();
  } catch (error) {
    errors.push({ browser: config.name, error: 'auto/notice: ' + String(/** @type {Error} */ (error).stack || error) });
  } finally { await browser.close(); }
}

const failures = checks.filter(c => !c.pass);
await writeFile('output/loaders.json', JSON.stringify({ version, loaders: Object.fromEntries(loaders), autoLoader: hasAuto ? artifacts.auto : 'absent (dist predates 4.3)', checks, errors }, null, 2));
console.log(JSON.stringify({ version, loaderChecks: checks.length, failures, errors }, null, 2));
if (failures.length || errors.length) process.exitCode = 1;
