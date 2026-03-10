import { chromium } from 'playwright';
import { join } from 'path';

const STYLE = `font-family: Georgia, 'Times New Roman', serif; font-size: 18px; line-height: 1.65; color: #d4d4d4;`;

const TEXTS = [
  { label: "pairings", text: "Good typography is invisible. Great typography speaks to the reader without raising its voice. The choices behind a well-set paragraph are deliberate, quiet, and precise." },
  { label: "rhetoric", text: "Ethos in typography means choosing typefaces and layouts that signal credibility, authority, and professionalism — earning the reader's trust before they read a single word." },
  { label: "hero-desc", text: "Manipulate variation axes in real time. Animate between extremes. Compare configurations. Generate production-ready CSS." },
  { label: "long-para", text: "She worked in a studio on the edge of the city. It was small but it had good light and a view of the park across the road. The tools of her trade filled every surface — ink, paper, type specimens, a loupe she kept on a brass chain. Everything had its place and every place had a purpose. She believed good work came from good order, and two decades of practice had proven her right." },
];

const WIDTHS = [320, 360, 390];

// Tuned configs — testing different expansion/dampening philosophies
const CONFIGS = [
  { label: "A-baseline", expand: 0.6, tighten: 0.4, expandMult: 0.8, tightenMult: 0.6, neighborDamp: 0.5, antiJustThresh: 0.92 },
  { label: "B-raised-caps", expand: 3.0, tighten: 2.0, expandMult: 0.8, tightenMult: 0.6, neighborDamp: 0.5, antiJustThresh: 0.92 },
  { label: "C-full-mult", expand: 3.0, tighten: 2.0, expandMult: 1.0, tightenMult: 0.7, neighborDamp: 0.5, antiJustThresh: 0.92 },
  { label: "D-soft-neighbor", expand: 3.0, tighten: 2.0, expandMult: 1.0, tightenMult: 0.7, neighborDamp: 0.75, antiJustThresh: 0.92 },
  { label: "E-higher-caps", expand: 4.0, tighten: 2.5, expandMult: 1.0, tightenMult: 0.7, neighborDamp: 0.75, antiJustThresh: 0.90 },
  { label: "F-sweet-spot", expand: 3.5, tighten: 2.0, expandMult: 1.0, tightenMult: 0.75, neighborDamp: 0.7, antiJustThresh: 0.91 },
];

async function applySmoothing(page, width, config) {
  return page.evaluate(({ width, config }) => {
    const el = document.getElementById('d');
    const text = el.textContent;
    const words = text.split(/ +/).filter(Boolean);
    if (words.length < 4) return [];

    el.innerHTML = words.map((w, i) => `<span data-w="${i}">${w}</span>`).join(' ');
    const wordSpans = el.querySelectorAll('span[data-w]');
    const lines = [];
    let currentTop = -1, currentLine = [];

    wordSpans.forEach((span, idx) => {
      const top = Math.round(span.getBoundingClientRect().top);
      if (currentTop === -1) { currentTop = top; currentLine = [idx]; }
      else if (Math.abs(top - currentTop) > 3) {
        const first = wordSpans[currentLine[0]], last = wordSpans[currentLine[currentLine.length - 1]];
        lines.push({ indices: currentLine, width: last.getBoundingClientRect().right - first.getBoundingClientRect().left });
        currentTop = top; currentLine = [idx];
      } else { currentLine.push(idx); }
    });
    if (currentLine.length > 0) {
      const first = wordSpans[currentLine[0]], last = wordSpans[currentLine[currentLine.length - 1]];
      lines.push({ indices: currentLine, width: last.getBoundingClientRect().right - first.getBoundingClientRect().left });
    }

    if (lines.length < 2) { el.innerHTML = words.join(' '); return []; }

    const nonLastWidths = lines.slice(0, -1).map(l => l.width).sort((a, b) => a - b);
    const mid = Math.floor(nonLastWidths.length / 2);
    let target = nonLastWidths.length % 2 === 0
      ? (nonLastWidths[mid - 1] + nonLastWidths[mid]) / 2 : nonLastWidths[mid];

    // Anti-justification: pull target down if near-justified + orphan
    const avgFill = nonLastWidths.reduce((s, w) => s + w, 0) / nonLastWidths.length / width;
    const lastFill = lines[lines.length - 1].width / width;
    if (avgFill > 0.88 && lastFill < 0.60 && lines.length > 2) {
      target = Math.min(target, width * 0.82);
    }

    // Raw deltas
    const rawDeltas = lines.map((line, i) => {
      const isLast = i === lines.length - 1;
      const spaces = line.indices.length - 1;
      const gap = target - line.width;
      if (isLast || spaces === 0 || Math.abs(gap) <= 1) return 0;
      const rawDelta = gap / spaces;
      return rawDelta > 0
        ? Math.min(config.expand, rawDelta * config.expandMult)
        : Math.max(-config.tighten, rawDelta * config.tightenMult);
    });

    // Neighbor dampening
    for (let i = 0; i < rawDeltas.length - 1; i++) {
      if (rawDeltas[i] * rawDeltas[i + 1] < 0) {
        rawDeltas[i] *= config.neighborDamp;
        rawDeltas[i + 1] *= config.neighborDamp;
      }
    }

    // Anti-justification: if adjusted fills too uniform, relax
    const adjWidths = lines.map((l, i) => l.width + rawDeltas[i] * (l.indices.length - 1));
    const adjFills = adjWidths.slice(0, -1).map(w => w / width);
    const minF = Math.min(...adjFills), maxF = Math.max(...adjFills);
    if (minF > config.antiJustThresh && maxF - minF < 0.04) {
      for (let i = 0; i < rawDeltas.length; i++) rawDeltas[i] *= 0.5;
    }

    // Build
    const htmlParts = [], lineData = [];
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const lineWords = line.indices.map(idx => words[idx]);
      const lineText = lineWords.join(' ');
      const spaces = lineWords.length - 1;
      const delta = rawDeltas[i];
      const adjW = line.width + delta * spaces;
      lineData.push({ text: lineText, orig: Math.round(line.width / width * 100), adj: Math.round(adjW / width * 100), delta: +delta.toFixed(2) });
      if (Math.abs(delta) > 0.05) {
        htmlParts.push(`<span style="word-spacing:${delta.toFixed(2)}px">${lineText}</span>`);
      } else { htmlParts.push(lineText); }
    }
    el.style.whiteSpace = 'pre-line';
    el.innerHTML = htmlParts.join('\n');
    return lineData;
  }, { width, config });
}

async function run() {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ deviceScaleFactor: 2 });
  const page = await ctx.newPage();

  for (const t of TEXTS) {
    console.log(`\n${'═'.repeat(70)}`);
    console.log(`TEXT: ${t.label}`);
    console.log(`${'═'.repeat(70)}`);

    for (const width of WIDTHS) {
      console.log(`\n  --- ${width}px ---`);
      for (const config of CONFIGS) {
        await page.setContent(`<html><body style="background:#0a0a0a;margin:0;padding:0"><div id="d" style="width:${width}px;${STYLE};padding:16px">${t.text}</div></body></html>`);
        await page.waitForTimeout(200);
        const lines = await applySmoothing(page, width, config);
        if (!lines.length) continue;

        const fills = lines.map(l => l.adj);
        const nonLast = fills.slice(0, -1);
        const range = Math.max(...nonLast) - Math.min(...nonLast);
        const grade = range < 5 ? '★★★' : range < 10 ? '★★' : range < 15 ? '★' : '✗';
        
        console.log(`  ${config.label.padEnd(18)} ${grade} range:${range.toString().padStart(2)}  ${lines.map(l => {
          const dir = l.delta > 0 ? '+' : l.delta < 0 ? '' : ' ';
          return `${l.adj}%${l.orig !== l.adj ? `(${dir}${l.delta})` : ''}`;
        }).join('  ')}`);
      }
    }
  }

  await browser.close();
  console.log('\n\nDone!');
}

run();
