import { build } from 'esbuild';
import { writeFile } from 'node:fs/promises';
import { browsers } from './browsers.mjs';

// Isolated browser experiment only. Never changes SceneF files or its deployment.
const bundle = (await build({ entryPoints: ['src/lib/v4/typeset.release.standalone.ts'], bundle: true,
  format: 'iife', target: 'es2022', write: false })).outputFiles[0].text;
const report = { url: 'https://scenef.com/capecoral', checks: [], samples: [], errors: [] };
for (const { name, engine, executablePath } of browsers) {
  const browser = await engine.launch({ executablePath });
  try {
    const page = await browser.newPage({ viewport: { width: 375, height: 812 } });
    page.on('pageerror', error => report.errors.push({ browser: name, error: error.message }));
    await page.goto(report.url, { waitUntil: 'networkidle' });
    await page.waitForFunction(() => window.__scenefTypeset?.version && document.querySelector('[aria-label="Picks"] p[data-ts-outcome]'));
    const sample = () => page.evaluate(async () => {
      const p = [...document.querySelectorAll('p')].find(el => el.textContent === 'The End of Oak Street');
      if (!p) throw new Error('The reported film title is no longer in the live corpus');
      const records = [];
      for (let i = 0; i < 40; i++) {
        const walker = document.createTreeWalker(p, NodeFilter.SHOW_TEXT);
        let node, position = 0, x;
        while ((node = walker.nextNode())) {
          const offset = p.textContent.indexOf('End') - position;
          if (offset >= 0 && offset + 3 <= node.length) {
            const range = document.createRange(); range.setStart(node, offset); range.setEnd(node, offset + 3);
            x = range.getBoundingClientRect().x; break;
          }
          position += node.length;
        }
        records.push({ x, html: p.innerHTML, outcome: p.dataset.tsOutcome, spacing: p.dataset.tsSpacing });
        await new Promise(resolve => setTimeout(resolve, 50));
      }
      return { positions: [...new Set(records.map(r => r.x))],
        transitions: records.slice(1).filter((r, i) => r.html !== records[i].html).length,
        outcome: p.dataset.tsOutcome, spacing: p.dataset.tsSpacing, text: p.textContent,
        generatedBreaks: p.querySelectorAll('[data-ts-break]').length,
        duplicateMatches: p.matches('main .font-display:not(.tnum)') && p.matches('main p:not(.tnum)') };
    });
    const before = await sample();
    report.samples.push({ browser: name, width: 375, variant: 'live-4.1.0', ...before });
    await page.evaluate(() => window.__scenefTypeset.disconnectAll());
    await page.addScriptTag({ content: bundle });
    await page.evaluate(async () => {
      window.ownershipTestControllers = [
        window.Typeset.mount(document, 'main .font-display:not(.tnum)', { mode: 'title', maxLines: 2 }),
        window.Typeset.mount(document, 'main p:not(.tnum)', { mode: 'body' }),
      ];
      await Promise.all(window.ownershipTestControllers.map(c => c.ready));
    });
    for (const width of [375, 390, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      await page.waitForTimeout(600);
      const after = await sample();
      report.samples.push({ browser: name, width, variant: 'unreleased-ownership-fix', ...after });
      report.checks.push({ browser: name, width, label: 'no title jitter', pass: after.transitions === 0 && after.positions.length === 1 });
      report.checks.push({ browser: name, width, label: 'source and title composition retained',
        pass: after.text === 'The End of Oak Street' && (width < 400
          ? after.outcome === 'composed:rich' && after.generatedBreaks > 0 && after.spacing === 'native:spacing-mode'
          : after.outcome === 'native:fits') });
      const integrity = await page.evaluate(() => {
        const p = [...document.querySelectorAll('p')].find(el => el.textContent === 'The End of Oak Street');
        const link = p.closest('a'); link.focus();
        const range = document.createRange(); range.selectNodeContents(p);
        const selection = getSelection(); selection.removeAllRanges(); selection.addRange(range);
        const clipboard = new DataTransfer();
        const copy = new ClipboardEvent('copy', { bubbles: true, cancelable: true, clipboardData: clipboard });
        p.dispatchEvent(copy);
        return { focused: document.activeElement === link, selected: selection.toString(),
          selectedSource: range.cloneContents().textContent,
          copied: copy.clipboardData.getData('text/plain'), intercepted: copy.defaultPrevented,
          href: link.getAttribute('href'), overflow: window.Typeset.measureLayout(p).overflow };
      });
      report.checks.push({ browser: name, width, label: 'link, focus, selection and bounds preserved',
        pass: integrity.focused && integrity.selectedSource === after.text && integrity.overflow <= .5
          && (after.outcome === 'composed:rich' ? integrity.intercepted && integrity.copied === after.text : !integrity.intercepted)
          && integrity.href === '/film/the-end-of-oak-street-2026/capecoral', detail: integrity });
      if (width === 375) await page.getByRole('region', { name: 'Picks', exact: true }).screenshot({ path: `output/playwright/capecoral-ownership-${name}.png` });
    }
    await page.evaluate(() => window.ownershipTestControllers.forEach(c => c.disconnect()));
  } catch (error) { report.errors.push({ browser: name, error: error.stack }); }
  finally { await browser.close(); }
}
await writeFile('output/scenef-ownership-verification.json', JSON.stringify(report, null, 2));
const failures = report.checks.filter(check => !check.pass);
console.log(JSON.stringify({ checks: report.checks.length, failures, samples: report.samples, errors: report.errors }, null, 2));
if (failures.length || report.errors.length) process.exitCode = 1;
