import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { browsers } from './browsers.mjs';

// An opt-in integration check, not a fixed corpus: SceneF's listings change daily.
const base = process.env.SCENEF_URL || 'http://127.0.0.1:4213';
const bundle = await readFile('public/releases/4.2.0/typeset.global.js', 'utf8');
const report = { base, version: '4.2.0', checks: [], samples: [], errors: [] };
await mkdir('output/playwright', { recursive: true });
for (const { name, engine, executablePath } of browsers) {
  const browser = await engine.launch({ executablePath });
  try {
    for (const width of [375, 1440]) {
      const page = await browser.newPage({ viewport: { width, height: 900 } });
      page.on('pageerror', error => report.errors.push({ browser: name, width, error: error.message }));
      const check = (label, pass, detail) => report.checks.push({ browser: name, width, label, pass: !!pass, detail });
      await page.goto(base + '/capecoral', { waitUntil: 'networkidle' });
      await page.waitForFunction(() => window.__scenefTypeset?.version);
      await page.evaluate(() => window.__scenefTypeset.ready);
      await page.addScriptTag({ content: bundle });
      const inspect = () => page.evaluate(() => {
        const contract = window.__scenefTypeset;
        const targets = [...document.querySelectorAll(contract.selectors.titles + ',' + contract.selectors.prose)];
        const read = el => ({ text: el.textContent, outcome: el.dataset.tsOutcome, lines: window.Typeset.measureLayout(el).lines.map(line => line.text), overflow: window.Typeset.measureLayout(el).overflow });
        const title = [...document.querySelectorAll('[aria-label="Picks"] p')].find(p => p.textContent === 'The End of Oak Street');
        const venue = [...document.querySelectorAll('[data-typeset-mode="title"]')].find(p => p.textContent === 'Marquee Cinemas Coralwood');
        const final = [...document.querySelectorAll('main p')].find(p => p.textContent.startsWith('Final ') && p.textContent.includes('Oak Street'));
        return { version: contract.version, overlaps: targets.filter(el => el.matches(contract.selectors.titles) && el.matches(contract.selectors.prose)).length,
          nested: targets.filter(el => targets.some(parent => parent !== el && parent.contains(el))).length,
          stats: contract.stats(), title: title && read(title), venue: venue && read(venue), final: final && read(final),
          outcomes: targets.reduce((counts, el) => { const outcome = el.dataset.tsOutcome || 'pending'; counts[outcome] = (counts[outcome] || 0) + 1; return counts; }, {}) };
      });
      const initial = await inspect();
      report.samples.push({ browser: name, width, path: '/capecoral', ...initial });
      check('exact release and disjoint non-nested targets', initial.version === report.version && !initial.overlaps && !initial.nested && initial.stats.every(s => !s.overlappingTargets), initial);
      for (const role of ['title', 'venue', 'final']) {
        const sample = initial[role];
        check('reported Cape Coral ' + role + ' remains covered', sample && /^(composed:|native:fits)/.test(sample.outcome) && sample.overflow <= .5, sample);
      }
      check('Oak Street remains together in Final nights', initial.final?.lines.some(line => line.includes('Oak Street')), initial.final);
      const jitter = await page.evaluate(async () => {
        const targets = [...document.querySelectorAll('[aria-label="Picks"] p')];
        const frames = [];
        for (let i = 0; i < 40; i++) {
          frames.push(targets.map(el => ({ html: el.innerHTML, rects: [...el.querySelectorAll('[data-ts-line]')].map(span => span.getBoundingClientRect().x) })));
          await new Promise(resolve => setTimeout(resolve, 50));
        }
        return new Set(frames.map(frame => JSON.stringify(frame))).size;
      });
      check('Picks composition remains stable for two seconds', jitter === 1, jitter);
      const integrity = await page.evaluate(() => {
        const p = [...document.querySelectorAll('[aria-label="Picks"] p')].find(p => p.textContent === 'The End of Oak Street');
        const link = p.closest('a'); link.focus();
        const range = document.createRange(); range.selectNodeContents(p);
        getSelection().removeAllRanges(); getSelection().addRange(range);
        const copy = new ClipboardEvent('copy', { bubbles: true, cancelable: true, clipboardData: new DataTransfer() });
        p.dispatchEvent(copy);
        return { source: p.textContent, selected: range.cloneContents().textContent, copied: copy.clipboardData.getData('text/plain'), intercepted: copy.defaultPrevented,
          composed: p.dataset.tsOutcome.startsWith('composed:'), focus: document.activeElement === link, href: link.getAttribute('href') };
      });
      check('selection, copy handler and keyboard focus preserve title', integrity.focus && integrity.source === integrity.selected
        && (!integrity.composed || (integrity.intercepted && integrity.copied === integrity.source)) && integrity.href.includes('/film/the-end-of-oak-street'), integrity);
      for (const resized of [390, 768, width]) { await page.setViewportSize({ width: resized, height: 900 }); await page.waitForTimeout(400); }
      const resized = await inspect();
      check('resize keeps targets composed without overflow', ['title', 'venue', 'final'].every(role => resized[role]?.overflow <= .5 && /^(composed:|native:fits)/.test(resized[role]?.outcome)), resized);
      await page.getByRole('region', { name: 'Picks', exact: true }).screenshot({ path: `output/playwright/scenef-4.2-picks-${name}-${width}.png` });
      for (const path of ['/week', '/theaters', '/']) {
        const href = path === '/' ? '/capecoral' : path;
        const links = page.locator(`a[href="${href}"]`);
        if (await links.count()) { await links.first().click(); await page.waitForURL(url => url.pathname === href); }
        else await page.goto(base + href);
        await page.waitForFunction(() => window.__scenefTypeset?.version === '4.2.0');
        await page.waitForTimeout(800);
        const state = await page.evaluate(() => ({ version: window.__scenefTypeset.version, stats: window.__scenefTypeset.stats(),
          targets: document.querySelectorAll('[data-ts-outcome]').length, composed: document.querySelectorAll('[data-ts-outcome^="composed:"]').length,
          audit: window.__scenefTypeset.audit() }));
        check('navigation composes ' + href, state.targets > 0 && state.stats.every(s => !s.overlappingTargets), { targets: state.targets, composed: state.composed, stats: state.stats });
        report.samples.push({ browser: name, width, path: href, ...state });
      }
      const tabs = page.getByRole('tab');
      for (let i = 0; i < Math.min(await tabs.count(), 4); i++) { await tabs.nth(i).click(); await page.waitForTimeout(150); }
      const now = page.getByRole('button', { name: /^Now / });
      if (await now.count()) { await now.first().click(); await page.waitForTimeout(150); }
      check('filter and Now interactions leave mount available', await page.evaluate(() => window.__scenefTypeset.stats().every(s => !s.overlappingTargets)));
      await page.close();
    }
  } catch (error) { report.errors.push({ browser: name, error: error.stack }); }
  finally { await browser.close(); }
}
await writeFile('output/scenef-integration-4.2.json', JSON.stringify(report, null, 2));
const failures = report.checks.filter(check => !check.pass);
console.log(JSON.stringify({ checks: report.checks.length, failures, errors: report.errors }, null, 2));
if (failures.length || report.errors.length) process.exitCode = 1;
