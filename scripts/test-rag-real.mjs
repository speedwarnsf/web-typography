import { chromium } from 'playwright';
import { writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';
import { execSync } from 'child_process';

const OUT = join(import.meta.dirname, '..', 'test-rag-output', 'real');
mkdirSync(OUT, { recursive: true });

// Bundle the actual typeset library
const bundlePath = '/tmp/typeset-bundle.js';
execSync(`npx esbuild ${join(import.meta.dirname, '..', 'src/lib/typeset.ts')} --bundle --format=iife --global-name=Typeset --outfile=${bundlePath} --platform=browser 2>&1`);
const bundleJS = (await import('fs')).readFileSync(bundlePath, 'utf-8');

const TEXT = "Good typography is invisible. Great typography speaks to the reader without raising its voice. The choices behind a well-set paragraph are deliberate, quiet, and precise. Every refinement serves the text and nothing calls attention to itself.";
const STYLE = `font-family: Georgia, serif; font-size: 18px; line-height: 1.7; color: #d4d4d4;`;
const WIDTH = 360;

async function measureLines(page) {
  return page.evaluate(() => {
    const el = document.getElementById('d');
    const cs = getComputedStyle(el);
    const cw = el.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
    const words = el.textContent.split(/ +/).filter(Boolean);
    
    // Save original content
    const origHTML = el.innerHTML;
    el.innerHTML = words.map((w, i) => `<span data-w="${i}">${w}</span>`).join(' ');
    const spans = el.querySelectorAll('span[data-w]');
    const lines = [];
    let top = -1, cur = [];
    spans.forEach((s, i) => {
      const t = Math.round(s.getBoundingClientRect().top);
      if (top === -1) { top = t; cur = [i]; }
      else if (Math.abs(t - top) > 3) {
        const f = spans[cur[0]], l = spans[cur[cur.length - 1]];
        lines.push({
          text: cur.map(j => words[j]).join(' '),
          width: l.getBoundingClientRect().right - f.getBoundingClientRect().left,
          fill: Math.round((l.getBoundingClientRect().right - f.getBoundingClientRect().left) / cw * 100),
        });
        top = t; cur = [i];
      } else cur.push(i);
    });
    if (cur.length) {
      const f = spans[cur[0]], l = spans[cur[cur.length - 1]];
      lines.push({
        text: cur.map(j => words[j]).join(' '),
        width: l.getBoundingClientRect().right - f.getBoundingClientRect().left,
        fill: Math.round((l.getBoundingClientRect().right - f.getBoundingClientRect().left) / cw * 100),
      });
    }
    // Restore
    el.innerHTML = origHTML;
    return { containerWidth: cw, lines };
  });
}

async function run() {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ deviceScaleFactor: 2 });
  const page = await ctx.newPage();

  // A — Natural (no smoothing)
  console.log('\n--- A: NATURAL (browser default) ---');
  await page.setContent(`<html><body style="background:#0a0a0a;margin:0;padding:16px 0">
    <div id="d" style="width:${WIDTH}px;${STYLE};padding:20px">${TEXT}</div>
  </body></html>`);
  await page.waitForTimeout(300);
  let info = await measureLines(page);
  info.lines.forEach((l, i) => console.log(`  L${i} ${l.fill}% "${l.text}"`));
  
  // Add label
  await page.evaluate(() => {
    const el = document.getElementById('d');
    const lab = document.createElement('div');
    lab.style.cssText = 'font-family:monospace;font-size:11px;color:#666;margin-top:12px;padding-top:8px;border-top:1px solid #333;letter-spacing:0.1em';
    lab.textContent = 'A: NATURAL — browser default, no smoothing';
    el.appendChild(lab);
  });
  writeFileSync(join(OUT, 'A-natural.png'), await (await page.$('#d')).screenshot());
  console.log('  saved A-natural.png');

  // B — smoothRag applied (actual library)
  console.log('\n--- B: smoothRag (actual typeset.ts library) ---');
  await page.setContent(`<html><body style="background:#0a0a0a;margin:0;padding:16px 0">
    <div id="d" style="width:${WIDTH}px;${STYLE};padding:20px">${TEXT}</div>
    <script>${bundleJS}</script>
  </body></html>`);
  await page.waitForTimeout(300);
  
  // Apply smoothRag
  await page.evaluate(() => {
    if (typeof Typeset !== 'undefined' && Typeset.smoothRag) {
      Typeset.smoothRag(document.getElementById('d'));
    }
  });
  await page.waitForTimeout(200);
  
  // Measure after
  info = await measureLines(page);
  info.lines.forEach((l, i) => console.log(`  L${i} ${l.fill}% "${l.text}"`));
  
  await page.evaluate(() => {
    const el = document.getElementById('d');
    const lab = document.createElement('div');
    lab.style.cssText = 'font-family:monospace;font-size:11px;color:#666;margin-top:12px;padding-top:8px;border-top:1px solid #333;letter-spacing:0.1em';
    lab.textContent = 'B: smoothRag — actual typeset.ts library applied';
    el.appendChild(lab);
  });
  writeFileSync(join(OUT, 'B-smoothRag.png'), await (await page.$('#d')).screenshot());
  console.log('  saved B-smoothRag.png');

  // C — v2 algorithm (word-spacing + letter-spacing, asymmetric dampening)
  console.log('\n--- C: v2 algorithm (dual-lever, asymmetric dampening) ---');
  await page.setContent(`<html><body style="background:#0a0a0a;margin:0;padding:16px 0">
    <div id="d" style="width:${WIDTH}px;${STYLE};padding:20px">${TEXT}</div>
  </body></html>`);
  await page.waitForTimeout(300);
  
  await page.evaluate(() => {
    const el = document.getElementById('d');
    const cs = getComputedStyle(el);
    const cw = el.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
    const lh = parseFloat(cs.lineHeight) / parseFloat(cs.fontSize) || 1.5;
    const lhScale = 1 + (lh - 1.5) * 1.0;
    const MAX_WS_E = 3.0 * lhScale, MAX_WS_T = 2.0 * lhScale, MAX_LS = 0.4 * lhScale;
    
    const words = el.textContent.split(/ +/).filter(Boolean);
    el.innerHTML = words.map((w, i) => `<span data-w="${i}">${w}</span>`).join(' ');
    const spans = el.querySelectorAll('span[data-w]');
    const lines = []; let top = -1, cur = [];
    spans.forEach((s, i) => {
      const t = Math.round(s.getBoundingClientRect().top);
      if (top === -1) { top = t; cur = [i]; }
      else if (Math.abs(t - top) > 3) {
        const f = spans[cur[0]], l = spans[cur[cur.length - 1]];
        lines.push({ indices: cur, width: l.getBoundingClientRect().right - f.getBoundingClientRect().left });
        top = t; cur = [i];
      } else cur.push(i);
    });
    if (cur.length) {
      const f = spans[cur[0]], l = spans[cur[cur.length - 1]];
      lines.push({ indices: cur, width: l.getBoundingClientRect().right - f.getBoundingClientRect().left });
    }
    if (lines.length < 2) return;

    const nlw = lines.slice(0, -1).map(l => l.width).sort((a, b) => a - b);
    const mid = Math.floor(nlw.length / 2);
    let target = nlw.length % 2 === 0 ? (nlw[mid - 1] + nlw[mid]) / 2 : nlw[mid];
    
    const avgFill = nlw.reduce((s, w) => s + w, 0) / nlw.length / cw;
    const lastFill = lines[lines.length - 1].width / cw;
    if (avgFill > 0.88 && lastFill < 0.60 && lines.length > 2) target = Math.min(target, cw * 0.82);

    const adjs = lines.map((line, i) => {
      const isLast = i === lines.length - 1;
      const lw = line.indices.map(idx => words[idx]);
      const lt = lw.join(' ');
      const spaces = lw.length - 1;
      const cc = lt.replace(/\s/g, '').length;
      const gap = target - line.width;
      if (isLast || spaces === 0 || Math.abs(gap) <= 1) return { ws: 0, ls: 0, text: lt, ow: line.width };
      
      const rawWs = gap / spaces;
      let ws = rawWs > 0 ? Math.min(MAX_WS_E, rawWs) : Math.max(-MAX_WS_T, rawWs * 0.7);
      const wsCov = ws * spaces;
      const rem = gap - wsCov;
      let ls = 0;
      if (rem > 2 && cc > 0) ls = Math.min(MAX_LS, rem / cc);
      else if (rem < -2 && cc > 0) ls = Math.max(-MAX_LS * 0.5, rem / cc);
      return { ws, ls, text: lt, ow: line.width };
    });

    for (let i = 0; i < adjs.length - 1; i++) {
      const a = adjs[i], b = adjs[i + 1];
      if (a.ws * b.ws < 0) {
        if (a.ws > 0) { a.ws *= 0.85; a.ls *= 0.85; b.ws *= 0.65; b.ls *= 0.65; }
        else { a.ws *= 0.65; a.ls *= 0.65; b.ws *= 0.85; b.ls *= 0.85; }
      }
    }

    const aw = adjs.map((a, i) => {
      const s = lines[i].indices.length - 1, c = a.text.replace(/\s/g, '').length;
      return a.ow + a.ws * s + a.ls * c;
    });
    const af = aw.slice(0, -1).map(w => w / cw);
    const minF = Math.min(...af), maxF = Math.max(...af);
    if (minF > 0.92 && maxF - minF < 0.04) adjs.forEach(a => { a.ws *= 0.5; a.ls *= 0.5; });

    const parts = [];
    for (const a of adjs) {
      const styles = [];
      if (Math.abs(a.ws) > 0.05) styles.push(`word-spacing:${a.ws.toFixed(2)}px`);
      if (Math.abs(a.ls) > 0.05) styles.push(`letter-spacing:${a.ls.toFixed(2)}px`);
      parts.push(styles.length ? `<span style="${styles.join(';')}">${a.text}</span>` : a.text);
    }
    el.style.whiteSpace = 'pre-line';
    el.innerHTML = parts.join('\n');
  });
  await page.waitForTimeout(200);
  
  info = await measureLines(page);
  info.lines.forEach((l, i) => console.log(`  L${i} ${l.fill}% "${l.text}"`));
  
  await page.evaluate(() => {
    const el = document.getElementById('d');
    const lab = document.createElement('div');
    lab.style.cssText = 'font-family:monospace;font-size:11px;color:#666;margin-top:12px;padding-top:8px;border-top:1px solid #333;letter-spacing:0.1em';
    lab.textContent = 'C: v2 — dual-lever (ws+ls), asymmetric neighbor dampening';
    el.appendChild(lab);
  });
  writeFileSync(join(OUT, 'C-v2.png'), await (await page.$('#d')).screenshot());
  console.log('  saved C-v2.png');

  await browser.close();
  console.log('\nDone!');
}
run();
