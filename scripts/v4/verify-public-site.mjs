import assert from 'node:assert/strict';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { browsers } from './browsers.mjs';

const base = process.env.SITE_URL || 'http://127.0.0.1:4210';
const { version } = JSON.parse(await readFile('public/release.json', 'utf8'));
const pin = `go@${version}.js`;
const integrity = JSON.parse(await readFile('public/sri.json', 'utf8')).files[pin];
const report = { base, version, checks: [], errors: [], thirdPartyErrors: [], samples: [] };
const check = (name, value) => { report.checks.push({ name, passed: !!value }); assert.ok(value, name); };
await mkdir('output/playwright', { recursive: true });
for (const config of browsers) {
  const browser = await config.engine.launch({ executablePath: config.executablePath });
  try {
    const page = await browser.newPage();
    page.on('pageerror', error => {
      const issue = { browser: config.name, error: error.message, url: page.url() };
      // Retain the pre-existing visitor-alert CORS failure separately, never hide it.
      if (/^\/ntfy\.sh\/dyork-typeset-alerts due to access control checks\.$/.test(error.message)) report.thirdPartyErrors.push(issue);
      else report.errors.push(issue);
    });
    for (const width of [390, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      for (const path of ['/', '/proof', '/utility', '/perfect-paragraph', '/essay', '/pairing-cards']) {
        const response = await page.goto(base + path);
        check(`${config.name} ${width} ${path} responds (${response.status()})`, [200, 304].includes(response.status()));
        await page.waitForFunction(version => window.Typeset?.VERSION === version, version);
        await page.evaluate(() => window.TypesetReady);
        await page.waitForTimeout(450);
        const sample = await page.evaluate(() => ({
          version: Typeset.VERSION,
          overflow: document.documentElement.scrollWidth - innerWidth,
          composed: document.querySelectorAll('[data-ts-outcome^="composed"]').length,
          spacing: document.querySelectorAll('[data-ts-spacing="applied"]').length,
          nested: document.querySelectorAll('.ts-line .ts-line').length,
          invalid: Array.from(document.querySelectorAll('[data-ts-outcome^="composed"]')).filter(el => Typeset.measureLayout(el).overflow > .75).map(el => el.textContent.slice(0, 80)),
        }));
        report.samples.push({ browser: config.name, width, path, ...sample });
        check(`${config.name} ${width} ${path} no new composed overflow`, !sample.invalid.length && !sample.nested);
        if (path === '/perfect-paragraph') check(`${config.name} ${width} paragraph demo composes`, sample.composed > 0);
        if (path === '/') {
          check(`${config.name} ${width} homepage composes`, sample.composed > 0 && sample.overflow <= 1);
          await page.getByRole('slider', { name: 'Squeeze the column width' }).focus();
          await page.keyboard.press('ArrowLeft');
          await page.keyboard.press('ArrowRight');
          await page.getByRole('tab', { name: 'Your browser', exact: true }).click();
          await page.getByRole('tab', { name: 'A good book', exact: true }).click();
          await page.screenshot({ path: `output/playwright/public-home-${config.name}-${width}.png`, fullPage: true });
          // Client-side route transition must keep the current engine and remove old ownership.
          await page.getByRole('link', { name: 'Try it on your own text' }).click();
          await page.waitForURL('**/proof');
          await page.evaluate(() => window.TypesetReady);
          check(`${config.name} client navigation`, await page.evaluate(version => Typeset.VERSION === version, version));
        }
        // Let route prefetches settle before forcing another full navigation.
        await page.waitForLoadState('networkidle');
      }
    }
    for (const path of ['/releases/3.5.1/', '/releases/4.0.0/', `/releases/${version}/`]) {
      const response = await page.goto(base + path);
      check(`${config.name} archive ${path}`, [200, 304].includes(response.status()));
      const docs = page.getByRole('link', { name: path.includes('3.5.1') ? 'Original package documentation' : 'Installation and selector targeting' });
      check(`${config.name} archive relative links ${path}`, (await docs.getAttribute('href')) === 'README.md');
      await docs.click();
      check(`${config.name} archive documentation ${path}`, page.url().includes(path + 'README.md'));
    }
    const text = 'A thoughtful title about the neighborhood gallery and the people who made it possible';
    for (const explicit of [false, true]) {
      await page.goto(base + `/releases/${version}/`);
      await page.setContent(`<html lang="en"><style>h2,figcaption,p{width:280px;font:20px/1.5 Georgia;text-wrap:wrap}</style><h2 class="chosen">${text}</h2><figcaption class="chosen">Read <a href="#notes">the neighborhood gallery notes</a> and discover how the collection grew over the years.</figcaption><p id="body">${text}</p><p data-no-typeset id="excluded">${text}</p></html>`);
      await page.evaluate(() => { window.originalLink = document.querySelector('a'); window.originalText = document.body.textContent; });
      await page.evaluate(({ base, explicit, integrity, pin }) => new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = base + '/' + pin;
        script.integrity = integrity; script.crossOrigin = 'anonymous';
        if (explicit) { script.dataset.typesetSelector = '.chosen'; script.dataset.typesetTracking = 'false'; }
        script.onload = resolve; script.onerror = reject; document.head.append(script);
      }), { base, explicit, integrity, pin });
      await page.evaluate(() => window.TypesetReady);
      const targets = await page.evaluate(() => ({ version: Typeset.VERSION, title: document.querySelector('h2').dataset.tsOutcome, caption: document.querySelector('figcaption').dataset.tsOutcome, tracking: document.querySelector('figcaption').dataset.tsTracking, body: document.querySelector('#body').dataset.tsOutcome, excluded: document.querySelector('#excluded').dataset.tsOutcome, link: originalLink === document.querySelector('a'), source: originalText === document.body.textContent }));
      check(`${config.name} loader targets titles and captions ${explicit}`, targets.version === version && targets.title && targets.caption);
      check(`${config.name} loader scope and identity ${explicit}`, (!explicit || targets.tracking === 'off') && !targets.excluded && targets.link && targets.source && (explicit ? !targets.body : !!targets.body));
      await page.evaluate(() => window.TypesetReady.then(controller => controller.disconnect()));
    }
  } finally { await browser.close(); }
}
await writeFile('output/public-site-verification.json', JSON.stringify(report, null, 2));
console.log(JSON.stringify({ checks: report.checks.length, errors: report.errors, thirdPartyErrors: report.thirdPartyErrors, samples: report.samples }, null, 2));
check('no browser runtime errors', report.errors.length === 0);
