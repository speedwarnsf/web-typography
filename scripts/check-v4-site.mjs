import { chromium, webkit, firefox } from 'playwright';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { existsSync, readdirSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';

const base = process.env.SITE_URL || 'http://127.0.0.1:4205';
assert.ok(/^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(base), 'Only a local release preview may be tested');
await mkdir('output/playwright', { recursive: true });
const report = { base, checks: 0, browsers: [], errors: [] };
let pilot;
const check = (condition, label) => { assert.ok(condition, label); report.checks++; };
function cached(prefix, suffix) {
  const root = join(homedir(), 'Library/Caches/ms-playwright');
  if (!existsSync(root)) return undefined;
  for (const entry of readdirSync(root).filter(name => name.startsWith(prefix)).sort().reverse()) {
    const file = join(root, entry, suffix);
    if (existsSync(file)) return file;
  }
}
const engines = [
  [chromium, cached('chromium_headless_shell-', 'chrome-headless-shell-mac-arm64/chrome-headless-shell')],
  [webkit, cached('webkit-', 'pw_run.sh')],
  [firefox, cached('firefox-', 'firefox/Nightly.app/Contents/MacOS/firefox')],
];
const settled = async page => { await page.evaluate(() => document.fonts.ready); await page.waitForTimeout(150); };
try {
  const manifest = await (await fetch(base + '/v4/manifest.json')).json();
  pilot = createServer((_request, response) => {
    response.setHeader('Content-Type', 'text/html; charset=utf-8');
    response.end(`<!doctype html><html lang="en"><meta charset="utf-8"><title>Cross-origin install pilot</title><style>p{width:280px;font:20px/1.5 Georgia}</style><p data-typeset>A carefully written story deserves a considered setting, with <a href="#story">the links</a> and <strong>the emphasis</strong> still intact.</p><script src="${base}/releases/${manifest.version}/go.js" integrity="${manifest.browser.loaderIntegrity}" crossorigin="anonymous" defer></script></html>`);
  });
  await new Promise(resolve => pilot.listen(0, '127.0.0.1', resolve));
  const pilotURL = 'http://127.0.0.1:' + pilot.address().port;
  check(manifest.version === '4.0.0-beta.1' && !manifest.npmLatestIsV4, 'Explicit beta distribution');
  for (const [name, artifact] of Object.entries(manifest.artifacts)) {
    const response = await fetch(base + '/releases/' + manifest.version + '/' + name);
    check(response.ok, 'Download ' + name);
    const bytes = Buffer.from(await response.arrayBuffer());
    check('sha384-' + createHash('sha384').update(bytes).digest('base64') === artifact.integrity, 'SRI ' + name);
    check(response.headers.get('access-control-allow-origin') === '*', 'Cross-origin ' + name);
  }
  const tarball = await fetch(base + new URL(manifest.packageURL).pathname);
  check(tarball.ok, 'Package download');
  check('sha512-' + createHash('sha512').update(Buffer.from(await tarball.arrayBuffer())).digest('base64') === manifest.packageIntegrity, 'Package integrity');
  for (const file of ['public/go.js', 'public/sri.json', ...readdirSync('public').filter(name => /^go@.*\.js$/.test(name)).map(name => 'public/' + name)]) {
    check((await readFile(file)).equals(execFileSync('git', ['show', '58e685b:' + file])), 'Unchanged V3 ' + file);
  }
  for (const path of ['/for-agents', '/for-agents.md', '/for-agents-v3.md', '/llms.txt', '/v4/SKILL.md', '/v4/capabilities.json', '/v4/acceptance.json', '/v4/social.png', '/robots.txt', '/sitemap.xml']) {
    check((await fetch(base + path)).ok, 'Discovery resource ' + path);
  }
  for (const [engine, executablePath] of engines) {
    const browser = await engine.launch({ headless: true, executablePath });
    try {
      const page = await browser.newPage();
      const errors = [];
      const consoleErrors = [];
      page.on('console', message => { if (message.type() === 'error') consoleErrors.push(message.text()); });
      page.on('pageerror', error => errors.push(error.message));
      await page.route('https://ntfy.sh/**', route => route.fulfill({ status: 204 }));
      // Test the copy controls without replacing the user's system clipboard.
      await page.addInitScript(() => {
        window.__copied = [];
        Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: async text => { window.__copied.push(text); } } });
      });
      for (const [width, height] of [[320,568], [390,844], [768,1024], [1440,1000], [1920,900]]) {
        await page.setViewportSize({ width, height });
        for (const path of ['/', '/v4', '/agents']) {
          const response = await page.goto(base + path);
          check(response.ok() || response.status() === 304, engine.name() + ' route ' + path + ' status ' + response.status());
          await settled(page);
          check(await page.locator('main h1').count() === 1, 'One primary heading');
          check(await page.locator('.v4-site').count() === 1, 'New route shell');
          const overflow = await page.locator('.v4-site').evaluate(root => [...root.querySelectorAll('h1,h2,h3,p,a,button,pre,select,textarea,table')].filter(el => {
            if (!el.getClientRects().length || el.classList.contains('v4-skip')) return false;
            const r = el.getBoundingClientRect();
            return r.left < -1 || r.right > innerWidth + 1;
          }).map(el => el.tagName + ':' + el.textContent.slice(0, 60)));
          check(!overflow.length, engine.name() + ' overflow ' + width + ' ' + path + ' ' + overflow);
          if (path === '/') {
            await page.waitForFunction(() => document.querySelector('#typeset-proof')?.dataset.tsOutcome);
            check(await page.locator('#native-proof').textContent() === await page.locator('#typeset-proof').textContent(), 'Rich source preserved');
            check(await page.locator('#typeset-proof a').count() === 1 && await page.locator('#typeset-proof strong').count() === 1, 'Inline semantics preserved');
            check(await page.locator('.v4-hero-art').evaluate(img => img.complete && img.naturalWidth > 0), 'Hero bitmap loaded');
            check(await page.locator('.v4-release-strip').evaluate(el => el.getBoundingClientRect().top < innerHeight), 'Next section visible ' + width);
          }
          if (engine === chromium && [320,390,1440].includes(width)) {
            await page.screenshot({ path: 'output/playwright/' + (path === '/' ? 'home' : path.slice(1)) + '-' + width + '.png', fullPage: true });
          }
        }
      }
      await page.setViewportSize({ width: 1440, height: 1000 });
      await page.goto(base);
      await settled(page);
      await page.getByRole('combobox', { name: 'Passage' }).selectOption('custom');
      await page.getByRole('textbox', { name: 'Your passage' }).fill('Read the whole story. The thoughtful details make a familiar place feel different, without changing the things that made it matter.');
      await page.getByRole('slider', { name: 'Text measure' }).fill('260');
      await page.getByRole('checkbox', { name: 'Optical hanging' }).uncheck();
      await page.waitForFunction(() => document.querySelector('#typeset-proof')?.dataset.tsOutcome);
      check(await page.locator('#native-proof').textContent() === await page.locator('#typeset-proof').textContent(), 'Custom update preserved');
      check(await page.getByRole('slider').inputValue() === '260', 'Measure control');
      await page.getByRole('button', { name: 'Copy agent prompt', exact: true }).click();
      check((await page.evaluate(() => window.__copied.at(-1))).includes('https://typeset.us/for-agents.md'), 'Agent prompt copy');
      await page.getByRole('navigation', { name: 'Primary', exact: true }).getByRole('link', { name: 'Get V4' }).click();
      await page.getByRole('tab', { name: 'Script', exact: true }).focus();
      await page.keyboard.press('ArrowRight');
      check(await page.getByRole('tab', { name: 'React', exact: true }).getAttribute('aria-selected') === 'true', 'Keyboard tabs');
      await page.getByRole('button', { name: 'Copy React snippet', exact: true }).click();
      check((await page.evaluate(() => window.__copied.at(-1))).includes('TypesetRichText'), 'React snippet copy');
      await page.getByRole('tab', { name: 'DOM', exact: true }).click();
      check((await page.getByRole('tabpanel').textContent()).includes('controller.disconnect()'), 'DOM teardown instructions');
      await page.getByRole('tab', { name: 'Script', exact: true }).click();
      check((await page.getByRole('tabpanel').textContent()).includes(manifest.browser.loaderIntegrity), 'Script SRI matches distribution');
      await page.getByRole('link', { name: 'Legacy V3 platform guides' }).click();
      check(await page.locator('.in-label').first().textContent() === 'Legacy V3 installation', 'Legacy guide label');
      await page.getByRole('link', { name: 'Install V4 beta with the new scoped loader or React adapters.' }).click();
      await page.locator('.v4-site').waitFor();
      check(await page.locator('.v4-site').count() === 1, 'Legacy to V4 route lifecycle');
      await page.getByRole('link', { name: 'typeset.ts', exact: true }).first().click();
      await page.waitForFunction(() => document.querySelector('#typeset-proof')?.dataset.tsOutcome);
      check(await page.locator('#typeset-proof a').count() === 1, 'Rich adapter after legacy navigation');
      await page.goto(pilotURL);
      await page.waitForFunction(() => Boolean(window.TypesetReady)).catch(error => { throw new Error(error.message + ' Loader console: ' + consoleErrors.join('; ')); });
      await page.evaluate(() => window.TypesetReady);
      check(await page.evaluate(() => window.Typeset.VERSION) === manifest.version, 'Cross-origin loader version');
      check(await page.evaluate(() => window.Typeset.auditJSON('[data-typeset]').pass), 'Installed loader audit');
      check(await page.locator('[data-typeset] a').count() === 1, 'Installed loader link preservation');
      check(!errors.length, engine.name() + ' page errors ' + errors.join('; '));
      report.browsers.push({ engine: engine.name(), version: browser.version(), routes: 3, viewports: 5, errors });
    } finally { await browser.close(); }
  }
} catch (error) {
  report.errors.push(error.stack);
  process.exitCode = 1;
} finally {
  if (pilot) await new Promise(resolve => pilot.close(resolve));
  await writeFile('output/playwright/launch-acceptance.json', JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
}
