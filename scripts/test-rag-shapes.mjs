import { chromium } from 'playwright';
import { writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';

const OUT = join(import.meta.dirname, '..', 'test-rag-output', 'shapes');
mkdirSync(OUT, { recursive: true });

const TEXT = "Good typography is invisible. Great typography speaks to the reader without raising its voice. The choices behind a well-set paragraph are deliberate, quiet, and precise. Every refinement serves the text and nothing calls attention to itself.";
const STYLE = `font-family: Georgia, serif; font-size: 18px; line-height: 1.7; color: #d4d4d4;`;
const WIDTH = 360;

// Each shape defines target fill % for each non-last line
// These are RELATIVE targets — we'll adjust word-spacing to push lines toward these fills
const SHAPES = [
  {
    name: "A-natural",
    desc: "Browser default (no smoothing)",
    targets: null, // no adjustment
  },
  {
    name: "B-flat-median",
    desc: "All lines toward median (Knuth-style)",
    // All non-last lines aim for same fill
    generate: (lineCount) => new Array(lineCount).fill(0.90),
  },
  {
    name: "C-gentle-taper",
    desc: "Each line slightly shorter than the last",
    generate: (n) => Array.from({ length: n }, (_, i) => 0.96 - (i / (n - 1)) * 0.12),
  },
  {
    name: "D-reverse-taper",
    desc: "Each line slightly longer than the last",
    generate: (n) => Array.from({ length: n }, (_, i) => 0.84 + (i / (n - 1)) * 0.12),
  },
  {
    name: "E-concave",
    desc: "Shorter at edges, longer in middle",
    generate: (n) => Array.from({ length: n }, (_, i) => {
      const t = i / (n - 1); // 0 to 1
      return 0.85 + 0.10 * Math.sin(t * Math.PI); // peaks at center
    }),
  },
  {
    name: "F-convex",
    desc: "Longer at edges, shorter in middle",
    generate: (n) => Array.from({ length: n }, (_, i) => {
      const t = i / (n - 1);
      return 0.95 - 0.10 * Math.sin(t * Math.PI); // dips at center
    }),
  },
  {
    name: "G-alternating",
    desc: "Long-short-long-short (high frequency noise)",
    generate: (n) => Array.from({ length: n }, (_, i) => i % 2 === 0 ? 0.95 : 0.82),
  },
  {
    name: "H-gentle-wave",
    desc: "Slow sine undulation",
    generate: (n) => Array.from({ length: n }, (_, i) => {
      const t = i / (n - 1);
      return 0.90 + 0.05 * Math.sin(t * Math.PI * 2);
    }),
  },
  {
    name: "I-stepped-descent",
    desc: "Groups of 2-3 at same width, stepping down",
    generate: (n) => {
      const steps = [0.95, 0.95, 0.90, 0.90, 0.85, 0.85, 0.82, 0.82];
      return Array.from({ length: n }, (_, i) => steps[i] || 0.85);
    },
  },
  {
    name: "J-flag",
    desc: "Sharp first line, rest aligned shorter",
    generate: (n) => Array.from({ length: n }, (_, i) => i === 0 ? 0.97 : 0.87),
  },
];

async function run() {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ deviceScaleFactor: 2 });
  const page = await ctx.newPage();

  // First, get natural line breaks and widths
  await page.setContent(`<html><body style="background:#0a0a0a;margin:0;padding:16px 0">
    <div id="d" style="width:${WIDTH}px;${STYLE};padding:20px">${TEXT}</div>
  </body></html>`);
  await page.waitForTimeout(300);

  const lineInfo = await page.evaluate(() => {
    const el = document.getElementById('d');
    const cs = getComputedStyle(el);
    const cw = el.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
    const words = el.textContent.split(/ +/).filter(Boolean);
    
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
          indices: cur,
          words: cur.map(j => words[j]),
          width: l.getBoundingClientRect().right - f.getBoundingClientRect().left,
        });
        top = t; cur = [i];
      } else cur.push(i);
    });
    if (cur.length) {
      const f = spans[cur[0]], l = spans[cur[cur.length - 1]];
      lines.push({ indices: cur, words: cur.map(j => words[j]), width: l.getBoundingClientRect().right - f.getBoundingClientRect().left });
    }
    
    return { containerWidth: cw, lines: lines.map(l => ({
      text: l.words.join(' '),
      width: l.width,
      fill: l.width / cw,
      gaps: l.words.length - 1,
      chars: l.words.join(' ').replace(/\s/g, '').length,
    })) };
  });

  console.log(`Container: ${lineInfo.containerWidth}px, ${lineInfo.lines.length} lines`);
  lineInfo.lines.forEach((l, i) => console.log(`  L${i}: ${(l.fill * 100).toFixed(0)}% "${l.text}"`));

  const nonLastCount = lineInfo.lines.length - 1;

  // Generate each shape
  for (const shape of SHAPES) {
    console.log(`\n--- ${shape.name}: ${shape.desc} ---`);

    await page.setContent(`<html><body style="background:#0a0a0a;margin:0;padding:16px 0">
      <div id="d" style="width:${WIDTH}px;${STYLE};padding:20px">${TEXT}</div>
    </body></html>`);
    await page.waitForTimeout(300);

    if (shape.targets === null) {
      // Natural — no adjustment, just screenshot
      const fills = lineInfo.lines.map(l => `${(l.fill * 100).toFixed(0)}%`).join(' ');
      console.log(`  ${fills}`);
    } else {
      const targets = shape.generate(nonLastCount);
      
      await page.evaluate(({ targets, cw }) => {
        const el = document.getElementById('d');
        const text = el.textContent;
        const words = text.split(/ +/).filter(Boolean);
        
        // Re-detect lines
        el.innerHTML = words.map((w, i) => `<span data-w="${i}">${w}</span>`).join(' ');
        const spans = el.querySelectorAll('span[data-w]');
        const lines = [];
        let top = -1, cur = [];
        spans.forEach((s, i) => {
          const t = Math.round(s.getBoundingClientRect().top);
          if (top === -1) { top = t; cur = [i]; }
          else if (Math.abs(t - top) > 3) {
            const f = spans[cur[0]], l = spans[cur[cur.length - 1]];
            lines.push({ indices: cur, words: cur.map(j => words[j]), width: l.getBoundingClientRect().right - f.getBoundingClientRect().left });
            top = t; cur = [i];
          } else cur.push(i);
        });
        if (cur.length) {
          const f = spans[cur[0]], l = spans[cur[cur.length - 1]];
          lines.push({ indices: cur, words: cur.map(j => words[j]), width: l.getBoundingClientRect().right - f.getBoundingClientRect().left });
        }

        const htmlParts = [];
        for (let i = 0; i < lines.length; i++) {
          const line = lines[i];
          const lineText = line.words.join(' ');
          const isLast = i === lines.length - 1;
          const gaps = line.words.length - 1;
          const chars = lineText.replace(/\s/g, '').length;

          if (isLast || i >= targets.length || gaps === 0) {
            htmlParts.push(lineText);
            continue;
          }

          const targetWidth = cw * targets[i];
          const gap = targetWidth - line.width;
          
          // Use both word-spacing and letter-spacing
          let ws = 0, ls = 0;
          if (Math.abs(gap) > 1) {
            ws = gap / gaps;
            // Cap word-spacing
            ws = Math.max(-3.0, Math.min(4.0, ws));
            const wsCoverage = ws * gaps;
            const remaining = gap - wsCoverage;
            if (Math.abs(remaining) > 1 && chars > 0) {
              ls = remaining / chars;
              ls = Math.max(-0.5, Math.min(0.5, ls));
            }
          }

          const styles = [];
          if (Math.abs(ws) > 0.05) styles.push(`word-spacing:${ws.toFixed(2)}px`);
          if (Math.abs(ls) > 0.05) styles.push(`letter-spacing:${ls.toFixed(2)}px`);
          
          if (styles.length) {
            htmlParts.push(`<span style="${styles.join(';')}">${lineText}</span>`);
          } else {
            htmlParts.push(lineText);
          }
        }

        el.style.whiteSpace = 'pre-line';
        el.innerHTML = htmlParts.join('\n');
      }, { targets, cw: lineInfo.containerWidth });

      await page.waitForTimeout(200);
      const fills = targets.map(t => `${(t * 100).toFixed(0)}%`).join(' ');
      console.log(`  targets: ${fills}`);
    }

    // Add label
    await page.evaluate((label) => {
      const el = document.getElementById('d');
      const labelEl = document.createElement('div');
      labelEl.style.cssText = 'font-family:monospace;font-size:11px;color:#666;margin-top:12px;padding-top:8px;border-top:1px solid #333;letter-spacing:0.1em;text-transform:uppercase';
      labelEl.textContent = label;
      el.appendChild(labelEl);
    }, `${shape.name.replace(/^.-/, '')}: ${shape.desc}`);

    const el = await page.$('#d');
    const buf = await el.screenshot();
    writeFileSync(join(OUT, `${shape.name}.png`), buf);
    console.log(`  saved ${shape.name}.png`);
  }

  await browser.close();
  console.log('\n\nDone! Check test-rag-output/shapes/');
}

run();
