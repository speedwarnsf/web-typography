import { chromium } from 'playwright';
import { writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';

const OUT = join(import.meta.dirname, '..', 'test-rag-output');
mkdirSync(OUT, { recursive: true });

const STYLE = `font-family: Georgia, 'Times New Roman', serif; font-size: 18px; line-height: 1.65; color: #d4d4d4;`;

const TEXT = "Good typography is invisible. Great typography speaks to the reader without raising its voice. The choices behind a well-set paragraph are deliberate, quiet, and precise.";

const WIDTHS = [320, 360, 390, 414];

// Test different max-expand / max-tighten combos
const CONFIGS = [
  { label: "current", expand: 0.6, tighten: 0.4 },
  { label: "mild", expand: 1.5, tighten: 1.0 },
  { label: "moderate", expand: 2.5, tighten: 1.5 },
  { label: "firm", expand: 3.5, tighten: 2.0 },
  { label: "strong", expand: 4.5, tighten: 2.5 },
];

/**
 * Simulate applyLightSmooth with configurable caps + neighbor-aware dampening
 */
async function applySmoothing(page, width, maxExpand, maxTighten, neighborAware) {
  return page.evaluate(({ width, maxExpand, maxTighten, neighborAware }) => {
    const el = document.getElementById('d');
    const text = el.textContent;
    const words = text.split(/ +/).filter(Boolean);
    if (words.length < 4) return { lines: [], adjusted: false };

    // Wrap words in spans
    el.innerHTML = words.map((w, i) => `<span data-w="${i}">${w}</span>`).join(' ');

    // Detect lines
    const wordSpans = el.querySelectorAll('span[data-w]');
    const lines = [];
    let currentTop = -1, currentLine = [];

    wordSpans.forEach((span, idx) => {
      const top = Math.round(span.getBoundingClientRect().top);
      if (currentTop === -1) {
        currentTop = top;
        currentLine = [idx];
      } else if (Math.abs(top - currentTop) > 3) {
        if (currentLine.length > 0) {
          const first = wordSpans[currentLine[0]];
          const last = wordSpans[currentLine[currentLine.length - 1]];
          lines.push({ indices: currentLine, width: last.getBoundingClientRect().right - first.getBoundingClientRect().left });
        }
        currentTop = top;
        currentLine = [idx];
      } else {
        currentLine.push(idx);
      }
    });
    if (currentLine.length > 0) {
      const first = wordSpans[currentLine[0]];
      const last = wordSpans[currentLine[currentLine.length - 1]];
      lines.push({ indices: currentLine, width: last.getBoundingClientRect().right - first.getBoundingClientRect().left });
    }

    if (lines.length < 2) { el.innerHTML = words.join(' '); return { lines: [], adjusted: false }; }

    // Target: median of non-last line widths
    const nonLastWidths = lines.slice(0, -1).map(l => l.width).sort((a, b) => a - b);
    const mid = Math.floor(nonLastWidths.length / 2);
    let target = nonLastWidths.length % 2 === 0
      ? (nonLastWidths[mid - 1] + nonLastWidths[mid]) / 2
      : nonLastWidths[mid];

    // Anti-justification: if all non-last lines >88% fill and last <60%, pull target down
    const avgFill = nonLastWidths.reduce((s, w) => s + w, 0) / nonLastWidths.length / width;
    const lastFill = lines[lines.length - 1].width / width;
    if (avgFill > 0.88 && lastFill < 0.60 && lines.length > 2) {
      target = Math.min(target, width * 0.82);
    }

    // Compute raw deltas first
    const rawDeltas = lines.map((line, i) => {
      const isLast = i === lines.length - 1;
      const lineWords = line.indices.map(idx => words[idx]);
      const spaces = lineWords.length - 1;
      const gap = target - line.width;
      if (isLast || spaces === 0 || Math.abs(gap) <= 1) return 0;
      const rawDelta = gap / spaces;
      return rawDelta > 0
        ? Math.min(maxExpand, rawDelta * 0.8)
        : Math.max(-maxTighten, rawDelta * 0.6);
    });

    // Neighbor-aware dampening: if adjacent lines move opposite directions, halve both
    if (neighborAware) {
      for (let i = 0; i < rawDeltas.length - 1; i++) {
        if (rawDeltas[i] * rawDeltas[i + 1] < 0) {
          rawDeltas[i] *= 0.5;
          rawDeltas[i + 1] *= 0.5;
        }
      }
    }

    // Anti-justification check: if after adjustment, non-last lines would all be >92% fill, relax
    const adjustedWidths = lines.map((line, i) => {
      const spaces = line.indices.length - 1;
      return line.width + rawDeltas[i] * spaces;
    });
    const adjustedFills = adjustedWidths.slice(0, -1).map(w => w / width);
    const minAdjFill = Math.min(...adjustedFills);
    const maxAdjFill = Math.max(...adjustedFills);
    if (minAdjFill > 0.92 && maxAdjFill > 0.95) {
      // Too close to justified — scale everything back 50%
      for (let i = 0; i < rawDeltas.length; i++) rawDeltas[i] *= 0.5;
    }

    // Build HTML
    const htmlParts = [];
    const lineData = [];
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const lineWords = line.indices.map(idx => words[idx]);
      const lineText = lineWords.join(' ');
      const spaces = lineWords.length - 1;
      const delta = rawDeltas[i];

      const adjustedW = line.width + delta * spaces;
      lineData.push({ text: lineText, origWidth: Math.round(line.width), adjustedWidth: Math.round(adjustedW), delta: delta.toFixed(2), fill: Math.round(adjustedW / width * 100) });

      if (Math.abs(delta) > 0.05) {
        htmlParts.push(`<span style="word-spacing:${delta.toFixed(2)}px">${lineText}</span>`);
      } else {
        htmlParts.push(lineText);
      }
    }

    el.style.whiteSpace = 'pre-line';
    el.innerHTML = htmlParts.join('\n');
    return { lines: lineData, adjusted: true };
  }, { width, maxExpand, maxTighten, neighborAware });
}

async function run() {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ deviceScaleFactor: 2 });
  const page = await ctx.newPage();

  const results = [];

  for (const width of WIDTHS) {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`WIDTH: ${width}px`);
    console.log(`${'='.repeat(60)}`);

    // Baseline (no smoothing)
    await page.setContent(`<html><body style="background:#0a0a0a;margin:0;padding:0"><div id="d" style="width:${width}px;${STYLE};padding:16px">${TEXT}</div></body></html>`);
    await page.waitForTimeout(300);
    let el = await page.$('#d');
    let buf = await el.screenshot();
    writeFileSync(join(OUT, `${width}-baseline.png`), buf);
    console.log(`  baseline saved`);

    for (const config of CONFIGS) {
      await page.setContent(`<html><body style="background:#0a0a0a;margin:0;padding:0"><div id="d" style="width:${width}px;${STYLE};padding:16px">${TEXT}</div></body></html>`);
      await page.waitForTimeout(300);

      const result = await applySmoothing(page, width, config.expand, config.tighten, true);
      
      console.log(`\n  ${config.label} (expand:${config.expand}, tighten:${config.tighten}):`);
      if (result.lines) {
        result.lines.forEach(l => {
          const bar = '█'.repeat(Math.round(l.fill / 100 * 30));
          const dir = l.delta > 0 ? '→' : l.delta < 0 ? '←' : ' ';
          console.log(`    ${bar} ${l.fill}% [${dir}${Math.abs(l.delta)}px/gap] ${l.text}`);
        });
      }

      el = await page.$('#d');
      buf = await el.screenshot();
      writeFileSync(join(OUT, `${width}-${config.label}.png`), buf);
    }
  }

  await browser.close();
  console.log('\n\nDone! Screenshots in test-rag-output/');
}

run();
