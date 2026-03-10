import { chromium } from 'playwright';
import { writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';

const OUT = join(import.meta.dirname, '..', 'test-rag-output', 'breaks');
mkdirSync(OUT, { recursive: true });

const PREPOSITIONS = new Set('of in at by to for with from on into upon about between through without during before after against among within beyond toward towards across along behind beneath beside besides despite except inside outside underneath until unlike'.split(' '));
const CONJUNCTIONS = new Set('and or but nor yet so'.split(' '));
const ARTICLES = new Set('a an the'.split(' '));

function isSentenceStart(words, idx) {
  if (idx === 0) return false;
  return /[.!?]["'\u201D\u2019]?$/.test(words[idx - 1]);
}

const SAMPLES = [
  {
    label: "original",
    text: "Good typography is invisible. Great typography speaks to the reader without raising its voice. The choices behind a well-set paragraph are deliberate, quiet, and precise. Every refinement serves the text and nothing calls attention to itself.",
  },
  {
    label: "rhetoric-ethos",
    text: "Ethos in typography means choosing typefaces and layouts that signal credibility, authority, and professionalism \u2014 earning the reader\u2019s trust before they read a single word.",
  },
  {
    label: "reading-lab",
    text: "Typography is the visual voice of language. When text is set with care \u2014 the right measure, the right leading, the right weight \u2014 reading becomes effortless. When it\u2019s cramped or loose, rhythm falters and the eye fatigues.",
  },
  {
    label: "pairing-card",
    text: "Good typography is invisible. Great typography speaks to the reader without raising its voice. The choices behind a well-set paragraph are deliberate, quiet, and precise.",
  },
];

const STYLE = `font-family: Georgia, serif; font-size: 18px; line-height: 1.7; color: #d4d4d4;`;
const WIDTH = 360;

// Measure lines WITHOUT destroying the DOM
async function measureLines(page) {
  return page.evaluate(() => {
    const el = document.getElementById('d');
    const cs = getComputedStyle(el);
    const cw = el.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);

    // Use Range API to measure each word's position without modifying DOM
    const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    const textNodes = [];
    while (walker.nextNode()) textNodes.push(walker.currentNode);

    // Collect all word positions
    const wordPositions = [];
    for (const node of textNodes) {
      const text = node.textContent;
      // Find word boundaries
      const regex = /\S+/g;
      let match;
      while ((match = regex.exec(text)) !== null) {
        const range = document.createRange();
        range.setStart(node, match.index);
        range.setEnd(node, match.index + match[0].length);
        const rect = range.getBoundingClientRect();
        wordPositions.push({ word: match[0], top: Math.round(rect.top), left: rect.left, right: rect.right });
      }
    }

    // Group into lines
    const lines = [];
    let curTop = -1, curWords = [];
    for (const wp of wordPositions) {
      if (curTop === -1) { curTop = wp.top; curWords = [wp]; }
      else if (Math.abs(wp.top - curTop) > 3) {
        const left = Math.min(...curWords.map(w => w.left));
        const right = Math.max(...curWords.map(w => w.right));
        lines.push({ text: curWords.map(w => w.word).join(' '), width: right - left, fill: Math.round((right - left) / cw * 100) });
        curTop = wp.top; curWords = [wp];
      } else curWords.push(wp);
    }
    if (curWords.length) {
      const left = Math.min(...curWords.map(w => w.left));
      const right = Math.max(...curWords.map(w => w.right));
      lines.push({ text: curWords.map(w => w.word).join(' '), width: right - left, fill: Math.round((right - left) / cw * 100) });
    }

    return { containerWidth: cw, lines };
  });
}

async function run() {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ deviceScaleFactor: 2 });
  const page = await ctx.newPage();

  for (const sample of SAMPLES) {
    console.log(`\n${'═'.repeat(70)}`);
    console.log(sample.label);
    console.log('═'.repeat(70));

    // ─── BEFORE ───
    await page.setContent(`<html><body style="background:#0a0a0a;margin:0;padding:16px 0">
      <div id="d" style="width:${WIDTH}px;${STYLE};padding:20px">${sample.text}</div>
    </body></html>`);
    await page.waitForTimeout(300);

    const before = await measureLines(page);
    const words = sample.text.split(/ +/).filter(Boolean);

    console.log('\nBEFORE:');
    const problems = [];
    for (let li = 0; li < before.lines.length; li++) {
      const line = before.lines[li];
      const lineWords = line.text.split(/ +/);
      const lastWord = lineWords[lineWords.length - 1];
      const isLast = li === before.lines.length - 1;
      const flags = [];

      if (!isLast) {
        const lower = lastWord.toLowerCase().replace(/[.,;:!?'"]+$/, '');
        // Find this word's index in the full words array
        let wordIdx = 0;
        for (let prev = 0; prev < li; prev++) {
          wordIdx += before.lines[prev].text.split(/ +/).length;
        }
        wordIdx += lineWords.length - 1; // position of last word on this line

        if (isSentenceStart(words, wordIdx)) {
          flags.push('⚠ sentence-start');
          problems.push({ line: li, wordIdx, type: 'sentence-start', word: lastWord });
        }
        if (PREPOSITIONS.has(lower)) {
          flags.push('⚠ stranded-prep');
          problems.push({ line: li, wordIdx, type: 'stranded-prep', word: lastWord });
        }
        if (CONJUNCTIONS.has(lower)) {
          flags.push('⚠ stranded-conj');
          problems.push({ line: li, wordIdx, type: 'stranded-conj', word: lastWord });
        }
        if (ARTICLES.has(lower)) {
          flags.push('⚠ stranded-article');
          problems.push({ line: li, wordIdx, type: 'stranded-article', word: lastWord });
        }
      } else {
        if (lineWords.length === 1 && line.fill < 40) {
          flags.push('⚠ orphan');
          // Find wordIdx of the last word of the previous line
          let wordIdx = 0;
          for (let prev = 0; prev < li - 1; prev++) {
            wordIdx += before.lines[prev].text.split(/ +/).length;
          }
          wordIdx += before.lines[li - 1].text.split(/ +/).length - 1;
          problems.push({ line: li - 1, wordIdx, type: 'orphan', word: lineWords[0] });
        }
        if (line.fill < 25) flags.push('⚠ widow');
      }

      console.log(`  L${li} [${line.fill}%] "${line.text}" ${flags.join(' ')}`);
    }

    // Screenshot before
    await page.evaluate(() => {
      const el = document.getElementById('d');
      const lab = document.createElement('div');
      lab.style.cssText = 'font-family:monospace;font-size:11px;color:#666;margin-top:12px;padding-top:8px;border-top:1px solid #333';
      lab.textContent = 'BEFORE — browser default';
      el.appendChild(lab);
    });
    writeFileSync(join(OUT, `${sample.label}-before.png`), await (await page.$('#d')).screenshot());

    if (problems.length === 0) {
      console.log('  ✓ Clean breaks');
      continue;
    }

    // ─── FIX: Build HTML with nowrap spans ───
    console.log(`\n  ${problems.length} problems found. Applying break fixes...`);

    const fixes = new Map();
    for (const p of problems) {
      if (p.type === 'orphan') {
        // Pull last word of prev line together with first word of last line
        if (p.wordIdx >= 0) fixes.set(p.wordIdx, { count: 2 });
      } else {
        // Keep problem word with next word
        if (p.wordIdx + 1 < words.length) fixes.set(p.wordIdx, { count: 2 });
      }
    }

    const parts = [];
    let i = 0;
    while (i < words.length) {
      const fix = fixes.get(i);
      if (fix) {
        const group = words.slice(i, i + fix.count).join(' ');
        parts.push(`<span style="white-space:nowrap">${group}</span>`);
        i += fix.count;
      } else {
        parts.push(words[i]);
        i++;
      }
    }
    const fixedHTML = parts.join(' ');

    // ─── AFTER ───
    await page.setContent(`<html><body style="background:#0a0a0a;margin:0;padding:16px 0">
      <div id="d" style="width:${WIDTH}px;${STYLE};padding:20px">${fixedHTML}</div>
    </body></html>`);
    await page.waitForTimeout(300);

    const after = await measureLines(page);
    console.log('\nAFTER:');
    
    // Check for remaining problems
    let stillBad = 0;
    for (let li = 0; li < after.lines.length; li++) {
      const line = after.lines[li];
      const lineWords = line.text.split(/ +/);
      const lastWord = lineWords[lineWords.length - 1];
      const isLast = li === after.lines.length - 1;
      const flags = [];

      if (!isLast) {
        const lower = lastWord.toLowerCase().replace(/[.,;:!?'"]+$/, '');
        let wordIdx = 0;
        for (let prev = 0; prev < li; prev++) wordIdx += after.lines[prev].text.split(/ +/).length;
        wordIdx += lineWords.length - 1;

        if (isSentenceStart(words, wordIdx)) { flags.push('⚠ sentence-start'); stillBad++; }
        if (PREPOSITIONS.has(lower)) { flags.push('⚠ stranded-prep'); stillBad++; }
        if (CONJUNCTIONS.has(lower)) { flags.push('⚠ stranded-conj'); stillBad++; }
        if (ARTICLES.has(lower)) { flags.push('⚠ stranded-article'); stillBad++; }
      } else {
        if (lineWords.length === 1 && line.fill < 40) { flags.push('⚠ orphan'); stillBad++; }
        if (line.fill < 25) { flags.push('⚠ widow'); stillBad++; }
      }
      console.log(`  L${li} [${line.fill}%] "${line.text}" ${flags.join(' ')}`);
    }

    if (stillBad > 0) console.log(`  ⚠ ${stillBad} remaining issues (may need iterative fixing)`);
    else console.log(`  ✓ All break issues resolved`);

    // Screenshot after
    await page.evaluate(() => {
      const el = document.getElementById('d');
      const lab = document.createElement('div');
      lab.style.cssText = 'font-family:monospace;font-size:11px;color:#666;margin-top:12px;padding-top:8px;border-top:1px solid #333';
      lab.textContent = 'AFTER — break quality pass (nowrap spans)';
      el.appendChild(lab);
    });
    writeFileSync(join(OUT, `${sample.label}-after.png`), await (await page.$('#d')).screenshot());
    console.log(`  saved before + after`);
  }

  await browser.close();
  console.log('\nDone!');
}
run();
