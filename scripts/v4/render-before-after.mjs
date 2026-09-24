// @ts-check
// The README's before/after image: one paragraph at a 375 px phone width,
// set by the browser with `text-wrap: pretty` and by Typeset (the candidate,
// or TYPESET_BUNDLE). Short words stranded at line ends are underlined and
// counted in both. Chromium, 2x device pixels. The image is archived with the
// release (public/releases/<v>/before-after.png), not shipped in the npm
// package, and the README links it by absolute URL.
//
//   node scripts/v4/render-before-after.mjs [--out packages/typeset-v4/before-after.png]
import { chromium } from 'playwright';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { parseArgs } from 'node:util';
import { buildCandidate } from '../build-candidate.mjs';
import { browsers } from './browsers.mjs';

const { values } = parseArgs({ options: { out: { type: 'string', default: 'packages/typeset-v4/before-after.png' } } });
const bundlePath = process.env.TYPESET_BUNDLE || (await buildCandidate()).env.TYPESET_BUNDLE;
const bundle = await readFile(bundlePath, 'utf8');
const TEXT = 'Your browser does not know what a sentence is. It does not know that a thought should not snap in half, or that a word left alone at the end of a line looks abandoned, because it is. It fills each line until the words run out, and calls that typography.';
const WEAK = ['a', 'an', 'the', 'of', 'to', 'in', 'on', 'at', 'by', 'or', 'and', 'but', 'if', 'as', 'is', 'it', 'its', 'for', 'we', 'i'];
const watchdog = setTimeout(() => { console.error('render-before-after: watchdog'); process.exit(3); }, 60000);
const executablePath = browsers.find(b => b.name === 'chromium')?.executablePath;
const browser = await chromium.launch({ executablePath, timeout: 20000 });
try {
  const page = await browser.newPage({ viewport: { width: 375, height: 700 }, deviceScaleFactor: 2 });
  page.setDefaultTimeout(20000);
  await page.setContent(`<!doctype html><html lang="en"><head><style>
    body { margin: 0; padding: 20px 16px 24px; background: #fbfaf7; color: #1d1b17; font: 18px/1.5 Georgia, serif; }
    h2 { margin: 0 0 8px; font: 600 11px/1.3 -apple-system, "Helvetica Neue", Arial, sans-serif; letter-spacing: .12em; text-transform: uppercase; color: #8a6d2b; }
    p { margin: 0; }
    .pretty { text-wrap: pretty; }
    section + section { margin-top: 22px; padding-top: 18px; border-top: 1px solid #e4dccb; }
    .count { margin-top: 8px; font: 12px/1.4 -apple-system, "Helvetica Neue", Arial, sans-serif; color: #6b6558; }
    mark { background: none; color: inherit; text-decoration: underline 2px #b8963e; text-underline-offset: 3px; }
  </style></head><body>
    <section><h2>Browser, text-wrap: pretty</h2><p class="pretty" id="before">${TEXT}</p><div class="count" id="before-count"></div></section>
    <section><h2>Typeset</h2><p id="after">${TEXT}</p><div class="count" id="after-count"></div></section>
  </body></html>`);
  await page.addScriptTag({ content: bundle });
  const result = await page.evaluate(async weak => {
    await document.fonts.ready;
    const T = /** @type {any} */ (window).Typeset;
    const outcome = T.typeset(document.getElementById('after')).outcome;
    /** Lines ending in a short function word, marked in place. */
    const mark = (/** @type {HTMLElement} */ p) => {
      const words = [];
      const walker = document.createTreeWalker(p, NodeFilter.SHOW_TEXT);
      for (let node = walker.nextNode(); node; node = walker.nextNode()) {
        for (const match of (node.textContent || '').matchAll(/\S+/g)) {
          const range = document.createRange();
          range.setStart(node, match.index); range.setEnd(node, match.index + match[0].length);
          const rects = range.getClientRects();
          words.push({ node, index: match.index, text: match[0], top: rects[rects.length - 1]?.top ?? 0 });
        }
      }
      const ends = words.filter((word, i) => i < words.length - 1 && words[i + 1].top > word.top + 2);
      const stranded = ends.filter(word => weak.includes(word.text.toLowerCase().replace(/[^a-z]/g, '')));
      for (const word of stranded.reverse()) {
        const range = document.createRange();
        range.setStart(word.node, word.index); range.setEnd(word.node, word.index + word.text.length);
        range.surroundContents(document.createElement('mark'));
      }
      return { lines: ends.length + 1, stranded: stranded.map(w => w.text) };
    };
    const before = mark(/** @type {HTMLElement} */ (document.getElementById('before')));
    const after = mark(/** @type {HTMLElement} */ (document.getElementById('after')));
    const say = (/** @type {{ lines: number, stranded: string[] }} */ r) => `${r.stranded.length} short word${r.stranded.length === 1 ? '' : 's'} left at a line end, ${r.lines} lines`;
    /** @type {HTMLElement} */ (document.getElementById('before-count')).textContent = say(before);
    /** @type {HTMLElement} */ (document.getElementById('after-count')).textContent = say(after);
    return { outcome, before, after, version: T.VERSION };
  }, WEAK);
  const height = await page.evaluate(() => Math.ceil(document.body.getBoundingClientRect().height));
  await mkdir(values.out.split('/').slice(0, -1).join('/') || '.', { recursive: true });
  await page.screenshot({ path: values.out, clip: { x: 0, y: 0, width: 375, height } });
  await writeFile('output/before-after.json', JSON.stringify({ ...result, browser: browser.version(), out: values.out }, null, 2));
  console.log(JSON.stringify({ ...result, browser: browser.version(), out: values.out }, null, 2));
} finally {
  await browser.close();
  clearTimeout(watchdog);
}
