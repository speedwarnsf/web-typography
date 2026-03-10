/**
 * Paragraph Optimizer v4 — CORRECT spacing tolerances
 * 
 * CRITICAL FIX: word-spacing is ADDITIVE to natural space.
 *   word-spacing: -5px with natural 4.3px = -0.7px = WORDS MERGE
 * 
 * Correct tolerances (Tschichold/InDesign/Bringhurst):
 *   Min word space: 80% of natural  → max tightening = 0.2 × natural
 *   Opt word space: 100% of natural → 0 adjustment
 *   Max word space: 133% of natural → max expansion = 0.33 × natural
 *   Letter-spacing: ±3% of em (secondary lever only)
 */

import { chromium } from 'playwright';
import { writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';

const OUT = join(import.meta.dirname, '..', 'test-rag-output', 'v4');
mkdirSync(OUT, { recursive: true });

const SAMPLES = [
  { label: "original", text: "Good typography is invisible. Great typography speaks to the reader without raising its voice. The choices behind a well-set paragraph are deliberate, quiet, and precise. Every refinement serves the text and nothing calls attention to itself." },
  { label: "long-academic", text: "Interdisciplinary communication requires an acknowledgement of counterproductive oversimplification. Professionalism in typographic craftsmanship demands uncompromising attention to detail." },
  { label: "reading-lab", text: "Typography is the visual voice of language. When text is set with care \u2014 the right measure, the right leading, the right weight \u2014 reading becomes effortless. When it\u2019s cramped or loose, rhythm falters and the eye fatigues." },
  { label: "rhetoric-pathos", text: "Pathos is the emotional layer \u2014 the warmth of a serif, the sharpness of a sans, the rhythm of a well-set paragraph. Type can evoke calm, urgency, warmth, or dramatic impact." },
];

const WIDTHS = [310, 340, 360];
const STYLE = `font-family: Georgia, serif; font-size: 18px; line-height: 1.7; color: #d4d4d4;`;

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
        const words = el.textContent.split(/ +/).filter(Boolean);
        const ww = words.map(w => { m.textContent = w; return m.getBoundingClientRect().width; });
        m.innerHTML = 'a b'; const ab = m.getBoundingClientRect().width;
        m.textContent = 'ab'; const sp = ab - m.getBoundingClientRect().width;
        m.textContent = 'M'; const em = m.getBoundingClientRect().width;
        m.textContent = 'abcdefghijklmnopqrstuvwxyz';
        const alpha = m.getBoundingClientRect().width;
        return { cw, words, ww, sp, em, alpha };
      });

      const { cw, words, ww, sp, em, alpha } = metrics;
      const n = words.length;

      // CORRECT spacing tolerances
      const maxTighten = sp * 0.20;  // 80% of natural = tighten by 20%
      const maxExpand = sp * 0.33;   // 133% of natural = expand by 33%
      const maxLS = em * 0.02;       // ±2% of em (conservative)

      console.log(`  space: ${sp.toFixed(1)}px, tighten max: ${maxTighten.toFixed(1)}px, expand max: ${maxExpand.toFixed(1)}px`);
      console.log(`  measure: ${(cw / alpha).toFixed(2)}× alphabet`);

      // Break quality rules
      const noEndLine = new Set();
      for (let i = 0; i < n - 1; i++) {
        const lower = words[i].toLowerCase().replace(/[.,;:!?'"\u201D\u2019]+$/, '');
        if (PREPOSITIONS.has(lower)) noEndLine.add(i);
        if (CONJUNCTIONS.has(lower)) noEndLine.add(i);
        if (ARTICLES.has(lower)) noEndLine.add(i);
        if (isSentenceEnd(words[i]) && i + 1 < n && /^[A-Z\u201C"]/.test(words[i + 1])) noEndLine.add(i + 1);
      }

      // Line width at natural spacing
      function lineWidth(s, e) {
        let t = 0;
        for (let i = s; i < e; i++) t += ww[i];
        return t + (e - s - 1) * sp;
      }

      // Knuth cubic badness
      function lineBadness(s, e, isLast) {
        const lw = lineWidth(s, e);
        if (lw > cw * 1.005) return 1e9;
        const fill = lw / cw;
        const nw = e - s;
        let badness = 0;

        if (isLast) {
          if (nw === 1 && fill < 0.25) return 150;
          if (fill < 0.15) return 100;
          return 0;
        }

        // Cubic badness: deviation from 0.85 target
        const deviation = Math.abs(fill - 0.85);
        badness += Math.pow(deviation / 0.15, 3) * 100;

        // Break quality
        if (noEndLine.has(e - 1)) badness += 500;
        if (nw <= 2 && fill < 0.55) badness += 150;
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

      const breaks = [];
      let pos = n;
      while (pos > 0) { breaks.unshift(pos); pos = prev[pos]; }

      // Build lines
      const optLines = [];
      let start = 0;
      for (const end of breaks) {
        const text = words.slice(start, end).join(' ');
        const lw = lineWidth(start, end);
        const fill = lw / cw;
        const isLast = end === n;
        const numGaps = (end - start) - 1;
        const totalChars = words.slice(start, end).join('').length;
        optLines.push({ text, naturalWidth: lw, fill, isLast, numGaps, totalChars, start, end });
        start = end;
      }

      // Pass 2: GENTLE rag smoothing with CORRECT tolerances
      const nonLastFills = optLines.filter(l => !l.isLast).map(l => l.fill).sort((a, b) => a - b);
      const mid = Math.floor(nonLastFills.length / 2);
      const medianFill = nonLastFills.length % 2 === 0
        ? (nonLastFills[mid - 1] + nonLastFills[mid]) / 2 : nonLastFills[mid];
      const targetWidth = medianFill * cw;

      for (const line of optLines) {
        line.ws = 0; line.ls = 0; line.adjFill = line.fill;
        if (line.isLast || line.numGaps === 0) continue;

        const gap = targetWidth - line.naturalWidth;
        if (Math.abs(gap) < 1) continue;

        // Word-spacing: within Tschichold tolerances
        let wsPerGap = gap / line.numGaps;
        wsPerGap = Math.max(-maxTighten, Math.min(maxExpand, wsPerGap));

        // Letter-spacing for remaining (very conservative)
        const wsGain = wsPerGap * line.numGaps;
        const remaining = gap - wsGain;
        let ls = 0;
        if (Math.abs(remaining) > 1 && line.totalChars > 0) {
          ls = remaining / line.totalChars;
          ls = Math.max(-maxLS * 0.5, Math.min(maxLS, ls));
        }

        line.ws = wsPerGap;
        line.ls = ls;
        const adjWidth = line.naturalWidth + wsPerGap * line.numGaps + ls * line.totalChars;
        line.adjFill = adjWidth / cw;
      }

      // Browser default
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
          else if (Math.abs(t - top) > 3) { const f = spans[cur[0]], l = spans[cur[cur.length - 1]]; result.push({ text: cur.map(j => words[j]).join(' '), fill: Math.round((l.getBoundingClientRect().right - f.getBoundingClientRect().left) / cw * 100) }); top = t; cur = [i]; }
          else cur.push(i);
        });
        if (cur.length) { const f = spans[cur[0]], l = spans[cur[cur.length - 1]]; result.push({ text: cur.map(j => words[j]).join(' '), fill: Math.round((l.getBoundingClientRect().right - f.getBoundingClientRect().left) / cw * 100) }); }
        return result;
      });

      // Count issues
      let bIssues = 0, bWordIdx = 0;
      for (let li = 0; li < bLines.length; li++) {
        const bw = bLines[li].text.split(/ +/);
        const lastIdx = bWordIdx + bw.length - 1;
        if (li < bLines.length - 1 && noEndLine.has(lastIdx)) { bLines[li].flag = '⚠'; bIssues++; }
        bWordIdx += bw.length;
      }
      const oIssues = optLines.filter((l, i) => !l.isLast && noEndLine.has(l.end - 1)).length;

      console.log(`\n  BROWSER (${bIssues} issues):`);
      bLines.forEach((l, i) => console.log(`    L${i} [${l.fill}%] "${l.text}" ${l.flag || ''}`));

      console.log(`\n  OPTIMIZED (${oIssues} issues):`);
      optLines.forEach((l, i) => {
        const natPct = Math.round(l.fill * 100);
        const adjPct = Math.round(l.adjFill * 100);
        const adj = [];
        if (Math.abs(l.ws) > 0.05) adj.push(`ws${l.ws > 0 ? '+' : ''}${l.ws.toFixed(2)}`);
        if (Math.abs(l.ls) > 0.02) adj.push(`ls${l.ls > 0 ? '+' : ''}${l.ls.toFixed(2)}`);
        const arrow = adjPct !== natPct ? `${natPct}→${adjPct}%` : `${natPct}%`;
        console.log(`    L${i} [${arrow}] "${l.text}" ${adj.join(' ')}`);
      });

      const bNL = bLines.slice(0, -1).map(l => l.fill);
      const oNL = optLines.filter(l => !l.isLast).map(l => Math.round(l.adjFill * 100));
      const bRange = bNL.length ? Math.max(...bNL) - Math.min(...bNL) : 0;
      const oRange = oNL.length ? Math.max(...oNL) - Math.min(...oNL) : 0;
      console.log(`\n  Range: ${bRange}% → ${oRange}%  |  Breaks: ${bIssues} → ${oIssues}`);

      // Side-by-side render
      const htmlParts = optLines.map(l => {
        const styles = [];
        if (Math.abs(l.ws) > 0.05) styles.push(`word-spacing:${l.ws.toFixed(2)}px`);
        if (Math.abs(l.ls) > 0.02) styles.push(`letter-spacing:${l.ls.toFixed(2)}px`);
        return styles.length ? `<span style="${styles.join(';')}">${l.text}</span>` : l.text;
      });

      await page.setContent(`<html><body style="background:#0a0a0a;margin:0;padding:16px">
        <div style="display:flex;gap:24px">
          <div>
            <div style="font-family:monospace;font-size:10px;color:#666;margin-bottom:8px">BROWSER</div>
            <div style="width:${width}px;${STYLE};padding:20px;border:1px solid #222">${sample.text}</div>
          </div>
          <div>
            <div style="font-family:monospace;font-size:10px;color:#666;margin-bottom:8px">OPTIMIZED</div>
            <div style="width:${width}px;${STYLE};padding:20px;border:1px solid #222;white-space:pre-line">${htmlParts.join('\n')}</div>
          </div>
        </div>
        <div style="font-family:monospace;font-size:9px;color:#444;margin-top:8px">${sample.label} @ ${width}px · range: ${bRange}%→${oRange}% · breaks: ${bIssues}→${oIssues} · ws: -${maxTighten.toFixed(1)}/+${maxExpand.toFixed(1)}px</div>
      </body></html>`);
      await page.waitForTimeout(300);
      writeFileSync(join(OUT, `${sample.label}-${width}.png`), await page.screenshot());
    }
  }

  await browser.close();
  console.log('\nDone!');
}
run();
