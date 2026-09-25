// @ts-check
// The rich-copy handler must not put hidden content on the clipboard (C11).
//
// A copy that touches a composed paragraph is serialized by the engine, so
// generated line breaks do not become pasted line breaks. 4.2 built that
// text/html from range.cloneContents(), which keeps what the browser's own
// copy leaves out: display:none notes, hidden inputs such as CSRF tokens,
// visibility:hidden text, templates, scripts and styles. Select-all took the
// same path, so pasting into mail or a document revealed them.
//
// Each engine copies the same selections with a real keyboard shortcut and
// pastes them into an editable sink, once on a composed page and once on an
// uncomposed control. The composed clipboard must carry nothing hidden that
// the control's native copy leaves out, its plain text must equal the
// control's, and it must still hold no engine markers, data-ts or adapter
// attributes (data-ts-stale, data-typeset-react), nor the engine's
// text-wrap-style override: a host keeps the author's inline style, including
// a text-wrap-style the engine overrode.
// A copy inside one paragraph whose source is hard-wrapped and indented
// pastes the text as it renders, not the source's white space.
// (The fixture has no visible text field: Chromium's native plain text
// includes a text field's current value, which Selection.toString(), and so
// the engine's cross-block text, never has. That predates and is outside C11.)
import { readFile, writeFile } from 'node:fs/promises';
import { browsers } from './browsers.mjs';
import { artifacts } from './candidate.mjs';

const watchdog = setTimeout(() => { console.error('verify-copy-privacy: watchdog'); process.exit(3); }, 170_000);
watchdog.unref();

const bundle = await readFile(artifacts.bundle, 'utf8');
// Hard-wrapped, indented source (Markdown output, templated HTML), with a
// tab, a double space and no-break spaces: none of that white space renders,
// and native copy gives single spaces. A copy inside the composed paragraph
// pasted the source's own newlines and indentation, and kept U+00A0.
const P4 = `
        Clinics across the county now offer free testing on weekends.
        No appointment is needed for walk-in visits, and results
        arrive by text message within two days. The fox\tjumps  far away,
        and doses of 50\u00a0mg start at 9\u00a0a.m. each morning.
    `;
const MARKS = ['INTERNALNOTE', 'CSRFTOKEN8F3A2C', 'VISHIDDEN', 'ATTRHIDDEN', 'TEMPLATECONTENT', 'SCRIPTJSON', 'STYLECONTENT', 'CVHIDDEN'];
const page = (/** @type {boolean} */ composed) => `<!doctype html><html lang="en"><head><meta charset="utf-8"><style>
body{margin:16px;background:#fff;font:18px/1.5 Georgia}main{width:320px}p{margin:0 0 14px}.admin-note{display:none}.cv{content-visibility:hidden}#sink{min-height:40px;border:1px solid #999}
</style></head><body><main>
<p id="p1">Every morning the corner shop puts out a small chalkboard with the day's price tag for bread, and the regulars read it before they even say hello to anyone behind the counter.</p>
<div class="admin-note">INTERNALNOTE patient flagged for a follow-up call</div>
<form><input type="hidden" name="csrf" value="CSRFTOKEN8F3A2C"><label>Search the archive</label></form>
<div>Shown text <span style="visibility:hidden">VISHIDDEN</span> after it.</div>
<div hidden>ATTRHIDDEN</div><template>TEMPLATECONTENT</template><script type="application/json">{"SCRIPTJSON":1}</script><style>.unused::after{content:"STYLECONTENT"}</style>
<div class="cv">CVHIDDEN</div>
<p id="p2" style="color: rgb(17, 17, 17);">Read the <em>careful</em> notes in <a href="/guide">the neighborhood gallery guide</a> before you plan a visit, because the opening hours change with the seasons and the weather.</p>
<p id="p3" style="text-wrap-style: pretty;" data-typeset-react="">Our volunteers built a wellness data dashboard for every clinic in the county and published the results openly for anyone to review.</p>
<p id="p4">${P4}</p>
</main><div id="sink" contenteditable="true"></div>
${composed ? '<script src="/typeset.js"></script>' : ''}</body></html>`;

/** @type {{ browser: string, label: string, pass: boolean, detail?: unknown }[]} */
const checks = [];
/** @type {{ browser: string, error: string }[]} */
const errors = [];

/** Selections by source offsets, so the composed page and the control select
 * the same characters however composition split the Text nodes. */
const SELECTIONS = {
  'p1 to p2': [['#p1', 6], ['#p2', 3]],
  'select all': [['main', 0], ['main', -1]],
  'within p1': [['#p1', 6], ['#p1', -10]],
  'within p4, across the source\'s line wraps': [['#p4', P4.indexOf('No appointment')], ['#p4', P4.indexOf('two days') + 8]],
  'all of p4': [['#p4', 0], ['#p4', -1]],
};
/** @param {[[string, number], [string, number]]} points */
function select(points) {
  const at = (/** @type {string} */ selector, /** @type {number} */ offset) => {
    const root = /** @type {Element} */ (document.querySelector(selector));
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    const total = (root.textContent || '').length;
    let remaining = offset < 0 ? total + offset : offset;
    if (offset === -1) return /** @type {[Node, number]} */ ([root, root.childNodes.length]);
    while (walker.nextNode()) {
      const text = /** @type {Text} */ (walker.currentNode);
      if (remaining <= text.length) return /** @type {[Node, number]} */ ([text, remaining]);
      remaining -= text.length;
    }
    return /** @type {[Node, number]} */ ([root, root.childNodes.length]);
  };
  const range = document.createRange();
  range.setStart(...at(...points[0])); range.setEnd(...at(...points[1]));
  getSelection()?.removeAllRanges(); getSelection()?.addRange(range);
}

for (const config of browsers) {
  const browser = await config.engine.launch({ executablePath: config.executablePath, timeout: 20000 });
  /** @param {string} label @param {unknown} pass @param {unknown} [detail] */
  const check = (label, pass, detail) => checks.push({ browser: config.name, label, pass: !!pass, ...(detail === undefined ? {} : { detail }) });
  try {
    /** @type {Record<string, Record<string, { html: string, text: string, handled: boolean }>>} */
    const clip = {};
    /** The inline styles as the CSSOM holds them before composition (an engine
     * without text-wrap-style: pretty drops that declaration). */
    let authored = { p2: '', p3: '' };
    for (const composed of [true, false]) {
      const context = await browser.newContext({ viewport: { width: 520, height: 1200 }, ...(config.name === 'chromium' ? { permissions: ['clipboard-read', 'clipboard-write'] } : {}) });
      await context.route('http://copy.test/**', route => new URL(route.request().url()).pathname === '/typeset.js'
        ? route.fulfill({ contentType: 'text/javascript', body: bundle })
        : route.fulfill({ contentType: 'text/html; charset=utf-8', body: page(composed) }));
      const tab = await context.newPage();
      tab.setDefaultTimeout(20000);
      tab.on('pageerror', error => errors.push({ browser: config.name, error: error.message }));
      await tab.goto('http://copy.test/page');
      if (composed) {
        authored = await tab.evaluate(() => ({ p2: /** @type {HTMLElement} */ (document.getElementById('p2')).style.cssText, p3: /** @type {HTMLElement} */ (document.getElementById('p3')).style.cssText }));
        await tab.evaluate(async () => { const c = window.Typeset.mount(document, 'main p'); await c.ready; });
        check('the paragraphs compose with generated breaks', await tab.evaluate(() => ['p1', 'p2', 'p3', 'p4'].every(id => document.getElementById(id)?.dataset.tsOutcome === 'composed:rich') && document.querySelectorAll('br[data-ts-break]').length > 3));
        // p1 as the engine marks a block whose width is changing.
        await tab.evaluate(() => document.getElementById('p1')?.setAttribute('data-ts-stale', ''));
      }
      await tab.evaluate(() => {
        const w = /** @type {any} */ (window);
        w.captured = null;
        // Registered after the engine's handler, so it sees that handler's decision.
        document.addEventListener('copy', e => { w.handled = e.defaultPrevented; });
        /** @type {HTMLElement} */ (document.getElementById('sink')).addEventListener('paste', e => { w.captured = { html: e.clipboardData?.getData('text/html') ?? '', text: e.clipboardData?.getData('text/plain') ?? '' }; e.preventDefault(); });
      });
      const results = clip[composed ? 'composed' : 'control'] = {};
      for (const [name, points] of Object.entries(SELECTIONS)) {
        await tab.evaluate(() => { /** @type {any} */ (window).captured = null; /** @type {any} */ (window).handled = null; });
        await tab.evaluate(select, points);
        await tab.keyboard.press('ControlOrMeta+C');
        await tab.evaluate(() => { const sink = /** @type {HTMLElement} */ (document.getElementById('sink')); sink.focus(); const s = /** @type {Selection} */ (getSelection()); s.removeAllRanges(); const r = document.createRange(); r.selectNodeContents(sink); r.collapse(true); s.addRange(r); });
        await tab.keyboard.press('ControlOrMeta+V');
        await tab.waitForFunction(() => /** @type {any} */ (window).captured !== null, null, { timeout: 5000 });
        results[name] = await tab.evaluate(() => ({ .../** @type {any} */ (window).captured, handled: /** @type {any} */ (window).handled }));
      }
      await context.close();
    }
    for (const name of Object.keys(SELECTIONS)) {
      const a = clip.composed[name], b = clip.control[name];
      const leaked = MARKS.filter(mark => (a.html.includes(mark) || a.text.includes(mark)) && !b.html.includes(mark) && !b.text.includes(mark));
      check(`${name}: the engine serializes the copy`, a.handled === true);
      check(`${name}: nothing hidden reaches the clipboard that native copy leaves out`, leaked.length === 0, { leaked, nativeKept: MARKS.filter(mark => b.html.includes(mark)) });
      check(`${name}: no engine markers, data-ts or adapter attributes, or wrap override in the HTML`, !/data-ts-|data-typeset-|text-wrap-style:\s*auto/.test(a.html), a.html.slice(0, 300));
      const normal = (/** @type {string} */ text) => text.replace(/\r\n/g, '\n').trim();
      check(`${name}: plain text equals native copy of the uncomposed page`, normal(a.text) === normal(b.text), { composed: a.text.slice(0, 240), native: b.text.slice(0, 240) });
    }
    check('within p1: the words on either side of each generated break keep their space', /corner shop puts out a small/.test(clip.composed['within p1'].text.replace(/\s+/g, ' ')), clip.composed['within p1'].text);
    const tag = (/** @type {string} */ id, /** @type {string} */ style) => `<p id="${id}"${style ? ` style="${style}"` : ''}>`;
    check('select all: the author\'s inline styles survive, including a text-wrap-style the engine overrode', clip.composed['select all'].html.includes(tag('p2', authored.p2)) && clip.composed['select all'].html.includes(tag('p3', authored.p3)), { authored, tags: clip.composed['select all'].html.match(/<p [^>]*>/g) });
    check('the link is still absolute and emphasis survives in the HTML', /href="http:\/\/copy\.test\/guide"/.test(clip.composed['p1 to p2'].html) || /href="http:\/\/copy\.test\/guide"/.test(clip.composed['select all'].html), clip.composed['select all'].html.slice(0, 400));
    check('the uncomposed control proves the page hides these marks from native copy', MARKS.filter(mark => clip.control['select all'].text.includes(mark)).length === 0, MARKS.filter(mark => clip.control['select all'].text.includes(mark)));
  } catch (error) {
    errors.push({ browser: config.name, error: String(/** @type {Error} */ (error).stack || error) });
  } finally { await browser.close(); }
}

const failures = checks.filter(c => !c.pass);
await writeFile('output/copy-privacy.json', JSON.stringify({ bundle: artifacts.bundle, marks: MARKS, checks, errors }, null, 2));
console.log(JSON.stringify({ checks: checks.length, failed: failures.length, failures, errors }, null, 2));
if (failures.length || errors.length) process.exitCode = 1;
