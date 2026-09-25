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
import { build } from 'esbuild';
import { readFile, writeFile } from 'node:fs/promises';
import { browsers } from './browsers.mjs';
import { releaseIdentity } from './release-evidence.mjs';
import { reactUnderTest } from './candidate.mjs';

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

// keptPhrases in linear time, with the release candidate's output. From each
// start it rebuilt and rescanned the joined units at every step and stopped
// only once they grew longer than the longest phrase; units that end in a
// dash and strip to nothing (en dash units, "— units) never did, so the
// search cost the cube of the run: in node 1,000 em dash units took 4.6 s and
// 2,000 took 30 s, and typeset() with keep on 1,088 characters took 651 ms in
// Chromium, 1,234 ms in WebKit and 547 ms in Firefox (without keep: 35 to
// 176 ms). It runs on every composition and recomposition.
{
  /** keptPhrases as the release candidate at 4f1815c had it: the reference. @param {readonly string[]} texts @param {unknown} keep */
  const reference = (texts, keep) => {
    const stripEnd = (/** @type {string} */ text, /** @type {string} */ chars) => { let end = text.length; while (end > 0 && chars.includes(text[end - 1])) end--; return end === text.length ? text : text.slice(0, end); };
    const leading = (/** @type {string} */ text) => text.replace(/^[("'\u201c\u2018[{]+/u, '');
    const trailing = (/** @type {string} */ text) => stripEnd(text, '.,;:!?"\'\u201d\u2019)]}\u2013\u2014');
    const normalize = (/** @type {string} */ text) => text.toLowerCase().replace(/[\s\u00a0\u202f]+/gu, ' ').trim();
    const list = Array.isArray(keep) ? keep.filter(phrase => typeof phrase === 'string') : [];
    const phrases = [...new Set(list.map(phrase => trailing(leading(normalize(phrase))))
      .filter(phrase => phrase.includes(' ') || /[-\u2010\u2013\u2014/]./u.test(phrase)))];
    /** @type {{ start: number, end: number }[]} */
    const found = [];
    if (!phrases.length) return found;
    const longest = Math.max(...phrases.map(phrase => phrase.length));
    for (let start = 0; start < texts.length; start++) {
      let joined = '';
      for (let end = start + 1; end <= texts.length; end++) {
        const unit = normalize(texts[end - 1]);
        joined += (end === start + 1 || /[-\u2010\u2013\u2014/]$/u.test(joined) ? '' : ' ') + unit;
        const bare = trailing(leading(joined));
        if (bare.length > longest) break;
        if (end - start > 1 && phrases.includes(bare)) found.push({ start, end });
      }
    }
    return found;
  };
  const source = (await build({ entryPoints: ['src/lib/v4/phrase-boundaries.ts'], bundle: true, write: false, format: 'esm', platform: 'node', target: 'node20', logLevel: 'silent' })).outputFiles[0].text;
  /** @type {{ keptPhrases: (texts: readonly string[], keep: unknown) => { start: number, end: number }[] }} */
  const { keptPhrases } = await import('data:text/javascript;base64,' + Buffer.from(source).toString('base64'));
  const check = (/** @type {string} */ label, /** @type {unknown} */ pass, /** @type {unknown} */ detail) => report.checks.push({ label, pass: !!pass, ...(detail === undefined ? {} : { detail }) });
  let seed = 4301;
  const random = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 2 ** 32; };
  const pick = (/** @type {readonly any[]} */ list) => list[Math.floor(random() * list.length)];
  // Letters, marks leading() or trailing() strips, joiners, spaces a unit may
  // hold (NBSP), a letter whose lower case is longer, surrogates, empty units.
  const atoms = ['a', 'b', 'new', 'york', 'New', 'YORK', 'x', '', '', '\u2013', '\u2014', '-', '\u2010', '/', '"', "'", '\u201c', '\u201d', '\u2018', '\u2019', '(', ')', '[', ']', '{', '}',
    '.', ',', ';', ':', '!', '?', '\u00a0', ' ', '\u202f', '\u0130', '\ud83d\ude00', '\ud83d', 'a b', 'long', 'term', 'care', 'price', 'tag'];
  const words = ['new', 'york', 'New', 'York\u2013', 'city', '(new', 'york)', 'york.', '"new', 'york,"', 'a', 'b', 'x-', 'y', 'price', 'tag\u2014', 'it\u2019s'];
  const dashes = ['\u2013', '\u2014', '"\u2014', '(\u2014', '\u2014)', '', '\u2013.', '-', '/', '\u2010', '.', '"', "'", '('];
  const unit = () => { let text = ''; for (let n = Math.floor(random() * 4); n > 0; n--) text += pick(atoms); return text; };
  const phraseOf = (/** @type {string[]} */ units) => units.map(u => (random() < .5 ? ' ' : pick(['', '\u2013', '-', '/', ' ', '  '])) + u).join('');
  /** @type {[string[], unknown[]][]} */
  const cases = [];
  for (let trial = 0; trial < 20000; trial++) {
    const texts = Array.from({ length: Math.floor(random() * 14) }, unit);
    const keep = [];
    for (let n = 1 + Math.floor(random() * 3); n > 0; n--) {
      if (texts.length && random() < .7) { const s = Math.floor(random() * texts.length); keep.push(phraseOf(texts.slice(s, s + 1 + Math.floor(random() * 4))).trim() + (random() < .2 ? pick([',', ')', '.']) : '')); }
      else keep.push(phraseOf([unit(), unit(), unit()]));
    }
    if (random() < .05) keep.push(42);
    cases.push([texts, keep]);
  }
  for (let trial = 0; trial < 10000; trial++) {
    const texts = Array.from({ length: Math.floor(random() * 60) }, () => random() < .5 ? pick(words) : pick(dashes));
    cases.push([texts, [pick(['New York', 'new york city', '( new york', 'york\u2013city', 'x-y', 'price tag', 'a b', '\u2014 a', 'a \u2014b', 'york\u2013', '" new', 'a/b']), pick(['New York', 'x-y', 'b a', 'it\u2019s new'])]]);
  }
  // Real prose: each corpus paragraph with two and three word phrases it holds.
  for (const text of JSON.parse(await readFile('tests/v4-corpus.json', 'utf8')).paragraphs) {
    const texts = text.split(/\s+/u).filter(Boolean);
    const keep = [0, 1, 2].map(() => { const s = Math.floor(random() * Math.max(1, texts.length - 2)); return texts.slice(s, s + 2 + Math.floor(random() * 2)).join(' '); });
    cases.push([texts, keep], [texts, ['wellness data', 'price tag', 'long-term care']]);
  }
  // A kept phrase followed by a dash run matches at every unit of the run.
  cases.push([['go', 'to', 'new', 'york\u2013', ...Array(300).fill('\u2013'), '', '', 'x'], ['New York']], [['(', 'new', 'york\u2014', ...Array(200).fill('"\u2014')], ['( new york', 'New York']]);
  let matched = 0;
  const mismatched = [];
  for (const [texts, keep] of cases) {
    const expected = JSON.stringify(reference(texts, keep)), actual = JSON.stringify(keptPhrases(texts, keep));
    if (expected !== '[]') matched++;
    if (expected !== actual && mismatched.length < 3) mismatched.push({ texts: texts.slice(0, 20), keep, expected: expected.slice(0, 200), actual: actual.slice(0, 200) });
    else if (expected !== actual) mismatched.push(null);
  }
  check('keptPhrases matches the release candidate on random, dash-run and corpus unit lists', cases.length > 30000 && matched > 3000 && !mismatched.length,
    { cases: cases.length, withMatches: matched, mismatches: mismatched.length, examples: mismatched.slice(0, 3) });
  const words17 = 'The results of the survey arrived in the spring and the team read every one of them'.split(' ');
  for (const [name, dash, count] of /** @type {const} */ ([['en dash', '\u2013', 460], ['"\u2014', '"\u2014', 460], ['em dash', '\u2014', 1000], ['em dash', '\u2014', 2000]])) {
    const texts = [...words17, ...Array(count).fill(dash), ...words17];
    keptPhrases(texts.slice(0, 40), ['New York']);
    const began = performance.now();
    const found = keptPhrases(texts, ['New York', 'the team']);
    const ms = performance.now() - began;
    check(`keptPhrases on ${count.toLocaleString('en-US')} ${name} units is linear (under 50 ms)`, ms < 50 && found.length === 2, { ms: Math.round(ms * 10) / 10, found: found.length });
  }
}

// Both React adapters take keep as a prop, at widths where plain composition splits a phrase.
const react = await build({ stdin: { contents: `
import React from 'react'; import { createRoot } from 'react-dom/client';
import { TypesetText, TypesetRichText } from './src/lib/v4/typeset.release.react';
const keep = ${JSON.stringify(KEEP)};
createRoot(document.getElementById('root')!).render(<>{[200, 260, 280, 360].map(width => <React.Fragment key={width}>
  <TypesetText id={'plain-' + width} style={{ width }} text={${JSON.stringify(BODY)}} keep={keep} />
  <TypesetRichText id={'rich-' + width} style={{ width }} keep={keep}>${RICH}</TypesetRichText>
</React.Fragment>)}</>);`, loader: 'tsx', resolveDir: process.cwd() }, bundle: true, write: false, format: 'iife', target: 'es2022', plugins: [reactUnderTest()] });

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
    // The release candidate took 651 / 1,234 / 547 ms here with keep (en
    // dash units) and 1,216 / 1,701 / 905 ms ("— units), against 35 to 176
    // ms without it (keptPhrases, above).
    const timing = await page.evaluate(() => {
      const api = window.Typeset;
      const words = 'The results of the survey arrived in the spring and the team read every one of them';
      const p = document.createElement('p');
      p.style.width = '600px'; document.body.append(p);
      const timed = (/** @type {string} */ text, /** @type {any} */ options) => {
        const times = [];
        let outcome = '';
        for (let i = 0; i < 3; i++) { p.textContent = text; const began = performance.now(); outcome = api.typeset(p, options).outcome; times.push(performance.now() - began); api.restore(p); }
        return { ms: Math.round(times.sort((a, b) => a - b)[1]), outcome };
      };
      const out = [];
      for (const unit of ['\u2013', '"\u2014']) {
        const text = words + ' ' + (unit + ' ').repeat(460) + words + '.';
        out.push({ unit, chars: text.length, plain: timed(text, {}), keep: timed(text, { keep: ['New York'] }) });
      }
      p.remove();
      return out;
    });
    for (const row of timing) check(`typeset() with keep on ${row.chars.toLocaleString('en-US')} characters of ${row.unit} units costs about what it does without keep`, row.keep.ms < row.plain.ms * 2 + 60, row);

    await page.setContent('<!doctype html><html lang="en"><head><style>body{margin:24px}p{font:18px/1.5 Georgia,serif;margin:0 0 12px}a{color:#176650}</style></head><body><div id="root"></div></body></html>');
    await page.addScriptTag({ content: bundle });
    await page.addScriptTag({ content: react.outputFiles[0].text });
    await page.waitForFunction(() => [...document.querySelectorAll('#root p')].length === 8 && [...document.querySelectorAll('#root p')].every(p => /** @type {HTMLElement} */ (p).dataset.tsOutcome));
    await page.waitForTimeout(150);
    const adapters = await page.evaluate(KEEP => [...document.querySelectorAll('#root p')].map(p => {
      const lines = window.Typeset.measureLayout(p).lines.map((/** @type {any} */ line) => line.text.toLowerCase().replace(/[^\p{L} ]/gu, ''));
      const split = KEEP.filter(phrase => lines.slice(0, -1).some((line, i) => line.endsWith(' ' + phrase.split(' ')[0]) && lines[i + 1].startsWith(phrase.split(' ')[1])));
      return { id: p.id, outcome: /** @type {HTMLElement} */ (p).dataset.tsOutcome, split };
    }), KEEP);
    for (const row of adapters) check(`React ${row.id.replace(/-.*/, '') === 'plain' ? 'TypesetText' : 'TypesetRichText'} ${row.id.replace(/^\w+-/, '')}px keeps every phrase`, !row.split.length && /^(composed|native:)/.test(row.outcome), row);
  } catch (error) { report.errors.push({ browser: name, error: String(/** @type {Error} */ (error).stack) }); }
  finally { await browser.close(); }
}
report.summary = { checks: report.checks.length, failed: report.checks.filter(c => !c.pass).length, errors: report.errors.length };
await writeFile('output/keep.json', JSON.stringify(report, null, 2));
console.log(JSON.stringify({ ...report.summary, failures: report.checks.filter(c => !c.pass).slice(0, 10), errors: report.errors }, null, 2));
if (report.summary.failed || report.summary.errors) process.exitCode = 1;
