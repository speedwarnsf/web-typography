import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { browsers } from './browsers.mjs';

const { version } = JSON.parse(await readFile('packages/typeset-v4/package.json', 'utf8'));
let checks = 0;
for (const config of browsers) {
  const browser = await config.engine.launch({ executablePath: config.executablePath });
  try {
    for (const file of ['packages/typeset-v4/dist/go.js', 'public/go.js']) {
      const content = await readFile(file, 'utf8');
      for (const option of ['default', 'tracking', 'spacing']) {
        const page = await browser.newPage();
        try {
          await page.setContent('<html lang="en"><style>p{width:320px;font:20px/1.5 Georgia}</style><p data-typeset>Your browser does not know what a sentence is. It does not know that a thought should not snap in half, or that a word left alone on a line looks abandoned, because it is. It fills each line until the words run out, and calls that typography.</p><p data-no-typeset>Excluded text stays untouched.</p></html>');
          const before = await page.locator('[data-typeset]').textContent();
          await page.evaluate(({ content, option }) => {
            const script = document.createElement('script');
            if (option === 'tracking') script.dataset.typesetTracking = 'false';
            if (option === 'spacing') script.dataset.typesetSpacing = 'false';
            script.textContent = content; document.head.append(script);
          }, { content, option });
          await page.evaluate(() => window.TypesetReady);
          const result = await page.evaluate(() => ({
            version: Typeset.VERSION,
            text: document.querySelector('[data-typeset]').textContent,
            outcome: document.querySelector('[data-typeset]').dataset.tsOutcome,
            tracking: document.querySelector('[data-typeset]').dataset.tsTracking,
            spacing: document.querySelector('[data-typeset]').dataset.tsSpacing,
            excluded: document.querySelector('[data-no-typeset]').dataset.tsOutcome,
          }));
          const label = config.name + ':' + file + ':' + option;
          assert.equal(result.version, version, label);
          assert.equal(result.text, before, label);
          assert.equal(result.outcome, 'composed:rich', label);
          assert.equal(result.excluded, undefined, label);
          if (option === 'default') assert.equal(result.tracking, 'applied', label);
          else assert.equal(result.tracking, 'off', label);
          if (option === 'spacing') assert.equal(result.spacing, 'off', label);
          else assert.notEqual(result.spacing, 'off', label);
          checks += 6;
          await page.evaluate(() => window.TypesetReady.then(controller => controller.disconnect()));
          assert.equal(await page.locator('[data-typeset]').textContent(), before, label);
          assert.equal(await page.locator('[data-ts-track], [data-ts-space], [data-ts-break]').count(), 0, label);
          checks += 2;
        } finally { await page.close(); }
      }
    }
  } finally { await browser.close(); }
}
console.log(JSON.stringify({ version, loaderChecks: checks, failed: 0 }));
