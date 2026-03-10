import { chromium } from 'playwright';
import { writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';

const OUT = join(import.meta.dirname, '..', 'test-rag-output', 'optimizer');
mkdirSync(OUT, { recursive: true });

const SAMPLES = [
  { label: "original", text: "Good typography is invisible. Great typography speaks to the reader without raising its voice. The choices behind a well-set paragraph are deliberate, quiet, and precise. Every refinement serves the text and nothing calls attention to itself." },
  { label: "rhetoric-pathos", text: "Pathos is the emotional layer \u2014 the warmth of a serif, the sharpness of a sans, the rhythm of a well-set paragraph. Type can evoke calm, urgency, warmth, or dramatic impact." },
  { label: "reading-lab", text: "Typography is the visual voice of language. When text is set with care \u2014 the right measure, the right leading, the right weight \u2014 reading becomes effortless. When it\u2019s cramped or loose, rhythm falters and the eye fatigues." },
];

const WIDTHS = [310, 340, 360];
const STYLE = `font-family: Georgia, serif; font-size: 18px; line-height: 1.7; color: #d4d4d4;`;

// Break quality rules
const PREPOSITIONS = new Set('of in at by to for with from on into upon about between through without during before after against among within beyond toward towards across along behind beneath beside besides despite except inside outside underneath until unlike'.split(' '));
const CONJUNCTIONS = new Set('and or but nor yet so'.split(' '));
const ARTICLES = new Set('a an the'.split(' '));

function isSentenceEnd(word) {
  return /[.!?]["'\u201D\u2019]?$/.test(word);
}

async function run() {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ deviceScaleFactor: 2 });
  const page = await ctx.newPage();

  for (const sample of SAMPLES) {
    for (const width of WIDTHS) {
      console.log(`\n${'═'.repeat(70)}`);
      console.log(`${sample.label} @ ${width}px`);
      console.log('═'.repeat(70));

      // Measure word widths
      await page.setContent(`<html><body style="background:#0a0a0a;margin:0;padding:0">
        <div id="d" style="width:${width}px;${STYLE};padding:20px">${sample.text}</div>
        <div id="m" style="position:absolute;top:0;left:0;${STYLE};white-space:nowrap;visibility:hidden"></div>
      </body></html>`);
      await page.waitForTimeout(200);

      const m = await page.evaluate(() => {
        const el = document.getElementById('d');
        const measure = document.getElementById('m');
        const cs = getComputedStyle(el);
        const cw = el.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
        const words = el.textContent.split(/ +/).filter(Boolean);
        const ww = words.map(w => { measure.textContent = w; return measure.getBoundingClientRect().width; });
        measure.innerHTML = 'a b';
        const ab = measure.getBoundingClientRect().width;
        measure.textContent = 'ab';
        const sp = ab - measure.getBoundingClientRect().width;
        return { cw, words, ww, sp };
      });

      const { cw, words, ww, sp } = m;
      const n = words.length;

      // ─── RAGGED-RIGHT OPTIMIZER ───
      // Key insight: word-spacing stays NATURAL. Lines end where they end.
      // Badness = break quality penalties + rag shape penalties.
      // A line is valid if: totalWordWidth + (numGaps × naturalSpace) <= containerWidth

      // Classify break quality
      const noEndLine = new Set(); // word indices that should NOT be the last word on a non-final line
      for (let i = 0; i < n - 1; i++) {
        const lower = words[i].toLowerCase().replace(/[.,;:!?'"\u201D\u2019]+$/, '');
        if (PREPOSITIONS.has(lower)) noEndLine.add(i);
        if (CONJUNCTIONS.has(lower)) noEndLine.add(i);
        if (ARTICLES.has(lower)) noEndLine.add(i);
        // Sentence-ending word followed by capitalized word: the NEXT word is a sentence starter
        // It should NOT be the last word on a line (it should start a line)
        if (isSentenceEnd(words[i]) && i + 1 < n && /^[A-Z\u201C"]/.test(words[i + 1])) {
          noEndLine.add(i + 1); // sentence starter should not end a line
        }
      }

      function lineWidth(start, end) {
        let total = 0;
        for (let i = start; i < end; i++) total += ww[i];
        total += (end - start - 1) * sp; // natural word spacing
        return total;
      }

      function lineBadness(start, end, isLast) {
        const lw = lineWidth(start, end);
        if (lw > cw * 1.01) return 1e9; // doesn't fit (1% tolerance for measurement rounding)

        const fill = lw / cw;
        const numWords = end - start;
        let badness = 0;

        if (isLast) {
          // Last line: penalize orphans and very short
          if (numWords === 1 && fill < 0.30) badness += 100;
          else if (fill < 0.15) badness += 80;
          return badness;
        }

        // ─── RAG SHAPE: prefer 70-95% fill ───
        if (fill < 0.50) badness += (0.50 - fill) * 500; // very short = very bad
        else if (fill < 0.65) badness += (0.65 - fill) * 200;
        else if (fill < 0.75) badness += (0.75 - fill) * 50;
        else if (fill > 0.98) badness += (fill - 0.98) * 100; // nearly full = slightly bad (tight)
        // Sweet spot: 0.75 - 0.95 = zero fill penalty

        // ─── BREAK QUALITY ───
        const lastWordIdx = end - 1;
        if (noEndLine.has(lastWordIdx)) {
          badness += 300; // stranded prep/conj/article or sentence starter at end
        }

        // Penalize very short lines (< 3 words) in middle of paragraph
        if (numWords <= 2 && fill < 0.60) badness += 80;

        return badness;
      }

      // DP: minimize total badness
      const dp = new Array(n + 1).fill(1e9);
      const prev = new Array(n + 1).fill(-1);
      dp[0] = 0;

      for (let i = 1; i <= n; i++) {
        for (let j = Math.max(0, i - 25); j < i; j++) {
          const isLast = i === n;
          const cost = dp[j] + lineBadness(j, i, isLast);
          if (cost < dp[i]) {
            dp[i] = cost;
            prev[i] = j;
          }
        }
      }

      // Reconstruct
      const breaks = [];
      let pos = n;
      while (pos > 0) { breaks.unshift(pos); pos = prev[pos]; }

      const lines = [];
      let start = 0;
      for (const end of breaks) {
        const text = words.slice(start, end).join(' ');
        const lw = lineWidth(start, end);
        const fill = Math.round(lw / cw * 100);
        const isLast = end === n;
        const lastIdx = end - 1;
        const flags = [];
        if (!isLast && noEndLine.has(lastIdx)) flags.push('⚠');
        lines.push({ text, fill, isLast, flags });
        start = end;
      }

      // Browser default for comparison
      const browserLines = await page.evaluate(() => {
        const el = document.getElementById('d');
        const cs = getComputedStyle(el);
        const cw = el.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
        const words = el.textContent.split(/ +/).filter(Boolean);
        el.innerHTML = words.map((w, i) => `<span data-w="${i}">${w}</span>`).join(' ');
        const spans = el.querySelectorAll('span[data-w]');
        const result = [];
        let top = -1, cur = [];
        spans.forEach((s, i) => {
          const t = Math.round(s.getBoundingClientRect().top);
          if (top === -1) { top = t; cur = [i]; }
          else if (Math.abs(t - top) > 3) {
            const f = spans[cur[0]], l = spans[cur[cur.length - 1]];
            result.push({ text: cur.map(j => words[j]).join(' '), fill: Math.round((l.getBoundingClientRect().right - f.getBoundingClientRect().left) / cw * 100) });
            top = t; cur = [i];
          } else cur.push(i);
        });
        if (cur.length) {
          const f = spans[cur[0]], l = spans[cur[cur.length - 1]];
          result.push({ text: cur.map(j => words[j]).join(' '), fill: Math.round((l.getBoundingClientRect().right - f.getBoundingClientRect().left) / cw * 100) });
        }
        return result;
      });

      // Count break quality issues in browser default
      let browserIssues = 0;
      let bWordIdx = 0;
      for (let li = 0; li < browserLines.length; li++) {
        const bWords = browserLines[li].text.split(/ +/);
        const lastIdx = bWordIdx + bWords.length - 1;
        const isLast = li === browserLines.length - 1;
        if (!isLast && noEndLine.has(lastIdx)) {
          browserLines[li].flag = '⚠';
          browserIssues++;
        }
        bWordIdx += bWords.length;
      }

      // Count optimizer issues
      const optIssues = lines.filter(l => l.flags.length > 0).length;

      console.log('\n  BROWSER:');
      browserLines.forEach((l, i) => console.log(`    L${i} [${l.fill}%] "${l.text}" ${l.flag || ''}`));

      console.log(`\n  OPTIMIZED (badness: ${dp[n].toFixed(0)}):`);
      lines.forEach((l, i) => console.log(`    L${i} [${l.fill}%] "${l.text}" ${l.flags.join('')}`));

      const bNL = browserLines.slice(0, -1).map(l => l.fill);
      const oNL = lines.filter(l => !l.isLast).map(l => l.fill);
      const bRange = bNL.length ? Math.max(...bNL) - Math.min(...bNL) : 0;
      const oRange = oNL.length ? Math.max(...oNL) - Math.min(...oNL) : 0;

      console.log(`\n  Fill range: ${bRange}% → ${oRange}%`);
      console.log(`  Break issues: ${browserIssues} → ${optIssues}`);

      // Render optimized
      await page.setContent(`<html><body style="background:#0a0a0a;margin:0;padding:0">
        <div id="d" style="width:${width}px;${STYLE};padding:20px;white-space:pre-line">${lines.map(l => l.text).join('\n')}</div>
      </body></html>`);
      await page.waitForTimeout(200);
      await page.evaluate(({ label, width, issues }) => {
        const el = document.getElementById('d');
        const lab = document.createElement('div');
        lab.style.cssText = 'font-family:monospace;font-size:10px;color:#555;margin-top:10px;padding-top:6px;border-top:1px solid #333;white-space:normal';
        lab.textContent = `${label} @ ${width}px — optimized (${issues} break issues)`;
        el.appendChild(lab);
      }, { label: sample.label, width, issues: optIssues });
      writeFileSync(join(OUT, `${sample.label}-${width}-opt.png`), await (await page.$('#d')).screenshot());

      // Render browser default
      await page.setContent(`<html><body style="background:#0a0a0a;margin:0;padding:0">
        <div id="d" style="width:${width}px;${STYLE};padding:20px">${sample.text}</div>
      </body></html>`);
      await page.waitForTimeout(200);
      await page.evaluate(({ label, width, issues }) => {
        const el = document.getElementById('d');
        const lab = document.createElement('div');
        lab.style.cssText = 'font-family:monospace;font-size:10px;color:#555;margin-top:10px;padding-top:6px;border-top:1px solid #333;white-space:normal';
        lab.textContent = `${label} @ ${width}px — browser default (${issues} break issues)`;
        el.appendChild(lab);
      }, { label: sample.label, width, issues: browserIssues });
      writeFileSync(join(OUT, `${sample.label}-${width}-browser.png`), await (await page.$('#d')).screenshot());
    }
  }

  await browser.close();
  console.log('\nDone!');
}
run();
