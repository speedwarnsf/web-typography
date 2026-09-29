// @ts-check
// audit() and auditJSON() are the product's machine-checkable promise (C16).
//  - Every issue.target resolves with document.querySelector to the flagged
//    element, in nested markup, beside duplicate ids and without ids.
//  - Known false positives stay quiet: a sentence-final word ("for."),
//    abbreviations ("Dr. Jones", "8 a.m. Monday"), letter designators
//    ("type A") and untagged text, which the compositor treats neutrally.
//    The published 4.2.0 audit flags each of them (negative control).
//  - Real line-end defects are reviewed: number/unit, honorific/name,
//    label/number and letter-designator splits (also a capital letter cut
//    off from the noun it modifies, "B | students"), line-initial dashes and
//    closing punctuation, split ellipses, and a sentence opener stranded
//    after "a.m." or "No." ending a sentence. A line starting with an elided
//    word (’n’, ’90s) is not line-initial punctuation.
//  - The JSON shape and schemaVersion stay those of 4.2.0.
//  - Text clipped on purpose (ellipsis, line clamp) is a review item (4.4).
//  - Composed text without a lang, and a scope where nothing composed, are
//    one review item each: untagged and uncomposed (4.4).
// (regressed-vs-native is checked against every golden cell by verify-golden.)
import { readFile, writeFile } from 'node:fs/promises';
import { browsers } from './browsers.mjs';
import { releaseIdentity } from './release-evidence.mjs';

const watchdog = setTimeout(() => { console.error('verify-audit: watchdog after 170 s'); process.exit(3); }, 170_000);
watchdog.unref();
const subject = await readFile(process.env.TYPESET_BUNDLE || 'packages/typeset-v4/dist/typeset.global.js', 'utf8');
const baseline = await readFile('public/releases/4.2.0/typeset.global.js', 'utf8');
const corpus = JSON.parse(await readFile('tests/v4-corpus.json', 'utf8')).paragraphs;
const report = { ...await releaseIdentity(), checks: /** @type {any[]} */ ([]), errors: /** @type {any[]} */ ([]), browsers: /** @type {Record<string, string>} */ ({}) };

const page = (/** @type {string} */ body, lang = 'en') => `<!doctype html><html lang="${lang}"><head><meta charset="utf-8"><style>body{margin:24px}p,h2,h3,figcaption,blockquote{font:18px/1.5 Georgia,serif;width:340px;margin:0 0 12px}.narrow{width:230px}</style></head><body>${body}</body></html>`;
const nested = page(`<main><article><h2>${corpus[3].slice(0, 60)}</h2>
  <section><p>${corpus[0]}</p><p>${corpus[1]}</p><blockquote><p>${corpus[2]}</p></blockquote></section>
  <section><h3>${corpus[5].slice(0, 50)}</h3><p class="narrow">${corpus[4]}</p><figure><figcaption>${corpus[6]}</figcaption></figure></section>
  <div id="dup"><p>${corpus[7]}</p></div><div id="dup"><p class="narrow">${corpus[8]}</p></div>
  <div id="unique"><div><p>${corpus[9]}</p></div></div>
</article></main><p data-typeset>${corpus[10]}</p><p>${corpus[11]}</p>`);
// Each paragraph's first line is fixed with <br>: [html, what the line end is].
const quiet = [
  ['Nobody told us what the money was for.<br>They said it would help.', 'sentence-final "for."'],
  ['Your first visit is with Dr. Jones<br>tomorrow morning at the clinic.', 'honorific mid-line'],
  ['The office opens at 8 a.m. Monday<br>through Friday for walk-ins.', 'a.m. mid-line'],
  ['The shop sold size S shirts and type A<br>batteries for decades.', 'letter designator'],
];
const untagged = ['We walked all the way to the<br>store and back again.', 'untagged text'];
// Quiet too, with no 4.2.0 control (4.2.0 had no line-initial-punctuation
// review): a line may start with an elided word.
const elided = [
  ['They talked about rock<br>’n’ roll until midnight.', 'an elision starting a line (’n’)'],
  ['We moved away in the ’80s and the<br>’90s and never came back.', 'an elision starting a line (’90s)'],
];
const loud = [
  ['The trail climbs 1,200<br>m over 14 km of ridge.', 'bound-split'],
  ['Your first visit is with Dr.<br>Jones, who will see you.', 'bound-split'],
  ['As shown in Fig.<br>3, the effect held.', 'bound-split'],
  ['Ask about a test for hepatitis<br>C, even if you feel fine.', 'bound-split'],
  ['She paused for a long time<br>— and then she spoke.', 'line-initial-punctuation'],
  ['The line kept going . .<br>. and then it ended.', 'split-ellipsis'],
  ['The meeting ran long<br>, so we left early.', 'line-initial-punctuation'],
  ['Arrive by 9 a.m. Parking<br>is free in the lot on Main Street.', 'stranded-opener'],
  ['Did the new schedule help? No. Staff<br>on the night shift could not use it.', 'stranded-opener'],
  ['A study found that A students and B<br>students differ less than people think.', 'bound-split'],
];

for (const { name, engine, executablePath } of browsers) {
  const browser = await engine.launch({ executablePath, timeout: 20_000 });
  report.browsers[name] = browser.version();
  const check = (/** @type {string} */ label, /** @type {unknown} */ pass, /** @type {unknown} */ detail) => report.checks.push({ browser: name, label, pass: !!pass, ...(detail === undefined ? {} : { detail }) });
  try {
    const tab = await browser.newPage({ viewport: { width: 900, height: 900 } });
    tab.setDefaultTimeout(20_000);
    tab.on('pageerror', (/** @type {Error} */ error) => report.errors.push({ browser: name, error: error.message }));

    // Targets resolve, composed or not.
    await tab.setContent(nested);
    await tab.addScriptTag({ content: subject });
    const targets = await tab.evaluate(() => {
      const api = window.Typeset;
      const composed = document.querySelectorAll('section p, h2, blockquote p, figcaption, #unique p');
      for (const el of composed) api.typeset(el);
      // Text edited after composition: every composed element then carries a
      // stale-output error, so targets are checked on composed elements as well
      // as unprocessed ones. (4.2.0's own output carried hidden-break errors
      // everywhere; 4.3's has none to rely on.)
      for (const el of composed) el.append(' ');
      const issues = api.audit(), json = api.auditJSON();
      return {
        count: issues.length, sameOrder: json.issues.length === issues.length,
        unresolved: json.issues.map((/** @type {any} */ issue, /** @type {number} */ i) => ({ target: issue.target, type: issue.type, ok: document.querySelector(issue.target) === issues[i].element }))
          .filter((/** @type {any} */ row) => !row.ok),
        elements: new Set(issues.map((/** @type {any} */ issue) => issue.element)).size,
        keys: Object.keys(json).sort().join(','), issueKeys: [...new Set(json.issues.map((/** @type {any} */ issue) => Object.keys(issue).sort().join(',')))],
        schemaVersion: json.schemaVersion,
      };
    });
    check('every issue.target resolves to its element', targets.sameOrder && targets.count >= 10 && !targets.unresolved.length && targets.elements >= 8, targets);
    check('auditJSON keeps its 4.2.0 shape and schemaVersion 1', targets.schemaVersion === 1
      && targets.keys === 'engineVersion,errors,examined,features,issues,outcomes,pass,reviews,schemaVersion,unprocessed'
      && targets.issueKeys.length === 1 && targets.issueKeys[0] === 'detail,severity,target,type', targets);

    // False positives and real defects, judged by this build and by 4.2.0.
    const fixture = (/** @type {string[][]} */ rows, /** @type {string} */ prefix) => rows.map(([html], i) => `<p id="${prefix}${i}">${html}</p>`).join('');
    await tab.setContent(page(fixture(quiet, 'q') + `<p id="u0" lang="">${untagged[0]}</p>` + fixture(loud, 'l') + fixture(elided, 'e')));
    await tab.addScriptTag({ content: baseline });
    await tab.evaluate(() => { window.Baseline = window.Typeset; });
    await tab.addScriptTag({ content: subject });
    const judged = await tab.evaluate(ids => Object.fromEntries(ids.map(id => {
      const types = (/** @type {any} */ api) => api.audit('#' + id).map((/** @type {any} */ issue) => issue.type).filter((/** @type {string} */ type) => type !== 'unprocessed');
      return [id, { subject: types(window.Typeset), baseline: types(window.Baseline), lines: window.Typeset.measureLayout(document.getElementById(id)).lines.length }];
    })), [...quiet.map((_, i) => 'q' + i), 'u0', ...loud.map((_, i) => 'l' + i), ...elided.map((_, i) => 'e' + i)]);
    for (const [i, [, what]] of quiet.entries()) {
      const row = judged['q' + i];
      check(`no false positive: ${what}`, row.lines >= 2 && !row.subject.length, row);
      check(`4.2.0 flagged it: ${what}`, row.baseline.length > 0, row);
    }
    check('no false positive: untagged text', judged.u0.lines >= 2 && !judged.u0.subject.length, judged.u0);
    check('4.2.0 flagged it: untagged text', judged.u0.baseline.length > 0, judged.u0);
    for (const [i, [, what]] of elided.entries()) {
      const row = judged['e' + i];
      check(`no false positive: ${what}`, row.lines >= 2 && !row.subject.includes('line-initial-punctuation'), row);
    }
    for (const [i, [html, type]] of loud.entries()) {
      const row = judged['l' + i];
      check(`reviewed as ${type}: ${html.replace(/<br>/, ' / ')}`, row.subject.includes(type), row);
    }

    // A hanging indent (padding-left with a negative text-indent, as in a
    // bibliography) is the author's layout, not overflow: the gate failed
    // correct pages on it, native or excluded. Real overflow still fails.
    await tab.setContent(page(`<div style="padding-left:2em;text-indent:-2em"><p id="h0">${corpus[12]}</p><p id="h1" data-no-typeset>${corpus[13]}</p><p id="h2">A short hanging line.</p></div>`
      + `<p id="o0" style="width:120px">Supercalifragilisticexpialidocious overflows its measure.</p>`));
    await tab.addScriptTag({ content: subject });
    const hanging = await tab.evaluate(() => {
      const overflow = (/** @type {string} */ selector) => window.Typeset.auditJSON(selector).issues.filter((/** @type {any} */ issue) => issue.type === 'overflow').map((/** @type {any} */ issue) => issue.detail);
      return { hanging: overflow('#h0, #h1, #h2'), real: overflow('#o0'), lines: ['h0', 'h1'].map(id => window.Typeset.measureLayout(/** @type {HTMLElement} */ (document.getElementById(id))).lines.length) };
    });
    check('no overflow error for a hanging indent (native, excluded, single-line)', hanging.hanging.length === 0 && hanging.lines.every(n => n >= 2), hanging);
    check('real overflow is still an error', hanging.real.length === 1, hanging);

    // Text cut off on purpose, with an ellipsis or a line clamp, is the
    // author's layout: a clipped review item, not an overflow error, so the
    // gate passes (4.4; 4.3 failed it). Real overflow is still an error.
    await tab.setContent(page(`<p id="ellip" style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${corpus[15]}</p>`
      + '<p id="clamp" style="display:-webkit-box;-webkit-box-orient:vertical;-webkit-line-clamp:2;overflow:hidden">Supercalifragilisticexpialidociousandmoreofit overflows its measure inside a two-line clamp.</p>'
      + '<p id="o1" style="width:120px">Supercalifragilisticexpialidocious overflows its measure.</p>'));
    await tab.addScriptTag({ content: subject });
    const clipped = await tab.evaluate(() => {
      for (const id of ['ellip', 'clamp', 'o1']) window.Typeset.typeset(/** @type {HTMLElement} */ (document.getElementById(id)));
      const summary = (/** @type {string} */ selector) => { const json = window.Typeset.auditJSON(selector); return { pass: json.pass, errors: json.errors, issues: json.issues.map((/** @type {any} */ issue) => issue.severity + ' ' + issue.type) }; };
      return { ellip: summary('#ellip'), clamp: summary('#clamp'), real: summary('#o1'), detail: window.Typeset.auditJSON('#ellip').issues.map((/** @type {any} */ issue) => issue.detail) };
    });
    // (Declined as native:clamped, the lone paragraph is also an uncomposed scope.)
    check('an ellipsis clipped on purpose (nowrap, hidden, ellipsis) passes with one clipped review item', clipped.ellip.pass && clipped.ellip.errors === 0 && JSON.stringify(clipped.ellip.issues) === '["review clipped","review uncomposed"]', clipped);
    check('a line clamp clipping a long word is a clipped review item, not an overflow error', clipped.clamp.issues.includes('review clipped') && !clipped.clamp.issues.includes('error overflow'), clipped);
    check('overflow without clipping is still an error', clipped.real.issues.includes('error overflow') && !clipped.real.pass, clipped);

    // The scope's own review items (4.4): composed text that declares no
    // language (English line-end preferences off), and a scope where nothing
    // was composed for a reason other than nothing to improve. One item each,
    // never an error; pass does not change. 4.3 said nothing in either case.
    const scoped = async (/** @type {string} */ lang, /** @type {string} */ body, /** @type {Record<string, unknown>} */ options = {}, /** @type {string | null} */ outcome = null) => {
      await tab.setContent(page(body, lang).replace(/<html lang="">/, '<html>'));
      await tab.addScriptTag({ content: subject });
      return tab.evaluate(({ options, outcome }) => {
        for (const el of document.querySelectorAll('p')) { if (outcome) /** @type {HTMLElement} */ (el).dataset.tsOutcome = outcome; else window.Typeset.typeset(/** @type {HTMLElement} */ (el), options); }
        const json = window.Typeset.auditJSON('p');
        return { pass: json.pass, errors: json.errors, outcomes: json.outcomes, items: json.issues.filter((/** @type {any} */ issue) => ['untagged', 'uncomposed'].includes(issue.type)).map((/** @type {any} */ issue) => ({ type: issue.type, severity: issue.severity, target: issue.target, detail: issue.detail })) };
      }, { options, outcome });
    };
    const two = `<p id="a">${corpus[0]}</p><p id="b">${corpus[1]}</p>`;
    const untaggedPage = await scoped('', two);
    check('untagged: composed text with no lang gets one untagged review item, and pass is unchanged', untaggedPage.pass && untaggedPage.items.length === 1 && untaggedPage.items[0].type === 'untagged' && untaggedPage.items[0].severity === 'review'
      && ['#a', '#b'].includes(untaggedPage.items[0].target) && (untaggedPage.outcomes['composed:rich'] ?? 0) > 0
      && untaggedPage.items[0].detail.startsWith(`${untaggedPage.outcomes['composed:rich']} composed element`) && /declares? no language/.test(untaggedPage.items[0].detail), untaggedPage);
    const englishPage = await scoped('en', two);
    check('untagged: lang="en" composes with no such item', englishPage.pass && englishPage.items.length === 0 && (englishPage.outcomes['composed:rich'] ?? 0) === 2, englishPage);
    const legacyPage = await scoped('', two, { lineBreaks: 'legacy' });
    check('untagged: the legacy path, which applies English preferences to untagged text, gets no such item', legacyPage.items.length === 0, legacyPage);
    const declinedPage = await scoped('ja', two);
    check('uncomposed: a scope where every block declines gets one uncomposed review item with the commonest reason, and still passes', declinedPage.pass && declinedPage.items.length === 1 && declinedPage.items[0].type === 'uncomposed'
      && declinedPage.items[0].severity === 'review' && /None of the 2 elements with an outcome was composed; most common: native:language \u00d72/.test(declinedPage.items[0].detail), declinedPage);
    const fitsPage = await scoped('en', '<p id="s1">A short line.</p><p id="s2">Another one.</p>');
    check('uncomposed: a scope with nothing to improve (every block fits) gets no such item', fitsPage.items.length === 0 && (fitsPage.outcomes['native:fits'] ?? 0) === 2, fitsPage);
    const environment = await scoped('en', two, {}, 'native:environment');
    check('uncomposed: blocks left native:environment (jsdom, happy-dom) get the uncomposed item', environment.items.length === 1 && environment.items[0].type === 'uncomposed' && /native:environment \u00d72/.test(environment.items[0].detail), environment);
  } catch (error) { report.errors.push({ browser: name, error: String(/** @type {Error} */ (error).stack) }); }
  finally { await browser.close(); }
}
report.summary = { checks: report.checks.length, failed: report.checks.filter(c => !c.pass).length, errors: report.errors.length };
await writeFile('output/audit.json', JSON.stringify(report, null, 2));
console.log(JSON.stringify({ ...report.summary, failures: report.checks.filter(c => !c.pass).slice(0, 10), errors: report.errors }, null, 2));
if (report.summary.failed || report.summary.errors) process.exitCode = 1;
