// bind-harness.mjs — shared measurement rig for phrase-binding tests.
// Committed deliberately: it is what makes the bind weight auditable.
// See docs/BINDING.md.
//
//   import { measure } from './bind-harness.mjs';
//   const r = await measure({ paragraphs, phrases, measures, weight, engine, font, port });
//
// Weight is injected at runtime via __TYPESET_BIND__ — NO rebuild needed, so
// many tests can run against one build. Never edit src/ to change a weight.

import { createServer } from 'node:http';
import { readFileSync } from 'node:fs';
import { extname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium, webkit, firefox } from '@playwright/test';

// Resolve from this file's location, not a hardcoded clone path — the
// harness is committed to make the bind weight auditable from any checkout.
// fileURLToPath, not URL.pathname: pathname is percent-encoded (a checkout
// under "My Projects" would 404 every asset) and breaks on Windows drives.
const PUBLIC = fileURLToPath(new URL('./public', import.meta.url));
const ENGINES = { chromium, webkit, firefox };
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json' };

export function buildFixture({ paragraphs, measures, font = "'Source Serif 4', serif", fontLink, phrases = [] }) {
  const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const link = fontLink ?? '<link href="https://fonts.googleapis.com/css2?family=Source+Serif+4:opsz,wght@8..60,400&display=block" rel="stylesheet">';
  return `<!doctype html><meta charset="utf-8">${link}
<style>body{font-family:${font};font-size:18px;line-height:1.55;margin:0;padding:20px}
p{margin:0 0 18px}${measures.map((m) => `.m${m} p{max-width:${m}ch}`).join('')}</style>
${measures.map((m) => `<section class="m${m}" data-measure="${m}">${paragraphs.map((p) => `<p>${esc(p)}</p>`).join('')}</section>`).join('\n')}
<script>window.__PHRASES__=${JSON.stringify(phrases)}</script>
<script src="/go.js"></script>`;
}

/** Compose a fixture and return split + rag metrics, per measure. */
export async function measure({
  paragraphs, phrases = [], measures = [24, 32, 40, 48, 56, 65, 78],
  weight = 0, numberUnit = 0, engine = 'chromium', font, fontLink, port = 4500, viewport = 1400,
}) {
  const html = buildFixture({ paragraphs, measures, font, fontLink, phrases });
  const server = createServer((req, res) => {
    const url = req.url.split('?')[0];
    if (url === '/_fixture.html') { res.writeHead(200, { 'content-type': 'text/html' }); return res.end(html); }
    try {
      const p = join(PUBLIC, url);
      const b = readFileSync(p);
      res.writeHead(200, { 'content-type': MIME[extname(p)] || 'application/octet-stream' });
      res.end(b);
    } catch { res.writeHead(404); res.end(''); }
  });
  await new Promise((r) => server.listen(port, r));

  const browser = await ENGINES[engine].launch();
  try {
    const ctx = await browser.newContext({ viewport: { width: viewport, height: 1000 } });
    await ctx.addInitScript(([t, n]) => { globalThis.__TYPESET_BIND__ = { toponym: t, numberUnit: n }; }, [weight, numberUnit]);
    const page = await ctx.newPage();
    const t0 = Date.now();
    await page.goto(`http://localhost:${port}/_fixture.html`, { waitUntil: 'load' });
    await page.waitForFunction(
      () => { const ps = [...document.querySelectorAll('p')]; return ps.length && ps.every((p) => p.hasAttribute('data-typeset-done')); },
      null, { timeout: 120000 });
    const composeMs = Date.now() - t0;

    const data = await page.evaluate(() => {
      const phrases = window.__PHRASES__ || [];
      const perMeasure = {};
      const viols = window.Typeset?.audit?.() || [];

      for (const sec of document.querySelectorAll('section[data-measure]')) {
        const m = sec.dataset.measure;
        const rec = { weak: 0, overflow: 0, orphan: 0, splits: 0, splitList: [], lines: 0, shortLines: 0, fills: [], composed: 0, fallback: 0 };
        const textWidth = (el) => {
          const r = document.createRange(); r.selectNodeContents(el);
          const rects = [...r.getClientRects()];
          if (!rects.length) return 0;
          return Math.max(...rects.map((x) => x.right)) - Math.min(...rects.map((x) => x.left));
        };
        for (const p of sec.querySelectorAll('p')) {
          p.getAttribute('data-ts-outcome') === 'composed' ? rec.composed++ : rec.fallback++;
          const els = [...p.querySelectorAll('.ts-line')];
          if (!els.length) continue;
          const ws = els.map(textWidth);
          const maxW = Math.max(...ws, 1);
          for (let i = 0; i < ws.length - 1; i++) {
            const f = ws[i] / maxW; rec.fills.push(f); rec.lines++;
            if (f < 0.75) rec.shortLines++;
          }
          const lt = els.map((l) => l.textContent.replace(/\s+/g, ' ').trim());
          for (const ph of phrases) {
            const [a, b] = ph.split(' ');
            for (let i = 0; i < lt.length - 1; i++) {
              if (new RegExp(`(^|\\s)${a.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`).test(lt[i]) &&
                  new RegExp(`^${b.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`).test(lt[i + 1])) {
                rec.splits++; rec.splitList.push(ph);
              }
            }
          }
        }
        const mean = rec.fills.reduce((a, b) => a + b, 0) / (rec.fills.length || 1);
        rec.meanFill = +mean.toFixed(4);
        rec.sdFill = +Math.sqrt(rec.fills.reduce((a, f) => a + (f - mean) ** 2, 0) / (rec.fills.length || 1)).toFixed(4);
        delete rec.fills;
        perMeasure[m] = rec;
      }
      for (const v of viols) {
        const sec = v.element?.closest?.('section[data-measure]');
        const rec = sec && perMeasure[sec.dataset.measure];
        if (!rec) continue;
        if (v.type === 'weak-line-end') rec.weak++;
        else if (v.type === 'overflow') rec.overflow++;
        else if (v.type === 'orphan') rec.orphan++;
      }
      return perMeasure;
    });

    const totals = { splits: 0, weak: 0, overflow: 0, orphan: 0, lines: 0, shortLines: 0, fallback: 0, composeMs };
    for (const r of Object.values(data)) {
      totals.splits += r.splits; totals.weak += r.weak; totals.overflow += r.overflow;
      totals.orphan += r.orphan; totals.lines += r.lines; totals.shortLines += r.shortLines;
      totals.fallback += r.fallback;
    }
    const sds = Object.values(data).map((r) => r.sdFill);
    totals.sdFill = +(sds.reduce((a, b) => a + b, 0) / (sds.length || 1)).toFixed(4);
    return { weight, engine, totals, perMeasure: data };
  } finally {
    await browser.close();
    server.close();
  }
}
