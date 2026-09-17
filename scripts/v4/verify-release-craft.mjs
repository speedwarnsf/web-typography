import { browsers } from './browsers.mjs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
import { smartQuotes } from '../../packages/typeset-v4/dist/index.js';
import { releaseIdentity } from './release-evidence.mjs';
import { installFixtureFont } from './font-fixture.mjs';

assert.equal(smartQuotes('"Read Jane\'s notes," she said.'), '\u201cRead Jane\u2019s notes,\u201d she said.');
assert.equal(smartQuotes('A 6\' 2" frame, a 12" print, and the \'90s.'), 'A 6\' 2" frame, a 12" print, and the \u201990s.');
assert.equal(smartQuotes('"Read \'the notes\'," she said.'), '\u201cRead \u2018the notes\u2019,\u201d she said.');
assert.equal(smartQuotes('"1984" and don\'t -- change... this.'), '\u201c1984\u201d and don\u2019t -- change... this.');
assert.equal(smartQuotes(smartQuotes('"Read Jane\'s notes."')), smartQuotes('"Read Jane\'s notes."'));
const report = { ...await releaseIdentity(), browsers: {}, checks: [], errors: [] };
await mkdir('output/playwright', { recursive: true });
for (const { name, engine, executablePath } of browsers) {
  const browser = await engine.launch({ executablePath });
  report.browsers[name] = browser.version();
  try {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    page.on('pageerror', error => report.errors.push({ browser: name, error: error.message }));
    await page.setContent('<!doctype html><html lang="en"><head><style>body{margin:32px;font:20px/1.4 Georgia;color:#171717;background:white}p{width:240px;margin:0 0 24px;text-wrap:wrap}a{color:#176650}</style></head><body></body></html>');
    await page.addScriptTag({ path: process.env.TYPESET_BUNDLE || 'packages/typeset-v4/dist/typeset.global.js' });
    await page.addStyleTag({ path: 'packages/typeset-v4/dist/styles.css' });
    await installFixtureFont(page);
    const checks = await page.evaluate(async () => {
      const api = window.Typeset, checks = [];
      const check = (label, pass, detail) => checks.push({ label, pass: !!pass, detail });
      const make = (html, width = 240) => { const p = document.createElement('p'); p.innerHTML = html; p.style.width = width + 'px'; document.body.append(p); return p; };
      const p = make('"Read <strong>Jane\'s notes</strong> about <a href="#notes">the exhibition</a>," she said.');
      const source = p.textContent, markup = p.innerHTML, strong = p.querySelector('strong'), link = p.querySelector('a'), head = p.firstChild;
      let clicks = 0; link.addEventListener('click', event => { event.preventDefault(); clicks++; }); link.focus();
      const options = { smartQuotes: 'en', opticalHanging: true };
      const result = api.typeset(p, options), first = p.innerHTML;
      check('smart quotes measure the displayed rich text', p.textContent === api.smartQuotes(source) && result.features.quotes === 'applied', result);
      check('optical alignment actually applies', result.features.hanging === 'applied' && !!p.querySelector('[data-ts-hang]'), result);
      check('optical output passes geometry audit', api.measureLayout(p).overflow <= .75, api.measureLayout(p));
      check('author elements and focus retained', p.querySelector('strong') === strong && p.querySelector('a') === link && document.activeElement === link);
      link.click(); check('link handler executes once', clicks === 1);
      api.typeset(p, options); check('repeat pass is idempotent', p.innerHTML === first);
      const range = document.createRange(); range.selectNodeContents(p); getSelection().removeAllRanges(); getSelection().addRange(range);
      const copy = new ClipboardEvent('copy', { bubbles: true, cancelable: true, clipboardData: new DataTransfer() }); p.dispatchEvent(copy);
      check('copy uses educated text without visual markers', copy.clipboardData.getData('text/plain') === api.smartQuotes(source) && !copy.clipboardData.getData('text/html').includes('data-ts-'));
      getSelection().removeAllRanges();
      p.style.width = '280px'; api.typeset(p, options); api.restore(p);
      check('restore reverses quotes, hanging and breaks with original nodes', p.innerHTML === markup && p.firstChild === head && p.querySelector('strong') === strong, p.innerHTML);
      api.typeset(p, options); strong.textContent = 'new author text'; api.restore(p);
      check('restoration respects external edits', strong.textContent === 'new author text');
      p.remove();
      for (const html of ['<span lang="fr">"Bonjour"</span> she said.', '<code>"literal"</code> and "prose".']) {
        const el = make(html); const original = el.innerHTML; const result = api.typeset(el, options);
        check('unsafe quote scope stays unchanged: ' + html, result.features.quotes === 'native:quotes-scope' && el.textContent.includes('"'));
        api.restore(el); check('unsupported rich scope restores exactly', el.innerHTML === original); el.remove();
      }
      const plain = make('The little gallery has a room for looking closely at the work.');
      const plainSource = plain.textContent;
      const selected = document.createRange(); selected.setStart(plain.firstChild, 4); selected.setEnd(plain.firstChild, 18); getSelection().removeAllRanges(); getSelection().addRange(selected);
      const defaultResult = api.typeset(plain);
      check('public defaults use identity-preserving Unicode path', defaultResult.outcome !== 'composed' && getSelection().toString() === plainSource.slice(4, 18), defaultResult.outcome);
      api.restore(plain); getSelection().removeAllRanges(); plain.remove();
      const quote = make('"An exhibition of small discoveries and unexpected connections."');
      const noFeatures = api.typeset(quote); check('punctuation and margins unchanged by default', quote.textContent.startsWith('"') && noFeatures.features.quotes === 'off' && !quote.querySelector('[data-ts-hang]'));
      api.restore(quote); quote.style.textAlign = 'center';
      check('centered text explicitly declines optical hanging', api.typeset(quote, options).features.hanging === 'native:hanging-layout');
      api.restore(quote); quote.style.textAlign = 'left'; quote.style.overflow = 'hidden'; quote.style.width = '1200px'; quote.style.fontFamily = 'TypesetFixture';
      const clipped = api.typeset(quote, options);
      check('clipping explicitly declines optical hanging', clipped.features.hanging === 'native:hanging-clipped', clipped.features);
      api.restore(quote); quote.style.overflow = 'visible'; quote.style.fontFamily = 'Georgia';
      for (const width of [160, 200, 240, 320]) {
        quote.style.width = width + 'px'; api.typeset(quote, { lineBreaks: 'unicode' }); const unstyled = api.measureLayout(quote).lines.map(l => l.text); api.restore(quote);
        const r = api.typeset(quote, { lineBreaks: 'unicode', opticalHanging: true });
        check('optical alignment preserves chosen lines at ' + width, JSON.stringify(api.measureLayout(quote).lines.map(l => l.text)) === JSON.stringify(unstyled) && r.after.overflow <= .75, r.features);
        api.restore(quote);
      }
      quote.remove();
      const section = document.createElement('section'); section.innerHTML = '<ul id="prose"><li>First item with enough text to wrap naturally.</li><li>Second item<ul><li>A nested detail.</li></ul></li></ul><ol><li>Keep ordered numbering.</li></ol><nav><ul><li>Navigation</li></ul></nav><ul style="list-style:none"><li>Custom design</li></ul>'; document.body.append(section);
      const beforeLists = section.innerHTML; const lists = api.styleProseLists(section); const overlap = api.styleProseLists(section);
      check('only prose unordered lists receive styling', lists.styled === 2 && lists.skipped === 2 && !section.querySelector('ol').className && !section.querySelector('nav ul').className, lists);
      check('real marker and list semantics retained', getComputedStyle(section.querySelector('#prose')).listStyleType !== 'none' && getComputedStyle(section.querySelector('#prose li'), '::marker').content !== 'normal');
      lists.restore(); check('overlapping list owner retains styles', section.querySelector('#prose').classList.contains('ts-styled'));
      overlap.restore(); check('list styling restores original markup', section.innerHTML === beforeLists);
      section.remove();
      const sample = make('"The room rewards a second look," says <a href="#artist">the artist</a>. "There is always another detail to discover."'); sample.id = 'release-sample';
      api.typeset(sample, options);
      check('JSON audit reports feature outcomes separately', api.auditJSON('#release-sample').features.quotes.applied === 1 && api.auditJSON('#release-sample').pass);
      return checks;
    });
    report.checks.push(...checks.map(check => ({ browser: name, ...check })));
    for (const width of [320, 390, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      await page.screenshot({ path: `output/playwright/release-craft-${name}-${width}.png`, fullPage: true });
    }
  } catch (error) { report.errors.push({ browser: name, error: error.stack }); }
  finally { await browser.close(); }
}
report.summary = { checks: report.checks.length, failed: report.checks.filter(c => !c.pass).length, errors: report.errors.length };
await writeFile('output/release-craft.json', JSON.stringify(report, null, 2));
console.log(JSON.stringify({ ...report.summary, failures: report.checks.filter(c => !c.pass), errors: report.errors }, null, 2));
if (report.summary.failed || report.summary.errors) process.exitCode = 1;
