/**
 * Test all five typeset features at multiple widths.
 * Uses Playwright to render text and visually verify differences.
 */
import { chromium } from 'playwright';

const NBSP = '\u00A0';

// Import typesetText by evaluating the module
const typesetSource = `
// Inline the core typesetText function for testing
const NBSP = '\\u00A0';
const isSentenceEnd = (word) => /[.!?]$/.test(word) || /[.!?]["'\\u201D\\u2019]$/.test(word);

function typesetText(text, options) {
  if (!text || text.length < 10) return text;
  const words = text.split(/\\s+/).filter(Boolean);
  if (words.length < 3) return text;
  
  const m = (options && options.measure) || 65;
  const doOrphans = m >= 30;
  const doTinyWordBinding = m >= 25;
  const doSentenceProtection = m >= 35;
  const doMediumWordBinding = m >= 45;
  const doFullShortWordBinding = m >= 55;
  
  const tinyWords = new Set(['a', 'i', 'an', 'as', 'at', 'be', 'by', 'do', 'go', 'if', 'in', 'is', 'it', 'my', 'no', 'of', 'on', 'or', 'so', 'to', 'up', 'we']);
  const mediumWords = new Set(['the', 'and', 'but', 'for', 'nor', 'not', 'yet', 'its', 'our', 'has', 'was', 'are', 'can']);
  
  const result = [];
  for (let i = 0; i < words.length; i++) {
    const word = words[i];
    const prevWord = i > 0 ? words[i - 1] : null;
    const nextWord = i < words.length - 1 ? words[i + 1] : null;
    
    // Orphan prevention
    if (doOrphans && i === words.length - 2) {
      result.push(word + NBSP + words[i + 1]);
      break;
    }
    
    // Sentence-start protection
    if (doSentenceProtection && prevWord && isSentenceEnd(prevWord) && nextWord && !isSentenceEnd(word)) {
      const maxLen = m >= 45 ? 6 : 5;
      if (word.length <= maxLen) {
        result.push(word + NBSP + words[i + 1]);
        i++;
        continue;
      }
    }
    
    // Sentence-end protection
    if (doSentenceProtection) {
      const hasTrailingPunct = /[.!?,;:]$/.test(word);
      if (hasTrailingPunct && word.length <= 7 && result.length > 0) {
        const last = result.pop();
        result.push(last + NBSP + word);
        continue;
      }
      if (nextWord && /[.!?,;:]$/.test(nextWord) && nextWord.length <= 5 && i < words.length - 2) {
        result.push(word + NBSP + words[i + 1]);
        i++;
        continue;
      }
    }
    
    // Tiered short-word binding
    const lc = word.toLowerCase();
    if (nextWord && !/[,;:.!?]$/.test(word)) {
      if (doTinyWordBinding && /^\\d{1,3}$/.test(word)) {
        result.push(word + NBSP + words[i + 1]);
        i++;
        continue;
      }
      if (doTinyWordBinding && tinyWords.has(lc)) {
        result.push(word + NBSP + words[i + 1]);
        i++;
        continue;
      }
      if (doMediumWordBinding && mediumWords.has(lc)) {
        result.push(word + NBSP + words[i + 1]);
        i++;
        continue;
      }
      if (doFullShortWordBinding && lc.length <= 2) {
        result.push(word + NBSP + words[i + 1]);
        i++;
        continue;
      }
    }
    
    result.push(word);
  }
  return result.join(' ');
}
`;

const TEST_TEXT = "She worked in a studio on the edge of the city. It was small but it had good light and a view of the park. On clear days she could see all the way to the bridge. The tools of her trade filled every surface — ink, paper, type specimens, a loupe she kept on a chain. Everything in its place. She believed good work came from good order, and she was right about that.";

const WIDTHS = [320, 375, 500, 650, 800];
const MEASURES = [30, 38, 50, 65, 80];

async function test() {
  console.log('=== TYPESET FEATURE TEST ===\n');
  
  // Test 1: typesetText output at different measures
  console.log('--- Test 1: typesetText bindings at different measures ---\n');
  
  for (const measure of MEASURES) {
    // Eval typesetText inline
    const fn = new Function(typesetSource + `return typesetText(${JSON.stringify(TEST_TEXT)}, { measure: ${measure} });`);
    const result = fn();
    
    // Count nbsp bindings
    const nbspCount = (result.match(/\u00A0/g) || []).length;
    
    // Find bound pairs
    const pairs = [];
    const parts = result.split(' ');
    for (const part of parts) {
      if (part.includes(NBSP)) {
        pairs.push(part.replace(/\u00A0/g, '·'));
      }
    }
    
    console.log(`  Measure ${measure}ch: ${nbspCount} bindings`);
    console.log(`  Bound pairs: ${pairs.join(', ')}`);
    console.log();
  }
  
  // Test 2: Visual line break differences at different pixel widths
  console.log('--- Test 2: Visual differences at different widths ---\n');
  
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ deviceScaleFactor: 2 });
  const page = await ctx.newPage();
  
  for (const width of WIDTHS) {
    const measure = Math.round(width / 10); // rough ch estimate
    const fn = new Function(typesetSource + `return typesetText(${JSON.stringify(TEST_TEXT)}, { measure: ${measure} });`);
    const processed = fn();
    
    // Render both versions
    const style = `font-family: 'Source Sans 3', 'Helvetica Neue', sans-serif; font-size: 16px; line-height: 1.65; color: #d4d4d4;`;
    
    // Get line breaks for raw text
    await page.setContent(`
      <html><body style="background:#0a0a0a;margin:0;padding:0">
        <div id="d" style="width:${width}px;${style}">${TEST_TEXT}</div>
      </body></html>
    `);
    await page.waitForTimeout(200);
    const rawLines = await page.evaluate(() => {
      const div = document.getElementById('d');
      const range = document.createRange();
      const tn = div.firstChild;
      let lastY = -1, lineCount = 0, lines = [];
      let lineStart = 0, lineText = '';
      for (let i = 0; i < tn.textContent.length; i++) {
        range.setStart(tn, i); range.setEnd(tn, i + 1);
        const y = Math.round(range.getBoundingClientRect().top);
        if (lastY !== -1 && Math.abs(y - lastY) > 5) {
          lines.push(lineText.trim());
          lineText = '';
          lineCount++;
        }
        lineText += tn.textContent[i];
        lastY = y;
      }
      if (lineText.trim()) lines.push(lineText.trim());
      return lines;
    });
    
    // Get line breaks for processed text
    await page.setContent(`
      <html><body style="background:#0a0a0a;margin:0;padding:0">
        <div id="d" style="width:${width}px;${style}">${processed.replace(/\u00A0/g, '&nbsp;')}</div>
      </body></html>
    `);
    await page.waitForTimeout(200);
    const processedLines = await page.evaluate(() => {
      const div = document.getElementById('d');
      const range = document.createRange();
      const tn = div.firstChild;
      let lastY = -1, lines = [];
      let lineText = '';
      for (let i = 0; i < tn.textContent.length; i++) {
        range.setStart(tn, i); range.setEnd(tn, i + 1);
        const y = Math.round(range.getBoundingClientRect().top);
        if (lastY !== -1 && Math.abs(y - lastY) > 5) {
          lines.push(lineText.trim());
          lineText = '';
        }
        lineText += tn.textContent[i];
        lastY = y;
      }
      if (lineText.trim()) lines.push(lineText.trim());
      return lines;
    });
    
    const linesChanged = rawLines.length !== processedLines.length || 
      rawLines.some((line, i) => line !== processedLines[i]);
    
    console.log(`  Width ${width}px (~${measure}ch):`);
    console.log(`    Raw: ${rawLines.length} lines | Typeset: ${processedLines.length} lines | Changed: ${linesChanged ? 'YES ✓' : 'NO ✗'}`);
    
    if (linesChanged) {
      // Show the differences
      const maxLines = Math.max(rawLines.length, processedLines.length);
      for (let i = 0; i < maxLines; i++) {
        const raw = rawLines[i] || '(empty)';
        const proc = processedLines[i] || '(empty)';
        if (raw !== proc) {
          console.log(`    Line ${i + 1} DIFF:`);
          console.log(`      Raw:     "${raw}"`);
          console.log(`      Typeset: "${proc}"`);
        }
      }
    }
    
    // Check specific features
    const lastRawLine = rawLines[rawLines.length - 1];
    const lastProcLine = processedLines[processedLines.length - 1];
    const rawOrphan = lastRawLine && lastRawLine.split(/\s+/).length === 1;
    const procOrphan = lastProcLine && lastProcLine.split(/\s+/).length === 1;
    
    if (rawOrphan && !procOrphan) {
      console.log(`    ✓ ORPHAN FIXED: "${lastRawLine}" → bound with previous line`);
    } else if (rawOrphan && procOrphan) {
      console.log(`    ✗ ORPHAN STILL PRESENT: "${lastProcLine}"`);
    }
    
    console.log();
  }
  
  await browser.close();
  console.log('=== DONE ===');
}

test().catch(console.error);
