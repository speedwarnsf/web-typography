/**
 * Paragraph Optimizer v3 — Integrating historical typographic formulas
 * 
 * Sources:
 *   Bringhurst: column width = 2× alphabet length, min 1.5× (~39ch)
 *   Tschichold: word spacing tolerance = 'i' thickness
 *   Knuth-Plass: badness = (stretch ratio)³ + penalties
 *   Ruder: leading 120-150% of type size; counter-form as instrument
 *   TM: width = f(type size × leading factor)
 *   The New Yorker: max 3 consecutive hyphens, ~35ch columns
 *   Octavo: golden ratio grids (1:1.618)
 */

import { chromium } from 'playwright';
import { writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';

const OUT = join(import.meta.dirname, '..', 'test-rag-output', 'v3');
mkdirSync(OUT, { recursive: true });

const SAMPLES = [
  { label: "original", text: "Good typography is invisible. Great typography speaks to the reader without raising its voice. The choices behind a well-set paragraph are deliberate, quiet, and precise. Every refinement serves the text and nothing calls attention to itself." },
  { label: "long-academic", text: "Interdisciplinary communication requires an acknowledgement of counterproductive oversimplification. Professionalism in typographic craftsmanship demands uncompromising attention to detail." },
  { label: "reading-lab", text: "Typography is the visual voice of language. When text is set with care \u2014 the right measure, the right leading, the right weight \u2014 reading becomes effortless. When it\u2019s cramped or loose, rhythm falters and the eye fatigues." },
  { label: "rhetoric-pathos", text: "Pathos is the emotional layer \u2014 the warmth of a serif, the sharpness of a sans, the rhythm of a well-set paragraph. Type can evoke calm, urgency, warmth, or dramatic impact." },
];

const WIDTHS = [310, 340, 360];
const STYLE = `font-family: Georgia, serif; font-size: 18px; line-height: 1.7; color: #d4d4d4;`;

// Break quality vocabulary
const PREPOSITIONS = new Set('of in at by to for with from on into upon about between through without during before after against among within beyond toward towards across along behind beneath beside besides despite except inside outside underneath until unlike'.split(' '));
const CONJUNCTIONS = new Set('and or but nor yet so'.split(' '));
const ARTICLES = new Set('a an the'.split(' '));
function isSentenceEnd(w) { return /[.!?]["'\u201D\u2019]?$/.test(w); }

async function run() {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ deviceScaleFactor: 2 });
  const page = await ctx.newPage();

  for (const sample of SAMPLES) {
    for (const width of WIDTHS) {
      console.log(`\n${'═'.repeat(60)}`);
      console.log(`${sample.label} @ ${width}px`);
      console.log('═'.repeat(60));

      // ─── MEASURE EVERYTHING ───
      await page.setContent(`<html><body style="background:#0a0a0a;margin:0;padding:0">
        <div id="d" style="width:${width}px;${STYLE};padding:20px">${sample.text}</div>
        <div id="m" style="position:absolute;top:0;${STYLE};white-space:nowrap;visibility:hidden"></div>
      </body></html>`);
      await page.waitForTimeout(200);

      const metrics = await page.evaluate(() => {
        const el = document.getElementById('d');
        const m = document.getElementById('m');
        const cs = getComputedStyle(el);
        const cw = el.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
        const fontSize = parseFloat(cs.fontSize);
        const lineHeight = parseFloat(cs.lineHeight);
        const leadingRatio = lineHeight / fontSize; // Ruder: should be 1.2-1.5

        const words = el.textContent.split(/ +/).filter(Boolean);
        const ww = words.map(w => { m.textContent = w; return m.getBoundingClientRect().width; });

        // Tschichold: word spacing tolerance = 'i' width
        m.textContent = 'i';
        const iWidth = m.getBoundingClientRect().width;

        // Bringhurst: column width = 2× alphabet length, min 1.5×
        m.textContent = 'abcdefghijklmnopqrstuvwxyz';
        const alphabetWidth = m.getBoundingClientRect().width;

        // Natural space width
        m.innerHTML = 'a b';
        const abSpace = m.getBoundingClientRect().width;
        m.textContent = 'ab';
        const abNoSpace = m.getBoundingClientRect().width;
        const spaceWidth = abSpace - abNoSpace;

        // Em width
        m.textContent = 'M';
        const emWidth = m.getBoundingClientRect().width;

        // Bringhurst measure quality
        const measureRatio = cw / alphabetWidth; // ideal: 1.5-2.0
        const charsPerLine = cw / (alphabetWidth / 26);

        return {
          cw, fontSize, lineHeight, leadingRatio,
          words, ww, iWidth, alphabetWidth, spaceWidth, emWidth,
          measureRatio, charsPerLine,
        };
      });

      const { cw, fontSize, leadingRatio, words, ww, iWidth, alphabetWidth, spaceWidth, emWidth, measureRatio, charsPerLine } = metrics;

      // ─── TYPOGRAPHIC QUALITY REPORT ───
      const measureGrade = measureRatio >= 1.5 && measureRatio <= 2.0 ? '✓' :
                           measureRatio >= 1.2 && measureRatio < 1.5 ? '⚠ narrow' :
                           measureRatio < 1.2 ? '✗ too narrow' : '⚠ wide';
      const leadingGrade = leadingRatio >= 1.2 && leadingRatio <= 1.5 ? '✓' :
                           leadingRatio > 1.5 && leadingRatio <= 1.7 ? '✓ generous' : '⚠';

      console.log(`  Bringhurst measure: ${measureRatio.toFixed(2)}× alphabet (${charsPerLine.toFixed(0)}ch) ${measureGrade}`);
      console.log(`  Ruder leading: ${(leadingRatio * 100).toFixed(0)}% ${leadingGrade}`);
      console.log(`  Tschichold 'i' width: ${iWidth.toFixed(1)}px (spacing tolerance unit)`);
      console.log(`  Space: ${spaceWidth.toFixed(1)}px = ${(spaceWidth / iWidth).toFixed(2)}i`);

      const n = words.length;

      // ─── BREAK QUALITY RULES ───
      const noEndLine = new Set();
      for (let i = 0; i < n - 1; i++) {
        const lower = words[i].toLowerCase().replace(/[.,;:!?'"\u201D\u2019]+$/, '');
        if (PREPOSITIONS.has(lower)) noEndLine.add(i);
        if (CONJUNCTIONS.has(lower)) noEndLine.add(i);
        if (ARTICLES.has(lower)) noEndLine.add(i);
        if (isSentenceEnd(words[i]) && i + 1 < n && /^[A-Z\u201C"]/.test(words[i + 1])) {
          noEndLine.add(i + 1);
        }
      }

      // ─── KNUTH-PLASS INSPIRED DP (ragged right, no hyphens) ───

      // Spacing tolerances derived from Tschichold's 'i' width
      const spaceTolerance = iWidth; // ±1 'i' width from natural
      const minSpace = spaceWidth - spaceTolerance;
      const optSpace = spaceWidth;
      const maxSpace = spaceWidth + spaceTolerance;

      function lineWidth(s, e) {
        let t = 0;
        for (let i = s; i < e; i++) t += ww[i];
        return t + (e - s - 1) * optSpace; // natural spacing
      }

      function lineBadness(s, e, isLast) {
        const lw = lineWidth(s, e);
        if (lw > cw * 1.005) return 1e9; // overflow
        const fill = lw / cw;
        const nw = e - s;
        let badness = 0;

        if (isLast) {
          if (nw === 1 && fill < 0.25) return 150; // orphan
          if (fill < 0.15) return 100;
          return 0;
        }

        // ─── KNUTH CUBIC BADNESS ───
        // deviation from ideal fill (0.85 target)
        const idealFill = 0.85;
        const deviation = Math.abs(fill - idealFill);
        // Cubic: small deviations are cheap, large are very expensive
        // Scale so that ±15% deviation = badness 100
        badness += Math.pow(deviation / 0.15, 3) * 100;

        // ─── BREAK QUALITY PENALTIES ───
        const lastIdx = e - 1;
        if (noEndLine.has(lastIdx)) badness += 500;

        // Short line penalty (< 3 words)
        if (nw <= 2 && fill < 0.55) badness += 150;

        // Very short line
        if (fill < 0.40) badness += 300;

        return badness;
      }

      // DP
      const dp = new Array(n + 1).fill(1e9);
      const prev = new Array(n + 1).fill(-1);
      dp[0] = 0;

      for (let i = 1; i <= n; i++) {
        for (let j = Math.max(0, i - 25); j < i; j++) {
          const cost = dp[j] + lineBadness(j, i, i === n);
          if (cost < dp[i]) { dp[i] = cost; prev[i] = j; }
        }
      }

      // Reconstruct
      const breaks = [];
      let pos = n;
      while (pos > 0) { breaks.unshift(pos); pos = prev[pos]; }

      // ─── PASS 2: RAG SMOOTHING (word-spacing + letter-spacing) ───
      const optLines = [];
      let start = 0;
      for (const end of breaks) {
        const lineWords = words.slice(start, end);
        const text = lineWords.join(' ');
        const lw = lineWidth(start, end);
        const fill = lw / cw;
        const isLast = end === n;
        const numGaps = lineWords.length - 1;
        const totalChars = lineWords.join('').length;
        optLines.push({ text, naturalWidth: lw, fill, isLast, numGaps, totalChars, start, end });
        start = end;
      }

      // Compute median target for non-last lines
      const nonLastFills = optLines.filter(l => !l.isLast).map(l => l.fill).sort((a, b) => a - b);
      const mid = Math.floor(nonLastFills.length / 2);
      const medianFill = nonLastFills.length % 2 === 0
        ? (nonLastFills[mid - 1] + nonLastFills[mid]) / 2
        : nonLastFills[mid];
      const targetWidth = medianFill * cw;

      // Apply spacing adjustments
      for (const line of optLines) {
        if (line.isLast || line.numGaps === 0) {
          line.ws = 0; line.ls = 0; line.adjFill = line.fill;
          continue;
        }

        const gap = targetWidth - line.naturalWidth;
        if (Math.abs(gap) < 1) {
          line.ws = 0; line.ls = 0; line.adjFill = line.fill;
          continue;
        }

        // Word-spacing: ±1 'i' width (Tschichold tolerance)
        const maxWS = spaceTolerance;
        const minWS = -spaceTolerance;
        let ws = gap / line.numGaps;
        ws = Math.max(minWS, Math.min(maxWS, ws));

        // Letter-spacing for remaining (max ±0.3px, ~3% of em)
        const maxLS = emWidth * 0.03;
        const wsGain = ws * line.numGaps;
        const remaining = gap - wsGain;
        let ls = 0;
        if (Math.abs(remaining) > 1 && line.totalChars > 0) {
          ls = remaining / line.totalChars;
          ls = Math.max(-maxLS * 0.5, Math.min(maxLS, ls));
        }

        const adjWidth = line.naturalWidth + ws * line.numGaps + ls * line.totalChars;
        line.ws = ws;
        line.ls = ls;
        line.adjFill = adjWidth / cw;
      }

      // Neighbor dampening (asymmetric: expansion 0.85, contraction 0.65)
      for (let i = 0; i < optLines.length - 1; i++) {
        const a = optLines[i], b = optLines[i + 1];
        if (a.ws * b.ws < 0) {
          if (a.ws > 0) { a.ws *= 0.85; a.ls *= 0.85; b.ws *= 0.65; b.ls *= 0.65; }
          else { a.ws *= 0.65; a.ls *= 0.65; b.ws *= 0.85; b.ls *= 0.85; }
        }
      }

      // Recalculate adjusted fills after dampening
      for (const line of optLines) {
        if (line.isLast || line.numGaps === 0) continue;
        const adjWidth = line.naturalWidth + line.ws * line.numGaps + line.ls * line.totalChars;
        line.adjFill = adjWidth / cw;
      }

      // ─── BROWSER DEFAULT ───
      const bLines = await page.evaluate(() => {
        const el = document.getElementById('d');
        const cs = getComputedStyle(el);
        const cw = el.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
        const words = el.textContent.split(/ +/).filter(Boolean);
        el.innerHTML = words.map((w, i) => `<span data-w="${i}">${w}</span>`).join(' ');
        const spans = el.querySelectorAll('span[data-w]');
        const result = []; let top = -1, cur = [];
        spans.forEach((s, i) => {
          const t = Math.round(s.getBoundingClientRect().top);
          if (top === -1) { top = t; cur = [i]; }
          else if (Math.abs(t - top) > 3) {
            const f = spans[cur[0]], l = spans[cur[cur.length - 1]];
            result.push({ text: cur.map(j => words[j]).join(' '), fill: Math.round((l.getBoundingClientRect().right - f.getBoundingClientRect().left) / cw * 100) });
            top = t; cur = [i];
          } else cur.push(i);
        });
        if (cur.length) { const f = spans[cur[0]], l = spans[cur[cur.length - 1]]; result.push({ text: cur.map(j => words[j]).join(' '), fill: Math.round((l.getBoundingClientRect().right - f.getBoundingClientRect().left) / cw * 100) }); }
        return result;
      });

      // ─── OUTPUT ───
      // Count break issues
      let bIssues = 0, oIssues = 0;
      let bWordIdx = 0;
      for (let li = 0; li < bLines.length; li++) {
        const bw = bLines[li].text.split(/ +/);
        const lastIdx = bWordIdx + bw.length - 1;
        if (li < bLines.length - 1 && noEndLine.has(lastIdx)) { bLines[li].flag = '⚠'; bIssues++; }
        bWordIdx += bw.length;
      }
      for (let li = 0; li < optLines.length; li++) {
        if (!optLines[li].isLast && noEndLine.has(optLines[li].end - 1)) oIssues++;
      }

      console.log(`\n  BROWSER (${bIssues} break issues):`);
      bLines.forEach((l, i) => console.log(`    L${i} [${l.fill}%] "${l.text}" ${l.flag || ''}`));

      console.log(`\n  OPTIMIZED + SMOOTHED (${oIssues} break issues):`);
      optLines.forEach((l, i) => {
        const natPct = Math.round(l.fill * 100);
        const adjPct = Math.round(l.adjFill * 100);
        const adj = [];
        if (Math.abs(l.ws) > 0.05) adj.push(`ws${l.ws > 0 ? '+' : ''}${l.ws.toFixed(1)}`);
        if (Math.abs(l.ls) > 0.02) adj.push(`ls${l.ls > 0 ? '+' : ''}${l.ls.toFixed(2)}`);
        const arrow = adjPct !== natPct ? `${natPct}→${adjPct}%` : `${natPct}%`;
        console.log(`    L${i} [${arrow}] "${l.text}" ${adj.join(' ')}`);
      });

      const bNL = bLines.slice(0, -1).map(l => l.fill);
      const oNL = optLines.filter(l => !l.isLast).map(l => Math.round(l.adjFill * 100));
      const bRange = bNL.length ? Math.max(...bNL) - Math.min(...bNL) : 0;
      const oRange = oNL.length ? Math.max(...oNL) - Math.min(...oNL) : 0;
      console.log(`\n  Fill range: ${bRange}% → ${oRange}%`);
      console.log(`  Break issues: ${bIssues} → ${oIssues}`);

      // ─── RENDER ───
      const htmlParts = optLines.map(l => {
        const styles = [];
        if (Math.abs(l.ws) > 0.05) styles.push(`word-spacing:${l.ws.toFixed(2)}px`);
        if (Math.abs(l.ls) > 0.02) styles.push(`letter-spacing:${l.ls.toFixed(2)}px`);
        return styles.length ? `<span style="${styles.join(';')}">${l.text}</span>` : l.text;
      });

      // Side by side screenshots
      await page.setContent(`<html><body style="background:#0a0a0a;margin:0;padding:16px">
        <div style="display:flex;gap:24px">
          <div>
            <div style="font-family:monospace;font-size:10px;color:#666;margin-bottom:8px;letter-spacing:0.05em">BROWSER DEFAULT</div>
            <div style="width:${width}px;${STYLE};padding:20px;border:1px solid #222">${sample.text}</div>
          </div>
          <div>
            <div style="font-family:monospace;font-size:10px;color:#666;margin-bottom:8px;letter-spacing:0.05em">OPTIMIZED + SMOOTHED</div>
            <div style="width:${width}px;${STYLE};padding:20px;border:1px solid #222;white-space:pre-line">${htmlParts.join('\n')}</div>
          </div>
        </div>
        <div style="font-family:monospace;font-size:9px;color:#444;margin-top:8px">${sample.label} @ ${width}px · measure: ${measureRatio.toFixed(2)}× · breaks: ${bIssues}→${oIssues} · range: ${bRange}%→${oRange}%</div>
      </body></html>`);
      await page.waitForTimeout(300);
      writeFileSync(join(OUT, `${sample.label}-${width}.png`), await page.screenshot());
    }
  }

  await browser.close();
  console.log('\nDone!');
}
run();
