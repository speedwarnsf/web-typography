import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { browsers } from './browsers.mjs';

const bundle = await readFile(process.env.TYPESET_BUNDLE || 'packages/typeset-v4/dist/typeset.global.js', 'utf8');
const report = { checks: [], errors: [] };
for (const { name, engine, executablePath } of browsers) {
  const browser = await engine.launch({ executablePath });
  try {
    const page = await browser.newPage();
    await page.setContent('<html lang="en"><style>p{font:18px/1.6 Arial;width:343px}code{font:0.9em monospace;overflow-wrap:break-word;background:#eee;padding:1px 5px}a{color:green}</style><body></body></html>');
    await page.addScriptTag({ content: bundle });
    const checks = await page.evaluate(() => {
      const checks = [], api = window.Typeset;
      const check = (label, pass, detail) => checks.push({ label, pass: !!pass, detail });
      for (const width of [240, 320, 343, 592]) for (const markup of [
        'The browser supports <code>word-spacing</code> and <code>text-align</code>, but its decisions still need a careful review before we publish this paragraph.',
        '<code>text-wrap: pretty</code> improves some breaks, and <a href="#test"><em>styled links</em></a> must retain their behavior as the available width changes.',
        'We measure the entire paragraph, including nested <code><strong>inline code</strong></code> with its own padding and borders.',
        'Our final check is the rendered layout and the <code>audit()</code>',
      ]) {
        const p = document.createElement('p'); p.style.width = width + 'px'; p.innerHTML = markup; document.body.append(p);
        const text = p.textContent, code = p.querySelector('code'), first = p.firstChild;
        const r = api.typeset(p, { density: 'editorial' });
        const label = width + ':' + text.slice(0, 35);
        check('inline code composes ' + label, r.outcome === (r.before.lines.length === 1 ? 'native:fits' : 'composed:rich'), { outcome: r.outcome, constraint: r.constraint });
        check('source and code identity ' + label, p.textContent === text && p.querySelector('code') === code);
        check('no overflow ' + label, r.after.overflow <= .5, r.after.overflow);
        const once = p.innerHTML; api.typeset(p, { density: 'editorial' });
        check('idempotent ' + label, p.innerHTML === once);
        api.restore(p); check('exact restore ' + label, p.innerHTML === markup && p.firstChild === first); p.remove();
      }
      const p = document.createElement('p'); p.style.width = '240px';
      p.innerHTML = 'A long identifier <code>' + 'UnbrokenIdentifier'.repeat(8) + '</code> still needs the native emergency wrap.';
      document.body.append(p); const original = p.innerHTML;
      const r = api.typeset(p);
      check('emergency wrap remains native', r.outcome === 'native:no-candidate' && r.constraint?.kind === 'unbreakable-run', r);
      check('emergency wrap remains intact', p.innerHTML === original && r.after.overflow <= .5);
      api.restore(p); p.innerHTML = 'The browser keeps text with <code>ordinary inline code</code> and links together in a readable paragraph.';
      const code = p.querySelector('code');
      for (const [property, value] of [['margin-left', '-5px'], ['box-decoration-break', 'clone']]) {
        code.style.setProperty(property, value);
        if (property === 'box-decoration-break') code.style.setProperty('-webkit-box-decoration-break', value);
        check('unsupported box remains explicit ' + property, api.typeset(p).outcome === 'native:rich-box');
        api.restore(p); code.style.removeProperty(property); code.style.removeProperty('-webkit-box-decoration-break');
      }
      code.style.overflowWrap = 'anywhere';
      check('anywhere policy not silently weakened', api.typeset(p).outcome === 'native:break-policy');
      api.restore(p); p.remove();
      const audit = document.createElement('p'); audit.id = 'opener-test';
      audit.innerHTML = 'The rule: fill<br>the line with readable words.'; document.body.append(audit);
      check('audit catches colon opener', api.audit('#opener-test').some(issue => issue.type === 'stranded-opener'));
      audit.remove();
      const prose = document.createElement('p');
      prose.textContent = 'The web was not built for typographers. By default, browsers allow lonely orphans on the last line of a paragraph, string together clunky rags, leave punctuation awkwardly stranded, and render lists with unrefined spacing.';
      document.body.append(prose);
      let repaired = false;
      for (let width = 280; width <= 460; width++) {
        prose.style.width = width + 'px';
        const before = api.measureLayout(prose);
        if (!before.lines.some(line => /\. By$/.test(line.text))) continue;
        const result = api.typeset(prose);
        if (result.outcome === 'composed:rich' && result.after.lines.length > before.lines.length && !result.after.lines.some(line => /\. By$/.test(line.text))) {
          repaired = true; api.restore(prose);
          const compact = api.typeset(prose, { density: 'compact' });
          check('explicit compact limit is respected', compact.after.lines.length <= before.lines.length);
          api.restore(prose);
          const capped = api.typeset(prose, { maxLines: before.lines.length });
          check('explicit maximum line count is respected', capped.after.lines.length <= before.lines.length);
          api.restore(prose); break;
        }
        api.restore(prose);
      }
      check('default density can repair a stranded opener with an extra line', repaired);
      prose.remove();
      return checks;
    });
    report.checks.push(...checks.map(check => ({ browser: name, ...check })));
  } catch (error) { report.errors.push({ browser: name, error: error.stack }); }
  finally { await browser.close(); }
}
await mkdir('output', { recursive: true });
await writeFile('output/inline-code-regression.json', JSON.stringify(report, null, 2));
const failures = report.checks.filter(check => !check.pass);
console.log(JSON.stringify({ checks: report.checks.length, failures, errors: report.errors }, null, 2));
if (failures.length || report.errors.length) process.exitCode = 1;
