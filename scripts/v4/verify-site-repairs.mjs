import { mkdir, writeFile } from 'node:fs/promises';
import { browsers } from './browsers.mjs';

const base = process.env.SITE_URL || 'http://127.0.0.1:4211';
const report = { checks: [], errors: [] };
await mkdir('output/playwright', { recursive: true });
for (const { name, engine, executablePath } of browsers) {
  const browser = await engine.launch({ executablePath });
  const page = await browser.newPage({ viewport: { width: 375, height: 812 } });
  const check = (label, pass, detail) => report.checks.push({ browser: name, label, pass: !!pass, detail });
  page.on('pageerror', error => report.errors.push({ browser: name, error: error.message }));
  await page.route('**/ntfy.sh/**', route => route.fulfill({ status: 200, body: '{}' }));
  try {
    const visit = async path => {
      await page.goto(base + path);
      await page.waitForFunction(() => window.TypesetReady);
      await page.evaluate(() => window.TypesetReady);
      await page.evaluate(() => document.fonts.ready);
    };
    await visit('/utility');
    const by = await page.evaluate(() => {
      const p = [...document.querySelectorAll('main p')].find(p => p.textContent.startsWith('The web wasn'));
      return { outcome: p.dataset.tsOutcome, lines: window.Typeset.measureLayout(p).lines.map(line => line.text) };
    });
    check('By stays with default at phone width', by.outcome === 'composed:rich' && !by.lines.slice(0, -1).some(line => /\bBy$/.test(line)), by);
    await visit('/essay');
    const essay = await page.evaluate(() => {
      const p = [...document.querySelectorAll('article > p')].find(p => p.textContent.startsWith('The browser sets'));
      return {
        fill: window.Typeset.measureLayout(p).lines.map(line => line.text),
        code: [...document.querySelectorAll('article > p')].filter(p => p.querySelector('code')).map(p => ({ outcome: p.dataset.tsOutcome, spacing: p.dataset.tsSpacing, overflow: window.Typeset.measureLayout(p).overflow })),
      };
    });
    check('fill stays with the following clause', !essay.fill.slice(0, -1).some(line => /rule: fill$/.test(line)), essay.fill);
    check('essay inline code paragraphs compose and finish', essay.code.length === 3 && essay.code.every(p => p.outcome === 'composed:rich' && p.spacing === 'applied' && p.overflow <= .5), essay.code);
    await page.waitForFunction(() => document.querySelector('.es-panels p:last-child')?.dataset.tsOutcome);
    check('initial hidden essay panel composes', await page.locator('.es-panels p:last-child').getAttribute('data-ts-outcome') === 'composed:rich');
    for (const mode of ['Browser', 'text-wrap: pretty', 'Typeset']) {
      await page.getByRole('tab', { name: mode, exact: true }).click();
      const slider = page.locator('.es-squeeze input');
      await slider.fill('280'); await slider.dispatchEvent('input');
      await page.waitForFunction(() => document.querySelector('.es-width-readout')?.textContent === '280px');
      check('essay resize while ' + mode, await page.locator('.es-panels p:last-child').getAttribute('data-ts-outcome') === 'composed:rich');
      await slider.fill('320'); await slider.dispatchEvent('input');
    }
    await page.locator('.es-demo').screenshot({ path: `output/playwright/essay-repair-${name}.png` });
    await visit('/');
    await page.getByRole('tab', { name: 'Your browser', exact: true }).click();
    const homeSlider = page.getByRole('slider', { name: 'Squeeze the column width' });
    await homeSlider.fill('290'); await homeSlider.dispatchEvent('input');
    await page.waitForFunction(() => document.querySelector('.v2-controls-px')?.textContent === '290px');
    await page.getByRole('tab', { name: 'A good book', exact: true }).click();
    check('homepage recompose while transformed panel inactive', await page.locator('.v2-stack p:nth-child(2)').getAttribute('data-ts-outcome') === 'composed:rich');
    await visit('/proof');
    const proofMetrics = () => page.evaluate(() => {
      const panels = [...document.querySelectorAll('[data-proof-panels] p')];
      const cells = [...document.querySelectorAll('tbody tr:last-child td')].slice(1).map(td => Number(td.textContent));
      return { widths: panels.map(p => p.getBoundingClientRect().width), counts: panels.map(p => window.Typeset.measureLayout(p).lines.length), reported: cells, outcome: panels[1].dataset.tsOutcome };
    });
    await page.waitForFunction(() => document.querySelector('tbody tr:last-child td:last-child')?.textContent !== '0');
    let metrics = await proofMetrics();
    check('hidden proof baseline is measured', metrics.counts.every(n => n > 1) && metrics.counts.every((n, i) => n === metrics.reported[i]), metrics);
    check('proof width is exact', metrics.widths.every(width => width === 375), metrics.widths);
    await page.getByRole('button', { name: 'Browser', exact: true }).click();
    await page.getByRole('button', { name: '320', exact: true }).click();
    await page.getByRole('button', { name: 'Source Sans', exact: true }).click();
    await page.getByRole('button', { name: 'Typeset', exact: true }).click();
    await page.waitForFunction(() => document.querySelector('[data-proof-panels] p[data-ts-outcome]')?.dataset.tsOutcome === 'composed:rich');
    metrics = await proofMetrics();
    check('proof controls recompose the inactive panel', metrics.outcome === 'composed:rich' && metrics.counts.every((n, i) => n === metrics.reported[i]), metrics);
    const replacement = 'By default, the browser fills each line. We need the compositor to preserve meaningful phrases while finishing the shape of the entire paragraph. Changing this text must update both comparisons.';
    await page.getByRole('textbox', { name: 'Your paragraph' }).fill(replacement);
    await page.waitForFunction(text => [...document.querySelectorAll('[data-proof-panels] p')].every(p => p.textContent === text), replacement);
    check('proof text updates reach both panels', true);
    await page.getByRole('checkbox', { name: 'Give the browser text-wrap: pretty' }).check();
    await page.getByRole('checkbox', { name: 'Line tracking', exact: true }).uncheck();
    await page.waitForFunction(() => document.querySelector('[data-proof-panels] p[data-ts-outcome]')?.dataset.tsTracking === 'off');
    check('proof tracking control leaves composition active', (await proofMetrics()).outcome === 'composed:rich');
    await page.getByRole('checkbox', { name: 'Line tracking', exact: true }).check();
    await page.getByRole('checkbox', { name: 'Optical hanging', exact: true }).uncheck();
    await page.waitForFunction(() => document.querySelector('[data-proof-panels] p[data-ts-outcome]')?.dataset.tsHanging === 'off');
    check('proof hanging control works', true);
    await page.getByRole('checkbox', { name: 'Optical hanging', exact: true }).check();
    for (const width of [375, 1280]) {
      await page.setViewportSize({ width, height: 900 });
      metrics = await proofMetrics();
      check('proof metrics after viewport resize ' + width, metrics.counts.every((n, i) => n === metrics.reported[i]), metrics);
      check('no page-level horizontal overflow ' + width, await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
      await page.screenshot({ path: `output/playwright/proof-repair-${name}-${width}.png`, fullPage: true });
    }
  } catch (error) { report.errors.push({ browser: name, error: error.stack }); }
  finally { await browser.close(); }
}
await writeFile('output/site-repairs.json', JSON.stringify(report, null, 2));
const failures = report.checks.filter(check => !check.pass);
console.log(JSON.stringify({ checks: report.checks.length, failures, errors: report.errors }, null, 2));
if (failures.length || report.errors.length) process.exitCode = 1;
