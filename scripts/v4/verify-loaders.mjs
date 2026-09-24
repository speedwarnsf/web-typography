// @ts-check
import { readFile, writeFile } from 'node:fs/promises';
import { browsers } from './browsers.mjs';
import { artifacts, expectedVersion } from './candidate.mjs';

const version = await expectedVersion();
/** @type {{ browser: string, label: string, pass: boolean, detail?: unknown }[]} */
const checks = [];
/** @type {{ browser: string, error: string }[]} */
const errors = [];
const loaders = [['package go.js', artifacts.go], ['website go.js', artifacts.siteGo]];
for (const config of browsers) {
  const browser = await config.engine.launch({ executablePath: config.executablePath });
  try {
    for (const [loader, file] of loaders) {
      const content = await readFile(file, 'utf8');
      for (const option of ['default', 'tracking', 'spacing']) {
        const page = await browser.newPage();
        page.setDefaultTimeout(20000);
        const label = `${loader} ${option}`;
        /** @param {string} what @param {unknown} pass @param {unknown} [detail] */
        const check = (what, pass, detail) => checks.push({ browser: config.name, label: `${label}: ${what}`, pass: !!pass, ...(pass ? {} : { detail }) });
        try {
          await page.setContent('<html lang="en"><style>p{width:320px;font:20px/1.5 Georgia}</style><p data-typeset>Your browser does not know what a sentence is. It does not know that a thought should not snap in half, or that a word left alone on a line looks abandoned, because it is. It fills each line until the words run out, and calls that typography.</p><p data-no-typeset>Excluded text stays untouched.</p></html>');
          const before = await page.locator('[data-typeset]').textContent();
          await page.evaluate(({ content, option }) => {
            const script = document.createElement('script');
            if (option === 'tracking') script.dataset.typesetTracking = 'false';
            if (option === 'spacing') script.dataset.typesetSpacing = 'false';
            script.textContent = content; document.head.append(script);
          }, { content, option });
          await page.evaluate(() => /** @type {any} */ (window).TypesetReady);
          const result = await page.evaluate(() => {
            const p = /** @type {HTMLElement} */ (document.querySelector('[data-typeset]'));
            const excluded = /** @type {HTMLElement} */ (document.querySelector('[data-no-typeset]'));
            return { version: /** @type {any} */ (window).Typeset.VERSION, text: p.textContent, outcome: p.dataset.tsOutcome, tracking: p.dataset.tsTracking, spacing: p.dataset.tsSpacing, excluded: excluded.dataset.tsOutcome };
          });
          check('reports VERSION ' + version, result.version === version, result.version);
          check('text unchanged', result.text === before, result.text);
          check('composes rich', result.outcome === 'composed:rich', result.outcome);
          check('data-no-typeset untouched', result.excluded === undefined, result.excluded);
          check('tracking ' + (option === 'default' ? 'applied' : 'off'), option === 'default' ? result.tracking === 'applied' : result.tracking === 'off', result.tracking);
          check('spacing ' + (option === 'spacing' ? 'off' : 'on'), option === 'spacing' ? result.spacing === 'off' : result.spacing !== 'off', result.spacing);
          await page.evaluate(() => /** @type {any} */ (window).TypesetReady.then((/** @type {any} */ controller) => controller.disconnect()));
          check('disconnect restores text', await page.locator('[data-typeset]').textContent() === before);
          check('disconnect removes markers', await page.locator('[data-ts-track], [data-ts-space], [data-ts-break]').count() === 0);
        } catch (error) {
          errors.push({ browser: config.name, error: label + ': ' + String(/** @type {Error} */ (error).stack || error) });
        } finally { await page.close(); }
      }
    }
  } finally { await browser.close(); }
}
const failures = checks.filter(c => !c.pass);
await writeFile('output/loaders.json', JSON.stringify({ version, loaders: Object.fromEntries(loaders), checks, errors }, null, 2));
console.log(JSON.stringify({ version, loaderChecks: checks.length, failures, errors }, null, 2));
if (failures.length || errors.length) process.exitCode = 1;
