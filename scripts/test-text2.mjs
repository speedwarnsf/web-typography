import { chromium } from 'playwright';
const STYLE = `font-family: Georgia, 'Times New Roman', serif; font-size: 18px; line-height: 1.65; color: #d4d4d4;`;

const candidates = [
  // Orphan demos — need single last word in "before", two words in "after"
  { w: 360, label: "orph-A", before: "Every typeface carries a history and a set of assumptions about where and how it should appear. Choose with care and your readers will feel the difference.", after: "Every typeface carries a history and a set of assumptions about where and how it should appear. Choose with care and your readers will feel the\u00A0difference." },
  { w: 360, label: "orph-B", before: "White space is not empty space. It is the breathing room that gives each word its weight and every line its clarity and calm.", after: "White space is not empty space. It is the breathing room that gives each word its weight and every line its clarity and\u00A0calm." },
  { w: 360, label: "orph-C", before: "A paragraph set with care reads like a conversation. Each line flows into the next and the eye never has to search for what comes next.", after: "A paragraph set with care reads like a conversation. Each line flows into the next and the eye never has to search for what comes\u00A0next." },
  { w: 360, label: "orph-D", before: "The details of typography are invisible to most readers but their absence is felt immediately. Good type earns trust.", after: "The details of typography are invisible to most readers but their absence is felt immediately. Good type earns\u00A0trust." },
  // Sentence-start demos
  { w: 360, label: "ss-A", before: "The redesign launched on Monday. She immediately noticed the improved readability across every screen size they had been testing for months.", after: "The redesign launched on Monday. She\u00A0immediately noticed the improved readability across every screen size they had been testing for\u00A0months." },
  { w: 360, label: "ss-B", before: "The team finished the audit on Thursday. We started implementing the recommended changes to the typographic hierarchy that same afternoon.", after: "The team finished the audit on Thursday. We\u00A0started implementing the recommended changes to the typographic hierarchy that same\u00A0afternoon." },
  // Sentence-end demos
  { w: 310, label: "se-A", before: "Every design decision should have a reason behind it. Without a clear rationale the work begins to feel hollow.", after: "Every design decision should have a reason behind\u00A0it. Without a clear rationale the work begins to feel\u00A0hollow." },
  // Short-word demos
  { w: 360, label: "sw-A", before: "The rhythm of a line depends on the balance between long words and short ones and the spaces that hold them all together.", after: "The rhythm of\u00A0a line depends on\u00A0the balance between long words and short ones and the\u00A0spaces that hold them all\u00A0together." },
];

async function run() {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ deviceScaleFactor: 2 });
  const page = await ctx.newPage();

  for (const c of candidates) {
    console.log(`\n=== ${c.label} (${c.w}px) ===`);
    for (const side of ['before', 'after']) {
      await page.setContent(`<html><body style="background:transparent;margin:0;padding:0"><div id="d" style="width:${c.w}px;${STYLE}">${c[side]}</div></body></html>`);
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
      console.log(`  ${side}:`);
      lines.forEach(l => {
        const bar = '█'.repeat(Math.round(l.width/maxW*30));
        console.log(`    ${bar} [${l.width}px] ${l.text}`);
      });
    }
  }
  await browser.close();
}
run();
