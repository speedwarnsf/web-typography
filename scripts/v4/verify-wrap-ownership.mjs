import { build } from 'esbuild';
import { writeFile } from 'node:fs/promises';
import { browsers } from './browsers.mjs';
const bundle = (await build({ entryPoints: ['src/lib/v4/typeset.release.standalone.ts'], bundle: true, format: 'iife', target: 'es2022', write: false })).outputFiles[0].text;
const report = { checks: [], errors: [] };
for (const { name, engine, executablePath } of browsers) {
  const browser = await engine.launch({ executablePath });
  try {
    const page = await browser.newPage();
    await page.setContent('<html lang="en"><style>p{font:14px/1.4 Georgia;width:110px}</style><body></body></html>');
    await page.addScriptTag({ content: bundle });
    const checks = await page.evaluate(() => {
      const api = window.Typeset, checks = [];
      const check = (label, pass, detail) => checks.push({ label, pass: !!pass, detail });
      for (const wrap of ['pretty', 'balance', 'stable']) for (const inherited of [true, false]) {
        const parent = document.createElement('div'); const p = document.createElement('p');
        parent.append(p); document.body.append(parent); p.textContent = 'Marquee Cinemas Coralwood';
        (inherited ? parent : p).style.setProperty('text-wrap', wrap, 'important');
        p.style.width = '1000px'; const range = document.createRange(); range.setStart(p.firstChild, 0); range.setEnd(p.firstChild, 15);
        p.style.width = Math.ceil(range.getBoundingClientRect().width + 3) + 'px';
        const original = p.outerHTML, prefix = wrap + '/' + inherited;
        const authoredWrap = getComputedStyle(p).getPropertyValue('text-wrap-style');
        const result = api.typeset(p, { mode: 'title' });
        check(prefix + ': chosen name composition wins', result.outcome === 'composed:rich' && result.after.lines[0].text === 'Marquee Cinemas'
          && result.after.lines[1].text === 'Coralwood' && result.after.overflow <= .5, result.after.lines.map(l => l.text));
        check(prefix + ': owns wrap style while active', getComputedStyle(p).getPropertyValue('text-wrap-style') === 'auto');
        api.restore(p); check(prefix + ': restores exact authored markup', p.outerHTML === original, p.outerHTML);
        api.typeset(p, { mode: 'title' }); p.style.color = 'red'; api.restore(p);
        check(prefix + ': preserves unrelated client style update', p.style.color === 'red' && getComputedStyle(p).getPropertyValue('text-wrap-style') === authoredWrap);
        api.typeset(p, { mode: 'title' }); p.style.setProperty('text-wrap-style', 'balance'); api.restore(p);
        check(prefix + ': preserves replacement wrapping policy', p.style.getPropertyValue('text-wrap-style') === 'balance');
        parent.remove();
      }
      return checks;
    });
    report.checks.push(...checks.map(check => ({ browser: name, ...check })));
  } catch (error) { report.errors.push({ browser: name, error: error.stack }); }
  finally { await browser.close(); }
}
await writeFile('output/wrap-ownership-regression.json', JSON.stringify(report, null, 2));
const failures = report.checks.filter(check => !check.pass);
console.log(JSON.stringify({ checks: report.checks.length, failures, errors: report.errors }, null, 2));
if (failures.length || report.errors.length) process.exitCode = 1;
