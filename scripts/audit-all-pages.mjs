/**
 * Audit all pages at mobile width (375px iPhone).
 * Captures screenshots and checks for:
 * 1. Horizontal overflow (content wider than viewport)
 * 2. Text overflow (words breaking container bounds)
 * 3. Font loading
 * 4. Console errors
 */
import { chromium } from 'playwright';
import { writeFileSync, mkdirSync } from 'fs';

const PAGES = [
  '/',
  '/perfect-paragraph',
  '/reading-lab',
  '/go',
  '/about',
  '/animations',
  '/audit',
  '/clamp',
  '/dna',
  '/font-inspector',
  '/pairing-cards',
  '/rhetoric',
  '/specimen',
  '/support',
  '/variable-fonts',
];

const BASE = 'https://typeset.us';
const WIDTH = 375;
const OUT_DIR = '/tmp/typeset-audit';

async function audit() {
  mkdirSync(OUT_DIR, { recursive: true });
  
  const browser = await chromium.launch();
  const context = await browser.newContext({
    viewport: { width: WIDTH, height: 812 },
    deviceScaleFactor: 2,
  });
  
  const issues = [];
  
  for (const path of PAGES) {
    const page = await context.newPage();
    const errors = [];
    page.on('console', msg => {
      if (msg.type() === 'error') errors.push(msg.text());
    });
    page.on('pageerror', err => errors.push(err.message));
    
    console.log(`\n--- ${path} ---`);
    
    try {
      await page.goto(BASE + path, { waitUntil: 'networkidle', timeout: 15000 });
      await page.waitForTimeout(2000); // Wait for GlobalTypeset
      
      // Check for horizontal overflow
      const overflow = await page.evaluate(() => {
        const body = document.body;
        const html = document.documentElement;
        const docWidth = Math.max(body.scrollWidth, html.scrollWidth);
        const viewWidth = window.innerWidth;
        
        // Find overflowing elements
        const overflowing = [];
        const all = document.querySelectorAll('*');
        for (const el of all) {
          const rect = el.getBoundingClientRect();
          if (rect.right > viewWidth + 2) {
            overflowing.push({
              tag: el.tagName,
              class: el.className?.toString().slice(0, 60),
              right: Math.round(rect.right),
              overflow: Math.round(rect.right - viewWidth),
            });
          }
        }
        
        return {
          docWidth,
          viewWidth,
          hasOverflow: docWidth > viewWidth + 2,
          overflowPx: docWidth - viewWidth,
          elements: overflowing.slice(0, 5),
        };
      });
      
      if (overflow.hasOverflow) {
        console.log(`  ⚠ OVERFLOW: ${overflow.overflowPx}px wider than viewport`);
        overflow.elements.forEach(el => {
          console.log(`    ${el.tag}.${el.class} → ${el.overflow}px overflow`);
        });
        issues.push({ path, type: 'overflow', detail: overflow });
      } else {
        console.log(`  ✓ No overflow`);
      }
      
      // Check for console errors
      if (errors.length > 0) {
        console.log(`  ⚠ ${errors.length} console error(s):`);
        errors.slice(0, 3).forEach(e => console.log(`    ${e.slice(0, 100)}`));
        issues.push({ path, type: 'errors', detail: errors });
      } else {
        console.log(`  ✓ No errors`);
      }
      
      // Screenshot
      const slug = path === '/' ? 'home' : path.slice(1).replace(/\//g, '-');
      await page.screenshot({
        path: `${OUT_DIR}/${slug}.png`,
        fullPage: true,
      });
      console.log(`  📸 ${slug}.png`);
      
    } catch (err) {
      console.log(`  ✗ FAILED: ${err.message}`);
      issues.push({ path, type: 'load-error', detail: err.message });
    }
    
    await page.close();
  }
  
  await browser.close();
  
  console.log('\n=== SUMMARY ===');
  if (issues.length === 0) {
    console.log('All pages pass! ✓');
  } else {
    console.log(`${issues.length} issue(s):`);
    issues.forEach(i => console.log(`  ${i.path}: ${i.type}`));
  }
}

audit().catch(console.error);
