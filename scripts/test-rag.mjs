import { chromium } from 'playwright';
const STYLE = `font-family: Georgia, 'Times New Roman', serif; font-size: 18px; line-height: 1.65; color: #d4d4d4;`;

const tests = [
  { w: 360, label: "orphans-before", text: 'We opened the new location on March 15th and the response from the community was overwhelming.' },
  { w: 360, label: "orphans-after", text: 'We opened the new location on March 15th and the response from the community was\u00A0overwhelming.' },
  { w: 360, label: "ss-before", text: 'The budget was approved last Tuesday. He immediately began hiring for the three open positions they had been waiting to fill since January.' },
  { w: 360, label: "ss-after", text: 'The budget was approved last Tuesday. He\u00A0immediately began hiring for the three open positions they had been waiting to fill since\u00A0January.' },
];

async function run() {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ deviceScaleFactor: 2 });
  const page = await ctx.newPage();

  for (const t of tests) {
    await page.setContent(`<html><body style="background:transparent;margin:0;padding:0"><div id="d" style="width:${t.w}px;${STYLE}">${t.text}</div></body></html>`);
    await page.waitForTimeout(200);
    const lines = await page.evaluate(() => {
      const div = document.getElementById('d');
      const walker = document.createTreeWalker(div, NodeFilter.SHOW_TEXT);
      const segs = []; let node;
      while ((node = walker.nextNode())) for (let i = 0; i < node.textContent.length; i++) segs.push({node, offset:i});
      if (!segs.length) return [];
      const range = document.createRange();
      let lastY = -1, start = 0; const result = [];
      for (let i = 0; i < segs.length; i++) {
        range.setStart(segs[i].node, segs[i].offset);
        range.setEnd(segs[i].node, Math.min(segs[i].offset+1, segs[i].node.textContent.length));
        const y = range.getBoundingClientRect().top;
        if (lastY !== -1 && Math.abs(y - lastY) > 5) {
          const s=segs[start], e=segs[i-1];
          range.setStart(s.node,s.offset); range.setEnd(e.node,Math.min(e.offset+1,e.node.textContent.length));
          result.push({text:range.toString().trim(), width:Math.round(range.getBoundingClientRect().width)});
          start = i;
        }
        lastY = y;
      }
      const s=segs[start], e=segs[segs.length-1];
      range.setStart(s.node,s.offset); range.setEnd(e.node,Math.min(e.offset+1,e.node.textContent.length));
      result.push({text:range.toString().trim(), width:Math.round(range.getBoundingClientRect().width)});
      return result;
    });
    const maxW = Math.max(...lines.map(l=>l.width));
    console.log(`\n${t.label}:`);
    lines.forEach(l => {
      const bar = '█'.repeat(Math.round(l.width/maxW*40));
      const pct = Math.round(l.width/t.w*100);
      console.log(`  ${bar} [${l.width}/${t.w}px = ${pct}%] ${l.text}`);
    });
  }
  await browser.close();
}
run();
