import { chromium } from 'playwright';
import { writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';

const OUT = join(import.meta.dirname, '..', 'public', 'examples');
mkdirSync(OUT, { recursive: true });

const STYLE = `
  font-family: Georgia, 'Times New Roman', serif;
  font-size: 18px;
  line-height: 1.65;
  color: #d4d4d4;
`;
const WIDTH = 360;

const rules = [
  {
    id: 'orphans',
    before: 'We opened the new location on March 15th and the response from the community was overwhelming.',
    after: 'We opened the new location on March 15th and the response from the community was\u00A0overwhelming.',
  },
  {
    id: 'sentence-start',
    before: 'The budget was approved last Tuesday. He immediately began hiring for the three open positions they had been waiting to fill since January.',
    after: 'The budget was approved last Tuesday. He\u00A0immediately began hiring for the three open positions they had been waiting to fill since\u00A0January.',
  },
  {
    id: 'sentence-end',
    before: 'Everyone on the team agreed it was the right call. We had been working toward this goal for years and we finally got to it.',
    after: 'Everyone on the team agreed it was the right call. We\u00A0had been working toward this goal for years and we finally got to\u00A0it.',
  },
  {
    id: 'rag',
    before: 'The building was designed by a small firm from Portland that specialized in sustainable architecture using reclaimed materials from the region.',
    after: 'The building was designed by a small firm from Portland that specialized in\u00A0sustainable architecture using reclaimed materials from the\u00A0region.',
  },
  {
    id: 'short-words',
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
          <div style="width:${WIDTH}px;${STYLE}">${text}</div>
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
