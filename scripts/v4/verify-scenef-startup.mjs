import { writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { browsers } from './browsers.mjs';

const base = process.env.SCENEF_URL || 'http://127.0.0.1:4213';
const { engine, executablePath } = browsers[0];
const browser = await engine.launch({ executablePath });
const report = { base, cpuSlowdown: 4, samples: [], checks: [], errors: [] };
try {
  for (const width of [375, 1440]) for (const path of ['/capecoral', '/week']) {
    const pair = [];
    let documentSnapshot;
    for (const enabled of [false, true]) {
      const context = await browser.newContext({ viewport: { width, height: 900 } });
      await context.addInitScript(on => {
        window.__scenefTypesetDisabled = !on;
        window.__typesetLongTasks = [];
        new PerformanceObserver(list => window.__typesetLongTasks.push(...list.getEntries().map(e => ({ start: e.startTime, duration: e.duration })))).observe({ type: 'longtask', buffered: true });
      }, enabled);
      const page = await context.newPage();
      // Replay the same server document: the live board changes while testing.
      // Hydration and all scripts still run normally in both independent contexts.
      if (documentSnapshot) await page.route(base + path, route => route.fulfill(documentSnapshot));
      page.on('pageerror', error => report.errors.push({ width, path, enabled, error: error.message }));
      const cdp = await context.newCDPSession(page);
      await cdp.send('Emulation.setCPUThrottlingRate', { rate: report.cpuSlowdown });
      const response = await page.goto(base + path, { waitUntil: 'networkidle', timeout: 120000 });
      if (!documentSnapshot) {
        const headers = await response.allHeaders();
        delete headers['content-encoding']; delete headers['content-length']; delete headers['transfer-encoding'];
        documentSnapshot = { status: response.status(), headers, body: await response.body() };
      }
      await page.waitForFunction(() => window.__scenefTypeset?.version);
      await page.evaluate(() => window.__scenefTypeset.ready);
      await page.waitForTimeout(1200);
      const before = await page.evaluate(() => {
        const api = window.__scenefTypeset;
        const targets = [...document.querySelectorAll(api.selectors.titles + ',' + api.selectors.prose)];
        return { version: api.version, enabled: api.enabled, text: targets.map(el => el.textContent).join('\n'), targets: targets.length,
          composed: document.querySelectorAll('[data-ts-outcome^="composed:"]').length, stats: api.stats(),
          longTasks: window.__typesetLongTasks, paint: performance.getEntriesByType('paint').map(e => ({ name: e.name, start: e.startTime })),
          height: document.documentElement.scrollHeight };
      });
      const scrollStart = await page.evaluate(() => performance.now());
      const steps = 30;
      for (let i = 0; i <= steps; i++) {
        await page.evaluate(fraction => scrollTo(0, (document.documentElement.scrollHeight - innerHeight) * fraction), i / steps);
        await page.waitForTimeout(100);
      }
      await page.waitForTimeout(600);
      const after = await page.evaluate(start => ({ stats: window.__scenefTypeset.stats(), longTasks: window.__typesetLongTasks.filter(e => e.start >= start),
        outcomes: [...document.querySelectorAll('[data-ts-outcome]')].reduce((counts, el) => { counts[el.dataset.tsOutcome] = (counts[el.dataset.tsOutcome] || 0) + 1; return counts; }, {}) }), scrollStart);
      const sourceHash = createHash('sha256').update(before.text).digest('hex');
      delete before.text;
      const summary = entries => ({ count: entries.length, longestMs: Math.max(0, ...entries.map(e => e.duration)), blockingMs: entries.reduce((total, e) => total + Math.max(0, e.duration - 50), 0) });
      const sample = { width, path, enabled, sourceHash, ...before, startup: summary(before.longTasks), scroll: summary(after.longTasks), after };
      report.samples.push(sample); pair.push(sample);
      console.log(JSON.stringify({ width, path, enabled, startup: sample.startup, scroll: sample.scroll, stats: after.stats }));
      await context.close();
    }
    const [off, on] = pair;
    report.checks.push({ width, path, label: 'same hydrated target text with true pre-mount off', pass: off.sourceHash === on.sourceHash && off.targets === on.targets && !off.enabled && on.enabled && off.composed === 0 && on.stats.some(s => s.passes > 0) });
    report.checks.push({ width, path, label: 'no observed one-second main-thread task', pass: on.startup.longestMs < 1000 && on.scroll.longestMs < 1000, off: { startup: off.startup, scroll: off.scroll }, on: { startup: on.startup, scroll: on.scroll } });
  }
} catch (error) { report.errors.push({ error: error.stack }); }
finally { await browser.close(); }
await writeFile('output/scenef-startup-4.2.json', JSON.stringify(report, null, 2));
const failures = report.checks.filter(check => !check.pass);
console.log(JSON.stringify({ checks: report.checks.length, failures, errors: report.errors }, null, 2));
if (failures.length || report.errors.length) process.exitCode = 1;
