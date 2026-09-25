// @ts-check
// Strict CSP and Trusted Types (C5).
//
// Banks, health and government sites serve "style-src 'self'" without
// 'unsafe-inline', and often "require-trusted-types-for 'script'". Under that
// policy a write to the style attribute is refused. 4.2 restored measurement
// styles with setAttribute('style', saved), so Chromium and WebKit kept
// white-space:nowrap on the paragraph and Firefox erased the author's CSSOM
// styles, with a CSP error on every pass.
//
// Each engine loads the same page twice, with and without the policy, runs
// typeset, a width change, recomposition, a declined composition, the copy
// handler, restore, mount() through go.js and both React adapters, and
// compares: no securitypolicyviolation event, author CSSOM width and colour
// intact, no nowrap, white-space-collapse or text-wrap residue in any style
// attribute, and the same outcomes as without the policy.
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { build } from 'esbuild';
import { browsers } from './browsers.mjs';
import { artifacts } from './candidate.mjs';

const watchdog = setTimeout(() => { console.error('verify-strict-csp: watchdog'); process.exit(3); }, 170_000);
watchdog.unref();

const POLICY = "default-src 'self'; style-src 'self'; script-src 'self'; require-trusted-types-for 'script'; trusted-types 'none'";
const files = {
  '/typeset.js': await readFile(artifacts.bundle, 'utf8'),
  '/go.js': await readFile(artifacts.go, 'utf8'),
  '/react.js': (await build({ stdin: { contents: `
import { createElement as h } from 'react';
import { createRoot } from 'react-dom/client';
import { TypesetText, TypesetRichText } from ${JSON.stringify(resolve(artifacts.react))};
createRoot(document.getElementById('react')).render(h('div', null,
  h(TypesetText, { id: 'rt', lang: 'en', smartQuotes: 'en', text: "The browser fills each line until the next word does not fit, then breaks, and the reader's eye pays for it." }),
  h(TypesetRichText, { id: 'rr', lang: 'en', style: { color: 'rgb(30, 30, 30)' } }, h('span', null, 'Read the ', h('a', { href: '#guide', style: { color: 'rgb(20, 96, 68)' } }, 'neighborhood gallery guide'), ' before you plan a visit, because the opening hours change with the seasons.'))));
`, resolveDir: process.cwd(), loader: 'js' }, bundle: true, write: false, format: 'iife', target: 'es2022', define: { 'process.env.NODE_ENV': '"production"' }, logLevel: 'silent' })).outputFiles[0].text,
  // Same-origin scripts only: the policy refuses inline script.
  '/listen.js': `window.violations = []; document.addEventListener('securitypolicyviolation', e => violations.push({ directive: e.violatedDirective, sample: e.sample, blocked: e.blockedURI }));`,
  '/setup.js': `for (const p of document.querySelectorAll('main p')) { p.style.width = '300px'; p.style.color = 'rgb(20, 20, 20)'; }
for (const a of document.querySelectorAll('main a')) a.style.color = 'rgb(20, 96, 68)';`,
  '/styles.css': `body{margin:16px;background:#fff;font:18px/1.5 Georgia}p{margin:0 0 14px}h2{font:600 24px/1.25 Georgia;width:300px}#react,#auto{width:300px}`,
};
const PAGE = `<!doctype html><html lang="en"><head><meta charset="utf-8"><script src="/listen.js"></script><link rel="stylesheet" href="/styles.css"></head><body><main>
<p id="p1">Every morning the corner shop puts out a small chalkboard with the day's price tag for bread, and the regulars read it before they even say hello to anyone behind the counter.</p>
<p id="p2">Read the <em>careful</em> notes in <a href="#guide">the neighborhood gallery guide</a> before you plan a visit, because the opening hours change with the seasons and the weather.</p>
<p id="p3">Our volunteers built <a href="#wellness">a wellness data dashboard for every clinic in the county</a> and published the results openly for anyone to review at any time.</p>
</main><div id="auto"><p data-typeset id="g1">"The room rewards a second look," says <a href="#artist">the artist</a>. "There is always another detail to discover in the corners of the frame."</p></div>
<div id="react"></div><script src="/setup.js"></script><script src="/typeset.js"></script><script src="/react.js"></script></body></html>`;
const GO = PAGE.replace('<script src="/typeset.js"></script>', '<script src="/go.js" data-typeset-smart-quotes="en" data-typeset-optical-hanging="true"></script>');

/** @type {{ browser: string, label: string, pass: boolean, detail?: unknown }[]} */
const checks = [];
/** @type {{ browser: string, error: string }[]} */
const errors = [];

/** The whole flow, returning outcomes and every residue it finds. */
function flow() {
  const T = /** @type {any} */ (window).Typeset;
  // Engine output (tracking wrappers reset with all:unset) is not author residue.
  const residue = (/** @type {Element} */ el) => !el.matches('[data-ts-track], [data-ts-break]') && /nowrap|white-space-collapse|text-wrap/.test(el.getAttribute('style') || '');
  const styles = () => [...document.querySelectorAll('main p, main a, main em')].map(el => el.getAttribute('style'));
  const out = /** @type {Record<string, unknown>} */ ({});
  const p1 = /** @type {HTMLElement} */ (document.getElementById('p1')), p2 = /** @type {HTMLElement} */ (document.getElementById('p2')), p3 = /** @type {HTMLElement} */ (document.getElementById('p3'));
  const before = styles();
  out.first = [p1, p2, p3].map(p => T.typeset(p, { smartQuotes: 'en', opticalHanging: true }).outcome);
  for (const p of [p1, p2, p3]) p.style.width = '260px';
  out.resized = [p1, p2, p3].map(p => T.typeset(p, { smartQuotes: 'en', opticalHanging: true }).outcome);
  out.recomposed = [p1, p2, p3].map(p => T.typeset(p, { smartQuotes: 'en', opticalHanging: true, density: 'editorial' }).outcome);
  // Copy across two composed paragraphs: the handler hides markers for its read.
  const texts = (/** @type {Node} */ el) => { const w = document.createTreeWalker(el, NodeFilter.SHOW_TEXT), found = []; while (w.nextNode()) if (/\S/.test(/** @type {Text} */ (w.currentNode).data)) found.push(w.currentNode); return found; };
  const range = document.createRange(); range.setStart(texts(p1)[0], 5); range.setEnd(/** @type {Node} */ (texts(p3).at(-1)), 4);
  getSelection()?.removeAllRanges(); getSelection()?.addRange(range);
  const copy = new ClipboardEvent('copy', { bubbles: true, cancelable: true, clipboardData: new DataTransfer() }); p1.dispatchEvent(copy);
  out.copied = copy.defaultPrevented && /* The words either side of each break keep their space. */ /corner shop puts out/.test(copy.clipboardData?.getData('text/plain') || '');
  getSelection()?.removeAllRanges();
  out.composedResidue = [p1, p2, p3].some(p => [...p.querySelectorAll('*')].some(residue)) || [p1, p2, p3].some(p => /nowrap|white-space-collapse/.test(p.getAttribute('style') || ''));
  for (const p of [p1, p2, p3]) T.restore(p);
  for (const p of [p1, p2, p3]) p.style.width = '300px';
  out.restoredStyles = JSON.stringify(styles()) === JSON.stringify(before) ? true : { before, after: styles() };
  // A declined composition overrides and restores too (native:no-candidate).
  out.declined = T.typeset(p1, { maxLines: 2 }).outcome;
  out.declinedResidue = residue(p1) || [...p1.querySelectorAll('*')].some(residue);
  out.declinedWhiteSpace = getComputedStyle(p1).whiteSpace;
  T.restore(p1);
  out.author = [p1, p2, p3].map(p => [getComputedStyle(p).width, getComputedStyle(p).color, getComputedStyle(p).whiteSpace]);
  out.links = [...document.querySelectorAll('main a')].map(a => [getComputedStyle(a).color, getComputedStyle(a).whiteSpace]);
  out.finalResidue = [...document.querySelectorAll('main *')].some(residue);
  return out;
}

for (const config of browsers) {
  const browser = await config.engine.launch({ executablePath: config.executablePath, timeout: 20000 });
  /** @param {string} label @param {unknown} pass @param {unknown} [detail] */
  const check = (label, pass, detail) => checks.push({ browser: config.name, label, pass: !!pass, ...(detail === undefined ? {} : { detail }) });
  try {
    /** @type {Record<string, any>} */
    const runs = {};
    for (const policy of [true, false]) {
      const context = await browser.newContext({ viewport: { width: 420, height: 1200 } });
      await context.route('http://csp.test/**', route => {
        const path = new URL(route.request().url()).pathname;
        const headers = policy ? { 'Content-Security-Policy': POLICY } : undefined;
        if (path in files) return route.fulfill({ contentType: path.endsWith('.css') ? 'text/css' : 'text/javascript', body: /** @type {Record<string, string>} */ (files)[path] });
        return route.fulfill({ contentType: 'text/html; charset=utf-8', headers, body: path === '/go' ? GO : PAGE });
      });
      const page = await context.newPage();
      page.setDefaultTimeout(20000);
      page.on('pageerror', error => errors.push({ browser: config.name, error: `${policy ? 'csp' : 'plain'}: ${error.message}` }));
      await page.goto('http://csp.test/page');
      await page.evaluate(() => document.fonts.ready);
      await page.waitForFunction(() => ['rt', 'rr'].every(id => document.getElementById(id)?.dataset.tsOutcome));
      const result = await page.evaluate(flow);
      const react = await page.evaluate(() => ['rt', 'rr'].map(id => { const el = /** @type {HTMLElement} */ (document.getElementById(id)); return [el.dataset.tsOutcome, el.dataset.tsSpacing, getComputedStyle(el).whiteSpace]; }));
      await page.goto('http://csp.test/go');
      const go = await page.evaluate(async () => {
        const controller = await /** @type {any} */ (window).TypesetReady;
        const g1 = /** @type {HTMLElement} */ (document.getElementById('g1'));
        const outcome = [g1.dataset.tsOutcome, g1.dataset.tsQuotes, g1.dataset.tsHanging, g1.dataset.tsSpacing];
        g1.style.width = '240px';
        await new Promise(r => setTimeout(r, 400));
        const resized = g1.dataset.tsOutcome;
        controller.disconnect();
        return { outcome, resized, residue: [g1, ...g1.querySelectorAll('*')].some(el => /nowrap|white-space-collapse|text-wrap/.test(el.getAttribute('style') || '')), whiteSpace: getComputedStyle(g1).whiteSpace, width: getComputedStyle(g1).width };
      });
      const violations = await page.evaluate(() => /** @type {any} */ (window).violations);
      await page.goto('http://csp.test/page');
      await page.waitForFunction(() => ['rt', 'rr'].every(id => document.getElementById(id)?.dataset.tsOutcome));
      const violationsPage = await page.evaluate(async () => { await new Promise(r => setTimeout(r, 300)); return /** @type {any} */ (window).violations; });
      runs[policy ? 'csp' : 'plain'] = { result, react, go, violations: [...violations, ...violationsPage] };
      await context.close();
    }
    const { csp, plain } = runs;
    check('strict CSP: no securitypolicyviolation events', csp.violations.length === 0, csp.violations.slice(0, 5));
    check('strict CSP: the paragraphs compose as they do without the policy', JSON.stringify([csp.result.first, csp.result.resized, csp.result.recomposed, csp.result.declined]) === JSON.stringify([plain.result.first, plain.result.resized, plain.result.recomposed, plain.result.declined])
      && csp.result.first.every((/** @type {string} */ o) => o === 'composed:rich'), { csp: [csp.result.first, csp.result.resized, csp.result.declined], plain: [plain.result.first, plain.result.resized, plain.result.declined] });
    check('strict CSP: the copy handler serializes across generated breaks', csp.result.copied === true);
    check('strict CSP: no nowrap or white-space residue while composed', csp.result.composedResidue === false);
    check('strict CSP: restore leaves every author style attribute as it was', csp.result.restoredStyles === true, csp.result.restoredStyles);
    check('strict CSP: a declined composition leaves no residue', csp.result.declined === 'native:no-candidate' && !csp.result.declinedResidue && csp.result.declinedWhiteSpace === 'normal', [csp.result.declined, csp.result.declinedResidue, csp.result.declinedWhiteSpace]);
    check('strict CSP: author CSSOM width and colour survive', JSON.stringify(csp.result.author) === JSON.stringify([['300px', 'rgb(20, 20, 20)', 'normal'], ['300px', 'rgb(20, 20, 20)', 'normal'], ['300px', 'rgb(20, 20, 20)', 'normal']])
      && csp.result.links.every((/** @type {string[]} */ l) => l[0] === 'rgb(20, 96, 68)' && l[1] === 'normal') && !csp.result.finalResidue, { author: csp.result.author, links: csp.result.links });
    check('strict CSP: the React adapters compose as without the policy', JSON.stringify(csp.react) === JSON.stringify(plain.react) && csp.react.every((/** @type {string[]} */ r) => r[0] === 'composed:rich' && r[2] === 'normal'), { csp: csp.react, plain: plain.react });
    check('strict CSP: go.js mounts, recomposes and disconnects cleanly', JSON.stringify(csp.go) === JSON.stringify(plain.go) && csp.go.outcome[0] === 'composed:rich' && !csp.go.residue && csp.go.whiteSpace === 'normal' && csp.go.width === '240px', { csp: csp.go, plain: plain.go });
    check('without the policy: the same flow leaves no residue either', plain.violations.length === 0 && plain.result.restoredStyles === true && !plain.result.finalResidue && !plain.go.residue);
  } catch (error) {
    errors.push({ browser: config.name, error: String(/** @type {Error} */ (error).stack || error) });
  } finally { await browser.close(); }
}

const failures = checks.filter(c => !c.pass);
await writeFile('output/strict-csp.json', JSON.stringify({ policy: POLICY, bundle: artifacts.bundle, checks, errors }, null, 2));
console.log(JSON.stringify({ checks: checks.length, failed: failures.length, failures, errors }, null, 2));
if (failures.length || errors.length) process.exitCode = 1;
