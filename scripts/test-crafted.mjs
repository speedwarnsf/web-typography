import { chromium } from 'playwright';
const STYLE = `font-family: Georgia, 'Times New Roman', serif; font-size: 18px; line-height: 1.65; color: #d4d4d4;`;

// Goal: texts where before has the problem, after fixes it, and BOTH have decent rag
const tests = [
  // ORPHANS: need "before" last line = 1 word, "after" = 2+ words
  // Key: the word before the orphan must fill most of its line so it only the last word drops
  { w: 360, l: "orph-1", b: "The best typography never draws attention to itself. It works in the background, quietly making every sentence more legible, more pleasant, and more clear.", a: "The best typography never draws attention to itself. It works in the background, quietly making every sentence more legible, more pleasant, and more\u00A0clear." },
  { w: 360, l: "orph-2", b: "Every page is a composition. The spaces between letters, words, and lines determine whether a reader stays engaged or gives up and walks away.", a: "Every page is a composition. The spaces between letters, words, and lines determine whether a reader stays engaged or gives up and walks\u00A0away." },
  { w: 360, l: "orph-3", b: "Good typography makes reading effortless. It guides the eye from line to line without distraction, letting meaning take the place of form.", a: "Good typography makes reading effortless. It guides the eye from line to line without distraction, letting meaning take the place of\u00A0form." },

  // SENTENCE-START: need "before" to strand first word of sentence at line end
  { w: 360, l: "ss-1", b: "The revisions were finished ahead of schedule. He began preparing the final presentation for the review board meeting that same afternoon.", a: "The revisions were finished ahead of schedule. He\u00A0began preparing the final presentation for the review board meeting that same\u00A0afternoon." },
  { w: 360, l: "ss-2", b: "The guidelines were published last spring. We started applying the new standards across every project and client deliverable immediately.", a: "The guidelines were published last spring. We\u00A0started applying the new standards across every project and client deliverable\u00A0immediately." },

  // SENTENCE-END: need "before" to strand short closing word
  { w: 310, l: "se-1", b: "Clear hierarchy helps a reader navigate the page without effort. When the structure is sound, every section feels like it belongs where it is.", a: "Clear hierarchy helps a reader navigate the page without\u00A0effort. When the structure is sound, every section feels like it belongs where it\u00A0is." },

  // SHORT WORDS: before has articles/preps at line ends
  { w: 360, l: "sw-1", b: "The weight of a typeface sets the tone for the entire page and the reader senses it before reading a single word of the text.", a: "The weight of\u00A0a typeface sets the\u00A0tone for the\u00A0entire page and the\u00A0reader senses it before reading a\u00A0single word of\u00A0the text." },
];

async function run() {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ deviceScaleFactor: 2 });
  const page = await ctx.newPage();
  for (const t of tests) {
    console.log(`\n=== ${t.l} (${t.w}px) ===`);
    for (const [side, text] of [['before', t.b], ['after', t.a]]) {
      await page.setContent(`<html><body style="background:transparent;margin:0;padding:0"><div id="d" style="width:${t.w}px;${STYLE}">${text}</div></body></html>`);
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
        const bar = '█'.repeat(Math.round(l.width/maxW*35));
        const pct = Math.round(l.width/t.w*100);
        console.log(`    ${bar} [${pct}%] ${l.text}`);
      });
    }
  }
  await browser.close();
}
run();
