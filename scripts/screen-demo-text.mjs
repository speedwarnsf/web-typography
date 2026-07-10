/**
 * screen-demo-text.mjs — choose the essay demo text empirically.
 *
 * The homepage proof text was selected because the browser butchers it at
 * 12/16 widths. This does the same screening for the essay's three-way
 * demo: each candidate is rendered browser-set at every width from 250 to
 * 590px in the production face (Source Sans 3, 17px/1.7), flaws counted
 * with the SAME word lists the shipped table uses, then composed with the
 * shipped engine to confirm typeset stays clean where the browser fails.
 *
 * Run: node scripts/screen-demo-text.mjs
 */
import { chromium } from 'playwright';
import { readFile } from 'node:fs/promises';

const CANDIDATES = {
  current:
    'Your browser does not know what a sentence is. It fills each line until the next word will not fit, then it breaks — wherever that happens to be. It will end a line on the word "of" and think nothing of it. It will leave a single word alone on the last line of your best paragraph. Every book you have ever trusted was set by people who considered these things unacceptable, and fixed them by hand, line by line, for five hundred years.',
  guest:
    'The browser does not read the sentence it is breaking. It will end a line on the word "of", as if "of" meant anything alone. It will leave the last word of your best paragraph sitting by itself, like a guest nobody came to meet. Every book on your shelf was set by people who called these mistakes by name and fixed every one of them by hand.',
  stumble:
    'Readers feel typography before they notice it. A line that ends on "the" or "of" makes the eye stumble, just a little, at the worst possible place. A last line holding one word looks abandoned because it is. For five hundred years, books were set by people who would not let either thing happen to a paragraph they cared about.',
  everywhere:
    'Good setting is invisible and bad setting is everywhere. Your phone will break a line after the word "with" and think it has done its job. It will strand the first word of a new sentence at the edge of a line, where no reader wants to find it. The people who set books for a living have never once shipped a paragraph like that.',
  shape:
    'A paragraph is a shape as much as a thought. Break it carelessly and the thought survives but the shape betrays it: little words hanging off the edge of every other line, a lonely word at the bottom looking up at the rest. The browser has been setting your writing this way for thirty years, and nobody ever asked it to stop.',
  promise:
    'Every trade keeps one promise to the people it serves. A typesetter\'s promise was simple: no line will end on a word that belongs to the next one, and no paragraph will abandon its last word to a line of its own. The web broke that promise by accident, kept breaking it for forty years, and called the result good enough.',
  edge:
    'Look closely at the right edge of this paragraph as you squeeze it. Watch which words get left at the ends of lines, and what happens to the last word when the column gets narrow enough. This is the shape of every article you have ever read on a phone, and none of it was decided by anyone.',
};

const WIDTHS = [];
for (let w = 250; w <= 590; w += 20) WIDTHS.push(w);

const PAGE = `<!doctype html><html lang="en"><head><meta charset="utf-8">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Source+Sans+3:wght@400&display=swap" rel="stylesheet">
<style>body{font-family:'Source Sans 3',sans-serif;font-size:17px;line-height:1.7;background:#0a0a0a;color:#dcdcdc;margin:40px}</style>
</head><body></body></html>`;

// Identical to ThreeWay.tsx's WEAK set — screening must predict the table.
const MEASURE_FN = `(({ text, width, mode }) => {
  const WEAK = new Set(['a','an','the','of','in','at','by','to','for','with','from','on','into','upon','about','between','through','without','during','before','after','against','among','within','beyond','toward','towards','across','along','behind','beneath','beside','despite','except','inside','outside','until','unlike','and','or','but','nor','yet','so','is','are','was','were','be','been','as','if','than','that']);
  document.body.innerHTML = '';
  const p = document.createElement('p');
  p.style.width = width + 'px';
  document.body.appendChild(p);
  let rows;
  if (mode === 'typeset') {
    p.dataset.tsRaw = text;
    p.textContent = text;
    window.Typeset.run(p);
    const lines = [...p.querySelectorAll(':scope > .ts-line')];
    if (!lines.length) return null; // engine skipped/fell back
    rows = lines.map(l => (l.textContent || '').trim().split(/\\s+/));
  } else {
    p.innerHTML = text.split(' ').map(w => '<span data-w>' + w.replace(/&/g,'&amp;').replace(/</g,'&lt;') + '</span>').join(' ');
    const spans = [...p.querySelectorAll('span[data-w]')];
    const grouped = [];
    for (const s of spans) {
      const top = Math.round(s.getBoundingClientRect().top);
      const cur = grouped[grouped.length - 1];
      if (!cur || Math.abs(top - cur.top) > 4) grouped.push({ top, words: [s.textContent] });
      else cur.words.push(s.textContent);
    }
    rows = grouped.map(g => g.words);
  }
  let hanging = 0;
  rows.forEach((words, i) => {
    if (i === rows.length - 1) return;
    const last = (words[words.length - 1] || '').replace(/[^A-Za-z0-9\\u2019']+$/g, '').toLowerCase();
    if (WEAK.has(last)) hanging++;
  });
  const lastWords = rows[rows.length - 1].filter(w => /[A-Za-z0-9]/.test(w));
  const orphan = rows.length > 1 && lastWords.length === 1;
  return { hanging, orphan, lines: rows.length };
})`;

const tsLib = await readFile('public/typeset.min.js', 'utf8');
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 900, height: 900 } });
await page.setContent(PAGE, { waitUntil: 'networkidle' });
await page.addScriptTag({ content: tsLib });
await page.evaluate(() => document.fonts.ready);

const results = [];
for (const [name, text] of Object.entries(CANDIDATES)) {
  let browserBadWidths = 0;
  let browserOrphanWidths = 0;
  let browserTotal = 0;
  let typesetTotal = 0;
  let typesetWorst = 0;
  let typesetSkips = 0;
  for (const width of WIDTHS) {
    const b = await page.evaluate(`${MEASURE_FN}(${JSON.stringify({ text, width, mode: 'browser' })})`);
    const t = await page.evaluate(`${MEASURE_FN}(${JSON.stringify({ text, width, mode: 'typeset' })})`);
    const bScore = b.hanging + (b.orphan ? 2 : 0);
    browserTotal += bScore;
    if (bScore >= 2) browserBadWidths++;
    if (b.orphan) browserOrphanWidths++;
    if (t === null) { typesetSkips++; continue; }
    const tScore = t.hanging + (t.orphan ? 2 : 0);
    typesetTotal += tScore;
    typesetWorst = Math.max(typesetWorst, tScore);
  }
  results.push({ name, browserBadWidths, browserOrphanWidths, browserTotal, typesetTotal, typesetWorst, typesetSkips });
}
await browser.close();

results.sort((a, b) =>
  b.browserBadWidths - a.browserBadWidths ||
  b.browserOrphanWidths - a.browserOrphanWidths ||
  b.browserTotal - a.browserTotal
);
console.log(`widths screened: ${WIDTHS.length} (250–590px, Source Sans 3 17px/1.7)\n`);
console.log('candidate     | bad widths | orphan widths | browser flaws | typeset flaws (worst) | skips');
for (const r of results) {
  console.log(
    `${r.name.padEnd(13)} | ${String(r.browserBadWidths).padStart(10)} | ${String(r.browserOrphanWidths).padStart(13)} | ${String(r.browserTotal).padStart(13)} | ${String(r.typesetTotal).padStart(13)} (${r.typesetWorst}) | ${r.typesetSkips}`
  );
}
