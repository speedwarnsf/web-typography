// Settle the Firefox question: is composition non-deterministic with a system
// font, and does the metrics gate change it?
//
// Controlled A/B on the SAME page, same reps, only the bundle differs.
// Uses the full corpus (595 paragraph-renderings) because the reported swing
// involved ~900 lines and a paragraph failing to compose — a rare race needs
// volume to surface, and my earlier 12-paragraph probe had none.
import { createServer } from 'node:http';
import { readFileSync } from 'node:fs';
import { chromium, webkit, firefox } from '@playwright/test';

const corpus = JSON.parse(readFileSync(process.env.HOME + '/web-typography/corpus.json', 'utf8'));
const MEASURES = [24, 32, 40, 48, 56, 65, 78];
const REPS = Number(process.env.REPS || 10);
const FONT = process.env.FONT || 'Georgia, serif';

const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const page = (bundle) => `<!doctype html><meta charset="utf-8">
<style>body{font-family:${FONT};font-size:18px;line-height:1.55;margin:0;padding:20px}
p{margin:0 0 18px}${MEASURES.map((m) => `.m${m} p{max-width:${m}ch}`).join('')}</style>
${MEASURES.map((m) => `<section class="m${m}">${corpus.paragraphs.map((p) => `<p>${esc(p)}</p>`).join('')}</section>`).join('\n')}
<script src="/${bundle}"></script>`;

const server = createServer((req, res) => {
  const u = req.url.split('?')[0];
  const m = u.match(/^\/page-(nofix|fixed)\.html$/);
  if (m) { res.writeHead(200, { 'content-type': 'text/html' }); return res.end(page(`_go-${m[1]}.js`)); }
  try {
    const body = readFileSync(process.env.HOME + '/web-typography/public' + u);
    res.writeHead(200, { 'content-type': 'text/javascript' });
    res.end(body);
  } catch { res.writeHead(404); res.end(''); }
});
await new Promise((r) => server.listen(4990, r));

async function trial(engine, variant, reps) {
  const browser = await engine.launch();
  const seen = new Map();
  const fallbacks = [];
  const lineCounts = [];
  for (let i = 0; i < reps; i++) {
    const ctx = await browser.newContext({ viewport: { width: 1300, height: 900 } });
    const p = await ctx.newPage();
    await p.goto(`http://localhost:4990/page-${variant}.html`, { waitUntil: 'load' });
    // Bounded settle wait; do NOT require done, so a hung/never-marked
    // paragraph cannot mask itself as a timeout.
    await p.waitForFunction(
      () => {
        const ps = [...document.querySelectorAll('p')];
        return ps.length > 0 && ps.every((x) => x.hasAttribute('data-typeset-done'));
      }, null, { timeout: 60000 }).catch(() => {});
    const r = await p.evaluate(() => {
      const ps = [...document.querySelectorAll('p')];
      const notComposed = ps.filter((x) => x.getAttribute('data-ts-outcome') !== 'composed').length;
      const lines = document.querySelectorAll('.ts-line').length;
      // cheap structural fingerprint of the whole composition
      let h = 0;
      for (const el of document.querySelectorAll('.ts-line')) {
        const t = el.textContent || '';
        for (let k = 0; k < t.length; k++) h = (h * 31 + t.charCodeAt(k)) | 0;
      }
      return { notComposed, lines, fp: String(h) };
    });
    seen.set(r.fp, (seen.get(r.fp) || 0) + 1);
    fallbacks.push(r.notComposed);
    lineCounts.push(r.lines);
    await ctx.close();
  }
  await browser.close();
  const uniqLines = [...new Set(lineCounts)];
  const uniqFb = [...new Set(fallbacks)];
  return { distinct: seen.size, counts: [...seen.values()].sort((a, b) => b - a), uniqLines, uniqFb };
}

console.log(`corpus: ${corpus.paragraphs.length} paras x ${MEASURES.length} measures = ${corpus.paragraphs.length * MEASURES.length} renderings`);
console.log(`font: "${FONT}"   reps: ${REPS}\n`);
console.log('engine    variant | distinct  spread        lines seen      fallbacks seen');
const ONLY = (process.env.ENGINES || 'firefox,chromium,webkit').split(',');
for (const [eng, name] of [[firefox, 'firefox'], [chromium, 'chromium'], [webkit, 'webkit']].filter(([,n]) => ONLY.includes(n))) {
  for (const variant of ['nofix', 'fixed']) {
    const r = await trial(eng, variant, REPS);
    const verdict = r.distinct === 1 ? 'stable' : `*** ${r.distinct} COMPOSITIONS ***`;
    console.log(
      `${name.padEnd(9)} ${variant.padEnd(7)} | ${String(r.distinct).padStart(8)}  ${JSON.stringify(r.counts).padEnd(12)}  ` +
      `${JSON.stringify(r.uniqLines).padEnd(15)} ${JSON.stringify(r.uniqFb).padEnd(12)} ${verdict}`);
  }
}
server.close();
