import { chromium } from 'playwright';
import { writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';

const OUT = join(import.meta.dirname, '..', 'test-rag-output', 'optimizer');
mkdirSync(OUT, { recursive: true });

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

const WIDTHS = [310, 340, 360];
const STYLE_BASE = `font-family: Georgia, serif; font-size: 18px; line-height: 1.7; color: #d4d4d4;`;

async function run() {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ deviceScaleFactor: 2 });
  const page = await ctx.newPage();

  for (const sample of SAMPLES) {
    for (const width of WIDTHS) {
      console.log(`\n${'═'.repeat(70)}`);
      console.log(`${sample.label} @ ${width}px`);
      console.log('═'.repeat(70));

      // ─── STEP 1: Measure every word's width ───
      await page.setContent(`<html><body style="background:#0a0a0a;margin:0;padding:0">
        <div id="d" style="width:${width}px;${STYLE_BASE};padding:20px;visibility:hidden">${sample.text}</div>
        <div id="m" style="position:absolute;top:0;left:0;${STYLE_BASE};white-space:nowrap;visibility:hidden"></div>
      </body></html>`);
      await page.waitForTimeout(200);

      const measurements = await page.evaluate(() => {
        const el = document.getElementById('d');
        const measure = document.getElementById('m');
        const cs = getComputedStyle(el);
        const containerWidth = el.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
        const text = el.textContent;
        const words = text.split(/ +/).filter(Boolean);

        // Measure each word
        const wordWidths = words.map(w => {
          measure.textContent = w;
          return measure.getBoundingClientRect().width;
        });

        // Measure space width (the font's designed word space)
        measure.innerHTML = 'a b';
        const abWidth = measure.getBoundingClientRect().width;
        measure.textContent = 'ab';
        const abNoSpace = measure.getBoundingClientRect().width;
        const spaceWidth = abWidth - abNoSpace;

        // Measure em
        measure.textContent = 'M';
        const emWidth = measure.getBoundingClientRect().width;

        return { containerWidth, words, wordWidths, spaceWidth, emWidth };
      });

      const { containerWidth, words, wordWidths, spaceWidth, emWidth } = measurements;
      console.log(`  container: ${containerWidth.toFixed(0)}px, space: ${spaceWidth.toFixed(2)}px, em: ${emWidth.toFixed(2)}px`);
      console.log(`  ${words.length} words, widths: ${wordWidths.map(w => w.toFixed(0)).join(', ')}`);

      // ─── STEP 2: Break quality rules ───
      // Classify words that should NOT end a line
      const PREPOSITIONS = new Set('of in at by to for with from on into upon about between through without during before after against among within beyond toward towards across along behind beneath beside besides despite except inside outside underneath until unlike'.split(' '));
      const CONJUNCTIONS = new Set('and or but nor yet so'.split(' '));
      const ARTICLES = new Set('a an the'.split(' '));

      const noBreakAfter = new Set(); // indices where we should NOT break after this word
      for (let i = 0; i < words.length - 1; i++) {
        const lower = words[i].toLowerCase().replace(/[.,;:!?'"]+$/, '');
        // Sentence start: if word[i+1] follows sentence-ending punctuation on word[i]
        if (/[.!?]["'\u201D\u2019]?$/.test(words[i]) && i + 1 < words.length && /^[A-Z]/.test(words[i + 1])) {
          // The NEXT word is a sentence start — don't let it be alone at end of prev line
          // Actually: we want to NOT break between word[i] and word[i+1] if word[i+1] would end up alone
          // Better: mark word[i+1] as "must not be last word on a line" (it should start a line or be mid-line)
        }
        if (PREPOSITIONS.has(lower)) noBreakAfter.add(i);
        if (CONJUNCTIONS.has(lower)) noBreakAfter.add(i);
        if (ARTICLES.has(lower)) noBreakAfter.add(i);
      }

      // Sentence starters: should not be the LAST word on a line
      const sentenceStarters = new Set();
      for (let i = 1; i < words.length; i++) {
        if (/[.!?]["'\u201D\u2019]?$/.test(words[i - 1]) && /^[A-Z\u201C"]/.test(words[i])) {
          sentenceStarters.add(i);
        }
      }

      // ─── STEP 3: Dynamic programming — optimal paragraph breaking ───
      // State: dp[i] = minimum total badness to set words[0..i-1]
      // Transition: for each possible previous break point j, compute badness of line words[j..i-1]

      const n = words.length;
      const INF = 1e9;

      // Spacing tolerances (Bringhurst / InDesign standards)
      const minSpace = spaceWidth * 0.80;  // tight
      const optSpace = spaceWidth;          // designed
      const maxSpace = spaceWidth * 1.33;   // loose

      // Letter-spacing tolerance (per character)
      const minLS = -0.3; // px per char
      const maxLS = 0.5;  // px per char

      function lineBadness(start, end) {
        // Line contains words[start..end-1]
        const lineWords = words.slice(start, end);
        const lineWordWidths = wordWidths.slice(start, end);
        const numGaps = lineWords.length - 1;
        const isLast = end === n;

        // Total word width
        const totalWordWidth = lineWordWidths.reduce((s, w) => s + w, 0);

        // Available space for gaps
        const availableForGaps = containerWidth - totalWordWidth;

        if (numGaps === 0) {
          // Single word line
          if (isLast) return 0; // last line, single word is ok if it's the end
          return totalWordWidth < containerWidth ? 50 : INF; // mid-paragraph single word = bad
        }

        const neededSpace = availableForGaps / numGaps;

        // Can we fit with word-spacing alone?
        if (neededSpace < minSpace * 0.5) return INF; // way too tight, impossible
        if (neededSpace > maxSpace * 2.0) return INF; // way too loose, impossible

        // If last line, we just need it to fit and not be too loose
        if (isLast) {
          if (neededSpace < minSpace * 0.7) return INF;
          const fill = totalWordWidth / containerWidth;
          // Penalize very short last lines
          if (fill < 0.20) return 100;
          if (fill < 0.30) return 30;
          return 0;
        }

        // Letter-spacing can help close remaining gaps
        const totalChars = lineWords.join('').length;

        // Compute achievable line width with max adjustments
        const maxAchievable = totalWordWidth + maxSpace * numGaps + maxLS * totalChars;
        const minAchievable = totalWordWidth + minSpace * numGaps + minLS * totalChars;

        if (containerWidth > maxAchievable) return INF; // can't stretch enough
        if (containerWidth < minAchievable) return INF; // can't compress enough

        // Badness = how far from optimal spacing?
        // If word-spacing alone works:
        let badness = 0;

        if (neededSpace >= minSpace && neededSpace <= maxSpace) {
          // Within word-spacing tolerance — compute deviation from optimal
          const deviation = (neededSpace - optSpace) / optSpace; // -0.2 to +0.33
          badness = Math.pow(Math.abs(deviation) * 100, 2); // quadratic penalty
        } else {
          // Need letter-spacing assistance
          let wsTarget, lsNeeded;
          if (neededSpace > maxSpace) {
            // Too loose — use max word-spacing + letter-spacing
            wsTarget = maxSpace;
            const wsWidth = totalWordWidth + wsTarget * numGaps;
            lsNeeded = (containerWidth - wsWidth) / totalChars;
            if (lsNeeded > maxLS) return INF;
          } else {
            // Too tight — use min word-spacing + negative letter-spacing
            wsTarget = minSpace;
            const wsWidth = totalWordWidth + wsTarget * numGaps;
            lsNeeded = (containerWidth - wsWidth) / totalChars;
            if (lsNeeded < minLS) return INF;
          }
          // Higher badness for needing letter-spacing
          const wsDeviation = (wsTarget - optSpace) / optSpace;
          const lsDeviation = Math.abs(lsNeeded) / 0.5; // normalized to max
          badness = Math.pow(Math.abs(wsDeviation) * 100, 2) + Math.pow(lsDeviation * 50, 2);
        }

        // Break quality penalties
        const lastWordIdx = end - 1;
        if (noBreakAfter.has(lastWordIdx)) {
          badness += 500; // heavy penalty for stranded preposition/conjunction/article
        }
        if (sentenceStarters.has(lastWordIdx)) {
          badness += 800; // very heavy penalty for sentence starter at line end
        }

        // Single-word line penalty (non-last)
        if (lineWords.length === 1) badness += 200;

        return badness;
      }

      // DP
      const dp = new Array(n + 1).fill(INF);
      const prev = new Array(n + 1).fill(-1);
      dp[0] = 0;

      for (let i = 1; i <= n; i++) {
        for (let j = Math.max(0, i - 20); j < i; j++) { // max ~20 words per line
          const cost = dp[j] + lineBadness(j, i);
          if (cost < dp[i]) {
            dp[i] = cost;
            prev[i] = j;
          }
        }
      }

      // Reconstruct breaks
      const breaks = [];
      let pos = n;
      while (pos > 0) {
        breaks.unshift(pos);
        pos = prev[pos];
      }

      // ─── STEP 4: Compute optimal spacing per line ───
      const lines = [];
      let start = 0;
      for (const end of breaks) {
        const lineWords = words.slice(start, end);
        const lineWordWidths = wordWidths.slice(start, end);
        const totalWordWidth = lineWordWidths.reduce((s, w) => s + w, 0);
        const numGaps = lineWords.length - 1;
        const isLast = end === n;
        const totalChars = lineWords.join('').length;

        let ws = optSpace, ls = 0;
        if (numGaps > 0 && !isLast) {
          const neededSpace = (containerWidth - totalWordWidth) / numGaps;
          if (neededSpace >= minSpace && neededSpace <= maxSpace) {
            ws = neededSpace;
          } else if (neededSpace > maxSpace) {
            ws = maxSpace;
            const wsWidth = totalWordWidth + ws * numGaps;
            ls = Math.min(maxLS, (containerWidth - wsWidth) / totalChars);
          } else {
            ws = minSpace;
            const wsWidth = totalWordWidth + ws * numGaps;
            ls = Math.max(minLS, (containerWidth - wsWidth) / totalChars);
          }
        }

        const lineWidth = totalWordWidth + ws * numGaps + ls * totalChars;
        const fill = Math.round(lineWidth / containerWidth * 100);

        // Check for break quality issues
        const flags = [];
        const lastIdx = end - 1;
        if (noBreakAfter.has(lastIdx)) flags.push('⚠ stranded');
        if (sentenceStarters.has(lastIdx)) flags.push('⚠ sent-start');

        lines.push({ text: lineWords.join(' '), fill, ws: ws - optSpace, ls, isLast, flags });
        start = end;
      }

      // ─── STEP 5: Also compute browser default for comparison ───
      await page.setContent(`<html><body style="background:#0a0a0a;margin:0;padding:0">
        <div id="d" style="width:${width}px;${STYLE_BASE};padding:20px">${sample.text}</div>
      </body></html>`);
      await page.waitForTimeout(200);
      const browserLines = await page.evaluate(() => {
        const el = document.getElementById('d');
        const cs = getComputedStyle(el);
        const cw = el.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
        const words = el.textContent.split(/ +/).filter(Boolean);
        el.innerHTML = words.map((w, i) => `<span data-w="${i}">${w}</span>`).join(' ');
        const spans = el.querySelectorAll('span[data-w]');
        const lines = [];
        let top = -1, cur = [];
        spans.forEach((s, i) => {
          const t = Math.round(s.getBoundingClientRect().top);
          if (top === -1) { top = t; cur = [i]; }
          else if (Math.abs(t - top) > 3) {
            const f = spans[cur[0]], l = spans[cur[cur.length - 1]];
            lines.push({ text: cur.map(j => words[j]).join(' '), fill: Math.round((l.getBoundingClientRect().right - f.getBoundingClientRect().left) / cw * 100) });
            top = t; cur = [i];
          } else cur.push(i);
        });
        if (cur.length) {
          const f = spans[cur[0]], l = spans[cur[cur.length - 1]];
          lines.push({ text: cur.map(j => words[j]).join(' '), fill: Math.round((l.getBoundingClientRect().right - f.getBoundingClientRect().left) / cw * 100) });
        }
        return lines;
      });

      console.log('\n  BROWSER DEFAULT:');
      browserLines.forEach((l, i) => console.log(`    L${i} [${l.fill}%] "${l.text}"`));

      const bNL = browserLines.slice(0, -1).map(l => l.fill);
      const bRange = bNL.length ? Math.max(...bNL) - Math.min(...bNL) : 0;

      console.log(`\n  OPTIMIZED (total badness: ${dp[n].toFixed(0)}):`);
      lines.forEach((l, i) => {
        const adj = [];
        if (Math.abs(l.ws) > 0.05) adj.push(`ws${l.ws > 0 ? '+' : ''}${l.ws.toFixed(1)}`);
        if (Math.abs(l.ls) > 0.05) adj.push(`ls${l.ls > 0 ? '+' : ''}${l.ls.toFixed(2)}`);
        console.log(`    L${i} [${l.fill}%] "${l.text}" ${adj.join(' ')} ${l.flags.join(' ')}`);
      });

      const oNL = lines.filter(l => !l.isLast).map(l => l.fill);
      const oRange = oNL.length ? Math.max(...oNL) - Math.min(...oNL) : 0;
      console.log(`\n  Range: ${bRange}% → ${oRange}%`);

      // ─── STEP 6: Render optimized version ───
      const htmlParts = lines.map(l => {
        const styles = [];
        if (Math.abs(l.ws) > 0.05) styles.push(`word-spacing:${l.ws.toFixed(2)}px`);
        if (Math.abs(l.ls) > 0.05) styles.push(`letter-spacing:${l.ls.toFixed(2)}px`);
        if (styles.length) return `<span style="${styles.join(';')}">${l.text}</span>`;
        return l.text;
      });

      await page.setContent(`<html><body style="background:#0a0a0a;margin:0;padding:0">
        <div id="d" style="width:${width}px;${STYLE_BASE};padding:20px;white-space:pre-line">${htmlParts.join('\n')}</div>
      </body></html>`);
      await page.waitForTimeout(200);

      await page.evaluate(({ label, width }) => {
        const el = document.getElementById('d');
        const lab = document.createElement('div');
        lab.style.cssText = 'font-family:monospace;font-size:10px;color:#555;margin-top:12px;padding-top:8px;border-top:1px solid #333;white-space:normal';
        lab.textContent = `${label} @ ${width}px — optimized breaks + spacing`;
        el.appendChild(lab);
      }, { label: sample.label, width });

      writeFileSync(join(OUT, `${sample.label}-${width}.png`), await (await page.$('#d')).screenshot());
    }
  }

  await browser.close();
  console.log('\nDone!');
}
run();
