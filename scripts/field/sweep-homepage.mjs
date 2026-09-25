// @ts-check
// The numbers the README and homepage quote: drive the homepage proof slider
// across every width from 250 to 345 px in Chromium, WebKit and Firefox and
// count, for the browser panel and the Typeset panel, the short words left
// hanging at line ends (the page's own "Words left hanging" row) and the
// widths where the last line holds a single word.
//
//   node scripts/field/sweep-homepage.mjs [--base https://typeset.us] [--step 1]
//
// Writes output/homepage-sweep.json. Needs the site (live, or `next start`).
import { writeFile, mkdir } from 'node:fs/promises';
import { parseArgs } from 'node:util';
import { browsers } from '../v4/browsers.mjs';

const { values } = parseArgs({ options: { base: { type: 'string', default: process.env.SITE_URL || 'https://typeset.us' }, step: { type: 'string', default: '1' } } });
const base = values.base.replace(/\/$/, '');
const step = Number(values.step);
const watchdog = setTimeout(() => { console.error('sweep-homepage: watchdog'); process.exit(3); }, 20 * 60 * 1000);
/** @type {Record<string, unknown>} */
const results = {};
try {
  for (const { name, engine, executablePath } of browsers) {
    const browser = await engine.launch({ executablePath, timeout: 20000 });
    try {
      const context = await browser.newContext({ viewport: { width: 1280, height: 900 }, reducedMotion: 'reduce' });
      await context.route(/^https:\/\/ntfy\.sh\//, route => route.abort());
      const page = await context.newPage();
      page.setDefaultTimeout(20000);
      await page.goto(base + '/', { waitUntil: 'load' });
      await page.locator('#v2-squeeze-input').scrollIntoViewIfNeeded();
      await page.waitForTimeout(1500);
      const rows = [];
      for (let width = 250; width <= 345; width += step) {
        await page.locator('#v2-squeeze-input').fill(String(width));
        await page.waitForTimeout(150);
        rows.push({ width, ...await page.evaluate(() => {
          const values = [...document.querySelectorAll('.v2-stat-row')].map(row => [...row.querySelectorAll('.v2-stat-vals em')].map(e => e.textContent));
          return { hanging: values[0], orphan: values[1], lines: values[2] };
        }) });
      }
      const sum = (/** @type {number} */ i) => rows.reduce((n, r) => n + Number(r.hanging?.[i] ?? 0), 0);
      const orphanWidths = (/** @type {number} */ i) => rows.filter(r => r.orphan?.[i] === 'yes').length;
      const baseline = await page.locator('#v2-baseline').textContent();
      results[name] = { version: browser.version(), widths: rows.length, baseline, hanging: { browser: sum(0), typeset: sum(1) }, oneWordLastLine: { browser: orphanWidths(0), typeset: orphanWidths(1) }, rows };
      await context.close();
    } finally { await browser.close(); }
  }
} finally { clearTimeout(watchdog); }
await mkdir('output', { recursive: true });
await writeFile('output/homepage-sweep.json', JSON.stringify({ base, step, results }, null, 2));
console.log(JSON.stringify(Object.fromEntries(Object.entries(results).map(([k, v]) => { const { rows, ...rest } = /** @type {any} */ (v); return [k, rest]; })), null, 2));
