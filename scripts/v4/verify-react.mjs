// @ts-check
// The React adapters (TypesetText, TypesetRichText) as shipped in react.js,
// on React 18.3.1 and 19.2.3 (development builds, so React's warnings
// surface), in Chromium, WebKit and Firefox.
//
//   node scripts/v4/verify-react.mjs [--only chromium] [--major 19]
//
// Recomposition only on real changes (P4): parent re-renders with an inline
// keep array and fresh JSX children, and a 60-frame ancestor transform,
// write nothing inside the hosts; a real style change still recomposes;
// 60 rapid updates in five React scheduling modes end exact. Lifecycle: no
// observers or listeners survive unmounting or 30 fast mount cycles, and
// StrictMode renders without warnings.
import { build } from 'esbuild';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { parseArgs } from 'node:util';
import { browsers } from './browsers.mjs';
import { artifacts, reactUnderTest } from './candidate.mjs';
import { join } from 'node:path';
import { releaseIdentity } from './release-evidence.mjs';
import { ensureReactEnv, reactMajor } from './react-env.mjs';

const { values } = parseArgs({ options: { only: { type: 'string' }, major: { type: 'string' } } });
const env = await ensureReactEnv();
const majors = /** @type {('18' | '19')[]} */ (values.major ? [values.major] : ['18', '19']);
/** @type {Record<string, string>} */
const bundles = {};
for (const major of majors) {
  const result = await build({ entryPoints: ['tests/react/app.tsx'], bundle: true, write: false, format: 'iife', target: 'es2022', jsx: 'automatic', define: { 'process.env.NODE_ENV': '"development"' }, plugins: [reactUnderTest(), reactMajor(major, env)], logLevel: 'error' });
  bundles[major] = result.outputFiles[0].text;
}
const instrument = await readFile('tests/react/instrument.js', 'utf8');
const html = '<!doctype html><html lang="en"><head><style>body{margin:16px;font:18px/1.45 Georgia,serif}.col{display:flex;flex-direction:column;align-items:flex-start}.blk{margin:0 0 10px}.big .blk{font-size:21px}</style></head><body><div id="root"></div><script src="/app.js"></script></body></html>';

const report = { ...await releaseIdentity(), react: majors, browsers: /** @type {Record<string, string>} */ ({}), checks: /** @type {{ browser: string, label: string, pass: boolean, detail?: unknown }[]} */ ([]), errors: /** @type {{ browser: string, error: string }[]} */ ([]), timings: /** @type {Record<string, unknown>} */ ({}) };
const selected = browsers.filter(b => !values.only || values.only.split(',').includes(b.name));

for (const config of selected) {
  const browser = await config.engine.launch({ executablePath: config.executablePath, timeout: 20000 });
  report.browsers[config.name] = browser.version();
  try {
    // K4: an engine without Intl.Segmenter, ResizeObserver or
    // requestIdleCallback imports every entry and leaves text native.
    {
      /** @param {string} label @param {unknown} pass @param {unknown} [detail] */
      const check = (label, pass, detail) => report.checks.push({ browser: config.name, label: 'Missing APIs: ' + label, pass: !!pass, ...(pass ? {} : { detail }) });
      const page = await browser.newPage({ viewport: { width: 900, height: 900 } });
      page.setDefaultTimeout(20000);
      /** @type {string[]} */
      const pageErrors = [];
      page.on('pageerror', error => pageErrors.push(error.message));
      await page.addInitScript(instrument);
      await page.addInitScript(() => {
        const w = /** @type {any} */ (window);
        delete (/** @type {any} */ (Intl)).Segmenter; delete w.ResizeObserver; delete w.requestIdleCallback; delete w.cancelIdleCallback;
      });
      await page.route('http://react.test/**', async route => {
        const path = new URL(route.request().url()).pathname;
        if (path === '/app.js') return route.fulfill({ contentType: 'text/javascript', body: bundles[majors.at(-1) ?? '19'] });
        if (path.startsWith('/dist/')) return route.fulfill({ contentType: path.endsWith('.js') ? 'text/javascript' : 'application/octet-stream', body: await readFile(join(artifacts.dist, path.slice(6))) });
        return route.fulfill({ contentType: 'text/html; charset=utf-8', body: '<!doctype html><html lang="en"><body><p id="plain">A paragraph in an engine without the APIs Typeset needs to compose.</p><div id="root"></div><script src="/app.js"></script></body></html>' });
      });
      await page.goto('http://react.test/index.html');
      // A module-level API use (4.2.0's Intl.Segmenter) stops the page booting.
      const booted = await page.waitForFunction(() => /** @type {any} */ (window).booted, null, { timeout: 5000 }).then(() => true, () => false);
      check('an application bundling the React entry boots', booted, pageErrors.slice(0, 3));
      const bare = !booted ? null : await page.evaluate(async () => {
        const w = /** @type {any} */ (window);
        const apis = { segmenter: typeof (/** @type {any} */ (Intl)).Segmenter, resize: typeof w.ResizeObserver, idle: typeof w.requestIdleCallback };
        const url = '/dist/index.js';
        const core = await import(/* @vite-ignore */ url);
        const plain = /** @type {HTMLElement} */ (document.getElementById('plain'));
        const direct = core.typeset(plain).outcome;
        const controller = core.mount(document, 'p');
        await controller.ready;
        const mounted = plain.dataset.tsOutcome;
        w.T.render('blocks', { n: 3, kind: 'both' });
        await w.__quiet(200);
        const blocks = Array.from(document.querySelectorAll('.blk'), el => ({ outcome: /** @type {HTMLElement} */ (el).dataset.tsOutcome, text: (el.textContent || '').length }));
        for (const src of ['/dist/typeset.global.js', '/dist/go.js']) await new Promise(resolve => { const s = document.createElement('script'); s.src = src; s.onload = s.onerror = resolve; document.head.append(s); });
        const ready = await Promise.race([w.TypesetReady?.then(() => 'resolved'), new Promise(r => setTimeout(() => r('pending'), 2000))]);
        return { apis, direct, mounted, blocks, global: typeof w.Typeset?.typeset, ready };
      });
      if (bare) {
        check('the test really removed them', bare.apis.segmenter === 'undefined' && bare.apis.resize === 'undefined' && bare.apis.idle === 'undefined', bare.apis);
        check('index.js imports; typeset() and mount() report native:environment', bare.direct === 'native:environment' && bare.mounted === 'native:environment', bare);
        check('both React adapters render their text and report native:environment', bare.blocks.length === 6 && bare.blocks.every(b => b.outcome === 'native:environment' && b.text > 40), bare.blocks);
        check('typeset.global.js and go.js load, and TypesetReady resolves', bare.global === 'function' && bare.ready === 'resolved', bare);
      }
      check('no page errors', pageErrors.length === 0, pageErrors.slice(0, 3));
      await page.close();
    }
    for (const major of majors) {
      const prefix = `React ${major}: `;
      /** @param {string} label @param {unknown} pass @param {unknown} [detail] */
      const check = (label, pass, detail) => { report.checks.push({ browser: config.name, label: prefix + label, pass: !!pass, ...(pass ? {} : { detail }) }); if (process.env.VERBOSE) process.stderr.write(`${config.name} ${prefix}${label}: ${pass ? 'ok' : 'FAIL'}\n`); };
      const page = await browser.newPage({ viewport: { width: 900, height: 900 } });
      page.setDefaultTimeout(20000);
      page.on('pageerror', error => report.errors.push({ browser: config.name, error: prefix + error.message }));
      await page.addInitScript(instrument);
      await page.route('http://react.test/**', route => route.request().url().endsWith('/app.js')
        ? route.fulfill({ contentType: 'text/javascript', body: bundles[major] })
        : route.fulfill({ contentType: 'text/html; charset=utf-8', body: html }));
      await page.goto('http://react.test/index.html');
      await page.waitForFunction(() => /** @type {any} */ (window).booted);
      check('fixture runs the expected React', await page.evaluate(() => /** @type {any} */ (window).T.version) === (major === '18' ? '18.3.1' : '19.2.3'));
      // Observers and listeners the page holds before any adapter mounts (Playwright's, React's root).
      const baseline = await page.evaluate(() => { const w = /** @type {any} */ (window); w.T.render('none'); return w.__snapshot(); });

      for (const strict of [false, true]) {
        const mode = strict ? ' (StrictMode)' : '';
        // P4: re-renders that change nothing write nothing.
        await page.evaluate(strict => /** @type {any} */ (window).T.render('blocks', { n: 6, kind: 'both', inlineKeep: true }, strict), strict);
        await page.evaluate(() => /** @type {any} */ (window).__quiet(300));
        const before = await page.evaluate(() => Array.from(document.querySelectorAll('.blk'), el => /** @type {HTMLElement} */ (el).dataset.tsOutcome));
        check('blocks compose' + mode, before.filter(o => o === 'composed:rich').length >= 6, before);
        const rerender = await page.evaluate(async () => {
          const w = /** @type {any} */ (window);
          const stop = w.__watch();
          const started = performance.now();
          for (let i = 0; i < 100; i++) w.api.flushSync(() => w.api.bump());
          const ms = performance.now() - started;
          await w.__quiet(300);
          return { ms, writes: stop() };
        });
        report.timings[`${config.name} ${prefix}100 re-renders${mode}`] = Math.round(rerender.ms);
        check('100 parent re-renders with an inline keep write nothing in TypesetText hosts' + mode, rerender.writes.text === 0, rerender);
        check('100 parent re-renders with fresh JSX children write nothing in TypesetRichText hosts' + mode, rerender.writes.rich === 0, rerender);
        const ancestor = await page.evaluate(async () => {
          const w = /** @type {any} */ (window);
          const wrap = /** @type {HTMLElement} */ (document.getElementById('wrap'));
          const stop = w.__watch();
          for (let i = 0; i < 60; i++) { wrap.style.transform = `translateX(${i % 12}px)`; await new Promise(r => requestAnimationFrame(r)); }
          wrap.style.transform = '';
          for (let i = 0; i < 10; i++) { document.body.classList.toggle('unstyled-toggle'); await new Promise(r => requestAnimationFrame(r)); }
          await w.__quiet(300);
          return stop();
        });
        check('a 60-frame ancestor transform and no-op ancestor class toggles write nothing in TypesetText hosts' + mode, ancestor.text === 0, ancestor);
        check('a 60-frame ancestor transform and no-op ancestor class toggles write nothing in TypesetRichText hosts' + mode, ancestor.rich === 0, ancestor);
        const restyle = await page.evaluate(async () => {
          const w = /** @type {any} */ (window);
          const wrap = /** @type {HTMLElement} */ (document.getElementById('wrap'));
          const stop = w.__watch();
          wrap.classList.add('big');
          await w.__quiet(300);
          const writes = stop();
          const blocks = Array.from(document.querySelectorAll('.blk'), el => ({ outcome: /** @type {HTMLElement} */ (el).dataset.tsOutcome, overflow: el.scrollWidth > el.clientWidth + 1 }));
          wrap.classList.remove('big');
          await w.__quiet(300);
          return { writes, blocks };
        });
        check('a real ancestor style change still recomposes every block' + mode, restyle.writes.hosts.length === 12 && restyle.blocks.every(b => !b.overflow && b.outcome), restyle);
      }

      // Continuous resize: never double-wrapped, and recomposed once the size holds.
      await page.evaluate(() => /** @type {any} */ (window).T.render('blocks', { n: 4, kind: 'both', width: '100%' }));
      await page.evaluate(() => { /** @type {HTMLElement} */ (document.getElementById('wrap')).style.width = '360px'; });
      await page.evaluate(() => /** @type {any} */ (window).__quiet(400));
      const drag = await page.evaluate(async () => {
        const w = /** @type {any} */ (window);
        const wrap = /** @type {HTMLElement} */ (document.getElementById('wrap'));
        // Line boxes from text only: markers and inline-block spacers report rects of their own.
        const lines = (/** @type {HTMLElement} */ el) => {
          /** @type {number[]} */ const bottoms = [];
          const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT), range = document.createRange();
          for (let n; (n = /** @type {Text | null} */ (walker.nextNode()));) {
            if (!n.data.trim()) continue;
            range.selectNodeContents(n);
            for (const r of range.getClientRects()) if (r.width > 1 && !bottoms.some(b => Math.abs(b - r.bottom) < 3)) bottoms.push(r.bottom);
          }
          return bottoms.length;
        };
        /** @type {Record<string, number>} */ const doubled = {};
        const stop = w.__watch();
        for (let i = 1; i <= 40; i++) {
          wrap.style.width = (360 - i * 3) + 'px';
          await new Promise(r => requestAnimationFrame(r));
          for (const el of /** @type {NodeListOf<HTMLElement>} */ (document.querySelectorAll('.blk'))) {
            const breaks = el.querySelectorAll('br[data-ts-break]').length;
            if (breaks && lines(el) > breaks + 1) doubled[el.id] = (doubled[el.id] || 0) + 1;
          }
        }
        await w.__quiet(500);
        const writes = stop();
        const final = Array.from(document.querySelectorAll('.blk'), el => ({ id: el.id, outcome: /** @type {HTMLElement} */ (el).dataset.tsOutcome, stale: el.hasAttribute('data-ts-stale'), overflow: el.scrollWidth > el.clientWidth + 1 }));
        return { doubled, writes, final };
      });
      // Resize observations arrive after layout, so the first frame of a resize
      // can still show the old breaks; every later frame must be clean.
      const worst = (/** @type {string} */ kind) => Math.max(0, ...Object.entries(drag.doubled).filter(([id]) => id.startsWith(kind)).map(([, n]) => n));
      check('continuous resize paints double-wrapped TypesetRichText lines in at most its first frame', worst('r') <= 1, drag);
      check('continuous resize paints double-wrapped TypesetText lines in at most its first frame', worst('t') <= 1, drag);
      check('after continuous resize every block is composed again at the final width', drag.final.every(b => b.outcome === 'composed:rich' && !b.stale && !b.overflow), drag.final);
      report.timings[`${config.name} ${prefix}resize writes (text, rich)`] = [drag.writes.text, drag.writes.rich];

      // Correctness under churn: every scheduling mode ends on the exact text.
      const words = 'alpha bravo charlie delta echo foxtrot golf hotel india juliet kilo lima mike november oscar papa quebec romeo sierra tango uniform victor whiskey'.split(' ');
      /** @type {[string, string, Record<string, unknown>][]} */
      const modes = [['batched burst', 'burst', {}], ['one per frame', 'frame', {}], ['flushSync', 'flush', {}], ['startTransition', 'transition', {}], ['useDeferredValue', 'frame', { deferred: true }], ['inline keep, one per frame', 'frame', { inlineKeep: true }]];
      for (const [name, driver, props] of modes) {
        await page.evaluate(props => /** @type {any} */ (window).T.render('rapid', props), props);
        await page.evaluate(() => /** @type {any} */ (window).__quiet(300));
        const expected = await page.evaluate(async ({ words, driver }) => {
          const w = /** @type {any} */ (window);
          let last = '';
          for (let i = 0; i < 60; i++) {
            const text = last = words.slice(0, 8 + (i % 15)).join(' ') + ' ' + i;
            if (driver === 'burst') w.api.setText(text);
            else if (driver === 'flush') w.api.flushSync(() => w.api.setText(text));
            else if (driver === 'transition') { w.api.startTransition(() => w.api.setText(text)); if (i % 7 === 0) await new Promise(r => setTimeout(r, 3)); }
            else { w.api.setText(text); await new Promise(r => requestAnimationFrame(r)); }
          }
          return last;
        }, { words, driver });
        await page.evaluate(() => /** @type {any} */ (window).__quiet(300));
        const state = await page.evaluate(() => ['rapid', 'rapidrich'].map(id => {
          const el = /** @type {HTMLElement} */ (document.getElementById(id));
          return { id, text: el.textContent, outcome: el.dataset.tsOutcome, done: el.dataset.typesetDone, overflow: el.scrollWidth > el.clientWidth + 1 };
        }));
        check(`60 updates (${name}) end on the exact text`, state.every(s => s.text === expected && s.done === '1' && s.outcome && !s.overflow), { expected, state });
      }

      // P5: one controller per document, visible blocks first.
      const footprint = await page.evaluate(async () => {
        const w = /** @type {any} */ (window);
        const counts = [];
        for (const n of [4, 40]) {
          w.T.render('none');
          await w.__frames(2);
          const before = w.__snapshot();
          w.T.render('blocks', { n, kind: 'both', labels: true });
          await w.__quiet(300, 4000);
          const after = w.__snapshot();
          counts.push({ n, mo: after.mo.created - before.mo.created, ro: after.ro.created - before.ro.created, io: after.io.created - before.io.created, listeners: Object.values(after.listeners).reduce((a, b) => a + b, 0) - Object.values(before.listeners).reduce((a, b) => a + b, 0) });
        }
        return counts;
      });
      check('observers and listeners do not grow with the number of blocks (8 vs 80 hosts)', footprint[0].mo === footprint[1].mo && footprint[0].ro === footprint[1].ro && footprint[0].io === footprint[1].io && footprint[0].listeners === footprint[1].listeners && footprint[1].mo <= 1 && footprint[1].ro <= 1 && footprint[1].io <= 1, footprint);
      await page.evaluate(() => /** @type {any} */ (window).T.render('none'));
      const push = await page.evaluate(async () => {
        const w = /** @type {any} */ (window);
        const first = await w.__afterFirstPaint(() => w.T.render('blocks', { n: 30, kind: 'both', labels: true }));
        const started = performance.now();
        while (performance.now() - started < 1500 && w.__composedState().some((/** @type {any} */ h) => !h.composed)) await new Promise(r => setTimeout(r, 50));
        return { first, settledMs: Math.round(performance.now() - started), last: w.__composedState() };
      });
      const onScreen = push.first.filter((/** @type {any} */ h) => h.visible);
      check('a pushed screen paints its first frame with every on-screen block composed', onScreen.length > 4 && onScreen.every((/** @type {any} */ h) => h.composed), onScreen.filter((/** @type {any} */ h) => !h.composed));
      check('offscreen blocks wait for idle time and compose within 1.5 s', push.first.some((/** @type {any} */ h) => !h.visible && !h.composed) && push.last.every((/** @type {any} */ h) => h.composed), { settledMs: push.settledMs, pending: push.last.filter((/** @type {any} */ h) => !h.composed).length });
      const sync = await page.evaluate(() => {
        const w = /** @type {any} */ (window);
        w.T.render('blocks', { n: 30, kind: 'both', labels: true, priority: 'sync' });
        return w.__composedState();
      });
      check('priority="sync" composes every block in the commit, on screen or not', sync.every((/** @type {any} */ h) => h.composed), sync.filter((/** @type {any} */ h) => !h.composed).map((/** @type {any} */ h) => h.id));
      const suspense = await page.evaluate(async () => {
        const w = /** @type {any} */ (window);
        // Mounted suspended: the blocks first render when the data arrives.
        w.T.render('suspense', { suspendMs: 300 });
        const fallback = await new Promise(resolve => { const t0 = performance.now(); const poll = () => document.getElementById('fallback') ? resolve(true) : performance.now() - t0 > 2000 ? resolve(false) : setTimeout(poll, 10); poll(); });
        // The frame that removes the fallback is the reveal.
        const revealed = await new Promise(resolve => {
          const observer = new w.__NativeMO(() => { if (!document.getElementById('fallback')) { observer.disconnect(); requestAnimationFrame(() => setTimeout(() => resolve(w.__composedState()), 0)); } });
          observer.observe(document.body, { subtree: true, childList: true, attributes: true });
          setTimeout(() => { observer.disconnect(); resolve([]); }, 3000);
        });
        return { fallback, revealed };
      });
      check('a Suspense reveal paints composed', suspense.fallback && suspense.revealed.length === 6 && suspense.revealed.every((/** @type {any} */ h) => h.composed), suspense);
      if (major === '19') {
        const activity = await page.evaluate(async () => {
          const w = /** @type {any} */ (window);
          w.T.render('activity');
          await w.__quiet(300);
          w.api.flushSync(() => w.api.setMode('hidden'));
          await w.__frames(3);
          const hidden = w.__composedState();
          const shown = await w.__afterFirstPaint(() => w.api.flushSync(() => w.api.setMode('visible')));
          const text = Array.from(document.querySelectorAll('.blk'), el => el.textContent);
          return { hidden, shown, text };
        });
        check('an Activity reveal paints composed with the text intact', activity.shown.length === 6 && activity.shown.every((/** @type {any} */ h) => h.composed && h.visible) && activity.text.every(t => t && t.length > 40), activity);
      }

      // K5: refs, wider hosts and onResult.
      const api = await page.evaluate(async () => {
        const w = /** @type {any} */ (window);
        w.T.render('api');
        await w.__quiet(400);
        await new Promise(r => setTimeout(r, 50));
        const r = w.__refs;
        const outcome = (/** @type {string} */ id) => /** @type {HTMLElement} */ (document.getElementById(id))?.dataset.tsOutcome;
        const ids = ['ref-text', 'ref-rich', 'cb-text', 'cb-rich', 'as-li', 'as-li-rich', 'as-div', 'as-blockquote', 'as-figcaption', 'as-dt', 'as-dd', 'as-td', 'as-label'];
        return {
          refs: { text: r.text.current === document.getElementById('ref-text'), rich: r.rich.current === document.getElementById('ref-rich'),
            callbackText: r.callbackText === document.getElementById('cb-text'), callbackRich: r.callbackRich === document.getElementById('cb-rich'),
            tags: [r.text.current?.tagName, r.rich.current?.tagName] },
          outcomes: Object.fromEntries(ids.map(id => [id, outcome(id)])),
          tags: Object.fromEntries(ids.map(id => [id, document.getElementById(id)?.tagName])),
          results: { ...w.__results },
          last: Object.fromEntries(Object.entries(w.__lastResult).map(([id, result]) => [id, { outcome: /** @type {any} */ (result).outcome, features: /** @type {any} */ (result).features, lines: /** @type {any} */ (result).after?.lines?.length }])),
          listInLi: document.querySelector('#list > li#as-li') !== null,
        };
      });
      check('a ref on TypesetText and TypesetRichText resolves to the host element (object and callback refs)', api.refs.text && api.refs.rich && api.refs.callbackText && api.refs.callbackRich && api.refs.tags.every(t => t === 'P'), api.refs);
      check('as="li" inside a list composes, for both adapters', api.listInLi && api.outcomes['as-li'] === 'composed:rich' && api.outcomes['as-li-rich'] === 'composed:rich', api.outcomes);
      check('as div, blockquote, figcaption, dd and td compose', ['as-div', 'as-blockquote', 'as-figcaption', 'as-dd', 'as-td'].every(id => api.outcomes[id] === 'composed:rich' && api.tags[id] === id.slice(3).toUpperCase()), { outcomes: api.outcomes, tags: api.tags });
      check('an inline host (as="label") stays native, decided by the engine', api.outcomes['as-label'] === 'native:inline', api.outcomes['as-label']);
      check('onResult reports each block with its outcome and features', Object.entries(api.outcomes).every(([id, o]) => api.results[id] >= 1 && api.last[id]?.outcome === o)
        && api.last['ref-rich']?.outcome === 'composed:rich' && api.last['ref-rich']?.features?.spacing && api.last['ref-text']?.lines > 1, { results: api.results, last: api.last });

      // Lifecycle: nothing survives unmounting.
      await page.evaluate(() => /** @type {any} */ (window).T.render('blocks', { n: 10, kind: 'both' }));
      await page.evaluate(() => /** @type {any} */ (window).__quiet(300));
      const leaks = await page.evaluate(async () => {
        const w = /** @type {any} */ (window);
        const mounted = w.__snapshot();
        w.api.setShow(false);
        await w.__frames(3);
        const unmounted = w.__snapshot();
        for (let i = 0; i < 30; i++) { w.api.flushSync(() => w.api.setShow(true)); w.api.flushSync(() => w.api.setShow(false)); }
        await new Promise(r => setTimeout(r, 400));
        return { mounted, unmounted, cycled: w.__snapshot() };
      });
      // The engine keeps one copy listener and one font-epoch listener per document, by design.
      const perDocument = ['document:copy', 'fonts:loadingdone'];
      const clean = (/** @type {any} */ s) => s.mo.active === baseline.mo.active && s.ro.active === baseline.ro.active && s.io.active === baseline.io.active
        && Object.entries(s.listeners).every(([key, count]) => count <= (baseline.listeners[key] || 0) + (perDocument.includes(key) ? 1 : 0));
      check('unmounting leaves no observers or listeners', clean(leaks.unmounted), { baseline, unmounted: leaks.unmounted });
      check('30 fast mount/unmount cycles leave no observers or listeners', clean(leaks.cycled), leaks.cycled);
      const warnings = await page.evaluate(() => /** @type {any} */ (window).__inst.warnings);
      check('no React warnings or console errors', warnings.length === 0, warnings.slice(0, 5));
      await page.close();
    }
  } catch (error) {
    report.errors.push({ browser: config.name, error: String(/** @type {Error} */ (error).stack || error) });
  } finally { await browser.close(); }
}

const summary = { checks: report.checks.length, failed: report.checks.filter(c => !c.pass).length, errors: report.errors.length };
await mkdir('output', { recursive: true });
await writeFile('output/react.json', JSON.stringify({ ...report, summary }, null, 2));
console.log(JSON.stringify({ ...summary, timings: report.timings, failures: report.checks.filter(c => !c.pass).slice(0, 20).map(c => `${c.browser} ${c.label}`), errors: report.errors.slice(0, 5) }, null, 2));
if (summary.failed || summary.errors) process.exitCode = 1;
