// @ts-check
// K11: misuse gets a clear, documented message. Invalid option values warn
// once each (the behaviour of the value is unchanged); a non-element target
// throws a TypeError that says what was received; mount('article p') is
// mount(document, 'article p'). Production bundles of the ESM and CommonJS
// entries contain no validator strings; the script-tag builds keep them.
import { build } from 'esbuild';
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { browsers } from './browsers.mjs';
import { artifacts } from './candidate.mjs';

const script = await readFile(artifacts.bundle, 'utf8');
const support = await readFile('packages/typeset-v4/SUPPORT.md', 'utf8');
const corpus = JSON.parse(await readFile('tests/v4-corpus.json', 'utf8')).paragraphs;
const escape = (/** @type {string} */ text) => text.replace(/&/g, '&amp;').replace(/</g, '&lt;');
const html = `<!doctype html><html lang="en"><body style="margin:0;font:17px/1.45 Georgia,serif"><article style="width:420px"><p>${escape(corpus[5])}</p><p>${escape(corpus[9])}</p></article><div style="width:420px"><p id="scratch">${escape(corpus[14])}</p></div></body></html>`;

// Each misuse and the warning it must print once.
const misuses = [
  ['{ smartQuotes: true }', '[typeset] smartQuotes must be "en", "en-declared" or false (received true)'],
  ['{ smartQuotes: "EN" }', '[typeset] smartQuotes must be "en", "en-declared" or false (received "EN")'],
  ['{ spacing: "false" }', '[typeset] spacing must be true or false (received "false")'],
  ['{ tracking: 1 }', '[typeset] tracking must be true or false (received 1)'],
  ['{ opticalHanging: "yes" }', '[typeset] opticalHanging must be true or false (received "yes")'],
  ['{ lineBreaks: "auto" }', '[typeset] lineBreaks must be "unicode" or "legacy" (received "auto")'],
  ['{ contour: "smooth" }', '[typeset] contour must be "finished" or "natural" (received "smooth")'],
  ['{ mode: "para" }', '[typeset] mode must be "body", "heading", "title" or "ui" (received "para")'],
  ['{ density: "loose" }', '[typeset] density must be "compact" or "editorial" (received "loose")'],
  ['{ maxLines: 0 }', '[typeset] maxLines must be a positive integer (received 0)'],
  ['{ keep: "Oak Street" }', '[typeset] keep must be an array of strings (received "Oak Street")'],
  ['{ text: 5 }', '[typeset] text must be a string (received 5)'],
  ['{ spcing: false }', '[typeset] typeset() has no option "spcing"; it is ignored'],
  ['"p"', '[typeset] typeset() options must be an object (received "p")'],
];

/** @type {{ checks: { browser: string, label: string, pass: boolean, detail?: unknown }[], errors: { browser: string, error: string }[] }} */
const report = { checks: [], errors: [] };
/** @param {string} browser @param {string} label @param {boolean} pass @param {unknown} [detail] */
const record = (browser, label, pass, detail) => report.checks.push({ browser, label, pass: !!pass, detail });

// Every message is documented.
for (const [, message] of misuses) record('-', `SUPPORT.md documents ${message}`, support.includes(message.replace('[typeset] ', '')));
for (const message of ['typeset() expects an HTMLElement', 'mount() expects a Document, an Element or a selector string']) record('-', `SUPPORT.md documents "${message}"`, support.includes(message));

// Production and development bundles of the module entries.
const bundle = async (/** @type {string} */ entry, /** @type {string} */ env, /** @type {'esm' | 'cjs'} */ syntax) => (await build({
  stdin: { contents: syntax === 'esm' ? `import { typeset, mount } from ${JSON.stringify(resolve(entry))}; globalThis.x = [typeset, mount];` : `const { typeset, mount } = require(${JSON.stringify(resolve(entry))}); globalThis.x = [typeset, mount];`, resolveDir: process.cwd(), loader: 'js' },
  bundle: true, minify: true, write: false, format: 'esm', target: 'es2022', define: { 'process.env.NODE_ENV': JSON.stringify(env) }, logLevel: 'silent',
})).outputFiles[0].text;
const strings = ['must be true or false', 'has no option', 'must be a positive integer'];
for (const [entry, syntax] of /** @type {[string, 'esm' | 'cjs'][]} */ ([[artifacts.esm, 'esm'], [`${artifacts.dist}/index.cjs`, 'cjs']])) {
  const production = await bundle(entry, 'production', syntax), development = await bundle(entry, 'development', syntax);
  record('-', `${syntax}: a production bundle contains no validator strings`, strings.every(s => !production.includes(s)), strings.filter(s => production.includes(s)));
  record('-', `${syntax}: a development bundle keeps the validator`, strings.every(s => development.includes(s)));
  record('-', `${syntax}: the clear TypeError survives production`, production.includes('expects an HTMLElement'));
}
record('-', 'the script-tag build keeps the validator', strings.every(s => script.includes(s)));

for (const { name, engine, executablePath } of browsers) {
  const browser = await engine.launch({ executablePath, timeout: 20000 });
  try {
    const page = await browser.newPage();
    page.setDefaultTimeout(20000);
    /** @type {string[]} */
    const warnings = [];
    page.on('console', message => { if (message.type() === 'warning') warnings.push(message.text()); });
    await page.setContent(html);
    await page.addScriptTag({ content: script });
    for (const [options, expected] of misuses) {
      warnings.length = 0;
      await page.evaluate(options => { const el = document.getElementById('scratch'); const value = (0, eval)('(' + options + ')'); window.Typeset.typeset(el, value); window.Typeset.restore(el); window.Typeset.typeset(el, value); window.Typeset.restore(el); }, options);
      await page.waitForTimeout(20);
      record(name, `typeset(el, ${options}) warns once: ${expected}`, warnings.length === 1 && warnings[0] === expected, warnings);
    }
    // copy (4.4) is a known boolean option: true and false compose without a
    // warning, another value warns once.
    warnings.length = 0;
    await page.evaluate(() => { const el = /** @type {HTMLElement} */ (document.getElementById('scratch')); for (const copy of [false, true]) { window.Typeset.typeset(el, { copy }); window.Typeset.restore(el); } });
    await page.waitForTimeout(20);
    record(name, 'typeset(el, { copy: false }) and { copy: true } log no warning', warnings.length === 0, [...warnings]);
    await page.evaluate(() => { const el = /** @type {HTMLElement} */ (document.getElementById('scratch')); window.Typeset.typeset(el, { copy: 'no' }); window.Typeset.restore(el); window.Typeset.typeset(el, { copy: 'no' }); window.Typeset.restore(el); });
    await page.waitForTimeout(20);
    record(name, 'typeset(el, { copy: "no" }) warns once: copy must be true or false', warnings.length === 1 && warnings[0] === '[typeset] copy must be true or false (received "no")', [...warnings]);
    // Keys named like Object.prototype members (an options object parsed
    // from JSON) warn like any unknown key and stop no later warning.
    warnings.length = 0;
    const polluted = await page.evaluate(() => {
      const el = /** @type {HTMLElement} */ (document.getElementById('scratch'));
      window.Typeset.typeset(el, JSON.parse('{"hasOwnProperty":1,"density":"airy","__proto__":{"polluted":1},"toString":"x"}'));
      window.Typeset.restore(el);
      return /** @type {any} */ ({}).polluted;
    });
    await page.waitForTimeout(20);
    record(name, 'option keys named like Object.prototype members warn, and later keys still warn', polluted === undefined && ['hasOwnProperty', '__proto__', 'toString'].every(key => warnings.includes(`[typeset] typeset() has no option "${key}"; it is ignored`))
      && warnings.includes('[typeset] density must be "compact" or "editorial" (received "airy")'), [...warnings]);
    warnings.length = 0;
    const thrown = await page.evaluate(() => {
      const w = /** @type {any} */ (window);
      const attempt = (/** @type {() => void} */ run) => { try { run(); return 'no error'; } catch (error) { return /** @type {Error} */ (error).name + ': ' + /** @type {Error} */ (error).message; } };
      return {
        nullTarget: attempt(() => w.Typeset.typeset(null)),
        stringTarget: attempt(() => w.Typeset.typeset('p')),
        mountNull: attempt(() => w.Typeset.mount(null)),
        mountNumber: attempt(() => w.Typeset.mount(42)),
      };
    });
    record(name, 'typeset(null) throws a clear TypeError', thrown.nullTarget === 'TypeError: [typeset] typeset() expects an HTMLElement (received null)', thrown.nullTarget);
    record(name, "typeset('p') throws a clear TypeError that points to selectors", thrown.stringTarget === 'TypeError: [typeset] typeset() expects an HTMLElement (received "p"; typesetAll() and mount() take selectors)', thrown.stringTarget);
    record(name, 'mount(null) throws a clear TypeError', thrown.mountNull === 'TypeError: [typeset] mount() expects a Document, an Element or a selector string (received null)', thrown.mountNull);
    record(name, 'mount(42) throws a clear TypeError', thrown.mountNumber === 'TypeError: [typeset] mount() expects a Document, an Element or a selector string (received 42)', thrown.mountNumber);
    const mounted = await page.evaluate(async () => {
      const w = /** @type {any} */ (window);
      const byString = w.Typeset.mount('article p', { spacing: false });
      await byString.ready;
      const outcomes = [...document.querySelectorAll('article p')].map(p => /** @type {HTMLElement} */ (p).dataset.tsOutcome + '/' + /** @type {HTMLElement} */ (p).dataset.tsSpacing);
      byString.disconnect();
      const wrong = w.Typeset.mount(document, { spacing: false });
      await wrong.ready;
      wrong.disconnect();
      return outcomes;
    });
    record(name, "mount('article p', options) composes the matching elements with those options", mounted.length === 2 && mounted.every(o => o === 'composed:rich/off'), mounted);
    record(name, 'mount(document, options) warns that the selector must be a string', warnings.includes('[typeset] mount() selector must be a string (received an object)'), warnings);
    await page.close();
  } catch (error) { report.errors.push({ browser: name, error: String(/** @type {Error} */ (error).stack || error) }); }
  finally { await browser.close(); }
}
await writeFile('output/options.json', JSON.stringify(report, null, 2));
const failures = report.checks.filter(c => !c.pass);
console.log(JSON.stringify({ checks: report.checks.length, failures, errors: report.errors }, null, 2));
if (failures.length || report.errors.length) process.exitCode = 1;
