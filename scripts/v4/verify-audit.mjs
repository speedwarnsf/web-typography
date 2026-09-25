// @ts-check
// audit() and auditJSON() are the product's machine-checkable promise (C16).
//  - Every issue.target resolves with document.querySelector to the flagged
//    element, in nested markup, beside duplicate ids and without ids.
//  - Known false positives stay quiet: a sentence-final word ("for."),
//    abbreviations ("Dr. Jones", "8 a.m. Monday"), letter designators
//    ("type A") and untagged text, which the compositor treats neutrally.
//    The published 4.2.0 audit flags each of them (negative control).
//  - Real line-end defects are reviewed: number/unit, honorific/name,
//    label/number and letter-designator splits, line-initial dashes and
//    closing punctuation, split ellipses, and a sentence opener stranded
//    after "a.m." or "No." ending a sentence.
//  - The JSON shape and schemaVersion stay those of 4.2.0.
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
    await tab.setContent(page(fixture(quiet, 'q') + `<p id="u0" lang="">${untagged[0]}</p>` + fixture(loud, 'l')));
    await tab.addScriptTag({ content: baseline });
    await tab.evaluate(() => { window.Baseline = window.Typeset; });
    await tab.addScriptTag({ content: subject });
    const judged = await tab.evaluate(ids => Object.fromEntries(ids.map(id => {
      const types = (/** @type {any} */ api) => api.audit('#' + id).map((/** @type {any} */ issue) => issue.type).filter((/** @type {string} */ type) => type !== 'unprocessed');
      return [id, { subject: types(window.Typeset), baseline: types(window.Baseline), lines: window.Typeset.measureLayout(document.getElementById(id)).lines.length }];
    })), [...quiet.map((_, i) => 'q' + i), 'u0', ...loud.map((_, i) => 'l' + i)]);
    for (const [i, [, what]] of quiet.entries()) {
      const row = judged['q' + i];
      check(`no false positive: ${what}`, row.lines >= 2 && !row.subject.length, row);
      check(`4.2.0 flagged it: ${what}`, row.baseline.length > 0, row);
    }
    check('no false positive: untagged text', judged.u0.lines >= 2 && !judged.u0.subject.length, judged.u0);
    check('4.2.0 flagged it: untagged text', judged.u0.baseline.length > 0, judged.u0);
    for (const [i, [html, type]] of loud.entries()) {
      const row = judged['l' + i];
      check(`reviewed as ${type}: ${html.replace(/<br>/, ' / ')}`, row.subject.includes(type), row);
    }
  } catch (error) { report.errors.push({ browser: name, error: String(/** @type {Error} */ (error).stack) }); }
  finally { await browser.close(); }
}
report.summary = { checks: report.checks.length, failed: report.checks.filter(c => !c.pass).length, errors: report.errors.length };
await writeFile('output/audit.json', JSON.stringify(report, null, 2));
console.log(JSON.stringify({ ...report.summary, failures: report.checks.filter(c => !c.pass).slice(0, 10), errors: report.errors }, null, 2));
if (report.summary.failed || report.summary.errors) process.exitCode = 1;
