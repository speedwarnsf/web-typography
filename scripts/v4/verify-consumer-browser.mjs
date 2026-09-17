import { readFile, writeFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { browsers } from './browsers.mjs';
const installed = JSON.parse(await readFile('output/package-verification.json', 'utf8'));
if (!installed.verificationToken) throw new Error('Rebuild the packed consumer to obtain its verification token.');
const reserve = createServer();
await new Promise(resolve => reserve.listen(0, '127.0.0.1', resolve));
const available = reserve.address().port;
await new Promise(resolve => reserve.close(resolve));
const port = process.env.CONSUMER_PORT || String(available);
const base = 'http://127.0.0.1:' + port;
const server = spawn('node', ['node_modules/next/dist/bin/next', 'start', '-p', port, '-H', '127.0.0.1'], { cwd: installed.consumer, stdio: 'inherit', env: { ...process.env, NEXT_TELEMETRY_DISABLED: '1' } });
const report = { version: installed.version, artifactSHA256: installed.artifactSHA256, verificationToken: installed.verificationToken, base, next: installed.next, react: installed.react, browsers: {}, checks: [], errors: [] };
try {
  let ready = false;
  for (let n = 0; n < 100; n++) {
    if (server.exitCode !== null) throw new Error('Consumer server exited before readiness');
    try {
      const response = await fetch(base + '/typeset-artifact.json');
      if (response.ok) {
        const identity = await response.json();
        if (identity.verificationToken === installed.verificationToken && identity.artifactSHA256 === installed.artifactSHA256) { ready = true; break; }
      }
    } catch {}
    await new Promise(r => setTimeout(r, 100));
  }
  if (!ready) throw new Error('Consumer server timed out');
  if (server.exitCode !== null) throw new Error('Consumer server exited during readiness');
  for (const { name, engine, executablePath } of browsers) {
    const browser = await engine.launch({ executablePath });
    report.browsers[name] = browser.version();
    const check = (label, pass, detail) => report.checks.push({ browser: name, label, pass: !!pass, detail });
    try {
      const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
      page.on('pageerror', error => report.errors.push({ browser: name, message: error.message }));
      page.on('console', message => { if (message.type() === 'error') report.errors.push({ browser: name, message: message.text(), location: message.location() }); });
      const response = await page.goto(base);
      const html = await response.text();
      check('SSR includes educated source and semantic markup', html.includes('\u201cA room for looking closely,\u201d') && html.includes('<strong>the curator</strong>'));
      await page.waitForSelector('#react-specimen[data-typeset-done]');
      await page.waitForTimeout(150);
      check('React actually composes rich markup', await page.locator('#react-specimen').getAttribute('data-ts-outcome') === 'composed:rich');
      check('React optical hanging actually applies', await page.locator('#react-specimen').getAttribute('data-ts-hanging') === 'applied' && await page.locator('#react-specimen [data-ts-hang]').count() > 0);
      await page.evaluate(() => { window.originalLink = document.querySelector('#react-specimen a'); });
      await page.locator('#react-specimen a').focus(); await page.keyboard.press('Enter');
      await page.waitForTimeout(150);
      check('keyboard activation is singular and retains focus', (await page.locator('#activations').textContent()) === '1 link activations' && await page.evaluate(() => document.activeElement === window.originalLink));
      const accessible = await page.locator('#react-specimen').ariaSnapshot();
      check('one complete accessible link name', await page.locator('#react-specimen').getByRole('link', { name: 'the neighborhood gallery', exact: true }).count() === 1, accessible);
      check('declarative bullet styling retains list semantics', await page.locator('#declarative-list').getAttribute('class') === 'ts-styled' && (await page.locator('#declarative-list').ariaSnapshot()).includes('listitem'));
      const copy = await page.evaluate(() => {
        const el = document.querySelector('#react-specimen'); const range = document.createRange(); range.selectNodeContents(el); getSelection().removeAllRanges(); getSelection().addRange(range);
        const e = new ClipboardEvent('copy', { bubbles: true, cancelable: true, clipboardData: new DataTransfer() }); el.dispatchEvent(e);
        const result = { expected: el.textContent, text: e.clipboardData.getData('text/plain'), html: e.clipboardData.getData('text/html') }; getSelection().removeAllRanges(); return result;
      });
      check('React copy excludes rendering markers and preserves emphasis', copy.text === copy.expected && !copy.html.includes('data-ts-') && copy.html.includes('<strong>'));
      await page.click('#update'); await page.waitForTimeout(180);
      check('React source update uses current educated text', (await page.locator('#react-specimen').textContent()).includes('artist\u2019s letters') && await page.evaluate(() => document.querySelector('#react-specimen a') === window.originalLink));
      await page.uncheck('#quotes'); await page.waitForTimeout(180);
      check('quote option reverses without stale text', (await page.locator('#react-specimen').textContent()).startsWith('"Read') && (await page.locator('#react-specimen').textContent()).includes("artist's letters"));
      await page.check('#quotes'); await page.waitForTimeout(180);
      check('plain React adapter receives new source', (await page.locator('#plain-specimen').textContent()).includes('\u201cThe artist'));
      await page.click('#toggle'); check('clean unmount', await page.locator('#react-specimen').count() === 0);
      await page.click('#toggle'); await page.waitForSelector('#react-specimen[data-typeset-done]');
      check('remount keeps latest source', (await page.locator('#react-specimen').textContent()).includes('artist\u2019s letters'));
      for (const width of [320, 390, 768, 1440]) {
        await page.setViewportSize({ width, height: 900 }); await page.waitForTimeout(180);
        check('no document overflow at ' + width, await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
        await page.screenshot({ path: `output/playwright/release-next-${name}-${width}.png`, fullPage: true });
      }
    } catch (error) { report.errors.push({ browser: name, message: error.stack }); }
    finally { await browser.close(); }
  }
} finally {
  if (server.exitCode === null && server.signalCode === null) await new Promise(resolve => { server.once('exit', resolve); server.kill('SIGTERM'); });
}
report.summary = { checks: report.checks.length, failed: report.checks.filter(c => !c.pass).length, errors: report.errors.length };
await writeFile('output/consumer-browser.json', JSON.stringify(report, null, 2));
console.log(JSON.stringify({ ...report.summary, failures: report.checks.filter(c => !c.pass), errors: report.errors }, null, 2));
if (report.summary.failed || report.summary.errors) process.exitCode = 1;
