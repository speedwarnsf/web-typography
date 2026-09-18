import { readFile, writeFile } from 'node:fs/promises';
import { build } from 'esbuild';
import { browsers } from './browsers.mjs';

const script = process.env.TYPESET_BUNDLE ? await readFile(process.env.TYPESET_BUNDLE, 'utf8')
  : (await build({ entryPoints: ['src/lib/v4/typeset.release.standalone.ts'], bundle: true, format: 'iife', target: 'es2022', write: false })).outputFiles[0].text;
const report = { checks: [], errors: [] };
for (const { name, engine, executablePath } of browsers) {
  const browser = await engine.launch({ executablePath });
  try {
    const page = await browser.newPage();
    await page.setContent('<html lang="en"><style>p{font:16px/1.25 Arial;width:103px}</style><main><p class="display">The End of Oak Street</p></main></html>');
    await page.addScriptTag({ content: script });
    const checks = await page.evaluate(async () => {
      const api = window.Typeset, checks = [], p = document.querySelector('p');
      const source = p.textContent;
      const check = (label, pass, detail) => checks.push({ label, pass: !!pass, detail });
      const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
      const settle = async (controllers, label) => {
        await wait(250);
        const passes = controllers.map(c => c.stats.passes), markup = p.innerHTML;
        await wait(500);
        check(label, controllers.every((c, i) => c.stats.passes === passes[i]) && p.innerHTML === markup,
          { before: passes, after: controllers.map(c => c.stats.passes), outcome: p.dataset.tsOutcome });
      };
      const title = api.mount(document, 'main .display', { mode: 'title', maxLines: 2 });
      const prose = api.mount(document, 'main p', { mode: 'body' });
      await Promise.all([title.ready, prose.ready]);
      check('overlapping targets are reported without taking ownership', title.stats.overlappingTargets === 0 && prose.stats.overlappingTargets === 1);
      await settle([title, prose], 'overlapping title/body controllers settle without rewriting');
      check('first owner retains title settings', p.dataset.tsSpacing === 'native:spacing-mode' && !p.querySelector('[data-ts-track]'), p.outerHTML);
      check('source is unchanged', p.textContent === source);
      p.style.width = '95px';
      await settle([title, prose], 'resize recomposes once and settles');
      check('resize preserves title ownership and fits', p.dataset.tsSpacing === 'native:spacing-mode' && api.measureLayout(p).overflow <= .5);
      const replacement = 'The House at the End of Oak Street';
      p.textContent = replacement;
      await settle([title, prose], 'source edits recompose without fighting');
      check('replacement is preserved', p.textContent === replacement);
      prose.disconnect();
      check('disconnecting a blocked controller does not restore the owner output', !!p.dataset.tsOutcome && p.textContent === replacement);
      const next = api.mount(document, 'main p', { mode: 'body' });
      await next.ready;
      title.disconnect();
      await settle([next], 'waiting controller takes over after owner disconnects');
      check('takeover uses body settings', !!p.dataset.tsOutcome && p.dataset.tsSpacing !== 'native:spacing-mode', p.dataset.tsSpacing);
      next.disconnect();
      check('last disconnect restores original text nodes', p.textContent === replacement && !p.querySelector('[data-ts-break], [data-ts-track]') && !p.dataset.tsOutcome);

      p.textContent = source;
      const first = api.mount(document, 'main .display', { mode: 'title', maxLines: 2 });
      const second = api.mount(document, 'main p', { mode: 'body' });
      const third = api.mount(document, 'main p', { mode: 'ui' });
      await Promise.all([first.ready, second.ready, third.ready]);
      p.classList.remove('display');
      await settle([first, second, third], 'selector changes transfer ownership and settle');
      check('former owner releases targets that no longer match', p.dataset.tsSpacing !== 'native:spacing-mode', p.dataset.tsSpacing);
      second.disconnect(false);
      await settle([first, third], 'retained output is safely adopted by the next controller');
      check('waiters claim in registration order', p.dataset.tsSpacing === 'native:spacing-mode', p.dataset.tsSpacing);
      first.disconnect(); third.disconnect();

      p.classList.add('display');
      const owner = api.mount(document, 'main .display', { mode: 'title', maxLines: 2 });
      const waiter = api.mount(document, 'main p', { mode: 'body' });
      await Promise.all([owner.ready, waiter.ready]);
      p.setAttribute('data-no-typeset', '');
      await settle([owner, waiter], 'opt-out restores text without restarting a competing owner');
      check('opt-out removes generated layout', p.textContent === source && !p.dataset.tsOutcome && !p.querySelector('[data-ts-break]'));
      p.removeAttribute('data-no-typeset');
      await settle([owner, waiter], 'removing opt-out resumes a single owner');
      check('opt-in resumes processing', !!p.dataset.tsOutcome);
      const main = p.parentElement;
      p.remove(); await wait(100); main.append(p);
      await settle([owner, waiter], 'removed and reinserted targets settle with one owner');
      check('reinsertion preserves source', p.textContent === source && !!p.dataset.tsOutcome);
      waiter.disconnect(); owner.disconnect();
      const fresh = api.mount(document, 'main p', { mode: 'body' });
      await fresh.ready;
      check('disconnect releases all claims for a later mount', !!p.dataset.tsOutcome && p.dataset.tsSpacing !== 'native:spacing-mode');
      fresh.disconnect();
      return checks;
    });
    report.checks.push(...checks.map(check => ({ browser: name, ...check })));
  } catch (error) { report.errors.push({ browser: name, error: error.stack }); }
  finally { await browser.close(); }
}
await writeFile('output/mount-ownership-regression.json', JSON.stringify(report, null, 2));
const failures = report.checks.filter(check => !check.pass);
console.log(JSON.stringify({ checks: report.checks.length, failures, errors: report.errors }, null, 2));
if (failures.length || report.errors.length) process.exitCode = 1;
