import { chromium } from 'playwright';

const STYLE = `font-family: Georgia, 'Times New Roman', serif; font-size: 18px; line-height: 1.65; color: #d4d4d4;`;

// Test multiple text options for each rule at their widths
const tests = [
  {
    label: "orphans",
    width: 360,
    texts: [
      { name: "opt1-before", text: "Good design is as little design as possible. Less is more because it concentrates on the essential aspects and the products are not burdened with inessentials." },
      { name: "opt1-after", text: "Good design is as little design as possible. Less is more because it concentrates on the essential aspects and the products are not burdened with\u00A0inessentials." },
      { name: "opt2-before", text: "She believed that careful attention to spacing and rhythm would transform ordinary text into something the reader could trust without ever knowing why." },
      { name: "opt2-after", text: "She believed that careful attention to spacing and rhythm would transform ordinary text into something the reader could trust without ever knowing\u00A0why." },
      { name: "opt3-before", text: "The measure of good typography is that the reader never notices it. Every decision serves the text and nothing calls attention to itself." },
      { name: "opt3-after", text: "The measure of good typography is that the reader never notices it. Every decision serves the text and nothing calls attention to\u00A0itself." },
    ]
  },
  {
    label: "sentence-start",
    width: 360,
    texts: [
      { name: "opt1-before", text: "The proposal was reviewed on Friday. It received unanimous approval from the committee members who had studied the recommendations carefully." },
      { name: "opt1-after", text: "The proposal was reviewed on Friday. It\u00A0received unanimous approval from the committee members who had studied the recommendations\u00A0carefully." },
    ]
  },
];

async function run() {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ deviceScaleFactor: 2 });
  const page = await ctx.newPage();

  for (const test of tests) {
    console.log(`\n=== ${test.label} (${test.width}px) ===`);
    for (const t of test.texts) {
      await page.setContent(`
        <html><body style="background:transparent;margin:0;padding:0">
          <div id="d" style="width:${test.width}px;${STYLE}">${t.text}</div>
        </body></html>
      `);
      await page.waitForTimeout(200);

      const lines = await page.evaluate(() => {
        const div = document.getElementById('d');
        const walker = document.createTreeWalker(div, NodeFilter.SHOW_TEXT);
        const segments = [];
        let node;
        while ((node = walker.nextNode())) {
          for (let i = 0; i < node.textContent.length; i++) {
            segments.push({ node, offset: i });
          }
        }
        if (segments.length === 0) return [];
        const range = document.createRange();
        let lastY = -1, lineStartIdx = 0;
        const result = [];
        for (let i = 0; i < segments.length; i++) {
          const seg = segments[i];
          range.setStart(seg.node, seg.offset);
          range.setEnd(seg.node, Math.min(seg.offset + 1, seg.node.textContent.length));
          const rect = range.getBoundingClientRect();
          if (lastY !== -1 && Math.abs(rect.top - lastY) > 5) {
            const s = segments[lineStartIdx], e = segments[i - 1];
            range.setStart(s.node, s.offset);
            range.setEnd(e.node, Math.min(e.offset + 1, e.node.textContent.length));
            result.push({ text: range.toString().trim(), width: Math.round(range.getBoundingClientRect().width) });
            lineStartIdx = i;
          }
          lastY = rect.top;
        }
        const s = segments[lineStartIdx], e = segments[segments.length - 1];
        range.setStart(s.node, s.offset);
        range.setEnd(e.node, Math.min(e.offset + 1, e.node.textContent.length));
        result.push({ text: range.toString().trim(), width: Math.round(range.getBoundingClientRect().width) });
        return result;
      });

      console.log(`  ${t.name}:`);
      const maxW = Math.max(...lines.map(l => l.width));
      lines.forEach(l => {
        const bar = '█'.repeat(Math.round(l.width / maxW * 30));
        console.log(`    ${bar} [${l.width}px] ${l.text}`);
      });
    }
  }

  await browser.close();
}
run();
