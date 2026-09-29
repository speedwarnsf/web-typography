// @ts-check
// C12: mount() from a parent page into a same-origin iframe (CMS previews, page
// builders). The iframe's nodes come from another realm, so the controller must
// not rely on instanceof against the parent's constructors, and must listen to
// the iframe's own font set and window.
//
// Each pass (mount(document) and mount(body)) starts from a 420 px iframe, so
// both passes' "iframe resize" steps resize it. A recomposition check that
// fails reports what the block shows (outcome, [data-ts-stale], lines against
// breaks, measured and box widths), what the controller did since the change
// (passes and compositions; its pending, resizing and settle state are not
// public, and show here as passes and [data-ts-stale]) and a timeline from
// this page's own observers of the block: when layout reached the new size,
// when the mutation's record was delivered, and each write, stale mark and
// outcome.
import { readFile, writeFile } from 'node:fs/promises';
import { browsers } from './browsers.mjs';
import { artifacts } from './candidate.mjs';
import { fixtureFont } from './font-fixture.mjs';

const script = await readFile(artifacts.bundle, 'utf8');
const text = 'The browser sets text with one rule: fill the line until the next word does not fit, then break. A compositor should preserve the thought and improve the entire paragraph.';
const frame = `<!doctype html><html lang="en"><head><style>body{margin:0}p{font:18px/1.5 Arial;width:290px}.late{font-family:LateFace,Arial}</style></head><body><main><p id="a">${text}</p></main></body></html>`;
/** @type {{ checks: { browser: string, label: string, pass: boolean, detail?: unknown }[], errors: { browser: string, error: string }[] }} */
const report = { checks: [], errors: [] };
for (const { name, engine, executablePath } of browsers) {
  const browser = await engine.launch({ executablePath, timeout: 20000 });
  try {
    const page = await browser.newPage();
    page.setDefaultTimeout(20000);
    await page.setContent(`<!doctype html><html lang="en"><body style="margin:0"><iframe id="f" style="width:420px;height:600px;border:0"></iframe></body></html>`);
    await page.addScriptTag({ content: script });
    for (const mode of ['document', 'body']) {
      const checks = await page.evaluate(async ({ frame, text, mode, font }) => {
        const api = /** @type {any} */ (window).Typeset;
        const iframe = /** @type {HTMLIFrameElement} */ (document.getElementById('f'));
        iframe.style.width = '420px';
        await new Promise(resolve => { iframe.onload = resolve; iframe.srcdoc = frame; });
        const doc = /** @type {Document} */ (iframe.contentDocument);
        const out = [];
        const check = (label, pass, detail) => out.push({ label: mode + ': ' + label, pass: !!pass, detail });
        const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
        const until = async (test, ms = 5000) => { const start = performance.now(); while (!test()) { if (performance.now() - start > ms) return false; await wait(20); } return true; };
        const intact = el => el.dataset.tsOutcome === 'composed:rich' && api.measureLayout(el).lines.length === el.querySelectorAll('br[data-ts-break]').length + 1;
        /** Watch a block from just before a change. The returned function
         * stops watching and reports its state, with the timeline on failure.
         * @param {HTMLElement} el */
        const watch = el => {
          const start = performance.now(), since = { passes: controller.stats.passes, compositions: controller.stats.compositions };
          /** @type {[number, string, number?][]} ms after the change, event, repeats */
          const events = [];
          const note = (/** @type {string} */ event) => {
            const last = events[events.length - 1];
            if (last?.[1] === event) last[2] = (last[2] ?? 1) + 1;
            else events.push([Math.round(performance.now() - start), event]);
          };
          const mutations = new MutationObserver(records => {
            for (const r of records) note(r.type !== 'attributes' ? 'written' : r.attributeName === 'data-ts-outcome' ? 'outcome ' + el.dataset.tsOutcome : r.attributeName === 'style' ? 'style record delivered' : r.attributeName + (el.hasAttribute(/** @type {string} */ (r.attributeName)) ? ' set' : ' removed'));
          });
          mutations.observe(el, { attributes: true, attributeFilter: ['style', 'data-ts-stale', 'data-ts-outcome'], childList: true });
          const sizes = new ResizeObserver(entries => { for (const e of entries) note('laid out at ' + Math.round(e.contentRect.width * 10) / 10 + ' x ' + Math.round(e.contentRect.height * 10) / 10); });
          sizes.observe(el);
          return (/** @type {boolean} */ pass) => {
            mutations.disconnect(); sizes.disconnect();
            const layout = api.measureLayout(el);
            const state = { outcome: el.dataset.tsOutcome, stale: el.hasAttribute('data-ts-stale'), lines: layout.lines.length, breaks: el.querySelectorAll('br[data-ts-break]').length, width: layout.width, box: parseFloat(getComputedStyle(el).width), passes: controller.stats.passes - since.passes, compositions: controller.stats.compositions - since.compositions, ms: Math.round(performance.now() - start) };
            return pass ? state : { ...state, events: events.slice(0, 40) };
          };
        };
        const controller = api.mount(mode === 'document' ? doc : doc.body, 'p');
        await controller.ready;
        const a = /** @type {HTMLElement} */ (doc.getElementById('a'));
        check('initial composition', intact(a), a.dataset.tsOutcome);
        const inserted = doc.createElement('p');
        inserted.textContent = 'An inserted paragraph must be discovered and composed even though it belongs to another document and realm.';
        doc.querySelector('main')?.append(inserted);
        check('an inserted paragraph is composed', await until(() => intact(inserted)), inserted.dataset.tsOutcome);
        const edited = 'The replacement paragraph must be recomposed after its text changes, and the engine must not restore any words from the old version.';
        let compositions = controller.stats.compositions;
        let seen = watch(a);
        a.textContent = edited;
        let pass = await until(() => controller.stats.compositions > compositions && a.textContent === edited && intact(a));
        check('a text edit is recomposed', pass, { ...seen(pass), text: a.textContent === edited ? 'edited' : a.textContent });
        compositions = controller.stats.compositions;
        seen = watch(a);
        a.style.width = '230px';
        pass = await until(() => controller.stats.compositions > compositions && intact(a) && Math.abs(api.measureLayout(a).width - 230) < .5);
        check('a width change is recomposed', pass, seen(pass));
        compositions = controller.stats.compositions;
        const frameWidth = iframe.getBoundingClientRect().width;
        seen = watch(inserted);
        iframe.style.width = '260px';
        inserted.style.width = 'auto';
        pass = frameWidth === 420 && await until(() => controller.stats.compositions > compositions && intact(inserted) && api.measureLayout(inserted).width <= 260);
        check('an iframe resize is recomposed', pass, { iframe: frameWidth + ' -> ' + iframe.getBoundingClientRect().width, ...seen(pass) });
        // An author's width change made in the first frame after a
        // composition, from this page's requestAnimationFrame. The page is
        // about:blank, and WebKit gives the iframe its own event loop: the
        // style change's record waits for the iframe's microtask checkpoint,
        // after the frame's ResizeObserver callbacks, so the controller's
        // ResizeObserver sees the new width with only its own composition
        // since it last delivered. That is the order in which 'a width change
        // is recomposed' failed on hosted WebKit runners. Widened, lines
        // composed for the old width still fit, and 4.3.0 kept them. Each edit
        // makes the block longer or shorter, so the frame between the edit and
        // its composition delivers a resize, as it would on a page.
        const b = doc.createElement('p');
        b.style.width = '230px';
        b.textContent = text;
        doc.querySelector('main')?.append(b);
        await until(() => intact(b));
        const kept = [];
        for (let attempt = 0; attempt < 3; attempt++) {
          compositions = controller.stats.compositions;
          b.textContent = attempt % 2 ? text : edited;
          const widened = await new Promise(resolve => {
            const start = performance.now();
            const frame = () => {
              if (controller.stats.compositions > compositions) { compositions = controller.stats.compositions; seen = watch(b); b.style.width = '290px'; resolve(true); }
              else if (performance.now() - start > 5000) resolve(false);
              else requestAnimationFrame(frame);
            };
            requestAnimationFrame(frame);
          });
          if (!widened) { kept.push({ attempt, step: 'the edit was not composed' }); break; }
          pass = await until(() => controller.stats.compositions > compositions && intact(b) && Math.abs(api.measureLayout(b).width - 290) < .5);
          if (!pass) { kept.push({ attempt, ...seen(pass) }); break; }
          seen(pass);
          compositions = controller.stats.compositions;
          b.style.width = '230px';
          await until(() => controller.stats.compositions > compositions && intact(b));
        }
        check('a width change in the frame after a composition is recomposed (3 attempts)', !kept.length, kept.length ? kept : undefined);
        // A font inside the iframe: its FontFaceSet, not the parent's, reports it.
        const face = new (/** @type {any} */ (iframe.contentWindow)).FontFace('LateFace', 'url(data:font/woff2;base64,' + font + ')', { weight: '100 900' });
        a.classList.add('late');
        await until(() => controller.stats.passes > 0);
        await wait(200);
        compositions = controller.stats.compositions;
        const before = a.innerHTML;
        seen = watch(a);
        doc.fonts.add(face);
        await face.load();
        pass = await until(() => controller.stats.compositions > compositions && intact(a) && a.innerHTML !== before);
        check('a font loaded inside the iframe is recomposed', pass, seen(pass));
        controller.disconnect();
        check('disconnect restores the iframe text', !doc.querySelector('[data-ts-break]') && a.textContent === edited);
        return out;
      }, { frame, text, mode, font: fixtureFont.toString('base64') });
      report.checks.push(...checks.map(c => ({ browser: name, ...c })));
    }
  } catch (error) { report.errors.push({ browser: name, error: String(/** @type {Error} */ (error).stack || error) }); }
  finally { await browser.close(); }
}
await writeFile('output/iframe-mount.json', JSON.stringify(report, null, 2));
const failures = report.checks.filter(c => !c.pass);
console.log(JSON.stringify({ checks: report.checks.length, failures, errors: report.errors }, null, 2));
if (failures.length || report.errors.length) process.exitCode = 1;
