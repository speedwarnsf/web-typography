import { chromium } from 'playwright';
import { writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';

const OUT = join(import.meta.dirname, '..', 'public', 'examples');
mkdirSync(OUT, { recursive: true });

const STYLE = `font-family: Georgia, 'Times New Roman', serif; font-size: 18px; line-height: 1.65; color: #d4d4d4;`;

// Each rule uses text + width that naturally creates the problem
const rules = [
  {
    id: 'orphans',
    width: 360,
    before: 'We opened the new location on March 15th and the response from the community was overwhelming.',
    after: 'We opened the new location on March 15th and the response from the community was\u00A0overwhelming.',
  },
  {
    id: 'sentence-start',
    width: 360,
    before: 'The budget was approved last Tuesday. He immediately began hiring for the three open positions they had been waiting to fill since January.',
    after: 'The budget was approved last Tuesday. He\u00A0immediately began hiring for the three open positions they had been waiting to fill since\u00A0January.',
  },
  {
    id: 'sentence-end',
    width: 345,
    before: 'The proposal sat on her desk for days and she kept finding reasons not to respond to it.',
    after: 'The proposal sat on her desk for days and she kept finding reasons not to respond to\u00A0it.',
  },
  {
    id: 'rag',
    width: 360,
    before: 'The building was designed by a small firm from Portland that specialized in sustainable architecture using reclaimed materials from the region.',
    after: 'The building was designed by a small firm from Portland that specialized in\u00A0sustainable architecture using reclaimed materials from the\u00A0region.',
  },
  {
    id: 'short-words',
    width: 360,
    before: 'She walked through the center of town and stopped at the old bookshop on the corner to look at the shelves near the back of the store.',
    after: 'She walked through the center of\u00A0town and stopped at\u00A0the old bookshop on\u00A0the corner to\u00A0look at\u00A0the shelves near the back of\u00A0the store.',
  },
];

async function render() {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ deviceScaleFactor: 2 });
  const page = await ctx.newPage();

  for (const rule of rules) {
    for (const side of ['before', 'after']) {
      const text = rule[side];
      await page.setContent(`
        <html><body style="background:#171717;margin:0;padding:24px">
          <div style="width:${rule.width}px;${STYLE}">${text}</div>
        </body></html>
      `);
      await page.waitForTimeout(300);
      const el = await page.$('div');
      const buf = await el.screenshot();
      const path = join(OUT, `${rule.id}-${side}.png`);
      writeFileSync(path, buf);
      console.log(`  ${path}`);
    }
  }

  await browser.close();
  console.log('Done!');
}

render();
