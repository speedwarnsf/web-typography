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
    width: 380,
    before: 'He arrived early and found a seat by the window overlooking the courtyard. The tables around him filled up slowly. A waiter brought coffee without being asked. Outside, two children chased a cat across the cobblestones while their parents watched from a doorway.',
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
      // First: merge orphaned last line (short single word) into previous line
      let lines = [...lineData.lines];
      const lastLine = lines[lines.length - 1];
      if (lastLine && lastLine.text.split(' ').length <= 2 && lines.length > 1) {
        const prev = lines[lines.length - 2];
        lines[lines.length - 2] = { text: prev.text + ' ' + lastLine.text, width: prev.width + lastLine.width };
        lines.pop();
      }

      // Target ~95% of container width — smooth rag, not justification
      const target = lineData.containerWidth * 0.95;
      const spanLines = lines.map((l, i) => {
        const spaces = (l.text.match(/ /g) || []).length;
        const isLast = i === lines.length - 1;
        if (isLast || spaces === 0) {
          return `<span style="display:block">${l.text}</span>`;
        }
        const gap = target - l.width;
        const ws = gap / spaces;
        // Only expand short lines, never tighten. Cap at 3px to stay subtle.
        if (ws <= 0.3 || ws > 3.0) {
          return `<span style="display:block">${l.text}</span>`;
        }
        return `<span style="display:block;word-spacing:${ws.toFixed(2)}px">${l.text}</span>`;
      });

      // Render "after" with a subtle guide line showing the target right edge
      const guidePos = Math.round(target);
      await page.setContent(`
        <html><body style="background:transparent;margin:0;padding:0;position:relative">
          <div style="width:${rule.width}px;${STYLE};position:relative">
            ${spanLines.join('')}
            <div style="position:absolute;top:0;bottom:0;left:${guidePos}px;width:1px;background:rgba(184,150,62,0.25)"></div>
          </div>
        </body></html>
      `);
      await page.waitForTimeout(300);
      el = await page.$('div');
      buf = await el.screenshot({ omitBackground: true });
      writeFileSync(join(OUT, `${rule.id}-after.png`), buf);
      console.log(`  ${join(OUT, `${rule.id}-after.png`)}`);

      // Also add guide line to "before" for comparison
      await page.setContent(`
        <html><body style="background:transparent;margin:0;padding:0">
          <div style="width:${rule.width}px;${STYLE};position:relative">
            ${text}
            <div style="position:absolute;top:0;bottom:0;left:${guidePos}px;width:1px;background:rgba(184,150,62,0.25)"></div>
          </div>
        </body></html>
      `);
      await page.waitForTimeout(300);
      el = await page.$('#d') || await page.$('div');
      buf = await el.screenshot({ omitBackground: true });
      writeFileSync(join(OUT, `${rule.id}-before.png`), buf);
      console.log(`  ${join(OUT, `${rule.id}-before.png`)} (with guide)`);
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
