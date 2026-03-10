import { chromium } from 'playwright';
import { writeFileSync, readFileSync, mkdirSync } from 'fs';
import { join } from 'path';
import { execSync } from 'child_process';

const OUT = join(import.meta.dirname, '..', 'public', 'examples');
mkdirSync(OUT, { recursive: true });

// Bundle typeset.ts for browser injection
execSync('npx esbuild src/lib/typeset.ts --bundle --format=iife --global-name=Typeset --outfile=/tmp/typeset-bundle.js --platform=browser', {
  cwd: join(import.meta.dirname, '..'),
});
const typesetBundle = readFileSync('/tmp/typeset-bundle.js', 'utf-8');

const STYLE = `font-family: Georgia, 'Times New Roman', serif; font-size: 18px; line-height: 1.65; color: #d4d4d4;`;

const rules = [
  {
    id: 'orphans',
    width: 360,
    text: 'We opened the new location on March 15th and the response from the community was overwhelming.',
  },
  {
    id: 'sentence-start',
    width: 360,
    text: 'The budget was approved last Tuesday. He immediately began hiring for the three open positions they had been waiting to fill since January.',
  },
  {
    id: 'sentence-end',
    width: 310,
    text: 'The contract stipulated that all parties must agree before anyone could sign it. Negotiations stalled for weeks.',
  },
  {
    id: 'rag',
    width: 360,
    text: 'Typography has always been about rhythm. The interplay of long words and short ones creates a pattern the eye follows instinctively. When that rhythm falters \u2014 when a line reaches far while the next barely starts \u2014 the reader stumbles.',
  },
  {
    id: 'short-words',
    width: 360,
    text: 'The foundation was built on the principles of transparency and the belief that every member of the community deserves a voice.',
  },
];

async function render() {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ deviceScaleFactor: 2 });
  const page = await ctx.newPage();

  // Inject typeset library
  await page.addScriptTag({ content: typesetBundle });

  for (const rule of rules) {
    // ── BEFORE: plain text, no processing ──
    await page.setContent(`
      <html><body style="background:transparent;margin:0;padding:0">
        <div id="d" style="width:${rule.width}px;${STYLE}">${rule.text}</div>
      </body></html>
    `);
    await page.waitForTimeout(300);
    let el = await page.$('#d');
    let buf = await el.screenshot({ omitBackground: true });
    writeFileSync(join(OUT, `${rule.id}-before.png`), buf);
    console.log(`  ${rule.id}-before.png`);

    // ── AFTER: apply real typeset library ──
    // Re-inject library (setContent resets the page)
    await page.setContent(`
      <html><body style="background:transparent;margin:0;padding:0">
        <script>${typesetBundle}<\/script>
        <div id="d" style="width:${rule.width}px;${STYLE}">${rule.text}</div>
      </body></html>
    `);
    await page.waitForTimeout(300);

    // Apply typesetText (text-level rules: orphans, sentence protection, short words)
    // Then smoothRag (per-line word-spacing for even rag)
    await page.evaluate(() => {
      const el = document.getElementById('d');
      const text = el.textContent;
      // Apply all text rules
      el.innerHTML = Typeset.typesetText(text);
      // Apply rag smoothing
      Typeset.smoothRag(el);
    });

    // Wait for smoothRag to apply (it's synchronous but layout needs a frame)
    await page.waitForTimeout(500);

    el = await page.$('#d');
    buf = await el.screenshot({ omitBackground: true });
    writeFileSync(join(OUT, `${rule.id}-after.png`), buf);
    console.log(`  ${rule.id}-after.png`);
  }

  await browser.close();
  console.log('Done!');
}

render();
