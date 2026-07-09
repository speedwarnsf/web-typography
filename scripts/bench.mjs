/**
 * bench.mjs — measure what the prose claims.
 *
 * The premise says the math "can run on any device, in milliseconds."
 * This script replaces that assertion with numbers: per-paragraph and
 * full-page compose time for the shipped go.js bundle, in Chromium at
 * 1x and at 4x CPU throttle (a mid-range-phone proxy via CDP).
 *
 * Run: npm run bench   (requires `npm run build:dist` first; writes
 * docs/BENCHMARKS.md)
 */
import { chromium } from 'playwright';
import { readFile, writeFile } from 'node:fs/promises';

// Real text only — the same passages the site and fixture use.
const PASSAGES = [
  'The problem I have lived with across this career is simple to state and difficult to solve: the web does not know how to break lines. The browser sets text using a greedy algorithm -- fill the line until the next word won\'t fit, then break. This is fast. At wide measures it works well enough.',
  '"Typography is the craft of endowing human language with a durable visual form," Bringhurst wrote. The rag is a feature, not a flaw -- the irregular right edge gives the eye a lattice of landmarks to track its position in the paragraph.',
  "The reader's comfort is not a luxury but a necessity. When text is set with care -- when the spaces between letters breathe properly, when lines are neither cramped nor sprawling, when the eye can traverse a line without fatigue -- reading becomes what it should be: transparent. The reader forgets the page and remembers the ideas.",
  'Research in typography and human factors has given us concrete guidance. We know that line lengths between 45 and 75 characters optimize reading speed and comprehension. We understand that line height affects both legibility and aesthetic harmony. We have measured the impact of letter spacing on readers with visual impairments and dyslexia.',
  'These are not arbitrary rules handed down by tradition. They are principles discovered through careful observation of how human eyes and brains process written language. When we set type according to evidence, we honor both the reader and the text.',
];
// A >120-token paragraph to exercise the BEAM=80 long-paragraph path.
const LONG = PASSAGES.slice(1).join(' ');

const WIDTHS = [340, 480, 650];
const PARAGRAPHS_PER_PAGE = 30;

function buildPage(goJs) {
  const blocks = [];
  for (let i = 0; i < PARAGRAPHS_PER_PAGE; i++) {
    const text = i % 6 === 5 ? LONG : PASSAGES[i % PASSAGES.length];
    const width = WIDTHS[i % WIDTHS.length];
    blocks.push(`<div style="width:${width}px"><p>${text}</p></div>`);
  }
  return `<!doctype html><html lang="en"><head><meta charset="utf-8">
<style>body{font-family:Georgia,serif;font-size:18px;line-height:1.65;margin:2rem;background:#111;color:#ddd}</style>
</head><body>${blocks.join('\n')}<script>${goJs}</script></body></html>`;
}

async function measure(page, throttle) {
  const client = await page.context().newCDPSession(page);
  await client.send('Emulation.setCPUThrottlingRate', { rate: throttle });
  const result = await page.evaluate(() => {
    const els = Array.from(document.querySelectorAll('p'));
    // Reset whatever the auto-run already composed so we time from raw text.
    els.forEach((el) => {
      el.removeAttribute('data-typeset-done');
      el.removeAttribute('data-ts-outcome');
    });
    const times = [];
    const t0 = performance.now();
    for (const el of els) {
      const s = performance.now();
      window.Typeset.run(el);
      times.push(performance.now() - s);
    }
    const total = performance.now() - t0;
    times.sort((a, b) => a - b);
    const q = (p) => times[Math.min(times.length - 1, Math.floor(p * times.length))];
    const words = els.reduce((n, el) => n + (el.textContent || '').trim().split(/\s+/).length, 0);
    const composed = els.filter((el) => el.getAttribute('data-ts-outcome') === 'composed').length;
    return {
      paragraphs: els.length,
      composed,
      words,
      total: +total.toFixed(1),
      median: +q(0.5).toFixed(2),
      p95: +q(0.95).toFixed(2),
      max: +times[times.length - 1].toFixed(2),
    };
  });
  await client.send('Emulation.setCPUThrottlingRate', { rate: 1 });
  return result;
}

const goJs = await readFile('public/go.js', 'utf8');
const browser = await chromium.launch();
const browserVersion = `Chromium ${browser.version()}`;
const page = await browser.newPage();
await page.setContent(buildPage(goJs), { waitUntil: 'load' });
await page.waitForFunction(() =>
  Array.from(document.querySelectorAll('p')).every((p) => p.hasAttribute('data-typeset-done')),
);

const rows = [];
for (const rate of [1, 4]) {
  // Warm-up pass, then the measured pass.
  await measure(page, rate);
  const r = await measure(page, rate);
  rows.push({ rate, ...r });
  console.log(`${rate}x throttle:`, r);
}
await browser.close();

const stamp = new Date().toISOString().slice(0, 10);
const md = `# Benchmarks

*Measured ${stamp} — ${browserVersion} via Playwright,
Georgia 18px, a ${PARAGRAPHS_PER_PAGE}-paragraph page of real site text at 340/480/650px measures
(every sixth paragraph >120 tokens, exercising the BEAM=80 path). Times are for the full
pipeline per paragraph — quote education, beam-search composition, contour re-rank, spacing
pass, render, post-render self-checks — through the shipped go.js bundle. The 4x CPU
throttle row is a mid-range-phone proxy (CDP \`Emulation.setCPUThrottlingRate\`).
Reproduce with \`npm run bench\`.*

| CPU | Paragraphs (composed) | Words | Median / paragraph | p95 / paragraph | Max | Full page |
|---|---|---|---|---|---|---|
${rows
  .map(
    (r) =>
      `| ${r.rate}x | ${r.paragraphs} (${r.composed}) | ${r.words} | ${r.median} ms | ${r.p95} ms | ${r.max} ms | ${r.total} ms |`,
  )
  .join('\n')}

## Reading the numbers

- Composition is synchronous on the main thread and runs once per paragraph
  after \`fonts.ready\` (and again only when a paragraph's width actually
  changes by 2px+, or its face finishes loading late).
- The honest claim is therefore: **milliseconds per paragraph, tens of
  milliseconds for a full page** on a desktop core, and roughly 4x that on a
  throttled core. Not free — measured.
- These numbers are the budget for the open question in RESEARCH.md Part XI
  (dynamic content on a 16ms frame): a single paragraph fits a frame budget
  at 1x; a full page does not and should never run inside one frame.
`;
await writeFile('docs/BENCHMARKS.md', md);
console.log('\nwrote docs/BENCHMARKS.md');
