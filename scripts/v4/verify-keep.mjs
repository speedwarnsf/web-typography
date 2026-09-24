// @ts-check
// The public keep option (C14). Body text keeps each listed phrase on one
// line wherever it fits the measure, using at most the one extra line a
// stranded opener may earn (none with density: 'compact', where keep works
// within the native line count, as it does in the legacy renderer). Titles
// keep phrases within their minimum line count and never grow a line for
// them. Matching ignores case, NBSP and surrounding punctuation. A keep phrase
// absent from the text changes nothing, including whether a well-set native
// paragraph is retained. (Output with keep omitted is held byte-identical to
// 4.2.0 by verify-golden.)
import { readFile, writeFile } from 'node:fs/promises';
import { browsers } from './browsers.mjs';
import { releaseIdentity } from './release-evidence.mjs';

const watchdog = setTimeout(() => { console.error('verify-keep: watchdog after 170 s'); process.exit(3); }, 170_000);
watchdog.unref();
const bundle = await readFile(process.env.TYPESET_BUNDLE || 'packages/typeset-v4/dist/typeset.global.js', 'utf8');
const BODY = 'The cost of something isn’t just its price tag—it’s the hours of your life you traded to earn that money. Sharp pain is a stop signal, not something to push through. Your wellness data is yours, and we never sell it.';
const RICH = 'The cost of something isn’t just its <em>price tag</em>—it’s the hours of your life you traded to earn that money. Sharp pain is a <a href="#stop">stop signal</a>, not something to push through. Your <strong>wellness data</strong> is yours, and we never sell it.';
const TITLE = 'Your wellness data is a stop signal for price tag thinking';
const KEEP = ['stop signal', 'wellness data', 'price tag'];
// Short paragraphs the engine often retains as set (native:sentence-aligned or native:paragraph-rhythm).
const RETAIN = [
  'Rest is part of training. Sleep is where the body repairs itself. Drink water through the day and eat real food when you are hungry.',
  'Small habits compound over time. A short walk after dinner lowers blood sugar. Ten minutes of stretching in the morning loosens the back and hips.',
  'We keep your records private. We never sell them. You can export or delete everything at any time from the settings page of the app.',
  'Breathing slowly through the nose calms the nervous system and helps you fall asleep. Try four counts in, hold for seven, and eight counts out before bed each night.',
];
const report = { ...await releaseIdentity(), checks: /** @type {any[]} */ ([]), errors: /** @type {any[]} */ ([]), browsers: /** @type {Record<string, string>} */ ({}) };

for (const { name, engine, executablePath } of browsers) {
  const browser = await engine.launch({ executablePath, timeout: 20_000 });
  report.browsers[name] = browser.version();
  const check = (/** @type {string} */ label, /** @type {unknown} */ pass, /** @type {unknown} */ detail) => report.checks.push({ browser: name, label, pass: !!pass, ...(detail === undefined ? {} : { detail }) });
  try {
    const page = await browser.newPage({ viewport: { width: 900, height: 900 } });
    page.setDefaultTimeout(20_000);
    page.on('pageerror', (/** @type {Error} */ error) => report.errors.push({ browser: name, error: error.message }));
    await page.setContent('<!doctype html><html lang="en"><head><style>body{margin:24px}p,h2{font:18px/1.5 Georgia,serif;margin:0 0 12px}h2{font-size:26px;font-weight:600}a{color:#176650}</style></head><body></body></html>');
    await page.addScriptTag({ content: bundle });
    const rows = await page.evaluate(({ BODY, RICH, TITLE, KEEP, RETAIN }) => {
      const api = window.Typeset;
      const run = (/** @type {string} */ tag, /** @type {string} */ html, /** @type {number} */ width, /** @type {any} */ options) => {
        const el = document.createElement(tag);
        el.style.width = width + 'px'; el.innerHTML = html; document.body.append(el);
        const result = api.typeset(el, options);
        const lines = api.measureLayout(el).lines.map((/** @type {any} */ line) => line.text);
        const markup = el.innerHTML;
        api.restore(el); el.remove();
        return { outcome: result.outcome, lines, markup, native: result.before.lines.length };
      };
      /** Phrases split across a line end in these lines. */
      const splits = (/** @type {string[]} */ lines, /** @type {string[]} */ phrases) => {
        const norm = (/** @type {string} */ text) => text.toLowerCase().replace(/[\s ]+/gu, ' ').replace(/[^\p{L} ]/gu, '');
        const out = [];
        for (let i = 0; i < lines.length - 1; i++) {
          const joined = norm(lines[i]) + ' | ' + norm(lines[i + 1]);
          for (const phrase of phrases) { const [a, b] = norm(phrase).split(' '); if (new RegExp('\\b' + a + ' \\| ' + b + '\\b').test(joined)) out.push(phrase); }
        }
        return out;
      };
      const out = [];
      for (let width = 200; width <= 420; width += 20) {
        const plain = run('p', BODY, width, {});
        const kept = run('p', BODY, width, { keep: KEEP });
        out.push({ kind: 'body', width, outcome: kept.outcome, plainSplit: splits(plain.lines, KEEP), split: splits(kept.lines, KEEP), lines: kept.lines, native: kept.native });
        const rich = run('p', RICH, width, { keep: KEEP });
        out.push({ kind: 'rich', width, outcome: rich.outcome, split: splits(rich.lines, KEEP), lines: rich.lines, native: rich.native });
        const loose = run('p', BODY, width, { keep: ['Price Tag', '  STOP   signal ', '(wellness data),'] });
        out.push({ kind: 'normalised', width, outcome: loose.outcome, split: splits(loose.lines, KEEP), lines: loose.lines, native: loose.native });
        const compact = run('p', BODY, width, { keep: KEEP, density: 'compact' });
        out.push({ kind: 'compact', width, outcome: compact.outcome, split: splits(compact.lines, KEEP), plainSplit: splits(run('p', BODY, width, { density: 'compact' }).lines, KEEP), lines: compact.lines, native: compact.native });
        const legacy = run('p', BODY, width, { keep: KEEP, lineBreaks: 'legacy' });
        out.push({ kind: 'legacy', width, outcome: legacy.outcome, split: splits(legacy.lines, KEEP), plainSplit: splits(run('p', BODY, width, { lineBreaks: 'legacy' }).lines, KEEP), lines: legacy.lines, native: legacy.native });
      }
      for (let width = 160; width <= 360; width += 20) {
        const plain = run('h2', TITLE, width, {});
        const kept = run('h2', TITLE, width, { keep: KEEP });
        out.push({ kind: 'title', width, outcome: kept.outcome, plainSplit: splits(plain.lines, KEEP), split: splits(kept.lines, KEEP), lines: kept.lines, plainLines: plain.lines });
      }
      let retained = 0, differ = 0;
      const examples = [];
      for (const text of RETAIN) for (let width = 220; width <= 620; width += 8) {
        const plain = run('p', text, width, {});
        const absent = run('p', text, width, { keep: ['zzzq qqqz'] });
        if (/sentence-aligned|paragraph-rhythm/.test(plain.outcome)) retained++;
        if (plain.outcome !== absent.outcome || plain.markup !== absent.markup) { differ++; if (examples.length < 3) examples.push({ width, plain: plain.outcome, absent: absent.outcome }); }
      }
      out.push({ kind: 'absent', retained, differ, examples });
      return out;
    }, { BODY, RICH, TITLE, KEEP, RETAIN });
    for (const row of rows) {
      if (row.kind === 'absent') {
        check('a keep phrase absent from the text changes nothing', row.differ === 0 && row.retained > 0, row);
      } else if (row.kind === 'title') {
        check(`title ${row.width}px keeps phrases within its line count`, row.lines.length === row.plainLines.length
          && row.split.every((/** @type {string} */ phrase) => row.plainSplit.includes(phrase)), row);
      } else if (row.kind === 'compact' || row.kind === 'legacy') {
        check(`${row.kind} ${row.width}px splits no phrase plain composition keeps and adds no line`,
          row.split.every((/** @type {string} */ phrase) => row.plainSplit.includes(phrase)) && row.lines.length <= row.native, row);
      } else {
        // Each phrase fits the measure at every width here.
        check(`${row.kind} ${row.width}px keeps every phrase`, !row.split.length && /^(composed|native:)/.test(row.outcome) && row.lines.length <= row.native + 1, row);
      }
    }
    const body = rows.filter(row => row.kind === 'body' && row.plainSplit.length);
    const titles = rows.filter(row => row.kind === 'title' && row.split.length < row.plainSplit.length);
    check('keep is exercised where plain composition splits a phrase', body.length >= 3 && titles.length >= 1,
      { body: body.map(row => [row.width, row.plainSplit]), titles: titles.map(row => [row.width, row.plainSplit, row.split]) });
  } catch (error) { report.errors.push({ browser: name, error: String(/** @type {Error} */ (error).stack) }); }
  finally { await browser.close(); }
}
report.summary = { checks: report.checks.length, failed: report.checks.filter(c => !c.pass).length, errors: report.errors.length };
await writeFile('output/keep.json', JSON.stringify(report, null, 2));
console.log(JSON.stringify({ ...report.summary, failures: report.checks.filter(c => !c.pass).slice(0, 10), errors: report.errors }, null, 2));
if (report.summary.failed || report.summary.errors) process.exitCode = 1;
