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
    width: 420,
    before: 'The morning light through the kitchen window caught the steam rising from her coffee. She sat at the counter rereading the letter for the third time, still not sure what to make of it. Outside, the neighbor was walking his dog past the same fire hydrant.',
    ragSmooth: true, // special handling: per-line word-spacing adjustment
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
    if (rule.ragSmooth) {
      // Special rag smoothing: render before normally, then after with per-line word-spacing
      const text = rule.before;

      // Render "before" (raw ragged text)
      await page.setContent(`
        <html><body style="background:transparent;margin:0;padding:0">
          <div id="d" style="width:${rule.width}px;${STYLE}">${text}</div>
        </body></html>
      `);
      await page.waitForTimeout(300);
      let el = await page.$('#d');
      let buf = await el.screenshot({ omitBackground: true });
      writeFileSync(join(OUT, `${rule.id}-before.png`), buf);
      console.log(`  ${join(OUT, `${rule.id}-before.png`)}`);

      // Detect line breaks and measure each line's pixel width
      const lineData = await page.evaluate(() => {
        const div = document.getElementById('d');
        const tn = div.firstChild;
        const range = document.createRange();
        let lastY = -1, lineStart = 0, lineText = '';
        const lines = [];
        for (let i = 0; i < tn.textContent.length; i++) {
          range.setStart(tn, i); range.setEnd(tn, i + 1);
          const rect = range.getBoundingClientRect();
          if (lastY !== -1 && Math.abs(rect.top - lastY) > 5) {
            range.setStart(tn, lineStart); range.setEnd(tn, i);
            lines.push({ text: lineText.trim(), width: range.getBoundingClientRect().width });
            lineStart = i; lineText = '';
          }
          lineText += tn.textContent[i];
          lastY = rect.top;
        }
        if (lineText) {
          range.setStart(tn, lineStart); range.setEnd(tn, tn.textContent.length);
          lines.push({ text: lineText.trim(), width: range.getBoundingClientRect().width });
        }
        return { lines, containerWidth: div.getBoundingClientRect().width };
      });

      // Build "after" HTML: each line as a span with adjusted word-spacing
      // Target ~92% of container width for a smooth right edge
      const target = lineData.containerWidth * 0.93;
      const spanLines = lineData.lines.map((l, i) => {
        const spaces = (l.text.match(/ /g) || []).length;
        const isLast = i === lineData.lines.length - 1;
        if (isLast || spaces === 0) {
          return `<span style="display:block">${l.text}</span>`;
        }
        const gap = target - l.width;
        const ws = gap / spaces;
        // Only adjust if needed (gap > 2px) and don't tighten too much
        if (Math.abs(ws) < 0.3) {
          return `<span style="display:block">${l.text}</span>`;
        }
        return `<span style="display:block;word-spacing:${ws.toFixed(2)}px">${l.text}</span>`;
      });

      await page.setContent(`
        <html><body style="background:transparent;margin:0;padding:0">
          <div style="width:${rule.width}px;${STYLE}">${spanLines.join('')}</div>
        </body></html>
      `);
      await page.waitForTimeout(300);
      el = await page.$('div');
      buf = await el.screenshot({ omitBackground: true });
      writeFileSync(join(OUT, `${rule.id}-after.png`), buf);
      console.log(`  ${join(OUT, `${rule.id}-after.png`)}`);
      continue;
    }

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
