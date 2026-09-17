import { readFile, writeFile } from 'node:fs/promises';
import { build } from 'esbuild';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { browsers } from './browsers.mjs';

// A script-free public /week snapshot isolates composition from React, server,
// and network costs. Both versions get the same text targets and real CSS.
const fixture = await readFile(process.env.SCENEF_FIXTURE || 'output/scenef-week-static.html', 'utf8');
const released = await readFile('public/releases/4.0.0/typeset.global.js', 'utf8');
const candidate = (await build({ entryPoints: ['src/lib/v4/typeset.release.ts'], bundle: true, format: 'iife', globalName: 'Typeset', write: false })).outputFiles[0].text;
const currentCore = await readFile('src/lib/v4/typeset.next.ts', 'utf8');
const previousCore = execFileSync('git', ['show', 'ac8f5aa:src/lib/v4/typeset.next.ts'], { encoding: 'utf8' });
const mountStart = text => text.indexOf('export function mount(');
const mountEnd = text => text.indexOf('\nexport { measureLayout, contentWidth');
const controlSource = currentCore.slice(0, mountStart(currentCore)) + previousCore.slice(mountStart(previousCore), mountEnd(previousCore)) + currentCore.slice(mountEnd(currentCore));
const control = (await build({ entryPoints: ['src/lib/v4/typeset.release.ts'], bundle: true, format: 'iife', globalName: 'Typeset', write: false,
  plugins: [{ name: 'previous-scheduler-control', setup(builder) { builder.onLoad({ filter: /typeset\.next\.ts$/ }, args => ({ contents: controlSource, loader: 'ts', resolveDir: args.path.slice(0, args.path.lastIndexOf('/')) })); } }],
})).outputFiles[0].text;
const report = { fixtureSHA256: createHash('sha256').update(fixture).digest('hex'), capturedPage: 'https://scenef.com/week',
  candidateSHA256: createHash('sha256').update(candidate).digest('hex'),
  cpuThrottle: Number(process.env.CPU_THROTTLE || 1),
  options: { smartQuotes: 'en', opticalHanging: true, spacing: true, tracking: true },
  note: 'Static real-page composition benchmark, not an end-to-end load-time or physical-device score.', runs: [] };
const { engine, executablePath } = browsers[0];
const browser = await engine.launch({ executablePath });
try {
  for (const variant of [{ name: 'released-4.0.0', script: released }, { name: 'same-compositor-old-scheduler', script: control }, { name: 'candidate', script: candidate }]) {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    await page.route('**/*', route => ['image', 'media'].includes(route.request().resourceType()) ? route.abort() : route.continue());
    await page.setContent(fixture, { waitUntil: 'load', timeout: 120000 });
    await page.evaluate(() => document.fonts.ready);
    await page.addScriptTag({ content: variant.script });
    if (report.cpuThrottle > 1) {
      const cdp = await page.context().newCDPSession(page);
      await cdp.send('Emulation.setCPUThrottlingRate', { rate: report.cpuThrottle });
    }
    await page.evaluate(() => {
      for (const root of document.querySelectorAll('main, header, footer')) for (const el of root.querySelectorAll('*')) {
        if (!(el instanceof HTMLElement) || el.closest('button,input,select,textarea,nav,script,style,template') || el.classList.contains('tnum')) continue;
        const count = [...el.childNodes].filter(node => node.nodeType === Node.TEXT_NODE).reduce((sum, node) => sum + (node.textContent || '').trim().split(/\s+/).filter(Boolean).length, 0);
        if (count >= 2 && !el.hasAttribute('data-bench-text')) el.setAttribute('data-bench-text', '');
      }
    });
    const result = await page.evaluate(async options => {
      const api = window.Typeset, targets = [...document.querySelectorAll('[data-bench-text]')];
      let maxGap = 0, last = performance.now();
      const heartbeat = setInterval(() => { const now = performance.now(); maxGap = Math.max(maxGap, now - last); last = now; }, 16);
      const longTasks = [];
      const observer = new PerformanceObserver(list => longTasks.push(...list.getEntries().map(entry => ({ start: entry.startTime, duration: entry.duration }))));
      observer.observe({ type: 'longtask' });
      const start = performance.now();
      const controller = api.mount(document, '[data-bench-text]', options);
      await controller.ready;
      const elapsed = performance.now() - start;
      await new Promise(resolve => setTimeout(resolve, 100));
      observer.disconnect(); clearInterval(heartbeat);
      const initial = { ...controller.stats };
      const outcomes = targets.reduce((out, element) => { const key = element.dataset.tsOutcome || 'unprocessed'; out[key] = (out[key] || 0) + 1; return out; }, {});
      const composed = targets.filter(el => el.dataset.tsOutcome?.startsWith('composed')).length;
      const features = Object.fromEntries(['tsQuotes', 'tsHanging', 'tsSpacing', 'tsTracking'].map(feature => [feature,
        targets.reduce((counts, el) => { const outcome = el.dataset[feature] || 'unprocessed'; counts[outcome] = (counts[outcome] || 0) + 1; return counts; }, {})]));
      const hangingFontContexts = [...new Set(targets.filter(el => el.dataset.tsHanging === 'native:hanging-font').map(el => {
        const cs = getComputedStyle(el);
        return JSON.stringify({ family: cs.fontFamily, features: cs.fontFeatureSettings, variations: cs.fontVariationSettings, variant: cs.fontVariant, sizeAdjust: cs.fontSizeAdjust });
      }))].slice(0, 8).map(value => JSON.parse(value));
      const compositionSignature = targets.map(el => el.dataset.tsOutcome + ':' + el.innerHTML).join('|');
      // An unrelated clock tick must not trigger a new whole-document pass.
      const clock = document.createElement('aside'); document.body.append(clock);
      const query = document.querySelectorAll;
      let fullScans = 0;
      document.querySelectorAll = function (...args) { fullScans++; return query.apply(this, args); };
      const passes = controller.stats.passes;
      for (let n = 0; n < 12; n++) { clock.replaceChildren(document.createTextNode(String(n))); await new Promise(resolve => setTimeout(resolve, 20)); }
      document.querySelectorAll = query;
      const mutationPasses = controller.stats.passes - passes;
      const measured = longTasks.filter(task => task.start + task.duration > start && task.start <= start + elapsed);
      controller.disconnect(false);
      return { engine: api.VERSION, elements: document.querySelectorAll('*').length, targets: targets.length, composed, outcomes, features, hangingFontContexts,
        elapsedMs: elapsed, maxHeartbeatGapMs: maxGap, maxBatchMs: initial.maxBatchMs, batches: initial.passes,
        blockingMs: measured.reduce((sum, task) => sum + Math.max(0, task.duration - 50), 0),
        longestTaskMs: Math.max(0, ...measured.map(task => task.duration)), compositionSignature,
        unrelatedMutationFullScans: fullScans, unrelatedMutationPasses: mutationPasses };
    }, report.options);
    const { compositionSignature, ...metrics } = result;
    report.runs.push({ variant: variant.name, ...metrics, compositionSHA256: createHash('sha256').update(compositionSignature).digest('hex') });
    console.log(JSON.stringify(report.runs.at(-1), null, 2));
    await page.close();
  }
} finally { await browser.close(); }
const controlRun = report.runs.find(run => run.variant === 'same-compositor-old-scheduler');
const candidateRun = report.runs.find(run => run.variant === 'candidate');
report.acceptance = { actualComposition: candidateRun.composed > 0,
  identicalOutput: controlRun.compositionSHA256 === candidateRun.compositionSHA256,
  sameTargets: controlRun.targets === candidateRun.targets,
  noUnrelatedScans: candidateRun.unrelatedMutationFullScans === 0 && candidateRun.unrelatedMutationPasses === 0 };
await writeFile(`output/scenef-composition-benchmark-${report.cpuThrottle}x.json`, JSON.stringify(report, null, 2));
if (Object.values(report.acceptance).some(pass => !pass)) process.exitCode = 1;
