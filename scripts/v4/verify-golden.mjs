// @ts-check
// Golden composition: the build under test against the published 4.2.0 build,
// cell by cell, in the same page of each engine.
//
//   node scripts/v4/verify-golden.mjs              every corpus paragraph, 3 engines in parallel (about 35 s)
//   --stride 4 samples every fourth paragraph      --engines chromium,webkit
//   --out <file>                                   --baseline <typeset.global.js> (default: the published 4.2.0)
//
// A cell is one paragraph at one width in one font, composed with one set of
// options. For every cell the suite records what each build produced: the
// outcome, the finish features and the element's markup after composition,
// which carries every break, spacing marker and tracking run. Cells must be
// identical to 4.2.0, apart from the attribute-only accessibility and break
// display changes (attributeNeutral, counted apart), a break moved out of
// the element that starts its line (breakOutside, counted apart) and 4.4's
// move of the markers' shared declarations into the engine's stylesheet
// (styleMoved, counted apart; line boxes and marker geometry must be
// identical), unless the text contains
// a construction a 4.3 rendering change (CHANGELOG, "Rendering changes") is
// about; those cells are
// counted and must still keep the paragraph's promises: no overflow, no new
// orphan, and the same decision in every engine where 4.2.0 agreed.
//
// The coverage corpus (tests/v4-corpus-4.4.json: long unbreakable runs,
// declared languages, Greek letters in Latin text, inline elements, quotes)
// is composed at the same widths and fonts and reported apart, as the
// "coverage" variant, against the release 4.4 is measured against
// (--coverage-baseline, default the published 4.3.1). A coverage cell must be
// identical to that release unless its case names the outcome this build
// must report (expect) or a change this build makes (coverageChanges below);
// report.counts.<engine> coverage says how many cells each build composed.
// The coverage additions (class C cases) are changes only in a pass composed
// with coverage: 'extended'; under 'core', the default (COVERAGE_DEFAULT in
// src/lib/v4/coverage.ts), they must equal 4.3.1 too.
// --subject-options '{"coverage":"extended"}' composes every cell of the
// build under test with those options, and the coverage corpus once more
// with the build's defaults (report.counts.<engine> coverage-default).
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { parseArgs } from 'node:util';
import { browsers } from './browsers.mjs';
import { releaseIdentity } from './release-evidence.mjs';
import { installFixtureFont } from './font-fixture.mjs';

const { values } = parseArgs({ options: {
  stride: { type: 'string', default: '1' },
  engines: { type: 'string' },
  out: { type: 'string', default: 'output/golden.json' },
  baseline: { type: 'string', default: 'public/releases/4.2.0/typeset.global.js' },
  'coverage-baseline': { type: 'string', default: 'public/releases/4.3.1/typeset.global.js' },
  dump: { type: 'string' },
  // Options merged into every cell's options for the build under test only,
  // e.g. '{"coverage":"extended"}': with it, coverage additions (class C
  // cases) may change the coverage corpus; under 'core' they must leave it as
  // the coverage baseline had it.
  'subject-options': { type: 'string' },
  // Sweep bind weights (typeset.ts bindWeights), e.g. '{"pair":1.5}'. Release
  // builds compile the override out, so the subject is then a research build
  // of src/ that reads globalThis.__TYPESET_BIND__, as bind-harness.mjs does.
  bind: { type: 'string' },
} });
const started = performance.now();
// Under its 300 s suite timeout (suites.mjs), so it reports itself first;
// hosted macos-15 runs have taken up to 158 s.
const watchdog = setTimeout(() => { console.error('verify-golden: watchdog after 290 s'); process.exit(3); }, 290_000);
watchdog.unref();

const corpus = JSON.parse(await readFile('tests/v4-corpus.json', 'utf8')).paragraphs;
/** @type {{ id: string, text: string }[]} */
const adversarial = JSON.parse(await readFile('tests/v4-corpus-adversarial.json', 'utf8')).paragraphs;
/** @type {{ id: string, group: string, class: string, html: string, lang?: string, options?: Record<string, unknown>, style?: string, expect?: string, reference?: string }[]} */
const coverage = JSON.parse(await readFile('tests/v4-corpus-4.4.json', 'utf8')).cases;
const baseline = await readFile(values.baseline, 'utf8');
const coverageBaseline = await readFile(values['coverage-baseline'], 'utf8');
const subject = values.bind
  ? (await (await import('esbuild')).build({ entryPoints: ['src/lib/v4/typeset.release.standalone.ts'], bundle: true, format: 'iife', target: 'es2022', write: false, logLevel: 'silent',
    define: { __TYPESET_BIND_OVERRIDE__: 'globalThis.__TYPESET_BIND__', 'process.env.NODE_ENV': '"development"' } })).outputFiles[0].text
  : await readFile(process.env.TYPESET_BUNDLE || 'packages/typeset-v4/dist/typeset.global.js', 'utf8');
const stride = Math.max(1, Number(values.stride) || 1);
/** @type {Record<string, unknown>} */
const subjectOptions = values['subject-options'] ? JSON.parse(values['subject-options']) : {};
/** The engine's default coverage, which the coverage-default pass and a run
 * without a coverage subject option compose with. */
const coverageDefault = /COVERAGE_DEFAULT: Coverage = '(\w+)'/.exec(await readFile('src/lib/v4/coverage.ts', 'utf8'))?.[1] ?? 'core';
/** The coverage a pass over the coverage corpus composes with. @param {string} variant */
const passCoverage = variant => variant === 'coverage-default' ? coverageDefault : String(subjectOptions.coverage ?? coverageDefault);
const report = { ...await releaseIdentity(), baseline: values.baseline, coverageBaseline: values['coverage-baseline'], subjectOptions, baselineVersions: /** @type {Record<string, string>} */ ({}), stride, checks: /** @type {any[]} */ ([]), errors: /** @type {any[]} */ ([]), browsers: /** @type {Record<string, string>} */ ({}), counts: /** @type {Record<string, any>} */ ({}), changed: /** @type {any[]} */ ([]) };

const texts = corpus.filter((/** @type {string} */ _, /** @type {number} */ i) => i % stride === 0);
const widths = [240, 320, 400, 560];
const fonts = ['Georgia', 'TypesetFixture'];
/** @param {string} text */
const escape = text => text.replace(/&/g, '&amp;').replace(/</g, '&lt;');
/** A link and emphasis inside the paragraph, as authors write them. @param {string} text */
function linked(text) {
  const words = text.split(' ');
  if (words.length < 12) return escape(text);
  const html = words.map(escape);
  html[3] = '<a href="#golden">' + html[3] + ' ' + html[4] + '</a>'; html[4] = '';
  html[8] = '<em>' + html[8] + '</em>';
  return html.filter(Boolean).join(' ');
}
/** React's server rendering between interpolated strings (Next, Astro islands):
 * a comment at every fourth word boundary. @param {string} text */
function separated(text) {
  const words = text.split(' ').map(escape), chunks = [];
  for (let i = 0; i < words.length; i += 4) chunks.push(words.slice(i, i + 4).join(' '));
  return chunks.join(' <!-- -->');
}
/** @typedef {{ id: string, variant: string, tag: string, html: string, width: number, font: string, options: Record<string, unknown>, style?: string, lang?: string, case?: string, group?: string, class?: string, expect?: string, reference?: string }} Cell */
/** @type {Cell[]} */
const cells = [];
for (const [index, text] of texts.entries()) for (const width of widths) for (const font of fonts) {
  const at = `${index * stride}@${width}/${font}`;
  cells.push({ id: 'default ' + at, variant: 'default', tag: 'p', html: escape(text), width, font, options: {} });
  cells.push({ id: 'rich ' + at, variant: 'rich', tag: 'p', html: linked(text), width, font, options: {} });
  cells.push({ id: 'legacy ' + at, variant: 'legacy', tag: 'p', html: escape(text), width, font, options: { lineBreaks: 'legacy', contour: 'natural' } });
  if (index % 2 === 0) cells.push({ id: 'finishes ' + at, variant: 'finishes', tag: 'p', html: escape(text), width, font, options: { smartQuotes: 'en', opticalHanging: true } });
  if (index % 2 === 1) cells.push({ id: 'justified ' + at, variant: 'justified', tag: 'p', html: escape(text), width, font, options: {}, style: 'text-align:justify' });
  if (index % 2 === 0) cells.push({ id: 'comments ' + at, variant: 'comments', tag: 'p', html: separated(text), width, font, options: {} });
  if (width <= 320) {
    const title = text.split(' ').slice(0, 9).join(' ');
    cells.push({ id: 'title ' + at, variant: 'title', tag: 'h2', html: escape(title), width: width - 60, font, options: {} });
  }
}

for (const { id, text } of adversarial) for (const width of widths) for (const font of fonts) {
  const at = `${id}@${width}/${font}`;
  cells.push({ id: 'adversarial ' + at, variant: 'adversarial', tag: 'p', html: escape(text), width, font, options: {} });
  cells.push({ id: 'adversarial-legacy ' + at, variant: 'adversarial-legacy', tag: 'p', html: escape(text), width, font, options: { lineBreaks: 'legacy', contour: 'natural' } });
}

// Coverage cells are composed at every width and font, like the corpus, with
// the case's options, lang and style. A run with --subject-options composes
// them a second time with the build's defaults (the coverage-default
// variant), so one run with '{"coverage":"extended"}' shows both what
// 'extended' adds and that the default leaves the coverage additions as
// 4.3.1 had them.
for (const variant of Object.keys(subjectOptions).length ? ['coverage', 'coverage-default'] : ['coverage']) {
  for (const item of coverage) for (const width of widths) for (const font of fonts) {
    cells.push({ id: `${variant} ${item.id}@${width}/${font}`, variant, tag: 'p', html: item.html, width, font, options: item.options ?? {},
      ...(item.style && { style: item.style }), ...(item.lang !== undefined && { lang: item.lang }), case: item.id, group: item.group, class: item.class, ...(item.expect && { expect: item.expect }), ...(item.reference && { reference: item.reference }) });
  }
}
const isCoverage = (/** @type {string} */ variant) => variant === 'coverage' || variant === 'coverage-default';

/**
 * Coverage cases this build changes on purpose, by case id, with the change.
 * A cell whose case names an `expect` outcome is checked against it instead.
 * Every other coverage cell must be identical to the coverage baseline. In a
 * pass composed with coverage: 'core' the coverage additions (class C cases)
 * are not changes this build makes: they too must be identical.
 * @type {Record<string, string>}
 */
const coverageChanges = {
  // B: a language tag in another spelling is read as the language it names.
  'lang-en_US': 'lang="en_US" is read as en-US (4.3.1: native:language)',
  'lang-english': 'lang="english" is read as en (4.3.1: native:language)',
  // C (coverage: 'extended'): declared Latin-script languages compose with
  // neutral preferences, and a Latin-script descendant in another language
  // is part of its paragraph.
  'lang-pt': 'Portuguese composes with neutral preferences',
  'lang-pt-BR': 'Portuguese composes with neutral preferences',
  'lang-it': 'Italian composes with neutral preferences',
  'lang-nl': 'Dutch composes with neutral preferences',
  'lang-vi': 'Vietnamese composes with neutral preferences',
  'lang-sr-Latn': 'Serbian in Latin script composes with neutral preferences',
  'lang-pl': 'Polish composes with neutral preferences',
  'lang-sw': 'Swahili composes with neutral preferences',
  'lang-ht': 'Haitian Creole composes with neutral preferences',
  'lang-fil': 'Filipino composes with neutral preferences',
  'lang-invalid': 'an unreadable lang counts as none (neutral preferences)',
  'lang-es-descendant-en': 'a Spanish phrase inside English is part of the paragraph',
  'lang-en-GB-descendant-untagged': 'an en-GB phrase inside untagged text is part of the paragraph',
  'lang-en_US-posix': 'lang="en_US.UTF-8" is read as en-US (4.3.1: native:language)',
  // B: Greek and Cyrillic letters in runs of at most three inside Latin text.
  'script-microgram': 'μg inside English composes (the unit binding is reachable)',
  'script-alpha-synuclein': 'α-synuclein inside English composes',
  'script-delta': 'ΔG inside English composes',
  // C (coverage: 'extended'): inline markup 4.3 left native.
  'inline-sup-footnote': 'sup measured in place',
  'inline-sup-normalize': 'sup raised with position: relative (normalize.css) measured in place',
  'inline-sub-formula': 'sub measured in place',
  'inline-time': 'time lays out inline',
  'inline-kbd': 'kbd lays out inline',
  'inline-dfn-ins': 'dfn and ins lay out inline',
  'inline-sr-only-link-text': 'visually hidden link text takes no room',
  'inline-sr-only-clip-path': 'visually hidden link text (clip-path) takes no room',
  'inline-aria-hidden-empty': 'an empty aria-hidden element takes no room',
  // B: smart quotes. A double quote with space on both sides, or with no
  // quotation to close, stays straight.
  'quotes-attribute-value': 'width="100" keeps its straight quotes (4.3.1: width=”100")',
  'quotes-french-spaced': '" Bonjour " keeps its straight quotes (4.3.1: ” Bonjour ”)',
};

/** Runs in the page: compose each cell with one build and describe the result. */
function compose({ cells, build, baseline, subjectOptions }) {
  // The baseline build of a coverage cell is the coverage baseline.
  const builds = cell => build === 'subject' ? window.Typeset : cell.variant.startsWith('coverage') ? window.CoverageBaseline : window.Baseline;
  // Smart quotes are the one sanctioned change to the characters.
  const plain = text => text.replace(/[\u2018\u2019]/g, "'").replace(/[\u201c\u201d]/g, '"');
  // Line review items of the audit under test, by type: the build under
  // test judges the native layout, its own output and 4.2.0's output alike.
  const lineTypes = ['weak-line-end', 'stranded-opener', 'bound-split', 'split-ellipsis', 'line-initial-punctuation', 'orphan', 'first-singleton'];
  const review = el => {
    const counts = {};
    if (build !== 'subject') return counts;
    for (const issue of window.Typeset.audit('#golden-cell')) if (lineTypes.includes(issue.type)) counts[issue.type] = (counts[issue.type] || 0) + 1;
    return counts;
  };
  // The markup with each spacing and hanging marker's style reduced to its
  // advance and each tracking wrapper's to its spacing (see below).
  const movedMarkup = el => {
    const moved = el.cloneNode(true);
    for (const marker of moved.querySelectorAll('[data-ts-space][data-ts-break], [data-ts-hang][data-ts-break]')) marker.setAttribute('style', 'margin-left: ' + marker.style.marginLeft + ';');
    for (const wrapper of moved.querySelectorAll('[data-ts-track]')) wrapper.setAttribute('style', 'letter-spacing: ' + wrapper.style.letterSpacing + '; word-spacing: ' + wrapper.style.wordSpacing + ';');
    return moved.innerHTML;
  };
  const out = [];
  for (const [index, cell] of cells.entries()) {
    const api = builds(cell);
    const el = document.createElement(cell.tag);
    el.id = 'golden-cell';
    el.style.cssText = `font:18px/1.5 ${cell.font === 'Georgia' ? 'Georgia, serif' : cell.font};width:${cell.width}px;margin:0;text-wrap:wrap;${cell.style || ''}`;
    if (cell.lang !== undefined) el.setAttribute('lang', cell.lang);
    el.innerHTML = cell.html;
    document.body.append(el);
    const native = api.measureLayout(el);
    const nativeReview = review(el);
    let result;
    try { result = api.typeset(el, build === 'subject' && cell.variant !== 'coverage-default' ? { ...cell.options, ...subjectOptions } : cell.options); } catch (error) { result = { outcome: 'threw ' + error.message, after: native, features: null }; }
    const after = api.measureLayout(el);
    // The markup with each spacing and hanging marker's style reduced to its
    // advance and each tracking wrapper's to its spacing (4.4 moved the rest
    // to the engine's stylesheet; see styleMoved), and the geometry that must
    // not change where only that moved: line boxes, and each marker's spacing
    // and box. (A marker's advance is in the markup; its computed margin is
    // left out because WebKit reports the used, 1/64 px value for 4.3's
    // inline declarations and the specified one for 4.4's, where the line
    // boxes are identical.)
    const moved = movedMarkup(el);
    const round = value => Math.round(value * 100) / 100;
    const geometry = JSON.stringify([after.lines.map(line => [line.left, line.top, line.width].map(round)),
      [...el.querySelectorAll('[data-ts-space][data-ts-break], [data-ts-hang][data-ts-break], [data-ts-track]')].map(marker => {
        const cs = getComputedStyle(marker), box = marker.getBoundingClientRect();
        return [cs.letterSpacing, cs.wordSpacing, round(box.width), round(box.height)].join(' ');
      })]);
    const record = { id: cell.id, outcome: result.outcome, features: result.features ?? null, markup: el.innerHTML, moved, geometry,
      breaks: after.lines.map(line => line.sourceStart), lines: after.lines.map(line => line.text), nativeText: native.lines.map(line => line.text),
      overflow: after.overflow, nativeOrphan: native.lastSingleton, orphan: after.lastSingleton, nativeLines: native.lines.length,
      textIntact: plain(el.textContent) === plain(new DOMParser().parseFromString('<body>' + cell.html, 'text/html').body.textContent),
      review: { native: nativeReview, subject: review(el), baseline: {} },
      regressed: build === 'subject' && window.Typeset.audit('#golden-cell').some(issue => issue.type === 'regressed-vs-native') };
    api.restore(el);
    if (build !== 'subject' && cell.reference) {
      // A lang in another spelling (en_US): the coverage baseline's
      // composition of the same paragraph under the tag it spells (en-US).
      el.setAttribute('lang', cell.reference);
      const referenced = api.typeset(el, cell.options);
      record.reference = { outcome: referenced.outcome, markup: el.innerHTML, moved: movedMarkup(el) };
      api.restore(el);
      el.setAttribute('lang', cell.lang);
    }
    if (build === 'subject' && baseline?.[index]) {
      // 4.2.0's output, rendered as it was, judged by the same audit.
      el.innerHTML = baseline[index].markup;
      el.dataset.tsOutcome = baseline[index].outcome;
      record.review.baseline = review(el);
      const reference = baseline[index].reference;
      if (reference) { el.innerHTML = reference.markup; el.dataset.tsOutcome = reference.outcome; record.review.reference = review(el); }
    }
    el.remove();
    out.push(record);
  }
  return out;
}

/**
 * Markup with the 4.3 changes that alter attributes only, never a break, a
 * width or a character: C2 exposes generated breaks to assistive technology
 * (no aria-hidden on a break; spacing and hanging markers display inline, not
 * inline-block) and C9 routes every break's display through
 * --ts-break-display. verify-break-semantics and verify-print-resize check
 * those attributes; here both builds' markup is compared without them, and
 * the cells they alone change are counted apart.
 * @param {string} markup
 */
function attributeNeutral(markup) {
  return markup
    .replace(/<br data-ts-break="" aria-hidden="true"/g, '<br data-ts-break=""')
    .replace(/(<br data-ts-break=""[^>]*? style=")display: (?:var\(--ts-break-display, inline\)|inline)(?: !important)?;/g, '$1display: BREAK;')
    .replace(/(<span data-ts-break=""[^>]*? style=")display: inline-block;/g, '$1display: inline;');
}

/**
 * Markup with 4.3's move of a generated break out of the element that starts
 * its line: 4.2 put the <br> first inside a link or emphasis whose text began
 * the line, so the element's first fragment was an empty stub at the end of
 * the previous line, where its focus ring and hover background painted; 4.3
 * breaks before the outermost such element. The same lines, widths and
 * characters; both builds' markup is compared with the break outside, and the
 * cells this alone changes are counted apart.
 * @param {string} markup
 */
function breakOutside(markup) {
  let out = markup, prior;
  do {
    prior = out;
    out = out.replace(/(<(?:a|b|strong|em|i|span|small|u|s|del|mark|abbr|cite|code)\b[^>]*>)(<br data-ts-break=""[^>]*>)/g, '$2$1');
  } while (out !== prior);
  return out;
}
/** @param {string} markup */
const neutral = markup => breakOutside(attributeNeutral(markup));

/**
 * The 4.3 rendering changes that apply to a cell. A cell none of them applies
 * to must be byte-identical to 4.2.0.
 * @param {Cell} cell
 * @returns {string[]}
 */
function changeReasons(cell) {
  const reasons = [];
  // C3: justified text is declined instead of composed ragged.
  if (/text-align:\s*justify/.test(cell.style || '')) reasons.push('justify');
  // C6: author text after a comment keeps its place, unwrapped, so a line
  // holding some is left untracked (the rest of the paragraph keeps tracking).
  if (cell.html.includes('<!--')) reasons.push('comment');
  // C13, English text: abbreviations end no sentence unless a common
  // sentence opener follows; numbers and units, honorifics and names, labels
  // and numbers, and words and letter designators are bound; of the single
  // letters only the article and the pronoun "I" pay the letter penalty ("I"
  // is a numeral only after a head such as War or Phase, or a regnal name).
  // Deliberately broader than the engine's own lists.
  const words = cell.html.replace(/<!--.*?-->/g, '').replace(/<[^>]+>/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').split(/\s+/u).filter(Boolean);
  const bare = (/** @type {string} */ word) => word.replace(/^[("'\u201C\u2018[]+/u, '').replace(/[.,;:!?"'\u201D\u2019)\]]+$/u, '');
  for (const [i, word] of words.entries()) {
    const next = words[i + 1] ?? '', previous = words[i - 1] ?? '';
    const core = word.replace(/^[("'\u201C\u2018[]+/u, '').replace(/["'\u201D\u2019)\]]+$/u, '');
    if (/^(?:Mr|Mrs|Ms|Mx|Dr|Prof|Rev|St|Mt|Jr|Sr|vs|etc|e\.g|i\.e|E\.g|I\.e|a\.m|p\.m|p|pp|Fig|fig|No|Vol|Ch|Inc|Ltd|Co|(?:\p{Lu}\.)+\p{Lu}|[B-HJ-Z])\.$/u.test(core)) reasons.push('abbreviation');
    const letter = bare(word);
    const designated = letter === 'A' ? /^(?:type|grade|class|size|plan|part|vitamin|hepatitis|blood|group|section|model|exhibit|appendix|schedule|title|category|level|phase|stage|tier|zone|option|list|team)$/iu.test(previous)
      : /^\p{Lu}\p{L}*$/u.test(previous) && (/^(?:war|part|title|phase|stage|type|class|grade|level|tier|chapter|book|act|volume|section|schedule|appendix|bowl)$/iu.test(previous)
        || /^(?:king|queen|pope|emperor|empress|tsar|czar|tsarina|pharaoh|kaiser|prince|princess|duke|sultan|shah)$/iu.test(bare(words[i - 2] ?? '')));
    if (/^\p{L}$/u.test(letter) && letter !== 'a' && (!['A', 'I'].includes(letter) || designated)) reasons.push('single letter');
    if (/^[$€£¥]?\d/u.test(word) && /^(?:[\p{L}°%‰µμ]{1,4}|a\.m|p\.m|million|billion|trillion|percent)$/u.test(bare(next))) reasons.push('number and unit');
    if (/^(?:table|figure|chapter|section|page|part|step|room|level|grade|stage|phase|type|class|category|tier|zone|appendix|exhibit|schedule|version)$/iu.test(bare(word)) && /^\d|^[IVX]{2,}/u.test(next)) reasons.push('label and number');
  }
  return [...new Set(reasons)];
}


/**
 * Changed cells allowed to end with more line-end problems than both native
 * and 4.2.0, each with the reason. The check above fails on any other.
 * @type {Record<string, string>}
 */
const tradeOffs = {
  // The ranking may adopt a layout within its cost slack that ends on a weak
  // word when the cheapest layout pays for a 97% line and a cliff (the
  // tight-line trade, to be retuned in 4.4). Unbinding "10 g" at a line end
  // made that layout eligible here.
  'recipe@320/TypesetFixture': 'weak line end chosen over a 97% line (tight-line trade, 4.4)',
  // C13 reads "U.S." before a capitalized noun ("the U.S. Health officials")
  // as mid-sentence, so ending a line on the next sentence's first word costs
  // nothing: the layout strands "Health" and ends another line on "than"
  // (recorded in the CHANGELOG with the sweep's counts; to be revisited in 4.4).
  'initialism-end@320/TypesetFixture': 'opener stranded after a sentence-final initialism (C13, recorded, 4.4)',
  // Coverage corpus (4.4): "ΔG" no longer keeps the paragraph native, and it
  // composes as English does. At 320 px in Georgia its layout ends lines on
  // "was" and "and" where native ended one on "the".
  'script-delta@320/Georgia': 'two weak line ends for one in newly composed English (ΔG, 4.4)',
  // With coverage: 'extended' a footnote sup no longer keeps the paragraph
  // native. At 240 px its lines are those of the same paragraph without the
  // sup (lang-en_US@240/Georgia, which 4.3.1 sets the same way as en-US).
  'inline-sup-footnote@240/Georgia': 'English composition as 4.3.1 sets the paragraph without the footnote (4.4 coverage)',
};

/** @param {{ name: string, engine: any, executablePath?: string }} config */
async function runEngine({ name, engine, executablePath }) {
  const browser = await engine.launch({ executablePath, timeout: 20_000 });
  report.browsers[name] = browser.version();
  try {
    const page = await browser.newPage({ viewport: { width: 1200, height: 900 } });
    page.setDefaultTimeout(20_000);
    page.on('pageerror', (/** @type {Error} */ error) => report.errors.push({ browser: name, error: error.message }));
    await page.setContent('<!doctype html><html lang="en"><head><meta charset="utf-8"><style>body{margin:24px}a{color:#176650}</style></head><body></body></html>');
    await installFixtureFont(page);
    if (values.bind) await page.evaluate(bind => { globalThis.__TYPESET_BIND__ = JSON.parse(bind); }, values.bind);
    await page.addScriptTag({ content: coverageBaseline });
    await page.evaluate(() => { window.CoverageBaseline = window.Typeset; });
    await page.addScriptTag({ content: baseline });
    await page.evaluate(() => { window.Baseline = window.Typeset; });
    await page.addScriptTag({ content: subject });
    report.baselineVersions[name] = await page.evaluate(() => [window.Baseline.VERSION, window.CoverageBaseline.VERSION, window.Typeset.VERSION].join(' / '));
    /** @type {any[]} */ const base = [], cand = [];
    // Chunks keep each evaluate well inside Playwright's timeout.
    for (let i = 0; i < cells.length; i += 60) {
      const chunk = cells.slice(i, i + 60);
      const done = await page.evaluate(compose, { cells: chunk, build: 'baseline' });
      base.push(...done);
      cand.push(...await page.evaluate(compose, { cells: chunk, build: 'subject', baseline: done.map(({ markup, outcome, reference }) => ({ markup, outcome, reference })), subjectOptions }));
    }
    return { name, base, cand };
  } finally { await browser.close(); }
}

const engines = values.engines?.split(',') ?? browsers.map(b => b.name);
await mkdir('output', { recursive: true });
const runs = (await Promise.allSettled(browsers.filter(b => engines.includes(b.name)).map(runEngine)))
  .flatMap((outcome, i) => {
    if (outcome.status === 'fulfilled') return [outcome.value];
    report.errors.push({ browser: engines[i], error: String(outcome.reason?.stack || outcome.reason) });
    return [];
  });

const check = (/** @type {string} */ browser, /** @type {string} */ label, /** @type {unknown} */ pass, /** @type {unknown} */ detail) =>
  report.checks.push({ browser, label, pass: !!pass, ...(detail === undefined ? {} : { detail }) });
const checkRun = check;
const byId = new Map(cells.map(cell => [cell.id, cell]));
/**
 * Whether two builds' records of one cell differ, beyond the neutral changes.
 * Markers are compared by their per-marker values only (moved): 4.4 moved
 * the declarations every spacing and hanging marker and tracking wrapper
 * shares out of its style attribute into the engine's stylesheet. The cells
 * that change alone are counted apart (styleMoved), and must keep identical
 * line boxes and marker geometry.
 * @param {any} c @param {any} b
 */
const differs = (c, b) => c.outcome !== b.outcome || neutral(c.moved) !== neutral(b.moved) || JSON.stringify(c.features) !== JSON.stringify(b.features);
/** @param {any} c @param {any} b */
const styleMovedOnly = (c, b) => !differs(c, b) && neutral(c.markup) !== neutral(b.markup);
const total = (/** @type {Record<string, number>} */ counts) => Object.values(counts).reduce((sum, n) => sum + n, 0);
/** A coverage cell this build changes on purpose. @param {Cell} cell */
const coverageChanged = cell => !!cell.expect || (!!cell.case && cell.case in coverageChanges && !(cell.class === 'C' && passCoverage(cell.variant) === 'core'));
for (const { name, base, cand } of runs) {
  const variants = [...new Set(cells.map(cell => cell.variant))].filter(variant => !isCoverage(variant));
  for (const variant of variants) {
    const pairs = cand.map((c, i) => ({ c, b: base[i], cell: /** @type {Cell} */ (byId.get(c.id)) })).filter(p => p.cell.variant === variant);
    const differ = pairs.filter(({ c, b }) => differs(c, b));
    const attributesOnly = pairs.filter(({ c, b }) => c.moved !== b.moved && !differ.some(d => d.c === c) && attributeNeutral(c.moved) === attributeNeutral(b.moved)).length;
    const breaksOutside = pairs.filter(({ c, b }) => attributeNeutral(c.moved) !== attributeNeutral(b.moved) && !differ.some(d => d.c === c)).length;
    const moved = pairs.filter(({ c, b }) => styleMovedOnly(c, b));
    const unexplained = differ.filter(({ cell }) => !changeReasons(cell).length);
    report.counts[`${name} ${variant}`] = { cells: pairs.length, changed: differ.length, unexplained: unexplained.length, attributesOnly, breaksOutside, styleMoved: moved.length };
    const shifted = moved.filter(({ c, b }) => c.geometry !== b.geometry);
    check(name, `${variant}: cells whose marker styles alone moved to the stylesheet keep identical line boxes and marker geometry`, !shifted.length,
      shifted.slice(0, 4).map(({ c, b }) => ({ id: c.id, baseline: b.geometry.slice(0, 300), subject: c.geometry.slice(0, 300) })));
    for (const { c, b, cell } of differ) report.changed.push({ browser: name, id: c.id, reasons: changeReasons(cell), baseline: { outcome: b.outcome, lines: b.lines }, subject: { outcome: c.outcome, lines: c.lines } });
    check(name, `${variant}: identical to 4.2.0 unless a rendering change applies`, unexplained.length === 0,
      unexplained.length ? unexplained.slice(0, 4).map(({ c, b }) => ({ id: c.id, baseline: [b.outcome, ...b.lines], subject: [c.outcome, ...c.lines] })) : { cells: pairs.length, changed: differ.length });
    const overflow = pairs.filter(({ c }) => c.overflow > .5);
    check(name, `${variant}: no overflow`, !overflow.length, overflow.slice(0, 4).map(({ c }) => ({ id: c.id, overflow: c.overflow })));
    const orphans = pairs.filter(({ c, cell }) => cell.tag === 'p' && c.orphan && !c.nativeOrphan);
    check(name, `${variant}: no new orphan`, !orphans.length, orphans.slice(0, 4).map(({ c }) => ({ id: c.id, lines: c.lines })));
    if (variant === 'justified') {
      const composed = pairs.filter(({ c }) => !/^native:(justify|fits)$/.test(c.outcome) || /data-ts-(break|track)/.test(c.markup));
      check(name, 'justified: declined and untouched', !composed.length, composed.slice(0, 4).map(({ c }) => ({ id: c.id, outcome: c.outcome })));
    }
    if (variant === 'comments') {
      // Text after a comment stays unwrapped: its line is left untracked, the
      // rest keep tracking, and no line is tracked part way.
      const partly = (/** @type {string} */ markup) => markup.split(/<br data-ts-break[^>]*>/).slice(0, -1).some(line => {
        const bare = line.replace(/<span data-ts-break[^>]*><\/span>|<wbr[^>]*>|<!--.*?-->/g, '');
        return /<span data-ts-track/.test(bare) && /\S/.test(bare.replace(/<span data-ts-track[^>]*>.*?<\/span>/g, '').replace(/<[^>]+>/g, ''));
      });
      const mixed = pairs.filter(({ c }) => partly(c.markup));
      const rolledBack = pairs.filter(({ c }) => c.features?.tracking === 'native:tracking-verification');
      check(name, 'comments: no line is tracked part way and tracking never rolls back', !mixed.length && !rolledBack.length,
        { mixed: mixed.slice(0, 3).map(({ c }) => c.id), rolledBack: rolledBack.slice(0, 3).map(({ c }) => c.id), applied: pairs.filter(({ c }) => c.features?.tracking === 'applied').length });
    }
    const damaged = pairs.filter(({ c }) => !c.textIntact || /^threw/.test(c.outcome));
    check(name, `${variant}: source text intact`, !damaged.length, damaged.slice(0, 4).map(({ c }) => ({ id: c.id, outcome: c.outcome })));
    // The audit under test judges the native layout, 4.2.0's output and this
    // build's output alike. A changed paragraph may trade one line-end
    // problem for another, but never ends with more of them than both the
    // browser and 4.2.0 had. (Declined justified text is native by design.)
    if (variant === 'justified') continue;
    const worse = differ.filter(({ c }) => total(c.review.subject) > Math.max(total(c.review.native), total(c.review.baseline)))
      .filter(({ c }) => !Object.keys(tradeOffs).some(key => c.id.endsWith(' ' + key)));
    check(name, `${variant}: no changed paragraph has more line-end problems than native and 4.2.0`, !worse.length,
      worse.slice(0, 4).map(({ c }) => ({ id: c.id, review: c.review, lines: c.lines })));
    const sums = { native: 0, baseline: 0, subject: 0 };
    for (const { c } of pairs) for (const key of /** @type {const} */ (['native', 'baseline', 'subject'])) sums[key] += total(c.review[key]);
    report.counts[`${name} ${variant}`].review = sums;
    check(name, `${variant}: no more line-end problems than 4.2.0 in all`, sums.subject <= sums.baseline, sums);
    // The audit's own regressed-vs-native item agrees with these counts.
    const composed = pairs.filter(({ c }) => c.outcome.startsWith('composed'));
    const inconsistent = composed.filter(({ c }) => c.regressed !== total(c.review.subject) > total(c.review.native));
    check(name, `${variant}: audit reports regressed-vs-native exactly where composition added line-end problems`, !inconsistent.length && composed.length > 0,
      { composed: composed.length, regressed: composed.filter(({ c }) => c.regressed).length, inconsistent: inconsistent.slice(0, 3).map(({ c }) => ({ id: c.id, review: c.review, regressed: c.regressed })) });
  }
  // A recorded trade-off that no longer occurs must be removed from the list.
  // The trade-offs are against 4.2.0: against a later baseline they are not
  // changes at all.
  if (/^4\.2\./.test(report.baselineVersions[name] ?? '')) for (const key of Object.keys(tradeOffs)) {
    // A trade-off in a coverage addition occurs only in a pass with
    // coverage: 'extended'.
    if (cells.some(cell => cell.class === 'C' && cell.id.endsWith(' ' + key)) && !cells.some(cell => cell.id.endsWith(' ' + key) && isCoverage(cell.variant) && passCoverage(cell.variant) === 'extended')) continue;
    const occurs = cand.some((c, i) => c.id.endsWith(' ' + key) && (attributeNeutral(c.moved) !== attributeNeutral(base[i].moved) || c.outcome !== base[i].outcome));
    check(name, `recorded trade-off still occurs: ${key}`, occurs);
  }
}

// The coverage corpus, against the coverage baseline: each case that names an
// expected outcome reports it, every other cell is identical unless its case
// is a change this build makes, and no cell gains overflow, a new orphan or
// more line-end problems than both native and the baseline had.
for (const { name, base, cand } of runs) for (const variant of ['coverage', 'coverage-default']) {
  const pairs = cand.map((c, i) => ({ c, b: base[i], cell: /** @type {Cell} */ (byId.get(c.id)) })).filter(p => p.cell.variant === variant);
  if (!pairs.length) continue;
  // Checks keep their 'coverage:' labels; the default-options pass is labelled apart.
  const check = (/** @type {string} */ browser, /** @type {string} */ label, /** @type {unknown} */ pass, /** @type {unknown} */ detail) => checkRun(browser, variant === 'coverage' ? label : label.replace(/^coverage:/, 'coverage-default:'), pass, detail);
  const version = (report.baselineVersions[name] ?? '').split(' / ')[1] || 'the coverage baseline';
  const differ = pairs.filter(({ c, b }) => differs(c, b));
  const unexplained = differ.filter(({ cell }) => !coverageChanged(cell));
  const moved = pairs.filter(({ c, b }) => styleMovedOnly(c, b));
  const shifted = moved.filter(({ c, b }) => c.geometry !== b.geometry);
  check(name, 'coverage: cells whose marker styles alone moved to the stylesheet keep identical line boxes and marker geometry', !shifted.length,
    shifted.slice(0, 4).map(({ c, b }) => ({ id: c.id, baseline: b.geometry.slice(0, 300), subject: c.geometry.slice(0, 300) })));
  const composed = (/** @type {any} */ record) => String(record.outcome).startsWith('composed');
  /** @type {Record<string, { cells: number, changed: number, baselineComposed: number, subjectComposed: number, outcomes: Record<string, number> }>} */
  const groups = {};
  for (const { c, b, cell } of pairs) {
    const group = groups[/** @type {string} */ (cell.group)] ??= { cells: 0, changed: 0, baselineComposed: 0, subjectComposed: 0, outcomes: {} };
    group.cells++; group.changed += +differ.some(d => d.c === c);
    group.baselineComposed += +composed(b); group.subjectComposed += +composed(c);
    const key = b.outcome === c.outcome ? c.outcome : b.outcome + ' -> ' + c.outcome;
    group.outcomes[key] = (group.outcomes[key] || 0) + 1;
  }
  report.counts[`${name} ${variant}`] = { cells: pairs.length, changed: differ.length, unexplained: unexplained.length, styleMoved: moved.length,
    baselineComposed: pairs.filter(({ b }) => composed(b)).length, subjectComposed: pairs.filter(({ c }) => composed(c)).length, groups };
  for (const { c, b, cell } of differ) report.changed.push({ browser: name, id: c.id, reasons: [cell.expect ? 'expect ' + cell.expect : coverageChanges[/** @type {string} */ (cell.case)] ?? 'unexplained'], baseline: { outcome: b.outcome, lines: b.lines }, subject: { outcome: c.outcome, lines: c.lines } });
  const wrong = pairs.filter(({ c, cell }) => cell.expect && c.outcome !== cell.expect);
  check(name, 'coverage: every case with an expected outcome reports it', !wrong.length, wrong.slice(0, 4).map(({ c, cell }) => ({ id: c.id, expect: cell.expect, outcome: c.outcome })));
  check(name, `coverage: identical to ${version} outside the changes this build makes`, !unexplained.length,
    unexplained.length ? unexplained.slice(0, 4).map(({ c, b }) => ({ id: c.id, baseline: [b.outcome, ...b.lines], subject: [c.outcome, ...c.lines] })) : { cells: pairs.length, changed: differ.length });
  // Long unbreakable runs overflow natively in both builds.
  const overflow = pairs.filter(({ c, b }) => c.overflow > Math.max(.5, b.overflow + .5));
  check(name, 'coverage: no overflow the baseline did not have', !overflow.length, overflow.slice(0, 4).map(({ c, b }) => ({ id: c.id, overflow: c.overflow, baseline: b.overflow })));
  const orphans = pairs.filter(({ c }) => c.orphan && !c.nativeOrphan);
  check(name, 'coverage: no new orphan', !orphans.length, orphans.slice(0, 4).map(({ c }) => ({ id: c.id, lines: c.lines })));
  const damaged = pairs.filter(({ c }) => !c.textIntact || /^threw/.test(c.outcome));
  check(name, 'coverage: source text intact', !damaged.length, damaged.slice(0, 4).map(({ c }) => ({ id: c.id, outcome: c.outcome })));
  // A lang in another spelling composes as the coverage baseline composed
  // the tag it spells; that composition is also the review's reference.
  const referenced = pairs.filter(({ b }) => b.reference);
  const unlike = referenced.filter(({ c, b }) => c.outcome !== b.reference.outcome || neutral(c.moved) !== neutral(b.reference.moved));
  if (referenced.length) check(name, 'coverage: a lang in another spelling (en_US, english) composes exactly as the coverage baseline composed the tag it spells', !unlike.length,
    unlike.length ? unlike.slice(0, 4).map(({ c, b }) => ({ id: c.id, reference: [b.reference.outcome], subject: [c.outcome, ...c.lines] })) : { cells: referenced.length });
  const worse = differ.filter(({ c }) => total(c.review.subject) > Math.max(total(c.review.native), total(c.review.baseline), total(c.review.reference ?? {})))
    .filter(({ c }) => !Object.keys(tradeOffs).some(key => c.id.endsWith(' ' + key)));
  check(name, 'coverage: no changed paragraph has more line-end problems than native and the baseline', !worse.length,
    worse.slice(0, 4).map(({ c }) => ({ id: c.id, review: c.review, lines: c.lines })));
}

// Engines keep agreeing wherever 4.2.0 made the same decision in each. Where
// a rendering change applies, near-equal costs can settle differently in each
// engine's text metrics, as they already do in some 4.2.0 cells: a change may
// not make engines disagree where 4.2.0's agreed more often than 4.2.0's
// engines disagree across the corpus. (Cells 4.2.0's engines already
// disagreed on, such as copies of corpus paragraphs, do not count against it.)
if (runs.length > 1) {
  const same = (/** @type {'base' | 'cand'} */ which, /** @type {number} */ index) => runs.every(run => JSON.stringify(run[which][index].breaks) === JSON.stringify(runs[0][which][index].breaks) && run[which][index].outcome === runs[0][which][index].outcome);
  const unchanged = [], changed = { cells: 0, before: 0, after: 0, introduced: 0 }, corpus = { cells: 0, before: 0 };
  for (const [index, cell] of cells.entries()) {
    if (cell.variant === 'justified') continue;
    // A coverage cell: engines agree wherever the coverage baseline's did,
    // unless its case is a change this build makes (checked above).
    if (isCoverage(cell.variant)) {
      if (!coverageChanged(cell) && same('base', index) && !same('cand', index)) unchanged.push({ id: cell.id, ...Object.fromEntries(runs.map(run => [run.name, [run.cand[index].outcome, ...run.cand[index].lines]])) });
      continue;
    }
    const reasons = changeReasons(cell).length > 0;
    if (!cell.variant.startsWith('adversarial')) { corpus.cells++; corpus.before += +!same('base', index); }
    if (reasons) { changed.cells++; changed.before += +!same('base', index); changed.after += +!same('cand', index); changed.introduced += +(same('base', index) && !same('cand', index)); }
    else if (same('base', index) && !same('cand', index)) unchanged.push({ id: cell.id, ...Object.fromEntries(runs.map(run => [run.name, [run.cand[index].outcome, ...run.cand[index].lines]])) });
  }
  report.counts.crossEngine = { corpus, changed };
  check('all', 'engines agree wherever 4.2.0 agreed and no change applies', !unchanged.length, unchanged.slice(0, 4));
  check('all', 'a change makes engines disagree where 4.2.0 agreed no more often than 4.2.0 disagrees across the corpus',
    changed.introduced / Math.max(1, changed.cells) <= corpus.before / Math.max(1, corpus.cells), { corpus, changed });
}
if (values.dump) await writeFile(values.dump, JSON.stringify({ cells, runs }));
report.summary = { cells: cells.length, engines: runs.map(run => run.name), seconds: Math.round((performance.now() - started) / 1000),
  checks: report.checks.length, failed: report.checks.filter(c => !c.pass).length, errors: report.errors.length,
  changed: Object.fromEntries(Object.entries(report.counts).map(([key, value]) => [key, value.changed])),
  attributesOnly: Object.fromEntries(Object.entries(report.counts).filter(([, value]) => 'attributesOnly' in value).map(([key, value]) => [key, value.attributesOnly])),
  breaksOutside: Object.fromEntries(Object.entries(report.counts).filter(([, value]) => value.breaksOutside).map(([key, value]) => [key, value.breaksOutside])),
  styleMoved: Object.fromEntries(Object.entries(report.counts).filter(([, value]) => value.styleMoved).map(([key, value]) => [key, value.styleMoved])),
  // Per engine: the 4.2/4.3 corpus against --baseline, and the coverage
  // corpus against --coverage-baseline (cells each build composed).
  existing: Object.fromEntries(runs.map(({ name }) => {
    const rows = Object.entries(report.counts).filter(([key]) => key.startsWith(name + ' ') && !isCoverage(key.slice(name.length + 1))).map(([, value]) => value);
    return [name, { cells: rows.reduce((sum, row) => sum + row.cells, 0), changed: rows.reduce((sum, row) => sum + row.changed, 0), styleMoved: rows.reduce((sum, row) => sum + (row.styleMoved ?? 0), 0) }];
  })),
  ...Object.fromEntries(['coverage', 'coverage-default'].map(variant => [variant === 'coverage' ? 'coverage' : 'coverageDefault',
    Object.fromEntries(runs.filter(({ name }) => report.counts[name + ' ' + variant]).map(({ name }) => {
      const { cells, changed, unexplained, styleMoved, baselineComposed, subjectComposed } = report.counts[name + ' ' + variant];
      return [name, { cells, changed, unexplained, styleMoved, baselineComposed, subjectComposed }];
    }))]).filter(([, value]) => Object.keys(value).length)) };
await writeFile(values.out, JSON.stringify(report, null, 2));
console.log(JSON.stringify({ ...report.summary, failures: report.checks.filter(c => !c.pass).slice(0, 8), errors: report.errors.slice(0, 4) }, null, 2));
if (report.summary.failed || report.summary.errors || !runs.length) process.exitCode = 1;
