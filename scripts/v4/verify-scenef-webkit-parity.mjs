import { writeFile } from 'node:fs/promises';
import { browsers } from './browsers.mjs';
const config = browsers.find(b => b.name === 'webkit');
const browser = await config.engine.launch({ executablePath: config.executablePath });
const report = { samples: [], checks: [] };
try {
  for (const enabled of [false, true]) {
    const page = await browser.newPage({ viewport: { width: 375, height: 900 } });
    page.setDefaultTimeout(15000);
    await page.addInitScript(on => { window.__scenefTypesetDisabled = !on; }, enabled);
    const errors = [], responses = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('response', response => { if (response.url().includes('_rsc=')) responses.push({ url: response.url(), status: response.status() }); });
    await page.goto('https://scenef.com/capecoral', { waitUntil: 'networkidle' });
    await page.waitForFunction(() => window.__scenefTypeset?.version);
    await page.evaluate(() => window.__scenefTypeset.ready);
    await page.waitForTimeout(700);
    const selected = await page.evaluate(() => {
      const p = document.querySelector('[aria-label="Picks"] p.font-display'), link = p.closest('a');
      link.focus(); const r = document.createRange(); r.selectNodeContents(p);
      getSelection().removeAllRanges(); getSelection().addRange(r);
      return { source: p.textContent, href: link.getAttribute('href') };
    });
    const active = () => page.evaluate(() => ({ tag: document.activeElement?.tagName, href: document.activeElement?.getAttribute('href'), text: document.activeElement?.textContent.slice(0, 100) }));
    await page.keyboard.press('Tab'); const afterSelectionTab = await active();
    await page.evaluate(href => { getSelection().removeAllRanges(); document.querySelector(`a[href="${href}"]`).focus(); }, selected.href);
    await page.keyboard.press('Tab'); const afterPlainTab = await active();
    for (const path of ['/week', '/theaters', '/capecoral']) {
      const link = page.locator(`a[href="${path}"]`).first();
      if (await link.count()) { await link.click(); await page.waitForURL(url => url.pathname === path); }
      else await page.goto('https://scenef.com' + path);
      await page.waitForTimeout(1500);
    }
    report.samples.push({ enabled, selected, afterSelectionTab, afterPlainTab, errors, responses });
    await page.close();
  }
} finally { await browser.close(); }
const [off, on] = report.samples;
report.checks.push({ label: 'selection Tab focus matches native behavior', pass: JSON.stringify(off.afterSelectionTab) === JSON.stringify(on.afterSelectionTab) });
report.checks.push({ label: 'plain Tab focus matches native behavior', pass: JSON.stringify(off.afterPlainTab) === JSON.stringify(on.afterPlainTab) });
await writeFile('output/scenef-webkit-parity-4.2.json', JSON.stringify(report, null, 2));
console.log(JSON.stringify({ checks: report.checks, samples: report.samples.map(({ responses, ...sample }) => ({ ...sample, responses: responses.length, failedResponses: responses.filter(r => r.status !== 200) })) }, null, 2));
if (report.checks.some(c => !c.pass)) process.exitCode = 1;
