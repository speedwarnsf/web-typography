import { chromium } from 'playwright';
import { writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';

const OUT = join(import.meta.dirname, '..', 'test-rag-output');
mkdirSync(OUT, { recursive: true });

// Exact text from Dustin's redlined screenshots
const SAMPLES = [
  {
    label: "pairing-card-body",
    text: "Good typography is invisible. Great typography speaks to the reader without raising its voice. The choices behind a well-set paragraph are deliberate, quiet, and precise.",
    font: "Georgia, 'Times New Roman', serif",
    size: "16px",
    leading: "1.65",
    widths: [310, 340, 360],
  },
  {
    label: "rhetoric-ethos",
    text: "Ethos in typography means choosing typefaces and layouts that signal credibility, authority, and professionalism \u2014 earning the reader\u2019s trust before they read a single word.",
    font: "Georgia, 'Times New Roman', serif",
    size: "16px",
    leading: "1.65",
    widths: [310, 340, 360],
  },
  {
    label: "rhetoric-pathos",
    text: "Pathos is the emotional layer \u2014 the warmth of a serif, the sharpness of a sans, the rhythm of a well-set paragraph. Type can evoke calm, urgency, warmth, or dramatic impact.",
    font: "Georgia, 'Times New Roman', serif",
    size: "16px",
    leading: "1.65",
    widths: [310, 340, 360],
  },
  {
    label: "varfonts-hero",
    text: "Manipulate variation axes in real time. Animate between extremes. Compare configurations. Generate production-ready CSS.",
    font: "'Source Sans 3', sans-serif",
    size: "18px",
    leading: "1.6",
    widths: [310, 340, 360],
  },
  {
    label: "font-dna-desc",
    text: "Drop a font file and CSS to extract fonts, scales, spacing, and patterns into reusable design tokens.",
    font: "'Source Sans 3', sans-serif",
    size: "18px",
    leading: "1.6",
    widths: [310, 340, 360],
  },
  {
    label: "clamp-preview",
    text: "Good typography is invisible. The reader doesn\u2019t notice the typeface, the spacing, the rhythm. They just absorb meaning. Every refinement carries meaning through form.",
    font: "Georgia, 'Times New Roman', serif",
    size: "18px",
    leading: "1.65",
    widths: [310, 340, 360],
  },
  {
    label: "reading-lab-preview",
    text: "Typography is the visual voice of language. When text is set with care \u2014 the right measure, the right leading, the right weight \u2014 reading becomes effortless. When it\u2019s cramped or loose, rhythm falters and the eye fatigues. The reader loses focus, backs up, or gives up entirely. Good type disappears. The reader forgets they\u2019re reading and simply understands.",
    font: "Georgia, 'Times New Roman', serif",
    size: "18px",
    leading: "1.65",
    widths: [310, 340, 360],
  },
];

// Adaptive config: reads computed line-height to scale caps
function getConfig(lineHeight) {
  const lh = parseFloat(lineHeight) || 1.5;
  // Scale factor: 1.0 at lh=1.5, +10% per 0.1 above, -10% per 0.1 below
  const scale = 1 + (lh - 1.5) * 1.0;
  return {
    expand: 3.0 * scale,
    tighten: 2.0 * scale,
    expandMult: 1.0,
    tightenMult: 0.7,
    neighborDamp: 0.75,
    antiJustThresh: 0.92,
  };
}

async function applySmoothing(page, width, config) {
  return page.evaluate(({ config }) => {
    const el = document.getElementById('d');
    const cs = getComputedStyle(el);
    const width = el.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
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

    const avgFill = nonLastWidths.reduce((s, w) => s + w, 0) / nonLastWidths.length / width;
    const lastFill = lines[lines.length - 1].width / width;
    if (avgFill > 0.88 && lastFill < 0.60 && lines.length > 2) {
      target = Math.min(target, width * 0.82);
    }

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

    // Anti-justification
    const adjWidths = lines.map((l, i) => l.width + rawDeltas[i] * (l.indices.length - 1));
    const adjFills = adjWidths.slice(0, -1).map(w => w / width);
    const minF = Math.min(...adjFills), maxF = Math.max(...adjFills);
    if (minF > config.antiJustThresh && maxF - minF < 0.04) {
      for (let i = 0; i < rawDeltas.length; i++) rawDeltas[i] *= 0.5;
    }

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
  }, { config });
}

async function run() {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ deviceScaleFactor: 2 });
  const page = await ctx.newPage();

  // Load Google Fonts
  await page.setContent(`<html><head>
    <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Source+Sans+3:wght@400&display=swap">
  </head><body></body></html>`);
  await page.waitForTimeout(1000);

  for (const sample of SAMPLES) {
    console.log(`\n${'═'.repeat(70)}`);
    console.log(`${sample.label}`);
    console.log(`${'═'.repeat(70)}`);

    const config = getConfig(sample.leading);
    console.log(`  Config: expand=${config.expand.toFixed(1)} tighten=${config.tighten.toFixed(1)} (lh=${sample.leading})`);

    for (const width of sample.widths) {
      const style = `font-family: ${sample.font}; font-size: ${sample.size}; line-height: ${sample.leading}; color: #d4d4d4;`;

      // Baseline
      await page.setContent(`<html><head>
        <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Source+Sans+3:wght@400&display=swap">
      </head><body style="background:#0a0a0a;margin:0;padding:0">
        <div id="d" style="width:${width}px;${style};padding:16px">${sample.text}</div>
      </body></html>`);
      await page.waitForTimeout(300);

      // Get baseline lines
      const baseLines = await page.evaluate(() => {
        const el = document.getElementById('d');
        const cs = getComputedStyle(el);
        const width = el.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
        const words = el.textContent.split(/ +/).filter(Boolean);
        el.innerHTML = words.map((w, i) => `<span data-w="${i}">${w}</span>`).join(' ');
        const spans = el.querySelectorAll('span[data-w]');
        const lines = [];
        let top = -1, cur = [];
        spans.forEach((s, i) => {
          const t = Math.round(s.getBoundingClientRect().top);
          if (top === -1) { top = t; cur = [i]; }
          else if (Math.abs(t - top) > 3) {
            const f = spans[cur[0]], l = spans[cur[cur.length-1]];
            lines.push({ text: cur.map(j => words[j]).join(' '), fill: Math.round((l.getBoundingClientRect().right - f.getBoundingClientRect().left) / width * 100) });
            top = t; cur = [i];
          } else cur.push(i);
        });
        if (cur.length) {
          const f = spans[cur[0]], l = spans[cur[cur.length-1]];
          lines.push({ text: cur.map(j => words[j]).join(' '), fill: Math.round((l.getBoundingClientRect().right - f.getBoundingClientRect().left) / width * 100) });
        }
        el.innerHTML = words.join(' ');
        return lines;
      });

      // Now apply smoothing
      await page.setContent(`<html><head>
        <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Source+Sans+3:wght@400&display=swap">
      </head><body style="background:#0a0a0a;margin:0;padding:0">
        <div id="d" style="width:${width}px;${style};padding:16px">${sample.text}</div>
      </body></html>`);
      await page.waitForTimeout(300);

      const smoothLines = await applySmoothing(page, width, config);

      // Save screenshots
      let el = await page.$('#d');
      let buf = await el.screenshot();
      writeFileSync(join(OUT, `${sample.label}-${width}-smoothed.png`), buf);

      const baseNonLast = baseLines.slice(0, -1).map(l => l.fill);
      const smoothNonLast = smoothLines.slice(0, -1).map(l => l.adj);
      const baseRange = Math.max(...baseNonLast) - Math.min(...baseNonLast);
      const smoothRange = smoothNonLast.length ? Math.max(...smoothNonLast) - Math.min(...smoothNonLast) : 0;

      console.log(`\n  ${width}px: range ${baseRange} → ${smoothRange}`);
      console.log(`    BEFORE: ${baseLines.map(l => `${l.fill}%`).join('  ')}`);
      if (smoothLines.length) {
        console.log(`    AFTER:  ${smoothLines.map(l => {
          const d = l.delta;
          const dir = d > 0 ? `+${d}` : d < 0 ? `${d}` : '0';
          return `${l.adj}%(${dir})`;
        }).join('  ')}`);
      }
    }
  }

  await browser.close();
  console.log('\n\nDone!');
}

run();
