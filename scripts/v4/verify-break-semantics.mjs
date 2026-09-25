// @ts-check
// Generated breaks as assistive technology sees them (C2).
//
// A composed line ends at a generated <br>; the source space before it
// collapses at the line end, so the <br> is the only word separator left. It
// must stay in the accessibility tree. A break after a hyphen or dash
// separates no words and stays hidden, or 'public-health' would be read as
// two words. Spacing and hanging markers are empty, aria-hidden and
// display:inline: inline-block made Chromium drop the word space beside them.
//
// This suite checks that markup in the DOM and React renderers, that the
// semantic change paints nothing (screenshots at DPR 2 and line boxes are
// identical with the 4.2 marker semantics put back), and that the legacy
// renderFrozenLines export sets no role and runs under Trusted Types.
// verify-native-ax.mjs reads the engines' real accessibility trees.
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { build } from 'esbuild';
import { browsers } from './browsers.mjs';
import { artifacts } from './candidate.mjs';

const watchdog = setTimeout(() => { console.error('verify-break-semantics: watchdog'); process.exit(3); }, 170_000);
watchdog.unref();

const bundle = await readFile(artifacts.bundle, 'utf8');
const react = (await build({
  stdin: { contents: `
import { createElement as h } from 'react';
import { createRoot } from 'react-dom/client';
import { TypesetRichText } from ${JSON.stringify(resolve(artifacts.react))};
createRoot(document.getElementById('react')).render(h('div', null,
  h(TypesetRichText, { id: 'r1', lang: 'en', smartQuotes: 'en' }, h('span', null, 'The public-health team kept a quarter-century archive of eighty-seven campaigns, and ', h('a', { href: '#archive' }, 'the neighborhood archive is open'), ' to anyone who asks at the desk.')),
  h(TypesetRichText, { id: 'r2', lang: 'en', opticalHanging: true }, h('span', null, '"Read ', h('em', null, 'the careful notes'), ' in the gallery guide before you plan a visit," she said, "because the hours change."'))));
`, resolveDir: process.cwd(), loader: 'js' }, bundle: true, write: false, format: 'iife', target: 'es2022', define: { 'process.env.NODE_ENV': '"production"' }, logLevel: 'silent',
})).outputFiles[0].text;

const PAGE = `<!doctype html><html lang="en"><head><meta charset="utf-8"><style>
body{margin:16px;background:#fff;color:#111;font:18px/1.5 Georgia}main,#react{width:300px}p{margin:0 0 14px}h2{font:600 24px/1.25 Georgia;margin:0 0 12px}a{color:#146044}
</style></head><body><main>
<h2 id="h">The quiet economics of <a href="#bakeries">neighborhood bakeries</a> and their morning regulars</h2>
<p id="p1">Every morning the corner shop puts out a small chalkboard with the day's price tag for bread, and the regulars read it before they even say hello to anyone behind the counter.</p>
<p id="p2">Read the <em>careful</em> notes in <a href="#guide">the neighborhood gallery guide</a> before you plan a visit, because the opening hours change with the seasons and the weather.</p>
<p id="p3">The public-health team kept a quarter-century archive of eighty-seven campaigns in a well-lit room, and the county's long-term plan keeps it open to anyone who asks.</p>
<p id="p4">"Parenthetical openings and <a href="#caps">Capital letters</a> can hang into the margin when optical alignment is on," the designer said, "which the website loader enables."</p>
</main><div id="react"></div><script src="/typeset.js"></script><script src="/react.js"></script></body></html>`;

// Trusted Types with no policy rejects every HTML sink, as a strict site would.
const LEGACY = `<!doctype html><html lang="en"><head><meta charset="utf-8"><style>body{margin:16px;font:20px/1.3 Georgia}h2{width:260px;font-size:24px}</style></head>
<body><h2 id="legacy">The Quiet Economics of Neighborhood Bakeries and Their Morning Regulars</h2><script src="/typeset.js"></script></body></html>`;

/** @type {{ browser: string, label: string, pass: boolean, detail?: unknown }[]} */
const checks = [];
/** @type {{ browser: string, error: string }[]} */
const errors = [];

/** Accessible name of #id, from the engine's own tree. @param {import('playwright').Page} page @param {string} name @param {string} id */
async function accessibleName(page, name, id) {
  if (name === 'chromium') {
    const cdp = await page.context().newCDPSession(page);
    const { root } = await cdp.send('DOM.getDocument', { depth: -1 });
    const { nodeId } = await cdp.send('DOM.querySelector', { nodeId: root.nodeId, selector: '#' + id });
    const { nodes } = await cdp.send('Accessibility.getPartialAXTree', { nodeId, fetchRelatives: false });
    await cdp.detach();
    return nodes[0]?.name?.value ?? '';
  }
  if (name === 'webkit') {
    const anyPage = /** @type {any} */ (page);
    const impl = anyPage._connection?.toImpl?.(page);
    const session = impl?.delegate?._session ?? impl?._delegate?._session;
    if (!session) return null;
    const { root } = await session.send('DOM.getDocument');
    const { nodeId } = await session.send('DOM.querySelector', { nodeId: root.nodeId, selector: '#' + id });
    const { properties } = await session.send('DOM.getAccessibilityPropertiesForNode', { nodeId });
    return properties?.label ?? '';
  }
  return null;
}

for (const config of browsers) {
  const browser = await config.engine.launch({ executablePath: config.executablePath, timeout: 20000 });
  /** @param {string} label @param {unknown} pass @param {unknown} [detail] */
  const check = (label, pass, detail) => checks.push({ browser: config.name, label, pass: !!pass, ...(detail === undefined ? {} : { detail }) });
  try {
    const context = await browser.newContext({ viewport: { width: 380, height: 1400 }, deviceScaleFactor: 2 });
    await context.route('http://breaks.test/**', route => {
      const path = new URL(route.request().url()).pathname;
      if (path === '/typeset.js') return route.fulfill({ contentType: 'text/javascript', body: bundle });
      if (path === '/react.js') return route.fulfill({ contentType: 'text/javascript', body: react });
      if (path === '/legacy-tt') return route.fulfill({ contentType: 'text/html; charset=utf-8', headers: { 'Content-Security-Policy': "require-trusted-types-for 'script'; trusted-types 'none'" }, body: LEGACY });
      if (path === '/legacy') return route.fulfill({ contentType: 'text/html; charset=utf-8', body: LEGACY });
      return route.fulfill({ contentType: 'text/html; charset=utf-8', body: PAGE });
    });
    const page = await context.newPage();
    page.setDefaultTimeout(20000);
    page.on('pageerror', error => errors.push({ browser: config.name, error: error.message }));
    for (const [configName, options] of /** @type {const} */ ([['defaults', {}], ['website-go', { smartQuotes: 'en', opticalHanging: true }]])) {
      await page.goto('http://breaks.test/page');
      await page.evaluate(async options => { const c = window.Typeset.mount(document, 'main p, main h2', options); await c.ready; }, options);
      await page.waitForFunction(() => ['r1', 'r2'].every(id => document.getElementById(id)?.dataset.tsOutcome) && document.getElementById('r1')?.dataset.tsTracking !== 'native:tracking-uncomposed');
      await page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))));
      const facts = await page.evaluate(() => {
        const blocks = [...document.querySelectorAll('main p, main h2, #react p')].map(el => {
          const breaks = [...el.querySelectorAll('br[data-ts-break]')].map(br => {
            const range = document.createRange(); range.setStart(el, 0); range.setEndBefore(br);
            return { space: /\s$/u.test(range.toString()), hidden: br.getAttribute('aria-hidden') === 'true' };
          });
          const markers = [...el.querySelectorAll('[data-ts-space], [data-ts-hang]')].map(m => ({ hidden: m.getAttribute('aria-hidden') === 'true', display: getComputedStyle(m).display }));
          return { id: el.id, outcome: /** @type {HTMLElement} */ (el).dataset.tsOutcome, breaks, markers };
        });
        return { blocks, audit: window.Typeset.auditJSON('main p, main h2, #react p') };
      });
      const where = `${configName}:`;
      const breaks = facts.blocks.flatMap(b => b.breaks), markers = facts.blocks.flatMap(b => b.markers);
      check(`${where} every block composes with generated breaks`, facts.blocks.every(b => b.outcome === 'composed:rich' && b.breaks.length), facts.blocks.map(b => [b.id, b.outcome, b.breaks.length]));
      check(`${where} a break that replaces a space is exposed to assistive technology`, breaks.filter(b => b.space).length > 10 && breaks.every(b => !b.space || !b.hidden), breaks.filter(b => b.space && b.hidden).length);
      check(`${where} a break after a hyphen stays hidden`, breaks.some(b => !b.space) && breaks.every(b => b.space || b.hidden), breaks.filter(b => !b.space).length);
      check(`${where} spacing and hanging markers are hidden and display:inline`, markers.length > 0 && markers.every(m => m.hidden && m.display === 'inline'), { markers: markers.length, wrong: markers.filter(m => !m.hidden || m.display !== 'inline').slice(0, 3) });
      if (configName === 'website-go') check(`${where} hanging markers are present`, facts.blocks.some(b => b.markers.length) && await page.locator('[data-ts-hang]').count() > 0);
      const issues = facts.audit.issues.filter(i => ['hidden-break', 'isolated-space'].includes(i.type));
      check(`${where} auditJSON reports no hidden break or isolated space, and passes`, !issues.length && facts.audit.pass, { issues, errors: facts.audit.errors });
      // Put the 4.2 marker semantics back and compare pixels and line boxes.
      const shoot = async () => ({ main: await page.locator('main').screenshot(), react: await page.locator('#react').screenshot(),
        lines: await page.evaluate(() => [...document.querySelectorAll('main p, main h2, #react p')].map(el => window.Typeset.measureLayout(/** @type {HTMLElement} */ (el)).lines.map(l => [l.sourceStart, l.sourceEnd, l.left, l.top, l.width]))) });
      const now = await shoot();
      await page.evaluate(() => {
        for (const br of document.querySelectorAll('br[data-ts-break]')) br.setAttribute('aria-hidden', 'true');
        for (const marker of document.querySelectorAll('[data-ts-space], [data-ts-hang]')) /** @type {HTMLElement} */ (marker).style.setProperty('display', 'inline-block');
      });
      const before = await shoot();
      check(`${where} exposing breaks and inline markers paints identically (DOM, DPR 2)`, now.main.equals(before.main));
      check(`${where} exposing breaks and inline markers paints identically (React, DPR 2)`, now.react.equals(before.react));
      check(`${where} exposing breaks and inline markers keeps every line box`, JSON.stringify(now.lines) === JSON.stringify(before.lines));
    }
    // The v3 renderer export: no role, no HTML sink.
    for (const path of ['legacy-tt', 'legacy']) {
      await page.goto('http://breaks.test/' + path);
      const legacy = await page.evaluate(() => {
        const el = /** @type {HTMLElement} */ (document.getElementById('legacy'));
        const source = el.textContent || '';
        const context = /** @type {CanvasRenderingContext2D} */ (document.createElement('canvas').getContext('2d'));
        context.font = getComputedStyle(el).font;
        const measure = (/** @type {string} */ text) => context.measureText(text).width;
        const T = /** @type {any} */ (window.Typeset);
        const lines = T.composeParagraph(T.tokenize(source, measure), el.clientWidth, el.clientWidth / measure('0'), { isHeading: true });
        let error = null;
        try { T.renderFrozenLines(el, lines); } catch (e) { error = String(e); }
        return { error, lines: el.querySelectorAll('.ts-line').length, role: el.getAttribute('role'), text: (el.textContent || '').replace(/\s+/g, ' ').trim(), source };
      });
      if (path === 'legacy-tt') { check('legacy renderFrozenLines runs under Trusted Types with no policy', legacy.error === null && legacy.lines > 1, legacy); continue; }
      check('legacy renderFrozenLines sets no role and keeps the words', legacy.error === null && legacy.lines > 1 && legacy.role === null && legacy.text === legacy.source, legacy);
      const name = await accessibleName(page, config.name, 'legacy');
      if (name !== null) check('legacy renderFrozenLines keeps the heading name', name.replace(/\s+/g, ' ').trim() === legacy.source, name);
    }
    await context.close();
  } catch (error) {
    errors.push({ browser: config.name, error: String(/** @type {Error} */ (error).stack || error) });
  } finally { await browser.close(); }
}

const failures = checks.filter(c => !c.pass);
await writeFile('output/break-semantics.json', JSON.stringify({ bundle: artifacts.bundle, react: artifacts.react, checks, errors }, null, 2));
console.log(JSON.stringify({ checks: checks.length, failed: failures.length, failures, errors }, null, 2));
if (failures.length || errors.length) process.exitCode = 1;
