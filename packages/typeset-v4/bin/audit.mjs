#!/usr/bin/env node
import { parseArgs } from 'node:util';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

try {
  const { values } = parseArgs({ options: {
    url: { type: 'string' }, selector: { type: 'string', default: '[data-typeset]' },
    widths: { type: 'string', default: '320,390,768,1440' }, apply: { type: 'boolean', default: false },
    browser: { type: 'string', default: 'chromium' }, mode: { type: 'string', default: 'body' },
    help: { type: 'boolean', default: false }, 'smart-quotes': { type: 'boolean', default: false },
    'optical-hanging': { type: 'boolean', default: false }, timeout: { type: 'string', default: '30' },
  } });
  if (values.help) {
    console.log('Usage: typeset-audit --url http://localhost:3000 --selector "article p" [--widths 320,390] [--browser chromium|webkit|firefox] [--apply] [--mode body|title] [--smart-quotes] [--optical-hanging] [--timeout 30]\nRead-only by default: it waits for the page\'s own composition to finish (window.TypesetReady from a loader, or every element in scope reporting an outcome), up to --timeout seconds per width. --apply changes only the isolated browser preview. No report is uploaded.\nInstall the optional runner: npm install -D playwright; npx playwright install chromium\nReview items (line ends worth a look, text clipped on purpose with an ellipsis or a line clamp) never fail the gate.\nExit codes: 0 = safety/coverage pass (not aesthetic approval), 1 = failed gate (a failed audit at any width, or any uncaught error or unhandled rejection on the page, listed under "errors"), 2 = invalid invocation/runtime failure.');
  } else {
    if (!values.url) throw new Error('--url is required.');
    const target = new URL(values.url);
    if (!['http:', 'https:'].includes(target.protocol) || target.username || target.password) throw new Error('Use an HTTP(S) URL without embedded credentials.');
    const widths = values.widths.split(',').map(Number);
    if (!widths.length || widths.some(w => !Number.isInteger(w) || w < 100 || w > 4000)) throw new Error('Widths must be integers from 100 to 4000.');
    if (!['chromium', 'webkit', 'firefox'].includes(values.browser)) throw new Error('Choose chromium, webkit, or firefox.');
    if (!['body', 'title'].includes(values.mode)) throw new Error('Mode must be body or title.');
    const timeout = Number(values.timeout);
    if (!Number.isFinite(timeout) || timeout < 1 || timeout > 600) throw new Error('Timeout must be 1 to 600 seconds.');
    let runner;
    try { runner = await import('playwright'); } catch { throw new Error('Install the optional runner: npm install -D playwright; npx playwright install ' + values.browser); }
    const browser = await runner[values.browser].launch({ executablePath: process.env.TYPESET_BROWSER_PATH || undefined });
    const reports = [], errors = [];
    // Run as the automation protocol's own script rather than a <script>
    // element, so a page's Content Security Policy (script-src 'self',
    // Trusted Types) does not refuse the inspector. The page's policy still
    // applies to everything the engine does there.
    const inspectorSource = await readFile(fileURLToPath(new URL('../dist/typeset.global.js', import.meta.url)), 'utf8');
    try {
      for (const width of widths) {
        const page = await browser.newPage({ viewport: { width, height: 900 } });
        page.on('pageerror', error => errors.push({ width, message: error.message }));
        await page.goto(target.href, { waitUntil: 'load', timeout: 30000 });
        page.setDefaultTimeout(timeout * 1000 + 30000);
        await page.evaluate(() => document.fonts.ready);
        // Keep a site's installed global intact. Inspection is not an upgrade.
        await page.evaluate(() => { window.__typesetAuditPrevious = window.Typeset; });
        await page.evaluate(inspectorSource + '\n;undefined');
        const report = await page.evaluate(async options => {
          const inspector = window.Typeset;
          window.Typeset = window.__typesetAuditPrevious;
          delete window.__typesetAuditPrevious;
          const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
          let waited;
          if (options.apply) {
            if ([...document.querySelectorAll(options.selector)].some(el => el.closest('[data-typeset-react-rich], [data-typeset-react]'))) throw new Error('Use the React adapter for framework-owned regions.');
            const controller = inspector.mount(document, options.selector, { mode: options.mode, smartQuotes: options['smart-quotes'] ? 'en' : false, opticalHanging: options['optical-hanging'] });
            await controller.ready;
            controller.disconnect(false);
          } else {
            // Wait for the page's own composition: mount() and the loaders
            // compose what is on screen first and the rest in later batches,
            // so a fixed wait audited a long page half done. A loader says
            // when its first pass is complete (window.TypesetReady); page code
            // (mount(), the React adapters) is done when every element in
            // scope reports an outcome. A page whose composition makes no
            // progress for 2 s (none on the page at all, say) is audited as is.
            const started = performance.now(), limit = options.timeoutMs;
            let reason = 'settled';
            await sleep(150);
            const ready = window.TypesetReady;
            if (ready && typeof ready.then === 'function') {
              reason = await Promise.race([Promise.resolve(ready).then(() => 'ready', () => 'ready'), sleep(Math.max(0, limit - (performance.now() - started))).then(() => 'timeout')]);
            }
            let done = -1, since = performance.now();
            while (reason !== 'timeout' && inspector.auditJSON(options.selector).unprocessed > 0) {
              const now = document.querySelectorAll('[data-ts-outcome]').length;
              if (now !== done) { done = now; since = performance.now(); }
              else if (performance.now() - since > 2000) { reason = 'no progress'; break; }
              if (performance.now() - started > limit) { reason = 'timeout'; break; }
              await sleep(250);
            }
            waited = { ms: Math.round(performance.now() - started), until: reason };
          }
          const report = inspector.auditJSON(options.selector);
          if (waited && report.unprocessed) waited.unprocessed = report.issues.filter(issue => issue.type === 'unprocessed').slice(0, 10).map(issue => issue.target);
          return { ...report, ...(waited && { waited }) };
        }, { ...values, timeoutMs: timeout * 1000 });
        reports.push({ width, inspectorVersion: report.engineVersion, ...report });
        await page.close();
      }
    } finally { await browser.close(); }
    const pass = reports.length > 0 && reports.every(report => report.pass) && errors.length === 0;
    console.log(JSON.stringify({ schemaVersion: 1, browser: values.browser, previewApplied: values.apply, pass, reports, errors }, null, 2));
    if (!pass) process.exitCode = 1;
  }
} catch (error) {
  console.error(JSON.stringify({ pass: false, error: error instanceof Error ? error.message : String(error) }));
  process.exitCode = 2;
}
