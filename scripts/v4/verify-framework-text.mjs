// @ts-check
// Framework text updates never leave stale text on screen (C6).
//
// Composition splits author Text nodes; a framework keeps its reference to
// the node it created and later writes to it (Svelte, Vue, Lit and Solid set
// .data, React sets .nodeValue), removes it or inserts before it. 4.2 left
// the old lines 2..n on screen after such a write, merged them back into the
// framework's node on restore, swallowed Solid updates written to
// parent.firstChild when a marker came first, and crashed React (removeChild)
// when tracking had moved its Text node into a wrapper.
//
// Each engine runs a hand-rolled renderer that holds Text nodes, React 19
// outside the adapters, Svelte 5, Vue 3.5, Solid 1.9 and Lit 3 (committed
// bundles in tests/frameworks/dist, see build-framework-fixtures.mjs), and Lit
// again with parts that start with an empty comment (the items of an array,
// map() and repeat(), and a top-level render() of a string), under
// mount() and under the website loader. Twenty updates each: every animation
// frame is sampled for text that differs from the framework's latest value,
// the paragraphs must recompose, and disconnect() must leave exactly the
// framework's text with the framework still able to update.
import { readFile, writeFile } from 'node:fs/promises';
import { build } from 'esbuild';
import { browsers } from './browsers.mjs';
import { artifacts } from './candidate.mjs';

const watchdog = setTimeout(() => { console.error('verify-framework-text: watchdog'); process.exit(3); }, 170_000);
watchdog.unref();

const bundleOf = async (/** @type {string} */ name) => (await build({ entryPoints: [`tests/frameworks/src/${name}.js`], bundle: true, write: false, format: 'iife', target: 'es2022', minify: true, define: { 'process.env.NODE_ENV': '"production"' }, logLevel: 'silent' })).outputFiles[0].text;
/** @type {Record<string, string>} */
const scripts = {
  '/typeset.js': await readFile(artifacts.bundle, 'utf8'),
  '/site-go.js': await readFile(artifacts.siteGo, 'utf8'),
  '/fw/vanilla.js': await bundleOf('vanilla'),
  '/fw/react.js': await bundleOf('react'),
};
for (const name of ['svelte', 'vue', 'solid', 'lit', 'lit-parts']) scripts[`/fw/${name}.js`] = await readFile(`tests/frameworks/dist/${name}.js`, 'utf8');
const versions = JSON.parse(await readFile('tests/frameworks/dist/versions.json', 'utf8'));
const FRAMEWORKS = ['vanilla', 'react', 'svelte', 'vue', 'solid', 'lit', 'lit-parts'];
/** The package whose version a fixture reports. @param {string} framework */
const pkg = framework => /** @type {Record<string, string>} */ ({ solid: 'solid-js', 'lit-parts': 'lit' })[framework] ?? framework;
const LOADERS = ['mount', 'website'];
const page = (/** @type {string} */ framework, /** @type {string} */ loader) => `<!doctype html><html lang="en"><head><meta charset="utf-8"><style>
body{margin:16px;background:#fff;color:#111;font:18px/1.5 Georgia}.col{width:320px}p{margin:0 0 14px}a{color:#146044}
</style>${loader === 'website' ? '<script src="/site-go.js" defer></script>' : '<script src="/typeset.js"></script>'}</head>
<body><div id="app"></div><script src="/fw/${framework}.js"></script></body></html>`;

/** Runs in the page: compose the paragraphs and keep the controller. */
async function compose(/** @type {string} */ loader) {
  const w = /** @type {any} */ (window);
  const controller = w.controller = loader === 'website' ? await w.TypesetReady : w.Typeset.mount(document, '#app p');
  await controller.ready;
  await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  const ids = ['sole', 'mixed', 'linked', 'cond'];
  return { composed: ids.filter(id => /** @type {HTMLElement} */ (document.getElementById(id)).dataset.tsOutcome === 'composed:rich'),
    breaks: document.querySelectorAll('#app br[data-ts-break]').length, tracked: document.querySelectorAll('#app [data-ts-track]').length, hangs: document.querySelectorAll('#app [data-ts-hang]').length };
}

/** Runs in the page: twenty updates, sampled every frame. */
async function exercise() {
  const w = /** @type {any} */ (window), fw = w.fw;
  const ids = ['sole', 'mixed', 'linked', 'cond'];
  const frames = () => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  const settle = () => new Promise(resolve => setTimeout(resolve, 260));
  const shown = () => Object.fromEntries(ids.map(id => [id, /** @type {HTMLElement} */ (document.getElementById(id)).textContent]));
  const composed = () => ids.filter(id => /** @type {HTMLElement} */ (document.getElementById(id)).dataset.tsOutcome === 'composed:rich');
  let expected = fw.expected(0), frame = 0, sampling = true;
  const stale = /** @type {unknown[]} */ ([]);
  const sample = () => {
    if (!sampling) return;
    frame++;
    for (const id of ids) { const text = /** @type {HTMLElement} */ (document.getElementById(id)).textContent; if (text !== expected[id] && stale.length < 8) stale.push({ frame, id, shown: text?.slice(0, 90), expected: expected[id].slice(0, 90) }); }
    requestAnimationFrame(sample);
  };
  requestAnimationFrame(sample);
  const sequence = [1, 2, 0, 3, 4, 1, 3, 2, 4, 0, 2, 1, 4, 3, 0, 1, 2, 3, 4, 2];
  const late = /** @type {unknown[]} */ ([]), recomposed = /** @type {unknown[]} */ ([]);
  for (const [step, index] of sequence.entries()) {
    expected = fw.expected(index);
    await fw.set(index);
    await frames();
    const now = shown();
    if (ids.some(id => now[id] !== expected[id])) late.push({ step, now });
    if (step % 5 === 4) {
      await settle();
      const report = w.Typeset.auditJSON('#app p');
      recomposed.push({ step, composed: composed().length, errors: report.issues.filter((/** @type {any} */ issue) => issue.severity === 'error').map((/** @type {any} */ issue) => issue.type + '@' + issue.target) });
    }
  }
  sampling = false;
  return { frames: frame, stale, late, recomposed, finalMatches: JSON.stringify(shown()) === JSON.stringify(expected) };
}

/** Runs in the page: disconnect, then update once more. */
async function finish() {
  const w = /** @type {any} */ (window), fw = w.fw;
  const ids = ['sole', 'mixed', 'linked', 'cond'];
  const frames = () => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  const shown = () => JSON.stringify(Object.fromEntries(ids.map(id => [id, /** @type {HTMLElement} */ (document.getElementById(id)).textContent])));
  w.controller.disconnect();
  await frames();
  const out = /** @type {Record<string, any>} */ ({ disconnected: { matches: shown() === JSON.stringify(fw.expected(2)), engineNodes: document.querySelectorAll('#app [data-ts-break], #app [data-ts-track]').length } });
  await fw.set(3);
  await frames();
  out.afterDisconnect = shown() === JSON.stringify(fw.expected(3));
  return out;
}

/** Chromium's own accessibility tree: the words of each paragraph, as StaticText and LineBreak. @param {import('playwright').Page} page */
async function axWords(page) {
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Accessibility.enable');
  const { root } = await cdp.send('DOM.getDocument', { depth: -1 });
  const ids = ['sole', 'mixed', 'linked', 'cond'];
  /** @type {Map<number, string>} */
  const backend = new Map();
  const visit = (/** @type {any} */ node) => { const a = node.attributes ?? []; for (let i = 0; i < a.length; i += 2) if (a[i] === 'id' && ids.includes(a[i + 1])) backend.set(node.backendNodeId, a[i + 1]); for (const child of node.children ?? []) visit(child); };
  visit(root);
  const { nodes } = await cdp.send('Accessibility.getFullAXTree');
  const byId = new Map(nodes.map((/** @type {any} */ n) => [n.nodeId, n]));
  const mismatches = [];
  const texts = await page.evaluate(ids => Object.fromEntries(ids.map(id => [id, /** @type {HTMLElement} */ (document.getElementById(id)).textContent])), ids);
  for (const node of nodes) {
    const id = backend.get(node.backendDOMNodeId);
    if (!id) continue;
    const parts = /** @type {string[]} */ ([]);
    const walk = (/** @type {any} */ n) => { const role = n.role?.value; if (!n.ignored) { if (role === 'StaticText') parts.push(n.name?.value ?? ''); else if (role === 'LineBreak') parts.push('\n'); } if (role === 'InlineTextBox') return; for (const c of n.childIds ?? []) { const child = byId.get(c); if (child) walk(child); } };
    walk(node);
    const words = (/** @type {string} */ t) => t.split(/\s+/u).filter(Boolean).join(' ');
    if (words(parts.join('')) !== words(texts[id] ?? '')) mismatches.push({ id, ax: words(parts.join('')), source: words(texts[id] ?? '') });
  }
  await cdp.detach();
  return mismatches;
}

/** Runs in the page: typeset() and restore() without a controller. */
function direct() {
  const T = /** @type {any} */ (window).Typeset;
  const p = document.createElement('p'); p.style.width = '260px'; document.body.append(p);
  const head = document.createTextNode('Every morning the corner shop puts out a small chalkboard with the price of bread, and the regulars read it before they even say hello to anyone behind the counter.');
  p.append(head);
  const results = /** @type {Record<string, unknown>} */ ({ outcome: T.typeset(p).outcome });
  const update = 'Update: drink water, then read the chalkboard before the regulars arrive and the bread is gone for the day.';
  head.data = update;
  results.recomposed = T.typeset(p).outcome;
  results.recomposedText = p.textContent === update || p.textContent;
  const last = 'Rest is not a reward for finishing everything on your list. It is the condition that makes the list possible, and the body keeps its own ledger.';
  head.data = last;
  T.restore(p);
  results.restored = p.textContent === last && p.childNodes.length === 1 && p.firstChild === head;
  p.remove();
  return results;
}

/** WebKit's accessible name for the linked paragraph's link, through its inspector protocol. @param {import('playwright').Page} page */
async function webkitLinkName(page) {
  const anyPage = /** @type {any} */ (page);
  const impl = anyPage._connection?.toImpl?.(page);
  const session = impl?.delegate?._session ?? impl?._delegate?._session;
  if (!session) return null;
  const { root } = await session.send('DOM.getDocument');
  const { nodeId } = await session.send('DOM.querySelector', { nodeId: root.nodeId, selector: '#linked a' });
  const { properties } = await session.send('DOM.getAccessibilityPropertiesForNode', { nodeId });
  return { name: String(properties?.label ?? '').replace(/\s+/g, ' ').trim(), text: await page.evaluate(() => (document.querySelector('#linked a')?.textContent || '').replace(/\s+/g, ' ').trim()) };
}

/** @type {{ browser: string, label: string, pass: boolean, detail?: unknown }[]} */
const checks = [];
/** @type {{ browser: string, error: string }[]} */
const errors = [];
await Promise.all(browsers.map(async config => {
  const browser = await config.engine.launch({ executablePath: config.executablePath, timeout: 20000 });
  /** @param {string} label @param {unknown} pass @param {unknown} [detail] */
  const check = (label, pass, detail) => checks.push({ browser: config.name, label, pass: !!pass, ...(detail === undefined ? {} : { detail }) });
  try {
    for (const framework of FRAMEWORKS) for (const loader of LOADERS) {
      const where = `${framework}${versions[pkg(framework)] ? ' ' + versions[pkg(framework)] : ''} under ${loader === 'website' ? 'the website loader' : 'mount()'}`;
      const context = await browser.newContext({ viewport: { width: 420, height: 1100 } });
      await context.route('http://fw.test/**', route => {
        const path = new URL(route.request().url()).pathname;
        return path in scripts ? route.fulfill({ contentType: 'text/javascript', body: scripts[path] }) : route.fulfill({ contentType: 'text/html; charset=utf-8', body: page(framework, loader) });
      });
      const tab = await context.newPage();
      tab.setDefaultTimeout(20000);
      /** @type {string[]} */
      const pageErrors = [];
      tab.on('pageerror', error => pageErrors.push(error.message));
      try {
        await tab.goto('http://fw.test/page');
        await tab.waitForFunction(() => /** @type {any} */ (window).fw && document.getElementById('cond'));
        await tab.evaluate(() => document.fonts.ready);
        const initial = await tab.evaluate(compose, loader);
        check(`${where}: composes with generated breaks and tracking`, initial.composed.length >= 3 && initial.breaks > 3 && initial.tracked > 0, initial);
        if (config.name === 'chromium') check(`${where}: Chromium's accessibility tree reads every word as composed`, (await axWords(tab)).length === 0, await axWords(tab));
        if (config.name === 'webkit') { const link = await webkitLinkName(tab); if (link) check(`${where}: WebKit names the link with its words`, link.name === link.text && link.text.length > 3, link); }
        const out = await tab.evaluate(exercise);
        check(`${where}: no frame shows stale text across 20 updates`, out.stale.length === 0 && out.frames > 20, { frames: out.frames, stale: out.stale });
        check(`${where}: the text equals the framework's value after every update`, out.late.length === 0 && out.finalMatches, out.late.slice(0, 2));
        check(`${where}: recomposes after updates with no audit error`, out.recomposed.every((/** @type {any} */ r) => r.composed >= 2 && !r.errors.length), out.recomposed);
        if (config.name === 'chromium') check(`${where}: Chromium's accessibility tree reads every word after the updates`, (await axWords(tab)).length === 0, await axWords(tab));
        const end = await tab.evaluate(finish);
        check(`${where}: disconnect() leaves exactly the framework's text`, end.disconnected.matches && end.disconnected.engineNodes === 0, end.disconnected);
        check(`${where}: the framework still updates after disconnect()`, end.afterDisconnect);
        check(`${where}: no page errors`, pageErrors.length === 0, pageErrors.slice(0, 3));
        if (framework === 'vanilla' && loader === 'mount') {
          const result = await tab.evaluate(direct);
          check('typeset() and restore() without a controller never merge stale fragments', result.outcome === 'composed:rich' && result.recomposed === 'composed:rich' && result.recomposedText === true && result.restored === true, result);
        }
      } catch (error) {
        // A page that could not finish (4.2's React unmounted itself) is a failed check, not a harness error.
        check(`${where}: completes the update sequence`, false, String(/** @type {Error} */ (error).stack || error).split('\n').slice(0, 3).join(' '));
      } finally { await context.close(); }
    }
  } finally { await browser.close(); }
}));

const failures = checks.filter(c => !c.pass);
await writeFile('output/framework-text.json', JSON.stringify({ bundle: artifacts.bundle, siteGo: artifacts.siteGo, frameworks: versions, checks, errors }, null, 2));
console.log(JSON.stringify({ checks: checks.length, failed: failures.length, failures: failures.slice(0, 20), errors }, null, 2));
if (failures.length || errors.length) process.exitCode = 1;
