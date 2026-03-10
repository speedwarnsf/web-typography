import { chromium } from 'playwright';
import { join } from 'path';

const SAMPLES = [
  { label: "pairing-card", text: "Good typography is invisible. Great typography speaks to the reader without raising its voice. The choices behind a well-set paragraph are deliberate, quiet, and precise.", font: "Georgia, serif", size: "16px", lh: "1.65" },
  { label: "rhetoric-ethos", text: "Ethos in typography means choosing typefaces and layouts that signal credibility, authority, and professionalism \u2014 earning the reader\u2019s trust before they read a single word.", font: "Georgia, serif", size: "16px", lh: "1.65" },
  { label: "rhetoric-pathos", text: "Pathos is the emotional layer \u2014 the warmth of a serif, the sharpness of a sans, the rhythm of a well-set paragraph. Type can evoke calm, urgency, warmth, or dramatic impact.", font: "Georgia, serif", size: "16px", lh: "1.65" },
  { label: "varfonts-hero", text: "Manipulate variation axes in real time. Animate between extremes. Compare configurations. Generate production-ready CSS.", font: "Georgia, serif", size: "18px", lh: "1.6" },
  { label: "font-dna", text: "Drop a font file and CSS to extract fonts, scales, spacing, and patterns into reusable design tokens.", font: "Georgia, serif", size: "18px", lh: "1.6" },
  { label: "reading-lab", text: "Typography is the visual voice of language. When text is set with care \u2014 the right measure, the right leading, the right weight \u2014 reading becomes effortless. When it\u2019s cramped or loose, rhythm falters and the eye fatigues. The reader loses focus, backs up, or gives up entirely. Good type disappears. The reader forgets they\u2019re reading and simply understands.", font: "Georgia, serif", size: "18px", lh: "1.65" },
];

const WIDTHS = [310, 340, 360];

async function smoothV2(page) {
  return page.evaluate(() => {
    const el = document.getElementById('d');
    const cs = getComputedStyle(el);
    const containerWidth = el.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
    const lineHeight = parseFloat(cs.lineHeight) / parseFloat(cs.fontSize) || 1.5;
    const text = el.textContent;
    const words = text.split(/ +/).filter(Boolean);
    if (words.length < 4) return [];

    // Line-height adaptive scaling
    const lhScale = 1 + (lineHeight - 1.5) * 1.0;
    const MAX_WS_EXPAND = 3.0 * lhScale;
    const MAX_WS_TIGHTEN = 2.0 * lhScale;
    const MAX_LS = 0.4 * lhScale; // letter-spacing cap (px)

    // Detect lines
    el.innerHTML = words.map((w, i) => `<span data-w="${i}">${w}</span>`).join(' ');
    const wordSpans = el.querySelectorAll('span[data-w]');
    const lines = [];
    let currentTop = -1, currentLine = [];
    wordSpans.forEach((span, idx) => {
      const top = Math.round(span.getBoundingClientRect().top);
      if (currentTop === -1) { currentTop = top; currentLine = [idx]; }
      else if (Math.abs(top - currentTop) > 3) {
        const f = wordSpans[currentLine[0]], l = wordSpans[currentLine[currentLine.length - 1]];
        lines.push({ indices: currentLine, width: l.getBoundingClientRect().right - f.getBoundingClientRect().left });
        currentTop = top; currentLine = [idx];
      } else { currentLine.push(idx); }
    });
    if (currentLine.length) {
      const f = wordSpans[currentLine[0]], l = wordSpans[currentLine[currentLine.length - 1]];
      lines.push({ indices: currentLine, width: l.getBoundingClientRect().right - f.getBoundingClientRect().left });
    }
    if (lines.length < 2) { el.innerHTML = words.join(' '); return []; }

    // Target: median of non-last
    const nonLastWidths = lines.slice(0, -1).map(l => l.width).sort((a, b) => a - b);
    const mid = Math.floor(nonLastWidths.length / 2);
    let target = nonLastWidths.length % 2 === 0
      ? (nonLastWidths[mid - 1] + nonLastWidths[mid]) / 2 : nonLastWidths[mid];

    // Anti-justification pulldown
    const avgFill = nonLastWidths.reduce((s, w) => s + w, 0) / nonLastWidths.length / containerWidth;
    const lastFill = lines[lines.length - 1].width / containerWidth;
    if (avgFill > 0.88 && lastFill < 0.60 && lines.length > 2) {
      target = Math.min(target, containerWidth * 0.82);
    }

    // Compute per-line adjustments: word-spacing delta + letter-spacing
    const adjustments = lines.map((line, i) => {
      const isLast = i === lines.length - 1;
      const lineWords = line.indices.map(idx => words[idx]);
      const lineText = lineWords.join(' ');
      const spaces = lineWords.length - 1;
      const charCount = lineText.replace(/\s/g, '').length;
      const gap = target - line.width;

      if (isLast || spaces === 0 || Math.abs(gap) <= 1) {
        return { ws: 0, ls: 0, text: lineText, origWidth: line.width };
      }

      // Primary: word-spacing
      const rawWsDelta = gap / spaces;
      let ws = rawWsDelta > 0
        ? Math.min(MAX_WS_EXPAND, rawWsDelta)
        : Math.max(-MAX_WS_TIGHTEN, rawWsDelta * 0.7);

      // How much gap does word-spacing cover?
      const wsCoverage = ws * spaces;
      const remaining = gap - wsCoverage;

      // Secondary: letter-spacing for remaining gap (expansion only)
      let ls = 0;
      if (remaining > 2 && charCount > 0) {
        ls = Math.min(MAX_LS, remaining / charCount);
      } else if (remaining < -2 && charCount > 0) {
        ls = Math.max(-MAX_LS * 0.5, remaining / charCount); // less aggressive tightening via ls
      }

      return { ws, ls, text: lineText, origWidth: line.width };
    });

    // Asymmetric neighbor dampening
    for (let i = 0; i < adjustments.length - 1; i++) {
      const a = adjustments[i], b = adjustments[i + 1];
      if (a.ws * b.ws < 0) { // opposite directions
        // Expansion gets lighter dampening (0.85), contraction gets heavier (0.65)
        if (a.ws > 0) { a.ws *= 0.85; a.ls *= 0.85; b.ws *= 0.65; b.ls *= 0.65; }
        else { a.ws *= 0.65; a.ls *= 0.65; b.ws *= 0.85; b.ls *= 0.85; }
      }
    }

    // Anti-justification check
    const adjWidths = adjustments.map((a, i) => {
      const spaces = lines[i].indices.length - 1;
      const charCount = a.text.replace(/\s/g, '').length;
      return a.origWidth + a.ws * spaces + a.ls * charCount;
    });
    const adjFills = adjWidths.slice(0, -1).map(w => w / containerWidth);
    const minF = Math.min(...adjFills), maxF = Math.max(...adjFills);
    if (minF > 0.92 && maxF - minF < 0.04) {
      adjustments.forEach(a => { a.ws *= 0.5; a.ls *= 0.5; });
    }

    // Build HTML
    const htmlParts = [], lineData = [];
    for (let i = 0; i < adjustments.length; i++) {
      const a = adjustments[i];
      const spaces = lines[i].indices.length - 1;
      const charCount = a.text.replace(/\s/g, '').length;
      const adjW = a.origWidth + a.ws * spaces + a.ls * charCount;
      const origPct = Math.round(a.origWidth / containerWidth * 100);
      const adjPct = Math.round(adjW / containerWidth * 100);
      lineData.push({ text: a.text, orig: origPct, adj: adjPct, ws: +a.ws.toFixed(2), ls: +a.ls.toFixed(2) });

      const styles = [];
      if (Math.abs(a.ws) > 0.05) styles.push(`word-spacing:${a.ws.toFixed(2)}px`);
      if (Math.abs(a.ls) > 0.05) styles.push(`letter-spacing:${a.ls.toFixed(2)}px`);
      if (styles.length) {
        htmlParts.push(`<span style="${styles.join(';')}">${a.text}</span>`);
      } else {
        htmlParts.push(a.text);
      }
    }
    el.style.whiteSpace = 'pre-line';
    el.innerHTML = htmlParts.join('\n');
    return lineData;
  });
}

async function run() {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ deviceScaleFactor: 2 });
  const page = await ctx.newPage();

  for (const sample of SAMPLES) {
    console.log(`\n${'═'.repeat(70)}`);
    console.log(sample.label);
    console.log(`${'═'.repeat(70)}`);

    for (const width of WIDTHS) {
      const style = `font-family:${sample.font};font-size:${sample.size};line-height:${sample.lh};color:#d4d4d4`;

      // Baseline
      await page.setContent(`<html><body style="background:#0a0a0a;margin:0;padding:0"><div id="d" style="width:${width}px;${style};padding:16px">${sample.text}</div></body></html>`);
      await page.waitForTimeout(200);
      const baseLines = await page.evaluate(() => {
        const el = document.getElementById('d');
        const cs = getComputedStyle(el);
        const cw = el.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
        const words = el.textContent.split(/ +/).filter(Boolean);
        el.innerHTML = words.map((w, i) => `<span data-w="${i}">${w}</span>`).join(' ');
        const spans = el.querySelectorAll('span[data-w]');
        const lines = []; let top = -1, cur = [];
        spans.forEach((s, i) => {
          const t = Math.round(s.getBoundingClientRect().top);
          if (top === -1) { top = t; cur = [i]; }
          else if (Math.abs(t - top) > 3) {
            const f = spans[cur[0]], l = spans[cur[cur.length-1]];
            lines.push(Math.round((l.getBoundingClientRect().right - f.getBoundingClientRect().left) / cw * 100));
            top = t; cur = [i];
          } else cur.push(i);
        });
        if (cur.length) { const f = spans[cur[0]], l = spans[cur[cur.length-1]]; lines.push(Math.round((l.getBoundingClientRect().right - f.getBoundingClientRect().left) / cw * 100)); }
        el.innerHTML = words.join(' ');
        return lines;
      });

      // Smoothed
      await page.setContent(`<html><body style="background:#0a0a0a;margin:0;padding:0"><div id="d" style="width:${width}px;${style};padding:16px">${sample.text}</div></body></html>`);
      await page.waitForTimeout(200);
      const result = await smoothV2(page);

      const bNL = baseLines.slice(0, -1);
      const sNL = result.map(l => l.adj).slice(0, -1);
      const bRange = bNL.length ? Math.max(...bNL) - Math.min(...bNL) : 0;
      const sRange = sNL.length ? Math.max(...sNL) - Math.min(...sNL) : 0;
      const grade = sRange <= 4 ? '★★★' : sRange <= 8 ? '★★' : sRange <= 12 ? '★' : '·';

      console.log(`  ${width}px ${grade} ${bRange}→${sRange}  ${result.map(l => {
        const d = [];
        if (l.ws) d.push(`ws${l.ws > 0 ? '+' : ''}${l.ws}`);
        if (l.ls) d.push(`ls${l.ls > 0 ? '+' : ''}${l.ls}`);
        return `${l.adj}%${d.length ? '(' + d.join(',') + ')' : ''}`;
      }).join('  ')}`);
    }
  }
  await browser.close();
  console.log('\nDone!');
}
run();
