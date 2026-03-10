/**
 * Paragraph Optimizer v6 — Probabilistic Breaking
 * 
 * New in v6:
 *   - Monte Carlo probabilistic breaking (Bouckaert variant)
 *   - Run DP 20 times with randomly perturbed penalty weights
 *   - Score each candidate by contour quality (not just badness)
 *   - Pick the most organic rag from near-optimal solutions
 *   - Fibonacci font-to-measure diagnostic
 *   - Contour quality metrics: stddev, max step, alternation score
 */

import { chromium } from 'playwright';
import { writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';

const OUT = join(import.meta.dirname, '..', 'test-rag-output', 'v6');
mkdirSync(OUT, { recursive: true });

const PHI = 1.618033988749895;
const MC_ITERATIONS = 20;

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

// Seeded random for reproducibility
function mulberry32(seed) {
  return function() {
    let t = seed += 0x6D2B79F5;
    t = Math.imul(t ^ t >>> 15, t | 1);
    t ^= t + Math.imul(t ^ t >>> 7, t | 61);
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

function runDP(words, ww, sp, cw, noEndLine, perturbation, rng) {
  const n = words.length;
  
  // Perturbed penalties — base ± random factor
  const breakPenalty = 500 * (1 + perturbation * (rng() - 0.5));
  const stepPenaltyLarge = 200 * (1 + perturbation * (rng() - 0.5));
  const stepPenaltyMod = 80 * (1 + perturbation * (rng() - 0.5));
  const shortLinePenalty = 300 * (1 + perturbation * (rng() - 0.5));
  const thinLinePenalty = 150 * (1 + perturbation * (rng() - 0.5));
  const targetFill = 0.85 + perturbation * 0.05 * (rng() - 0.5); // 0.825–0.875

  function lineWidth(s, e) {
    let t = 0; for (let i = s; i < e; i++) t += ww[i];
    return t + (e - s - 1) * sp;
  }

  function lineBadness(s, e, isLast, prevFill) {
    const lw = lineWidth(s, e);
    if (lw > cw * 1.005) return 1e9;
    const fill = lw / cw;
    const nw = e - s;
    let badness = 0;

    if (isLast) {
      if (nw === 1 && fill < 0.25) return thinLinePenalty;
      if (fill < 0.15) return 100;
      return 0;
    }

    // Cubic badness
    const deviation = Math.abs(fill - targetFill);
    badness += Math.pow(deviation / 0.15, 3) * 100;

    // Stairstep demerits
    if (prevFill !== null) {
      const step = Math.abs(fill - prevFill);
      if (step > 0.15) badness += stepPenaltyLarge;
      else if (step > 0.10) badness += stepPenaltyMod;
    }

    // Break quality
    if (noEndLine.has(e - 1)) badness += breakPenalty;
    if (nw <= 2 && fill < 0.55) badness += thinLinePenalty;
    if (fill < 0.40) badness += shortLinePenalty;

    return badness;
  }

  const dp = new Array(n + 1).fill(null);
  dp[0] = { cost: 0, prev: -1, fill: null };

  for (let i = 1; i <= n; i++) {
    let best = { cost: 1e9, prev: -1, fill: 0 };
    for (let j = Math.max(0, i - 25); j < i; j++) {
      if (!dp[j] || dp[j].cost >= 1e9) continue;
      const isLast = i === n;
      const lw = lineWidth(j, i);
      const fill = lw / cw;
      const cost = dp[j].cost + lineBadness(j, i, isLast, dp[j].fill);
      if (cost < best.cost) best = { cost, prev: j, fill };
    }
    dp[i] = best;
  }

  // Reconstruct
  const breaks = [];
  let pos = n;
  while (pos > 0) { breaks.unshift(pos); pos = dp[pos].prev; }

  // Build lines
  const lines = [];
  let start = 0;
  for (const end of breaks) {
    const lw = lineWidth(start, end);
    const fill = lw / cw;
    const isLast = end === n;
    const hasBreakViolation = !isLast && noEndLine.has(end - 1);
    lines.push({ start, end, fill, isLast, hasBreakViolation, text: words.slice(start, end).join(' '), naturalWidth: lw, numGaps: (end - start) - 1, totalChars: words.slice(start, end).join('').length });
    start = end;
  }

  return { lines, totalCost: dp[n].cost };
}

// Contour quality scoring — lower is better
function contourScore(lines) {
  const nonLast = lines.filter(l => !l.isLast);
  if (nonLast.length < 2) return { score: 0, stddev: 0, maxStep: 0, alternation: 0, breakViolations: 0 };

  const fills = nonLast.map(l => l.fill);
  const mean = fills.reduce((a, b) => a + b, 0) / fills.length;
  const variance = fills.reduce((a, f) => a + (f - mean) ** 2, 0) / fills.length;
  const stddev = Math.sqrt(variance);

  // Max stairstep
  let maxStep = 0;
  for (let i = 1; i < fills.length; i++) {
    maxStep = Math.max(maxStep, Math.abs(fills[i] - fills[i - 1]));
  }

  // Alternation score: gentle back-and-forth is better than monotonic runs
  // Count direction changes (more = more organic)
  let dirChanges = 0;
  for (let i = 2; i < fills.length; i++) {
    const prev = fills[i - 1] - fills[i - 2];
    const curr = fills[i] - fills[i - 1];
    if ((prev > 0.01 && curr < -0.01) || (prev < -0.01 && curr > 0.01)) dirChanges++;
  }
  const alternation = fills.length > 2 ? dirChanges / (fills.length - 2) : 0;

  // Break violations
  const breakViolations = lines.filter(l => l.hasBreakViolation).length;

  // Composite score (lower = better)
  // Heavily penalize break violations, then stddev, then steps
  const score = breakViolations * 1000 + stddev * 100 + maxStep * 50 - alternation * 20;

  return { score, stddev, maxStep, alternation, breakViolations };
}

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
        const fontSize = parseFloat(cs.fontSize);
        const lineHeight = parseFloat(cs.lineHeight);
        const words = el.textContent.split(/ +/).filter(Boolean);
        const ww = words.map(w => { m.textContent = w; return m.getBoundingClientRect().width; });
        m.innerHTML = 'a b'; const ab = m.getBoundingClientRect().width;
        m.textContent = 'ab'; const sp = ab - m.getBoundingClientRect().width;
        m.textContent = 'M'; const em = m.getBoundingClientRect().width;
        m.textContent = 'abcdefghijklmnopqrstuvwxyz';
        const alpha = m.getBoundingClientRect().width;
        return { cw, fontSize, lineHeight, words, ww, sp, em, alpha };
      });

      const { cw, fontSize, lineHeight, words, ww, sp, em, alpha } = metrics;

      // Diagnostics
      const grtHeight = fontSize * (PHI + (cw / fontSize - PHI) / 100);
      const grtRatio = grtHeight / fontSize;
      const actualRatio = lineHeight / fontSize;
      const measureRatio = cw / alpha;
      const fibIdeal = cw / PHI;

      // Spacing tolerances
      const maxTighten = sp * 0.20;
      const maxExpand = sp * 0.33;
      const maxLS = em * 0.02;

      console.log(`  Bringhurst: ${measureRatio.toFixed(2)}× alphabet`);
      console.log(`  Fibonacci: ideal font ${fibIdeal.toFixed(0)}px (actual ${fontSize}px)`);
      console.log(`  GRT: optimal lh ${grtRatio.toFixed(3)} (actual ${actualRatio.toFixed(3)})`);

      // Break quality rules
      const noEndLine = new Set();
      for (let i = 0; i < words.length - 1; i++) {
        const lower = words[i].toLowerCase().replace(/[.,;:!?'"\u201D\u2019]+$/, '');
        if (PREPOSITIONS.has(lower)) noEndLine.add(i);
        if (CONJUNCTIONS.has(lower)) noEndLine.add(i);
        if (ARTICLES.has(lower)) noEndLine.add(i);
        if (isSentenceEnd(words[i]) && i + 1 < words.length && /^[A-Z\u201C"]/.test(words[i + 1])) noEndLine.add(i + 1);
      }

      // ─── MONTE CARLO: Run DP 20 times with perturbed weights ───
      const candidates = [];
      const rng = mulberry32(42 + width); // deterministic but varied per width

      // Iteration 0: deterministic (perturbation = 0)
      candidates.push(runDP(words, ww, sp, cw, noEndLine, 0, rng));

      // Iterations 1-19: perturbed
      for (let iter = 1; iter < MC_ITERATIONS; iter++) {
        const perturbation = 0.3 + (iter / MC_ITERATIONS) * 0.4; // 0.3 to 0.7
        candidates.push(runDP(words, ww, sp, cw, noEndLine, perturbation, mulberry32(42 + width + iter * 1000)));
      }

      // Score each candidate by contour quality
      const scored = candidates.map((c, i) => ({
        ...c,
        iteration: i,
        contour: contourScore(c.lines)
      }));

      // Sort by contour score (lower = better), but only among solutions with zero break violations
      scored.sort((a, b) => a.contour.score - b.contour.score);

      const best = scored[0];
      const deterministic = scored.find(s => s.iteration === 0);

      console.log(`\n  Monte Carlo: ${MC_ITERATIONS} iterations`);
      console.log(`  Deterministic: contour=${deterministic.contour.score.toFixed(1)} (stddev=${deterministic.contour.stddev.toFixed(3)}, maxStep=${(deterministic.contour.maxStep * 100).toFixed(0)}%, alt=${deterministic.contour.alternation.toFixed(2)}, breaks=${deterministic.contour.breakViolations})`);
      console.log(`  Best (iter ${best.iteration}): contour=${best.contour.score.toFixed(1)} (stddev=${best.contour.stddev.toFixed(3)}, maxStep=${(best.contour.maxStep * 100).toFixed(0)}%, alt=${best.contour.alternation.toFixed(2)}, breaks=${best.contour.breakViolations})`);
      
      if (best.iteration !== 0) {
        console.log(`  ✨ Probabilistic found better contour! (iter ${best.iteration})`);
      } else {
        console.log(`  Deterministic was already best.`);
      }

      // Show top 3
      console.log(`\n  Top 3 candidates:`);
      for (let i = 0; i < Math.min(3, scored.length); i++) {
        const s = scored[i];
        const fills = s.lines.filter(l => !l.isLast).map(l => Math.round(l.fill * 100)).join(',');
        console.log(`    #${i + 1} iter=${s.iteration} contour=${s.contour.score.toFixed(1)} fills=[${fills}] breaks=${s.contour.breakViolations}`);
      }

      const optLines = best.lines;

      // Pass 2: Rag smoothing with Tschichold tolerances
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
        let wsPerGap = gap / line.numGaps;
        wsPerGap = Math.max(-maxTighten, Math.min(maxExpand, wsPerGap));
        const wsGain = wsPerGap * line.numGaps;
        const remaining = gap - wsGain;
        let ls = 0;
        if (Math.abs(remaining) > 1 && line.totalChars > 0) {
          ls = remaining / line.totalChars;
          ls = Math.max(-maxLS * 0.5, Math.min(maxLS, ls));
        }
        line.ws = wsPerGap; line.ls = ls;
        line.adjFill = (line.naturalWidth + wsPerGap * line.numGaps + ls * line.totalChars) / cw;
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

      // Analysis
      let bIssues = 0, bWordIdx = 0;
      for (let li = 0; li < bLines.length; li++) {
        const bw = bLines[li].text.split(/ +/);
        const lastIdx = bWordIdx + bw.length - 1;
        if (li < bLines.length - 1 && noEndLine.has(lastIdx)) { bLines[li].flag = '⚠'; bIssues++; }
        bWordIdx += bw.length;
      }
      const oIssues = optLines.filter(l => !l.isLast && l.hasBreakViolation).length;

      function countSteps(lines) {
        let s = 0;
        for (let i = 1; i < lines.length - 1; i++) {
          if (Math.abs(lines[i].fill - lines[i - 1].fill) > 0.10) s++;
        }
        return s;
      }

      const bSteps = countSteps(bLines.map(l => ({ fill: l.fill / 100 })));
      const oSteps = countSteps(optLines);

      console.log(`\n  BROWSER (${bIssues} breaks, ${bSteps} steps):`);
      bLines.forEach((l, i) => console.log(`    L${i} [${l.fill}%] "${l.text}" ${l.flag || ''}`));

      console.log(`\n  OPTIMIZED (${oIssues} breaks, ${oSteps} steps):`);
      optLines.forEach((l, i) => {
        const adjPct = Math.round(l.adjFill * 100);
        const natPct = Math.round(l.fill * 100);
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
      console.log(`\n  Range: ${bRange}% → ${oRange}%  |  Breaks: ${bIssues}→${oIssues}  |  Steps: ${bSteps}→${oSteps}`);

      // Render
      const htmlParts = optLines.map(l => {
        const styles = [];
        if (Math.abs(l.ws) > 0.05) styles.push(`word-spacing:${l.ws.toFixed(2)}px`);
        if (Math.abs(l.ls) > 0.02) styles.push(`letter-spacing:${l.ls.toFixed(2)}px`);
        return styles.length ? `<span style="${styles.join(';')}">${l.text}</span>` : l.text;
      });

      const mcNote = best.iteration === 0 ? 'deterministic was best' : `probabilistic iter ${best.iteration} won`;

      await page.setContent(`<html><body style="background:#0a0a0a;margin:0;padding:16px">
        <div style="display:flex;gap:24px">
          <div>
            <div style="font-family:monospace;font-size:10px;color:#666;margin-bottom:8px">BROWSER</div>
            <div style="width:${width}px;${STYLE};padding:20px;border:1px solid #222">${sample.text}</div>
          </div>
          <div>
            <div style="font-family:monospace;font-size:10px;color:#666;margin-bottom:8px">OPTIMIZED (v6 MC)</div>
            <div style="width:${width}px;${STYLE};padding:20px;border:1px solid #222;white-space:pre-line">${htmlParts.join('\n')}</div>
          </div>
        </div>
        <div style="font-family:monospace;font-size:9px;color:#444;margin-top:8px">${sample.label} @ ${width}px · range ${bRange}→${oRange}% · breaks ${bIssues}→${oIssues} · steps ${bSteps}→${oSteps} · ${mcNote} · GRT=${grtRatio.toFixed(2)} · Fib=${fibIdeal.toFixed(0)}px</div>
      </body></html>`);
      await page.waitForTimeout(300);
      writeFileSync(join(OUT, `${sample.label}-${width}.png`), await page.screenshot());
    }
  }

  await browser.close();
  console.log('\n\nDone! All renders in test-rag-output/v6/');
}
run();
