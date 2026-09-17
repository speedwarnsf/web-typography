import { readFile, writeFile } from 'node:fs/promises';
import { browsers } from './browsers.mjs';

const script = await readFile(process.env.TYPESET_BUNDLE || 'packages/typeset-v4/dist/typeset.global.js', 'utf8');
const report = { checks: [], errors: [] };
for (const { name, engine, executablePath } of browsers) {
  const browser = await engine.launch({ executablePath });
  try {
    const page = await browser.newPage();
    await page.setContent('<html lang="en"><style>p{font:18px/1.5 Arial;width:290px}.large p{font-size:24px}</style><body><main id="scope"><p id="copy">The browser sets text with one rule: fill the line until the next word does not fit, then break. A compositor should preserve the thought and improve the entire paragraph.</p></main><aside id="clock"></aside><p id="outside">This paragraph is outside the mounted scope.</p></body></html>');
    await page.addScriptTag({ content: script });
    const checks = await page.evaluate(async () => {
      const api = window.Typeset, checks = [], scope = document.querySelector('#scope'), p = document.querySelector('#copy');
      const check = (label, pass, detail) => checks.push({ label, pass: !!pass, detail });
      const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
      const until = async test => { const start = performance.now(); while (!test()) { if (performance.now() - start > 5000) throw new Error('Controller update timed out'); await wait(20); } };
      const controller = api.mount(scope, 'p', { density: 'editorial' });
      await controller.ready;
      check('initial composition', p.dataset.tsOutcome === 'composed:rich');
      await wait(150); const settled = controller.stats.passes; await wait(150);
      check('no self-triggered pass loop', controller.stats.passes === settled, controller.stats);
      const query = scope.querySelectorAll; let scans = 0;
      scope.querySelectorAll = function (...args) { scans++; return query.apply(this, args); };
      const clock = document.querySelector('#clock');
      for (let i = 0; i < 8; i++) { clock.textContent = String(i); await wait(20); }
      scope.querySelectorAll = query;
      check('unrelated mutations do not recompose or rescan', scans === 0 && controller.stats.passes === settled, { scans, stats: controller.stats });
      const replacement = 'The replacement paragraph must be recomposed after its text changes. The engine must not restore the words that belonged to the old version.';
      p.textContent = replacement;
      await until(() => controller.stats.passes > settled && p.dataset.tsOutcome === 'composed:rich');
      check('text edits trigger composition', p.textContent === replacement);
      const inserted = document.createElement('p'); inserted.textContent = replacement; scope.append(inserted);
      await until(() => inserted.dataset.tsOutcome === 'composed:rich');
      check('inserted text is discovered', true);
      const beforeTheme = controller.stats.passes; document.body.classList.add('large');
      await until(() => controller.stats.passes > beforeTheme);
      check('ancestor context changes stay in scope', !document.querySelector('#outside').dataset.tsOutcome && api.measureLayout(p).overflow <= .5);
      const beforeResize = controller.stats.passes; p.style.width = '240px';
      await until(() => controller.stats.passes > beforeResize);
      check('width changes recompose', p.dataset.tsOutcome === 'composed:rich' && api.measureLayout(p).width === 240);
      scope.setAttribute('data-no-typeset', '');
      await until(() => !p.dataset.tsOutcome);
      check('opt-out restores owned text', p.textContent === replacement && !p.querySelector('[data-ts-break]'));
      scope.removeAttribute('data-no-typeset');
      await until(() => p.dataset.tsOutcome === 'composed:rich');
      check('removing opt-out resumes composition', true);
      const oldParent = inserted.parentElement; inserted.remove(); await wait(80); const beforeInsert = controller.stats.passes; oldParent.append(inserted);
      await until(() => controller.stats.passes > beforeInsert && inserted.dataset.tsOutcome === 'composed:rich');
      check('removed and reinserted nodes survive', inserted.textContent === replacement);
      controller.disconnect();
      check('disconnect restores source and removes generated output', p.textContent === replacement && !scope.querySelector('[data-ts-break]'));
      const stoppedPasses = controller.stats.passes; p.style.width = '270px'; await wait(100);
      check('disconnect stops observers', controller.stats.passes === stoppedPasses);
      const empty = api.mount(document.createElement('main'), 'p'); await empty.ready; empty.disconnect();
      check('empty mount resolves ready', true);
      document.body.classList.remove('large');
      for (const transform of ['matrix(1, 0, 0, 1, 0, 0)', 'translate(12px, 8px)', 'translateZ(0)']) {
        scope.style.transform = transform;
        const r = api.typeset(p, { density: 'editorial' });
        check('translation composes ' + transform, r.outcome === 'composed:rich' && r.after.overflow <= .5, r.outcome);
        api.restore(p);
      }
      for (const transform of ['scale(.9)', 'rotate(2deg)', 'perspective(500px) rotateY(5deg)']) {
        scope.style.transform = transform;
        check('distortion remains explicit ' + transform, api.typeset(p).outcome === 'native:transformed'); api.restore(p);
      }
      scope.style.transform = ''; scope.style.scale = '.9';
      check('individual CSS scale is detected', api.typeset(p).outcome === 'native:transformed'); api.restore(p);
      scope.style.scale = ''; scope.style.display = 'none';
      const hidden = api.mount(scope, 'p'); await hidden.ready;
      check('hidden scope reports unmeasurable', p.dataset.tsOutcome === 'unmeasurable');
      scope.style.display = 'block'; await until(() => p.dataset.tsOutcome === 'composed:rich');
      check('showing hidden scope recomposes', true); hidden.disconnect();
      return checks;
    });
    report.checks.push(...checks.map(check => ({ browser: name, ...check })));
  } catch (error) { report.errors.push({ browser: name, error: error.stack }); }
  finally { await browser.close(); }
}
await writeFile('output/controller-regression.json', JSON.stringify(report, null, 2));
const failures = report.checks.filter(check => !check.pass);
console.log(JSON.stringify({ checks: report.checks.length, failures, errors: report.errors }, null, 2));
if (failures.length || report.errors.length) process.exitCode = 1;
