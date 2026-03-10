import { chromium } from 'playwright';
import { writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';

const OUT = join(import.meta.dirname, '..', 'test-rag-output', 'breaks');
mkdirSync(OUT, { recursive: true });

// ─── Break Quality Rules ───────────────────────────────────────
// These patterns should NOT appear at a line's end (the last word[s] of a line):
//
// 1. SENTENCE STARTERS: word following ". " or "! " or "? " — should begin next line
// 2. STRANDED PREPOSITIONS: of, in, at, by, to, for, with, from, on, into, upon, about, between, through, without, during, before, after, against, among, within, beyond, toward, towards, across, along, behind, beneath, beside, besides, despite, except, inside, outside, underneath, until, unlike, upon
// 3. STRANDED CONJUNCTIONS: and, or, but, nor, yet, so, for (when conjunction)
// 4. STRANDED ARTICLES: a, an, the
// 5. SHORT ORPHAN LAST LINE: last line < 25% fill or just 1 word

const PREPOSITIONS = new Set('of in at by to for with from on into upon about between through without during before after against among within beyond toward towards across along behind beneath beside besides despite except inside outside underneath until unlike'.split(' '));
const CONJUNCTIONS = new Set('and or but nor yet so'.split(' '));
const ARTICLES = new Set('a an the'.split(' '));

// Detect sentence boundary: word is preceded by sentence-ending punctuation
function isSentenceStart(words, idx) {
  if (idx === 0) return false;
  const prev = words[idx - 1];
  return /[.!?]["'\u201D\u2019]?$/.test(prev);
}

function classifyWord(word, words, idx) {
  const lower = word.toLowerCase().replace(/[.,;:!?'"]+$/, '');
  if (isSentenceStart(words, idx)) return 'sentence-start';
  if (PREPOSITIONS.has(lower)) return 'preposition';
  if (CONJUNCTIONS.has(lower)) return 'conjunction';
  if (ARTICLES.has(lower)) return 'article';
  return null;
}

// ─── Test Texts ────────────────────────────────────────────────

const SAMPLES = [
  {
    label: "original",
    text: "Good typography is invisible. Great typography speaks to the reader without raising its voice. The choices behind a well-set paragraph are deliberate, quiet, and precise. Every refinement serves the text and nothing calls attention to itself.",
  },
  {
    label: "rhetoric-pathos",
    text: "Pathos is the emotional layer \u2014 the warmth of a serif, the sharpness of a sans, the rhythm of a well-set paragraph. Type can evoke calm, urgency, warmth, or dramatic impact.",
  },
  {
    label: "reading-lab",
    text: "Typography is the visual voice of language. When text is set with care \u2014 the right measure, the right leading, the right weight \u2014 reading becomes effortless. When it\u2019s cramped or loose, rhythm falters and the eye fatigues.",
  },
];

const STYLE = `font-family: Georgia, serif; font-size: 18px; line-height: 1.7; color: #d4d4d4;`;
const WIDTH = 360;

async function detectAndFix(page, text, label) {
  const words = text.split(/ +/).filter(Boolean);

  // ─── Phase 1: Detect line breaks and problems ───
  await page.setContent(`<html><body style="background:#0a0a0a;margin:0;padding:16px 0">
    <div id="d" style="width:${WIDTH}px;${STYLE};padding:20px">${text}</div>
  </body></html>`);
  await page.waitForTimeout(300);

  const analysis = await page.evaluate(() => {
    const el = document.getElementById('d');
    const cs = getComputedStyle(el);
    const cw = el.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
    const text = el.textContent;
    const words = text.split(/ +/).filter(Boolean);

    el.innerHTML = words.map((w, i) => `<span data-w="${i}">${w}</span>`).join(' ');
    const spans = el.querySelectorAll('span[data-w]');
    const lines = [];
    let top = -1, cur = [];
    spans.forEach((s, i) => {
      const t = Math.round(s.getBoundingClientRect().top);
      if (top === -1) { top = t; cur = [i]; }
      else if (Math.abs(t - top) > 3) {
        const f = spans[cur[0]], l = spans[cur[cur.length - 1]];
        lines.push({ indices: [...cur], width: l.getBoundingClientRect().right - f.getBoundingClientRect().left });
        top = t; cur = [i];
      } else cur.push(i);
    });
    if (cur.length) {
      const f = spans[cur[0]], l = spans[cur[cur.length - 1]];
      lines.push({ indices: [...cur], width: l.getBoundingClientRect().right - f.getBoundingClientRect().left });
    }

    el.innerHTML = words.join(' ');

    return {
      containerWidth: cw,
      lines: lines.map(l => ({
        indices: l.indices,
        words: l.indices.map(i => words[i]),
        text: l.indices.map(i => words[i]).join(' '),
        fill: Math.round(l.width / cw * 100),
        lastWord: words[l.indices[l.indices.length - 1]],
        lastWordIdx: l.indices[l.indices.length - 1],
      })),
    };
  });

  // ─── Phase 2: Identify problems ───
  const problems = [];
  for (let i = 0; i < analysis.lines.length; i++) {
    const line = analysis.lines[i];
    const isLast = i === analysis.lines.length - 1;

    if (isLast) {
      // Check for widow/orphan
      if (line.words.length === 1) {
        problems.push({ line: i, type: 'orphan-last', word: line.words[0], idx: line.lastWordIdx });
      }
      if (line.fill < 25) {
        problems.push({ line: i, type: 'widow', fill: line.fill });
      }
      continue;
    }

    const lastWord = line.lastWord;
    const nextLineFirstIdx = line.lastWordIdx + 1;

    // Check if last word is a stranded preposition/conjunction/article
    const lower = lastWord.toLowerCase().replace(/[.,;:!?'"]+$/, '');
    if (PREPOSITIONS.has(lower)) {
      problems.push({ line: i, type: 'stranded-preposition', word: lastWord, idx: line.lastWordIdx });
    }
    if (CONJUNCTIONS.has(lower)) {
      problems.push({ line: i, type: 'stranded-conjunction', word: lastWord, idx: line.lastWordIdx });
    }
    if (ARTICLES.has(lower)) {
      problems.push({ line: i, type: 'stranded-article', word: lastWord, idx: line.lastWordIdx });
    }

    // Check if first word of NEXT line is a sentence start (meaning last word of THIS line ends a sentence,
    // and the sentence-starting word that follows it is on the next line — that's fine)
    // BUT: if last word of THIS line IS the sentence-starting word, that's bad
    if (nextLineFirstIdx < words.length && isSentenceStart(words, nextLineFirstIdx)) {
      // Next line starts a new sentence — this is GOOD (sentence starts at line start)
    }

    // Check if last word on this line is a sentence-START word (preceded by . ! ?)
    if (isSentenceStart(words, line.lastWordIdx)) {
      problems.push({ line: i, type: 'sentence-start-at-line-end', word: lastWord, idx: line.lastWordIdx });
    }

    // Check second-to-last word too (sometimes two words dangle)
    if (line.words.length >= 2) {
      const secondLast = line.words[line.words.length - 2];
      const secondLastIdx = line.indices[line.indices.length - 2];
      if (isSentenceStart(words, secondLastIdx) && line.fill < 85) {
        // Two words of a new sentence at end of a short line
        problems.push({ line: i, type: 'sentence-start-dangling', word: secondLast + ' ' + lastWord, idx: secondLastIdx });
      }
    }
  }

  return { analysis, problems, words };
}

function buildFixedHTML(words, problems) {
  // Strategy: wrap "keep together" groups using white-space: nowrap
  // For sentence starters at line end: wrap the sentence-start word with the NEXT word(s) in a nowrap span
  // For stranded prepositions/conjunctions/articles: wrap with the next word in a nowrap span

  // Build a map: wordIndex → { action, pairWith }
  const fixes = new Map();

  for (const p of problems) {
    switch (p.type) {
      case 'sentence-start-at-line-end':
      case 'sentence-start-dangling':
        // This word (and maybe its successor) should start the next line
        // Wrap it with the next word so they can't be split
        if (p.idx + 1 < words.length) {
          fixes.set(p.idx, { type: 'nowrap-forward', count: 2 });
        }
        break;
      case 'stranded-preposition':
      case 'stranded-conjunction':
      case 'stranded-article':
        // Wrap with next word
        if (p.idx + 1 < words.length) {
          fixes.set(p.idx, { type: 'nowrap-forward', count: 2 });
        }
        break;
      case 'orphan-last':
        // Pull last word up by wrapping with previous word
        if (p.idx - 1 >= 0) {
          fixes.set(p.idx - 1, { type: 'nowrap-forward', count: 2 });
        }
        break;
    }
  }

  // Build HTML
  const parts = [];
  let i = 0;
  while (i < words.length) {
    const fix = fixes.get(i);
    if (fix && fix.type === 'nowrap-forward') {
      const group = words.slice(i, i + fix.count).join(' ');
      parts.push(`<span style="white-space:nowrap">${group}</span>`);
      i += fix.count;
    } else {
      parts.push(words[i]);
      i++;
    }
  }
  return parts.join(' ');
}

async function run() {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ deviceScaleFactor: 2 });
  const page = await ctx.newPage();

  for (const sample of SAMPLES) {
    console.log(`\n${'═'.repeat(70)}`);
    console.log(`${sample.label}`);
    console.log(`${'═'.repeat(70)}`);

    // Analyze
    const { analysis, problems, words } = await detectAndFix(page, sample.text, sample.label);

    console.log('\nBEFORE:');
    analysis.lines.forEach((l, i) => {
      const probs = problems.filter(p => p.line === i);
      const flags = probs.map(p => `⚠ ${p.type}(${p.word || p.fill + '%'})`).join(' ');
      console.log(`  L${i} [${l.fill}%] "${l.text}" ${flags}`);
    });

    // Screenshot before
    await page.setContent(`<html><body style="background:#0a0a0a;margin:0;padding:16px 0">
      <div id="d" style="width:${WIDTH}px;${STYLE};padding:20px">${sample.text}</div>
    </body></html>`);
    await page.waitForTimeout(300);
    await page.evaluate(() => {
      const el = document.getElementById('d');
      const lab = document.createElement('div');
      lab.style.cssText = 'font-family:monospace;font-size:11px;color:#666;margin-top:12px;padding-top:8px;border-top:1px solid #333;letter-spacing:0.05em';
      lab.textContent = 'BEFORE — browser default breaks';
      el.appendChild(lab);
    });
    writeFileSync(join(OUT, `${sample.label}-before.png`), await (await page.$('#d')).screenshot());

    if (problems.length === 0) {
      console.log('\n  ✓ No break quality issues found');
      continue;
    }

    console.log(`\nFOUND ${problems.length} PROBLEMS:`);
    problems.forEach(p => console.log(`  ⚠ L${p.line}: ${p.type} — "${p.word || ''}"`));

    // Apply fixes
    const fixedHTML = buildFixedHTML(words, problems);
    console.log(`\nFIXED HTML (nowrap spans applied):`);

    // Render fixed version
    await page.setContent(`<html><body style="background:#0a0a0a;margin:0;padding:16px 0">
      <div id="d" style="width:${WIDTH}px;${STYLE};padding:20px">${fixedHTML}</div>
    </body></html>`);
    await page.waitForTimeout(300);

    // Measure fixed lines
    const fixedInfo = await page.evaluate(() => {
      const el = document.getElementById('d');
      const cs = getComputedStyle(el);
      const cw = el.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
      const text = el.textContent;
      const words = text.split(/ +/).filter(Boolean);

      // Temporarily measure
      const origHTML = el.innerHTML;
      el.innerHTML = words.map((w, i) => `<span data-w="${i}">${w}</span>`).join(' ');
      const spans = el.querySelectorAll('span[data-w]');
      const lines = [];
      let top = -1, cur = [];
      spans.forEach((s, i) => {
        const t = Math.round(s.getBoundingClientRect().top);
        if (top === -1) { top = t; cur = [i]; }
        else if (Math.abs(t - top) > 3) {
          const f = spans[cur[0]], l = spans[cur[cur.length - 1]];
          lines.push({ words: cur.map(j => words[j]).join(' '), fill: Math.round((l.getBoundingClientRect().right - f.getBoundingClientRect().left) / cw * 100) });
          top = t; cur = [i];
        } else cur.push(i);
      });
      if (cur.length) {
        const f = spans[cur[0]], l = spans[cur[cur.length - 1]];
        lines.push({ words: cur.map(j => words[j]).join(' '), fill: Math.round((l.getBoundingClientRect().right - f.getBoundingClientRect().left) / cw * 100) });
      }
      el.innerHTML = origHTML;
      return lines;
    });

    console.log('\nAFTER:');
    fixedInfo.forEach((l, i) => console.log(`  L${i} [${l.fill}%] "${l.words}"`));

    // Check for NEW problems in the fixed version
    const { problems: newProblems } = await detectAndFix(page, fixedInfo.map(l => l.words).join(' '), sample.label + '-fixed');
    if (newProblems.length > 0) {
      console.log('\n  ⚠ FIX INTRODUCED NEW PROBLEMS:');
      newProblems.forEach(p => console.log(`    L${p.line}: ${p.type} — "${p.word || ''}"`));
      
      // Iterative fix: apply again
      const reWords = fixedInfo.map(l => l.words).join(' ').split(/ +/).filter(Boolean);
      const reFixedHTML = buildFixedHTML(reWords, newProblems);
      await page.setContent(`<html><body style="background:#0a0a0a;margin:0;padding:16px 0">
        <div id="d" style="width:${WIDTH}px;${STYLE};padding:20px">${reFixedHTML}</div>
      </body></html>`);
      await page.waitForTimeout(300);
      
      const reInfo = await page.evaluate(() => {
        const el = document.getElementById('d');
        const cs = getComputedStyle(el);
        const cw = el.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
        const text = el.textContent;
        const words = text.split(/ +/).filter(Boolean);
        const origHTML = el.innerHTML;
        el.innerHTML = words.map((w, i) => `<span data-w="${i}">${w}</span>`).join(' ');
        const spans = el.querySelectorAll('span[data-w]');
        const lines = [];
        let top = -1, cur = [];
        spans.forEach((s, i) => {
          const t = Math.round(s.getBoundingClientRect().top);
          if (top === -1) { top = t; cur = [i]; }
          else if (Math.abs(t - top) > 3) {
            const f = spans[cur[0]], l = spans[cur[cur.length - 1]];
            lines.push({ words: cur.map(j => words[j]).join(' '), fill: Math.round((l.getBoundingClientRect().right - f.getBoundingClientRect().left) / cw * 100) });
            top = t; cur = [i];
          } else cur.push(i);
        });
        if (cur.length) {
          const f = spans[cur[0]], l = spans[cur[cur.length - 1]];
          lines.push({ words: cur.map(j => words[j]).join(' '), fill: Math.round((l.getBoundingClientRect().right - f.getBoundingClientRect().left) / cw * 100) });
        }
        el.innerHTML = origHTML;
        return lines;
      });
      
      console.log('\n  AFTER PASS 2:');
      reInfo.forEach((l, i) => console.log(`    L${i} [${l.fill}%] "${l.words}"`));
    }

    // Screenshot after
    await page.evaluate(() => {
      const el = document.getElementById('d');
      const lab = document.createElement('div');
      lab.style.cssText = 'font-family:monospace;font-size:11px;color:#666;margin-top:12px;padding-top:8px;border-top:1px solid #333;letter-spacing:0.05em';
      lab.textContent = 'AFTER — break quality pass (nowrap spans)';
      el.appendChild(lab);
    });
    writeFileSync(join(OUT, `${sample.label}-after.png`), await (await page.$('#d')).screenshot());
    console.log(`\n  saved ${sample.label}-before.png + ${sample.label}-after.png`);
  }

  await browser.close();
  console.log('\nDone!');
}

run();
