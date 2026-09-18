import { build } from 'esbuild';
import { readFile, writeFile } from 'node:fs/promises';
import { browsers } from './browsers.mjs';

const baseline = await readFile('public/releases/4.1.0/typeset.global.js', 'utf8');
const candidate = process.env.TYPESET_BUNDLE ? await readFile(process.env.TYPESET_BUNDLE, 'utf8')
  : (await build({ entryPoints: ['src/lib/v4/typeset.release.standalone.ts'], bundle: true, format: 'iife', target: 'es2022', write: false })).outputFiles[0].text;
const report = { checks: [], errors: [] };
for (const { name, engine, executablePath } of browsers) {
  const browser = await engine.launch({ executablePath });
  try {
    const page = await browser.newPage();
    await page.setContent('<html lang="en"><style>p{font:14px/1.4 Georgia;width:130px}a{color:inherit}</style><body></body></html>');
    await page.addScriptTag({ content: baseline });
    await page.evaluate(() => { window.Baseline = window.Typeset; });
    await page.addScriptTag({ content: candidate });
    const checks = await page.evaluate(() => {
      const api = window.Typeset, checks = [];
      const check = (label, pass, detail) => checks.push({ label, pass: !!pass, detail });
      for (const [group, tail] of [['Marquee Cinemas', 'Coralwood'], ['Grand Theatre', 'Riverside'], ['Central Library', 'Downtown']]) {
        const p = document.createElement('p'); p.textContent = group + ' ' + tail; document.body.append(p);
        p.style.width = '1000px'; const range = document.createRange(); range.setStart(p.firstChild, 0); range.setEnd(p.firstChild, group.length);
        p.style.width = Math.ceil(range.getBoundingClientRect().width + 2) + 'px';
        const result = api.typeset(p, { mode: 'title' });
        check('name before location: ' + group, result.outcome === 'composed:rich' && result.after.lines[0].text === group
          && result.after.lines[1].text === tail, result.after.lines.map(line => line.text));
        check('name result fits: ' + group, result.after.overflow <= .5 && p.textContent === group + ' ' + tail);
        api.restore(p); p.remove();
      }
      for (const [street, suffix] of [['Oak', 'Street'], ['Cedar', 'Road'], ['Pine', 'Avenue']]) {
        const p = document.createElement('p'); p.style.width = '343px';
        p.innerHTML = `<em>Final nights: </em><a href="#one"><span style="white-space:nowrap">Don't Move</span></a>, <a href="#two">The\u00a0End of ${street} ${suffix}</a>, <a href="#three"><span style="white-space:nowrap">By Any Means</span></a>`;
        document.body.append(p); const source = p.textContent, links = [...p.querySelectorAll('a')];
        for (const width of [260, 300, 343, 375]) {
          p.style.width = width + 'px'; const result = api.typeset(p);
          check('inline name remains together: ' + street + ' ' + width, /^(composed:rich|native:fits)$/.test(result.outcome)
            && result.after.lines.some(line => line.text.includes(street + ' ' + suffix)), { outcome: result.outcome, lines: result.after.lines.map(line => line.text) });
          check('inline name preserves text and links: ' + street + ' ' + width,
            p.textContent === source && links.every((link, i) => p.querySelectorAll('a')[i] === link) && result.after.overflow <= .5);
        }
        api.restore(p); p.remove();
      }
      for (const source of ['The End of Oak Street', 'A Quiet Place', 'The Grand Budapest Hotel', 'The Life of Chuck', 'Portrait of a Lady on Fire']) {
        for (const width of [90, 110, 130, 180, 240]) {
          const p = document.createElement('p'); p.textContent = source; p.style.width = width + 'px'; document.body.append(p);
          const before = window.Baseline.typeset(p, { mode: 'title' }); window.Baseline.restore(p);
          const after = api.typeset(p, { mode: 'title' });
          if (!before.after.lines.some(line => /\b(?:Oak|Budapest)$/u.test(line.text))) {
            check('retain successful title: ' + source + ' ' + width,
              JSON.stringify(before.after.lines.map(line => line.text)) === JSON.stringify(after.after.lines.map(line => line.text)),
              { before: before.after.lines.map(line => line.text), after: after.after.lines.map(line => line.text) });
          }
          api.restore(p); p.remove();
        }
      }
      return checks;
    });
    report.checks.push(...checks.map(check => ({ browser: name, ...check })));
  } catch (error) { report.errors.push({ browser: name, error: error.stack }); }
  finally { await browser.close(); }
}
await writeFile('output/name-groups-regression.json', JSON.stringify(report, null, 2));
const failures = report.checks.filter(check => !check.pass);
console.log(JSON.stringify({ checks: report.checks.length, failures, errors: report.errors }, null, 2));
if (failures.length || report.errors.length) process.exitCode = 1;
