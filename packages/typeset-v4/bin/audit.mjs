#!/usr/bin/env node
import { parseArgs } from 'node:util';
import { fileURLToPath } from 'node:url';

try {
  const { values } = parseArgs({ options: {
    url: { type: 'string' }, selector: { type: 'string', default: '[data-typeset]' },
    widths: { type: 'string', default: '320,390,768,1440' }, apply: { type: 'boolean', default: false },
    browser: { type: 'string', default: 'chromium' }, mode: { type: 'string', default: 'body' },
    help: { type: 'boolean', default: false }, 'smart-quotes': { type: 'boolean', default: false },
    'optical-hanging': { type: 'boolean', default: false },
  } });
  if (values.help) {
    console.log('Usage: typeset-audit --url http://localhost:3000 --selector "article p" [--widths 320,390] [--browser chromium|webkit|firefox] [--apply] [--mode body|title] [--smart-quotes] [--optical-hanging]\nRead-only by default. --apply changes only the isolated browser preview. No report is uploaded.\nInstall the optional runner: npm install -D playwright; npx playwright install chromium\nExit codes: 0 = safety/coverage pass (not aesthetic approval), 1 = failed gate, 2 = invalid invocation/runtime failure.');
  } else {
    if (!values.url) throw new Error('--url is required.');
    const target = new URL(values.url);
    if (!['http:', 'https:'].includes(target.protocol) || target.username || target.password) throw new Error('Use an HTTP(S) URL without embedded credentials.');
    const widths = values.widths.split(',').map(Number);
    if (!widths.length || widths.some(w => !Number.isInteger(w) || w < 100 || w > 4000)) throw new Error('Widths must be integers from 100 to 4000.');
    if (!['chromium', 'webkit', 'firefox'].includes(values.browser)) throw new Error('Choose chromium, webkit, or firefox.');
    if (!['body', 'title'].includes(values.mode)) throw new Error('Mode must be body or title.');
    let runner;
    try { runner = await import('playwright'); } catch { throw new Error('Install the optional runner: npm install -D playwright; npx playwright install ' + values.browser); }
    const browser = await runner[values.browser].launch({ executablePath: process.env.TYPESET_BROWSER_PATH || undefined });
    const reports = [], errors = [];
    try {
      for (const width of widths) {
        const page = await browser.newPage({ viewport: { width, height: 900 } });
        page.on('pageerror', error => errors.push({ width, message: error.message }));
        await page.goto(target.href, { waitUntil: 'load', timeout: 30000 });
        await page.evaluate(() => document.fonts.ready);
        // Keep a site's installed global intact. Inspection is not an upgrade.
        await page.evaluate(() => { window.__typesetAuditPrevious = window.Typeset; });
        await page.addScriptTag({ path: fileURLToPath(new URL('../dist/typeset.global.js', import.meta.url)) });
        const report = await page.evaluate(async options => {
          const inspector = window.Typeset;
          window.Typeset = window.__typesetAuditPrevious;
          delete window.__typesetAuditPrevious;
          if (options.apply) {
            if ([...document.querySelectorAll(options.selector)].some(el => el.closest('[data-typeset-react-rich], [data-typeset-react]'))) throw new Error('Use the React adapter for framework-owned regions.');
            const controller = inspector.mount(document, options.selector, { mode: options.mode, smartQuotes: options['smart-quotes'] ? 'en' : false, opticalHanging: options['optical-hanging'] });
            await controller.ready;
            controller.disconnect(false);
          } else {
            await new Promise(resolve => setTimeout(resolve, 150));
          }
          return inspector.auditJSON(options.selector);
        }, values);
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
