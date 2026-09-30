// @ts-check
// Accessibility as the engines expose it, not as the DOM suggests.
//
// Playwright's ariaSnapshot is computed from the DOM with whitespace
// normalised, so it reads composed text exactly like native text even when
// the browser's own accessibility tree joins words. This oracle reads the real
// trees and compares them with the source:
//   Chromium  CDP Accessibility.getFullAXTree: the StaticText and LineBreak
//             text of every composed block, word by word, and every link and
//             heading name.
//   WebKit    Web Inspector DOM.getAccessibilityPropertiesForNode: every link
//             and heading name (WebKit exposes no block text through it).
//   Firefox   nsIAccessible through Marionette: block text and link and
//             heading names. Optional (--firefox, or TYPESET_AX_FIREFOX=1),
//             run in the nightly lane.
// Fixtures: the acceptance page, the promise corpus with links, emphasis and
// headings, TypesetText/TypesetRichText blocks, and the markup 4.4 composes
// with coverage: 'extended' (sup, sub, time, dfn, kbd, ins, visually hidden link text, a
// Spanish phrase, Greek letters), at 320, 375 and 768 px. The coverage
// blocks' words are compared with the Chromium tree's words before
// composition, which joins words at visually hidden text natively too.
// Two more lanes on the corpus: composed at 768 px and narrowed to 320 px
// (blocks far offscreen wait, stale, to be recomposed), and composed with an
// accessibility tree already live, as with a screen reader running, then
// released to a translator (Chromium never re-adds a word space it left out
// while it collapsed at a line end, so a fresh tree cannot see that defect).
// That lane skips WebKit, whose names join words at any soft wrap between two
// Text nodes (plain DOM does it too); released text keeps its Text nodes
// split at the former breaks until the translation ends.
//
// Negative control: the same oracle runs against the published 4.2.0 build
// (public/releases/4.2.0) and must find its joined words; a run that cannot
// see that defect proves nothing about the candidate.
import { readFile, writeFile } from 'node:fs/promises';
import { createServer } from 'node:net';
import { resolve } from 'node:path';
import { build } from 'esbuild';
import { browsers } from './browsers.mjs';
import { artifacts } from './candidate.mjs';
import { acceptanceFixture } from './acceptance-fixture.mjs';
import { marionette, GECKO_AX } from './marionette.mjs';
import { releaseIdentity } from './release-evidence.mjs';

const WIDTHS = [320, 375, 768];
const firefoxLane = process.argv.includes('--firefox') || process.env.TYPESET_AX_FIREFOX === '1';
const started = Date.now();
// test:v4 gives each suite 180 s; the optional Firefox lane runs on its own.
const limit = firefoxLane ? 540 : 170;
const watchdog = setTimeout(() => { console.error(`verify-native-ax: watchdog after ${limit} s`); process.exit(3); }, limit * 1000);
watchdog.unref();

/** @param {string} reactPath */
async function reactBundle(reactPath) {
  const contents = `
import { createElement as h } from 'react';
import { createRoot } from 'react-dom/client';
import { TypesetText, TypesetRichText } from ${JSON.stringify(resolve(reactPath))};
const rich = [
  ['r1', h('span', null, 'Read ', h('strong', null, "the curator's notes"), ' at ', h('a', { href: '#gallery' }, 'the neighborhood gallery guide'), ', then walk the long way home through the market before the stalls close for the evening.')],
  ['r2', h('span', null, 'Our ', h('em', null, 'wellness data'), ' shows the new price tag and a ', h('a', { href: '#signal' }, 'stop signal on every screen'), ' of the app today, which is why the redesign starts with the checkout.')],
  ['r3', h('span', null, 'Community clinics in ', h('a', { href: '#county' }, 'every county of the state'), ' now offer free testing on weekends, and ', h('em', null, 'no appointment'), ' is needed for walk-in visits.')],
];
const plain = [
  ['t1', 'Your browser does not know what a sentence is. It fills each line until the words run out, and calls that typography.'],
  ['t2', 'A word left alone on the last line looks abandoned, and a reader notices the gap long before noticing the craft.'],
];
function App() {
  return h('main', null,
    h(TypesetText, { id: 'th', as: 'h2', text: 'The web does not know how to break lines, and this script teaches it', lang: 'en' }),
    ...plain.map(([id, text]) => h(TypesetText, { key: id, id, text, lang: 'en', smartQuotes: 'en' })),
    ...rich.map(([id, children]) => h(TypesetRichText, { key: id, id, lang: 'en', smartQuotes: 'en' }, children)),
    h(TypesetRichText, { id: 'rh', as: 'h2', lang: 'en' }, h('span', null, 'Read the ', h('a', { href: '#guide' }, 'neighborhood gallery guide'), ' before the tour')));
}
createRoot(document.getElementById('root')).render(h(App));
`;
  const result = await build({ stdin: { contents, resolveDir: process.cwd(), loader: 'js' }, bundle: true, write: false, format: 'iife', target: 'es2022', define: { 'process.env.NODE_ENV': '"production"' }, logLevel: 'silent' });
  return result.outputFiles[0].text;
}

const corpus = JSON.parse(await readFile('tests/v4-corpus.json', 'utf8')).paragraphs.slice(0, 40);
/** @param {string} text */
const escape = text => text.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c] ?? c);
/** Corpus paragraphs, some with a link or emphasis over several words, and headings. */
function corpusHTML() {
  const blocks = corpus.map((/** @type {string} */ text, /** @type {number} */ i) => {
    const words = text.split(' ');
    if (i % 3 === 0 && words.length > 12) return `<p id="c${i}">${escape(words.slice(0, 3).join(' '))} <a href="#l${i}">${escape(words.slice(3, 8).join(' '))}</a> ${escape(words.slice(8).join(' '))}</p>`;
    if (i % 3 === 1 && words.length > 12) return `<p id="c${i}">${escape(words.slice(0, 2).join(' '))} <em>${escape(words.slice(2, 6).join(' '))}</em> ${escape(words.slice(6).join(' '))}</p>`;
    return `<p id="c${i}">${escape(text)}</p>`;
  });
  const headings = corpus.slice(0, 6).map((/** @type {string} */ text, /** @type {number} */ i) => {
    const words = text.split(' ').slice(0, 11);
    return i === 0 ? `<h2 id="h${i}">${escape(words.slice(0, 3).join(' '))} <a href="#hl">${escape(words.slice(3, 8).join(' '))}</a> ${escape(words.slice(8).join(' '))}</h2>` : `<h2 id="h${i}">${escape(words.join(' '))}</h2>`;
  });
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><style>body{margin:16px;font:18px/1.5 Georgia;color:#111}h2{font:600 24px/1.25 Georgia}p{margin:0 0 14px;text-wrap:wrap}</style></head><body><main>${headings.slice(0, 3).join('')}${blocks.slice(0, 20).join('')}${headings.slice(3).join('')}${blocks.slice(20).join('')}</main>
<script src="/typeset.js"></script><script>window.composeAll=()=>{const c=Typeset.mount(document,'main p, main h2',{smartQuotes:'en'});return c.ready;};</script></body></html>`;
}

/** Markup 4.4 composes with coverage: 'extended' (opt-in) that 4.3 left
 * native: sup and sub, time, dfn, kbd, ins, visually hidden link text, a
 * phrase in another language, and Greek letters in English (which compose
 * under the default too). The fixture passes coverage: 'extended'; 4.2.0,
 * the negative control, ignores the option. */
function coverageHTML() {
  const sr = 'position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0';
  const blocks = [
    'The clinic on Market Street offers free testing on Saturdays, and results arrive by text message within two days.<sup>1</sup> Bring a photo ID and arrive a few minutes before your appointment.',
    'Drink water through the day; plain H<sub>2</sub>O is the best choice for most people, and the nurse can suggest how much to aim for in hot weather.',
    'The walk-in hours start at <time datetime="09:00">9 a.m.</time> on weekdays and run until the last visitor has been seen, which is usually by early evening.',
    'To make the text on this page larger, press <kbd>Ctrl</kbd> and the plus key together, and press them again until the size feels comfortable to read.',
    'A <dfn>walk-in visit</dfn> needs no appointment, and <ins>as of this month</ins> the clinic also takes walk-in visits for vaccines on Saturday mornings.',
    `The clinic offers free testing on Saturdays, and results arrive by text message within two days. <a href="#hours">Read more<span style="${sr}"> about testing hours</span></a> on the clinic page before you come.`,
    `<a href="#guide"><span style="${sr}">Printable </span>Guide to the clinic</a> in English and Spanish, with the hours, the bus stops and a map of the parking lot for every visitor.`,
    'Staff greet every visitor with <span lang="es">bienvenidos a la clínica</span> and hand out a printed guide in both languages at the front desk.',
    'The usual starting dose is 5 μg/mL, given once a day with food, and the pharmacist will check the label with you before the first dose.',
  ];
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><style>body{margin:16px;font:18px/1.5 Georgia;color:#111}p{margin:0 0 14px;text-wrap:wrap}</style></head><body><main>${blocks.map((html, i) => `<p id="v${i}">${html}</p>`).join('')}</main>
<script src="/typeset.js"></script><script>window.composeAll=()=>{const c=Typeset.mount(document,'main p',{coverage:'extended'});return c.ready;};</script></body></html>`;
}

const acceptance = await acceptanceFixture();
const acceptanceHTML = await (await fetch(acceptance.url)).text();
await acceptance.close();

const SUBJECTS = [
  { key: 'candidate', label: 'candidate', bundle: artifacts.bundle, react: artifacts.react },
  { key: 'control', label: 'negative control 4.2.0', bundle: 'public/releases/4.2.0/typeset.global.js', react: 'public/releases/4.2.0/react.js' },
];
for (const subject of SUBJECTS) Object.assign(subject, { bundleText: await readFile(subject.bundle, 'utf8'), reactText: await reactBundle(subject.react) });

/** axReference: compare a composed block's words with the Chromium tree's
 * words for the same block before composition, not with its source words.
 * Chromium's tree joins the words on either side of visually hidden
 * (out-of-flow) text natively too ("Read more" + "about testing hours").
 * @typedef {{ name: string, html: () => string, compose: string | null, blocks: string, widths?: number[], narrowTo?: number, live?: boolean, translate?: boolean, engines?: string[], axReference?: boolean }} Fixture */
/** @type {Fixture[]} */
const FIXTURES = [
  { name: 'acceptance', html: () => acceptanceHTML, compose: 'compose', blocks: '[data-compose]' },
  { name: 'corpus', html: corpusHTML, compose: 'composeAll', blocks: 'main p, main h2' },
  { name: 'react', html: () => '<!doctype html><html lang="en"><head><meta charset="utf-8"><style>body{margin:16px;font:18px/1.5 Georgia}h2{font:600 24px/1.25 Georgia}p{margin:0 0 14px}</style></head><body><div id="root"></div><script src="/react-fixture.js"></script></body></html>', compose: null, blocks: '#root p, #root h2' },
  { name: 'coverage', html: coverageHTML, compose: 'composeAll', blocks: 'main p', axReference: true },
  { name: 'corpus-narrowed', html: corpusHTML, compose: 'composeAll', blocks: 'main p, main h2', widths: [768], narrowTo: 320 },
  { name: 'corpus-translated-live', html: corpusHTML, compose: 'composeAll', blocks: 'main p, main h2', widths: [320, 768], live: true, translate: true, engines: ['chromium', 'firefox'] },
];

const identity = await releaseIdentity();
/** @type {{ browser: string, label: string, pass: boolean, detail?: unknown }[]} */
const checks = [];
/** @type {{ browser: string, error: string }[]} */
const errors = [];
/** @type {Record<string, { unmatchedWords: number, blocks: number, linkMismatches: number, headingMismatches: number, links: number, headings: number, samples: unknown[] }>} */
const tallies = {};

/** @param {string} text */
const words = text => text.split(/\s+/u).filter(Boolean);
/** @param {string} text */
const normal = text => text.replace(/\s+/gu, ' ').trim();
/** Words present in the AX text but not in the source: joined words ('galleryguide') or split ones ('public-' 'health'). @param {string[]} ax @param {string[]} source */
function unmatched(ax, source) {
  const pool = new Map();
  for (const w of source) pool.set(w, (pool.get(w) ?? 0) + 1);
  const out = [];
  for (const w of ax) { if (pool.get(w)) pool.set(w, pool.get(w) - 1); else out.push(w); }
  return out;
}

// Playwright's Firefox listens for Marionette on the default port whatever
// marionette.port says, so the Firefox lane needs 2828 free and runs alone.
const MARIONETTE_PORT = 2828;
async function portFree(/** @type {number} */ port) {
  const server = createServer();
  const free = await new Promise(resolve => { server.once('error', () => resolve(false)); server.listen(port, '127.0.0.1', () => resolve(true)); });
  if (free) await new Promise(resolve => server.close(() => resolve(undefined)));
  return free;
}

/**
 * Read the page's blocks, links and headings from the DOM, tagging each with
 * an id the accessibility readers can find.
 * @param {import('playwright').Page} page @param {string} selector
 */
async function domFacts(page, selector) {
  return page.evaluate(selector => {
    let n = 0;
    const tag = (/** @type {Element} */ el) => { if (!el.id) el.id = 'ax-' + (++n); return el.id; };
    const blocks = [...document.querySelectorAll(selector)].filter(el => (el.textContent || '').trim()).map(el => ({ id: tag(el), tag: el.tagName.toLowerCase(), outcome: /** @type {HTMLElement} */ (el).dataset.tsOutcome ?? null, breaks: el.querySelectorAll('br[data-ts-break]').length, text: el.textContent || '' }));
    const links = [...document.querySelectorAll(selector)].flatMap(el => [...el.querySelectorAll('a')]).map(a => ({ id: tag(a), text: a.textContent || '' }));
    const headings = blocks.filter(b => /^h[1-6]$/.test(b.tag)).map(b => ({ id: b.id, text: b.text }));
    return { blocks, links, headings };
  }, selector);
}

/** @param {import('playwright').Page} page @param {string[]} ids @param {import('playwright').CDPSession} [live] a session whose tree has been live since before composition */
async function chromiumAX(page, ids, live) {
  const cdp = live ?? await page.context().newCDPSession(page);
  if (!live) await cdp.send('Accessibility.enable');
  const { root } = await cdp.send('DOM.getDocument', { depth: -1 });
  /** @type {Map<string, number>} */
  const backend = new Map();
  const visit = (/** @type {any} */ node) => {
    const attributes = node.attributes ?? [];
    for (let i = 0; i < attributes.length; i += 2) if (attributes[i] === 'id' && ids.includes(attributes[i + 1])) backend.set(attributes[i + 1], node.backendNodeId);
    for (const child of node.children ?? []) visit(child);
  };
  visit(root);
  const { nodes } = await cdp.send('Accessibility.getFullAXTree');
  const byId = new Map(nodes.map(node => [node.nodeId, node]));
  const byBackend = new Map(nodes.filter(node => node.backendDOMNodeId).map(node => [node.backendDOMNodeId, node]));
  /** @type {Record<string, { text: string, name: string }>} */
  const out = {};
  for (const id of ids) {
    const start = byBackend.get(backend.get(id));
    if (!start) { out[id] = { text: '', name: '' }; continue; }
    const parts = [];
    const walk = (/** @type {any} */ node) => {
      const role = node.role?.value;
      if (!node.ignored) {
        if (role === 'StaticText') parts.push(node.name?.value ?? '');
        else if (role === 'LineBreak') parts.push('\n');
      }
      if (role === 'InlineTextBox') return;
      for (const child of node.childIds ?? []) { const c = byId.get(child); if (c) walk(c); }
    };
    walk(start);
    out[id] = { text: parts.join(''), name: start.name?.value ?? '' };
  }
  if (!live) await cdp.detach();
  return out;
}

/** @param {import('playwright').Page} page @param {string[]} ids */
async function webkitNames(page, ids) {
  // Playwright exposes WebKit's inspector protocol only in-process.
  const anyPage = /** @type {any} */ (page);
  const impl = anyPage._connection?.toImpl?.(page);
  const session = impl?.delegate?._session ?? impl?._delegate?._session;
  if (!session) throw new Error('WebKit inspector session unavailable in this Playwright version');
  const { root } = await session.send('DOM.getDocument');
  /** @type {Record<string, { name: string }>} */
  const out = {};
  for (const id of ids) {
    const { nodeId } = await session.send('DOM.querySelector', { nodeId: root.nodeId, selector: '#' + CSS_escape(id) });
    const { properties } = await session.send('DOM.getAccessibilityPropertiesForNode', { nodeId });
    out[id] = { name: properties?.label ?? '' };
  }
  return out;
}
/** @param {string} id */
function CSS_escape(id) { return id.replace(/[^a-zA-Z0-9_-]/g, c => '\\' + c); }

for (const config of browsers.filter(b => b.name !== 'firefox' || firefoxLane)) {
  const firefox = config.name === 'firefox';
  if (firefox && !await portFree(MARIONETTE_PORT)) { errors.push({ browser: 'firefox', error: `Marionette port ${MARIONETTE_PORT} is in use; the Firefox lane runs one at a time.` }); continue; }
  const browser = await config.engine.launch({ executablePath: config.executablePath, timeout: 20000, ...(firefox ? { args: ['-marionette', '-remote-allow-system-access'], env: { ...process.env, MOZ_MARIONETTE: '1' } } : {}) });
  /** @type {Awaited<ReturnType<typeof marionette>> | null} */
  let gecko = null;
  try {
    // Marionette greets only once a browser window exists.
    if (firefox) { await browser.newPage(); gecko = await marionette(MARIONETTE_PORT); }
    for (const subject of SUBJECTS) {
      const tally = tallies[`${subject.key}:${config.name}`] = { unmatchedWords: 0, blocks: 0, linkMismatches: 0, headingMismatches: 0, links: 0, headings: 0, samples: [] };
      for (const fixture of FIXTURES.filter(f => !f.engines || f.engines.includes(config.name))) {
        for (const width of fixture.widths ?? WIDTHS) {
          const where = `${config.name} ${fixture.name} ${width}px${fixture.narrowTo ? ' to ' + fixture.narrowTo + 'px' : ''}`;
          const page = await browser.newPage({ viewport: { width, height: 900 } });
          page.setDefaultTimeout(20000);
          page.on('pageerror', error => errors.push({ browser: config.name, error: `${subject.key} ${where}: ${error.message}` }));
          try {
            const url = `http://ax.test/${fixture.name}-${subject.key}-${width}`;
            await page.route('http://ax.test/**', route => {
              const path = new URL(route.request().url()).pathname;
              const s = /** @type {any} */ (subject);
              if (path === '/typeset.js') return route.fulfill({ contentType: 'text/javascript', body: s.bundleText });
              if (path === '/react-fixture.js') return route.fulfill({ contentType: 'text/javascript', body: s.reactText });
              if (path === '/styles.css') return route.fulfill({ contentType: 'text/css', body: '' });
              if (path.startsWith(`/${fixture.name}-`)) return route.fulfill({ contentType: 'text/html; charset=utf-8', body: fixture.html() });
              return route.fulfill({ status: 404, body: '' });
            });
            await page.route('**/*', route => route.request().url().startsWith('http://ax.test/') ? route.fallback() : route.abort());
            await page.goto(url);
            /** @type {import('playwright').CDPSession | undefined} */
            let live;
            if (fixture.live && config.name === 'chromium') {
              live = await page.context().newCDPSession(page);
              await live.send('Accessibility.enable');
              await live.send('Accessibility.getFullAXTree');
            }
            // The native tree's words, where the fixture compares with them.
            /** @type {Record<string, string[]>} */
            let nativeWords = {};
            if (fixture.axReference && config.name === 'chromium' && fixture.compose) {
              const pre = await domFacts(page, fixture.blocks);
              const preAx = await chromiumAX(page, pre.blocks.map(b => b.id));
              nativeWords = Object.fromEntries(pre.blocks.map(b => [b.id, words(preAx[b.id]?.text ?? '')]));
            }
            if (fixture.compose) await page.evaluate(name => /** @type {any} */ (window)[name](), fixture.compose);
            else await page.waitForFunction(selector => { const els = [...document.querySelectorAll(selector)]; return els.length >= 7 && els.every(el => /** @type {HTMLElement} */ (el).dataset.tsOutcome); }, fixture.blocks);
            await page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))));
            const before = await domFacts(page, fixture.blocks);
            const composedBefore = before.blocks.filter(b => b.outcome?.startsWith('composed'));
            const withBreaks = composedBefore.filter(b => b.breaks > 0);
            if (subject.key === 'candidate') checks.push({ browser: config.name, label: `candidate: ${where} composes with generated breaks`, pass: withBreaks.length > 0, detail: { blocks: before.blocks.length, composed: composedBefore.length, withBreaks: withBreaks.length } });
            if (fixture.narrowTo) {
              // Past the resize settle and the idle work it leaves offscreen.
              await page.setViewportSize({ width: fixture.narrowTo, height: 900 });
              await page.waitForTimeout(1500);
            }
            if (fixture.translate) {
              await page.evaluate(() => document.documentElement.classList.add('translated-ltr'));
              await page.waitForTimeout(600);
            }
            const facts = fixture.narrowTo || fixture.translate ? await domFacts(page, fixture.blocks) : before;
            // Every block once the engine has stepped aside; otherwise the composed ones.
            const composed = fixture.translate ? facts.blocks : facts.blocks.filter(b => b.outcome?.startsWith('composed'));
            if (fixture.narrowTo && subject.key === 'candidate') {
              const stale = await page.evaluate(() => document.querySelectorAll('[data-ts-stale]').length);
              checks.push({ browser: config.name, label: `candidate: ${where} leaves offscreen blocks waiting`, pass: stale > 0, detail: { stale } });
            }
            /** @type {Record<string, { text?: string, name: string }>} */
            let ax = {};
            const ids = [...facts.blocks.map(b => b.id), ...facts.links.map(l => l.id)];
            if (config.name === 'chromium') ax = await chromiumAX(page, ids, live);
            else if (config.name === 'webkit') ax = await webkitNames(page, [...facts.links.map(l => l.id), ...facts.headings.map(h => h.id)]);
            else if (gecko) {
              await page.waitForTimeout(800);
              const result = await gecko.exec(GECKO_AX, [url, ids]);
              if (result?.error) throw new Error('Gecko: ' + result.error);
              ax = result;
            }
            const blockFailures = [];
            if (config.name !== 'webkit') {
              for (const block of composed) {
                const source = nativeWords[block.id] ?? words(block.text), exposed = words(ax[block.id]?.text ?? '');
                tally.blocks++;
                if (exposed.join(' ') !== source.join(' ')) {
                  const words = unmatched(exposed, source);
                  tally.unmatchedWords += words.length;
                  blockFailures.push({ id: block.id, unmatchedWords: words.slice(0, 6), exposedWords: exposed.length, sourceWords: source.length });
                }
              }
              if (subject.key === 'candidate') checks.push({ browser: config.name, label: `candidate: ${where} composed block words equal ${Object.keys(nativeWords).length ? 'the native tree\'s' : 'source'}`, pass: blockFailures.length === 0, detail: blockFailures.slice(0, 5) });
            }
            const linkFailures = [];
            for (const link of facts.links) {
              tally.links++;
              const name = /** @type {any} */ (ax[link.id])?.name ?? '';
              if (normal(name) !== normal(link.text)) { tally.linkMismatches++; linkFailures.push({ id: link.id, name, source: normal(link.text) }); }
            }
            if (subject.key === 'candidate' && facts.links.length) checks.push({ browser: config.name, label: `candidate: ${where} link names equal source`, pass: linkFailures.length === 0, detail: linkFailures.slice(0, 5) });
            const headingFailures = [];
            for (const heading of facts.headings) {
              tally.headings++;
              const name = /** @type {any} */ (ax[heading.id])?.name ?? '';
              if (normal(name) !== normal(heading.text)) { tally.headingMismatches++; headingFailures.push({ id: heading.id, name, source: normal(heading.text) }); }
            }
            if (subject.key === 'candidate' && facts.headings.length) checks.push({ browser: config.name, label: `candidate: ${where} heading names equal source`, pass: headingFailures.length === 0, detail: headingFailures.slice(0, 5) });
            if (tally.samples.length < 4 && (blockFailures.length || linkFailures.length)) tally.samples.push({ where, block: blockFailures[0], link: linkFailures[0] });
            if (process.env.TYPESET_AX_PROGRESS) process.stderr.write(`${subject.key} ${where} ${Math.round((Date.now() - started) / 1000)} s\n`);
          } catch (error) {
            errors.push({ browser: config.name, error: `${subject.key} ${where}: ${String(/** @type {Error} */ (error).stack || error).split('\n').slice(0, 3).join(' ')}` });
          } finally { await page.close(); }
        }
      }
    }
    const control = tallies[`control:${config.name}`];
    if (config.name === 'webkit') checks.push({ browser: config.name, label: 'negative control 4.2.0: the oracle finds joined link or heading names', pass: control.linkMismatches + control.headingMismatches > 0, detail: control });
    else checks.push({ browser: config.name, label: 'negative control 4.2.0: the oracle finds joined words', pass: control.unmatchedWords > 0, detail: control });
  } catch (error) {
    errors.push({ browser: config.name, error: String(/** @type {Error} */ (error).stack || error) });
  } finally {
    gecko?.close();
    await browser.close();
  }
}

const failures = checks.filter(c => !c.pass);
await writeFile('output/native-ax.json', JSON.stringify({ ...identity, control: 'public/releases/4.2.0', widths: WIDTHS, firefox: firefoxLane, seconds: Math.round((Date.now() - started) / 1000), tallies, checks, errors }, null, 2));
console.log(JSON.stringify({ checks: checks.length, failed: failures.length, tallies: Object.fromEntries(Object.entries(tallies).map(([k, v]) => [k, { unmatchedWords: v.unmatchedWords, blocks: v.blocks, linkMismatches: v.linkMismatches, links: v.links, headingMismatches: v.headingMismatches, headings: v.headings }])), failures: failures.slice(0, 12).map(f => ({ browser: f.browser, label: f.label, detail: JSON.stringify(f.detail).slice(0, 300) })), errors }, null, 2));
if (failures.length || errors.length) process.exitCode = 1;
