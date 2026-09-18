import { build } from 'esbuild';
import { readFile, writeFile } from 'node:fs/promises';
import { browsers } from './browsers.mjs';

const script = process.env.TYPESET_BUNDLE ? await readFile(process.env.TYPESET_BUNDLE, 'utf8')
  : (await build({ entryPoints: ['src/lib/v4/typeset.release.standalone.ts'], bundle: true, format: 'iife', target: 'es2022', write: false })).outputFiles[0].text;
const report = { checks: [], errors: [] };
for (const { name, engine, executablePath } of browsers) {
  const browser = await engine.launch({ executablePath });
  try {
    const page = await browser.newPage();
    await page.setContent('<html lang="en"><style>p{font:16px/1.5 Arial;width:343px}.nowrap{white-space:nowrap}</style><main></main></html>');
    await page.addScriptTag({ content: script });
    const checks = await page.evaluate(() => {
      const api = window.Typeset, checks = [], main = document.querySelector('main');
      const check = (label, pass, detail) => checks.push({ label, pass: !!pass, detail });
      const fixtures = [
        ['film list', '<em>Final nights: </em><a href="#first"><span class="nowrap">Don\'t Move</span></a>, <a href="#oak">The\u00a0End of Oak Street</a>, <a href="#last"><span class="nowrap">By Any Means</span></a>'],
        ['nested emphasis', 'Tonight we are showing <a href="#film" class="nowrap">Don\'t <strong>Move</strong></a> and several other films. All original links and emphasis must survive composition.'],
        ['nested hyphen', 'Tonight we present <a href="#film" class="nowrap">The Twenty-<em>First</em> Century</a> and several other films. The protected title must retain its original spelling and line membership.'],
      ];
      for (const [label, markup] of fixtures) for (const width of [220, 290, 343, 400]) {
        const p = document.createElement('p'); p.style.width = width + 'px'; p.innerHTML = markup; main.append(p);
        const source = p.textContent, original = p.innerHTML, links = [...p.querySelectorAll('a')];
        const result = api.typeset(p, { density: 'editorial' });
        check(label + ' composes ' + width, result.outcome === 'composed:rich', { outcome: result.outcome, lines: result.after.lines.map(l => l.text) });
        check(label + ' preserves protected runs ' + width, [...p.querySelectorAll('.nowrap')].every(el => {
          const range = document.createRange(); range.setStart(p, 0); range.setEndBefore(el);
          const start = range.toString().length, end = start + el.textContent.length;
          return result.after.lines.some(line => line.sourceStart <= start && line.sourceEnd >= end);
        }));
        check(label + ' preserves source, links and bounds ' + width, p.textContent === source && result.after.overflow <= .5
          && links.every((a, i) => p.querySelectorAll('a')[i] === a));
        api.restore(p);
        check(label + ' restores original markup ' + width, p.innerHTML === original);
        p.remove();
      }
      const wide = document.createElement('p'); wide.style.width = '90px';
      wide.innerHTML = 'See <a class="nowrap" href="#wide">The Entire Unbreakable Film Title</a> tonight.'; main.append(wide);
      const rejected = api.typeset(wide);
      check('overlong protected phrase reports its actual constraint', rejected.outcome === 'native:no-candidate'
        && rejected.constraint?.kind === 'unbreakable-run' && !wide.querySelector('[data-ts-break]'), rejected);
      api.restore(wide); wide.remove();
      const pre = document.createElement('p'); pre.innerHTML = 'Read <span style="white-space:pre">this  exact spacing</span> without rewriting its whitespace.'; main.append(pre);
      check('preserved whitespace is not mistaken for nowrap', api.typeset(pre).outcome === 'native:rich-whitespace');
      return checks;
    });
    report.checks.push(...checks.map(check => ({ browser: name, ...check })));
  } catch (error) { report.errors.push({ browser: name, error: error.stack }); }
  finally { await browser.close(); }
}
await writeFile('output/inline-nowrap-regression.json', JSON.stringify(report, null, 2));
const failures = report.checks.filter(check => !check.pass);
console.log(JSON.stringify({ checks: report.checks.length, failures, errors: report.errors }, null, 2));
if (failures.length || report.errors.length) process.exitCode = 1;
