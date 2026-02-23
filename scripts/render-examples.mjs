import { chromium } from 'playwright';
import { writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';

const OUT = join(import.meta.dirname, '..', 'public', 'examples');
mkdirSync(OUT, { recursive: true });

const STYLE = `font-family: Georgia, 'Times New Roman', serif; font-size: 18px; line-height: 1.65; color: #d4d4d4;`;

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
    before: 'It was a collaboration between the university and several local nonprofits focused on housing.',
    after: 'It was a collaboration between the university and several local nonprofits focused on\u00A0housing.',
  },
  {
    id: 'short-words',
    width: 360,
    before: 'The foundation was built on the principles of transparency and the belief that every member of the community deserves a voice.',
    after: 'The foundation was built on\u00A0the principles of\u00A0transparency and the belief that every member of\u00A0the community deserves a\u00A0voice.',
  },
];

async function render() {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ deviceScaleFactor: 2 });
  const page = await ctx.newPage();

  for (const rule of rules) {
    for (const side of ['before', 'after']) {
      const text = rule[side];
      // Transparent background — no grey block
      await page.setContent(`
        <html><body style="background:transparent;margin:0;padding:0">
          <div style="width:${rule.width}px;${STYLE}">${text}</div>
        </body></html>
      `);
      await page.waitForTimeout(300);
      const el = await page.$('div');
      const buf = await el.screenshot({ omitBackground: true });
      const path = join(OUT, `${rule.id}-${side}.png`);
      writeFileSync(path, buf);
      console.log(`  ${path}`);
    }
  }

  await browser.close();
  console.log('Done!');
}

render();
