// @ts-check
// C12: mount() from a parent page into a same-origin iframe (CMS previews, page
// builders). The iframe's nodes come from another realm, so the controller must
// not rely on instanceof against the parent's constructors, and must listen to
// the iframe's own font set and window.
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
      const checks = await page.evaluate(async ({ frame, mode, font }) => {
        const api = /** @type {any} */ (window).Typeset;
        const iframe = /** @type {HTMLIFrameElement} */ (document.getElementById('f'));
        await new Promise(resolve => { iframe.onload = resolve; iframe.srcdoc = frame; });
        const doc = /** @type {Document} */ (iframe.contentDocument);
        const out = [];
        const check = (label, pass, detail) => out.push({ label: mode + ': ' + label, pass: !!pass, detail });
        const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
        const until = async (test, ms = 5000) => { const start = performance.now(); while (!test()) { if (performance.now() - start > ms) return false; await wait(20); } return true; };
        const intact = el => el.dataset.tsOutcome === 'composed:rich' && api.measureLayout(el).lines.length === el.querySelectorAll('br[data-ts-break]').length + 1;
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
        a.textContent = edited;
        check('a text edit is recomposed', await until(() => controller.stats.compositions > compositions && a.textContent === edited && intact(a)), { outcome: a.dataset.tsOutcome, text: a.textContent });
        compositions = controller.stats.compositions;
        a.style.width = '230px';
        check('a width change is recomposed', await until(() => controller.stats.compositions > compositions && intact(a) && Math.abs(api.measureLayout(a).width - 230) < .5), api.measureLayout(a).width);
        compositions = controller.stats.compositions;
        iframe.style.width = '260px';
        inserted.style.width = 'auto';
        check('an iframe resize is recomposed', await until(() => controller.stats.compositions > compositions && intact(inserted) && api.measureLayout(inserted).width <= 260), api.measureLayout(inserted).width);
        // A font inside the iframe: its FontFaceSet, not the parent's, reports it.
        const face = new (/** @type {any} */ (iframe.contentWindow)).FontFace('LateFace', 'url(data:font/woff2;base64,' + font + ')', { weight: '100 900' });
        a.classList.add('late');
        await until(() => controller.stats.passes > 0);
        await wait(200);
        compositions = controller.stats.compositions;
        const before = a.innerHTML;
        doc.fonts.add(face);
        await face.load();
        check('a font loaded inside the iframe is recomposed', await until(() => controller.stats.compositions > compositions && intact(a) && a.innerHTML !== before), { outcome: a.dataset.tsOutcome, lines: api.measureLayout(a).lines.length, breaks: a.querySelectorAll('br[data-ts-break]').length });
        controller.disconnect();
        check('disconnect restores the iframe text', !doc.querySelector('[data-ts-break]') && a.textContent === edited);
        return out;
      }, { frame, mode, font: fixtureFont.toString('base64') });
      report.checks.push(...checks.map(c => ({ browser: name, ...c })));
    }
  } catch (error) { report.errors.push({ browser: name, error: String(/** @type {Error} */ (error).stack || error) }); }
  finally { await browser.close(); }
}
await writeFile('output/iframe-mount.json', JSON.stringify(report, null, 2));
const failures = report.checks.filter(c => !c.pass);
console.log(JSON.stringify({ checks: report.checks.length, failures, errors: report.errors }, null, 2));
if (failures.length || report.errors.length) process.exitCode = 1;
