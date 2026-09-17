import { mkdir, writeFile } from 'node:fs/promises';
import { browsers } from './browsers.mjs';
import { releaseIdentity } from './release-evidence.mjs';
import { acceptanceFixture } from './acceptance-fixture.mjs';

const fixture = await acceptanceFixture();
const report = { ...await releaseIdentity(), generated: new Date().toISOString(), scope: 'Desktop browser automation with mobile viewport/touch emulation. Accessibility-tree and keyboard checks, not VoiceOver/NVDA or physical-device certification.', browsers: {}, checks: [], errors: [] };
await mkdir('output/playwright', { recursive: true });
try {
  for (const config of browsers) {
    const browser = await config.engine.launch({ executablePath: config.executablePath });
    report.browsers[config.name] = browser.version();
    const check = (label, pass, detail) => report.checks.push({ browser: config.name, label, pass: !!pass, detail });
    try {
      const context = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: config.name !== 'firefox', deviceScaleFactor: 3 });
      const page = await context.newPage();
      page.on('pageerror', e => report.errors.push({ browser: config.name, error: e.message }));
      await page.goto(fixture.url);
      const source = await page.locator('#passages').textContent();
      const original = await page.locator('#passages').innerHTML();
      // Compare the educated source before rendering with its composed AX tree.
      await page.evaluate(() => {
        const p = document.querySelector('#first'); const text = Typeset.smartQuotes(p.textContent); let offset = 0;
        const walker = document.createTreeWalker(p, NodeFilter.SHOW_TEXT); window.originalText = [];
        while(walker.nextNode()) { const node = walker.currentNode; originalText.push([node,node.data]); node.data = text.slice(offset, offset + node.length); offset += node.length; }
      });
      const ax = await page.locator('#passages').ariaSnapshot();
      const nativeCopyText = await page.evaluate(() => { const range=document.createRange();range.selectNodeContents(document.querySelector('#passages'));getSelection().removeAllRanges();getSelection().addRange(range);const text=getSelection().toString();getSelection().removeAllRanges();return text; });
      await page.evaluate(() => originalText.forEach(([node,text]) => node.data = text));
      const listAX = await page.locator('#list').ariaSnapshot();
      await page.locator('#first a').focus(); await page.keyboard.press('Tab');
      const nativeTabTarget = await page.evaluate(() => { window.tabTarget = document.activeElement; return tabTarget.outerHTML; });
      await page.evaluate(() => { window.link = document.querySelector('#first a'); window.head = document.querySelector('#second').firstChild; });
      await page.locator('#first a').focus();
      await page.evaluate(() => compose());
      check('composition does real work', await page.locator('#passages [data-ts-break]').count() > 0);
      check('accessible prose and links unchanged by rendering', ax === await page.locator('#passages').ariaSnapshot(), { before: ax, after: await page.locator('#passages').ariaSnapshot() });
      check('focused author link survives initial composition', await page.evaluate(() => document.activeElement === link && document.querySelector('#first a') === link));
      await page.keyboard.press('Enter');
      check('keyboard activation occurs exactly once', await page.evaluate(() => activations === 1));
      await page.locator('#first a').focus(); await page.keyboard.press('Tab');
      check('Tab traversal matches native browser behavior', await page.evaluate(() => document.activeElement === tabTarget), nativeTabTarget);
      await page.evaluate(() => Typeset.styleProseLists(document.querySelector('main')));
      check('native list AX semantics unchanged', listAX === await page.locator('#list').ariaSnapshot());
      const copied = await page.evaluate(() => {
        const host = document.querySelector('#passages'), range = document.createRange(); range.selectNodeContents(host);
        getSelection().removeAllRanges(); getSelection().addRange(range);
        const event = new ClipboardEvent('copy', { bubbles:true, cancelable:true, clipboardData:new DataTransfer() }); host.dispatchEvent(event);
        const result = { handled:event.defaultPrevented, text:event.clipboardData.getData('text/plain'), html:event.clipboardData.getData('text/html'), expected:[...host.children].map(p=>p.textContent).join('\n\n'), url:document.querySelector('#first a').href };
        const inputCopy = new ClipboardEvent('copy', { bubbles:true, cancelable:true, clipboardData:new DataTransfer() }); document.querySelector('#plain').dispatchEvent(inputCopy); result.inputUntouched = !inputCopy.defaultPrevented;
        const authored = document.querySelector('#authored'); range.setEnd(authored,authored.childNodes.length);
        const mixed = new ClipboardEvent('copy', { bubbles:true, cancelable:true, clipboardData:new DataTransfer() }); host.dispatchEvent(mixed);
        result.mixed = mixed.clipboardData.getData('text/plain'); result.mixedHTML = mixed.clipboardData.getData('text/html');
        const siteHandler = e => { e.clipboardData.setData('text/plain','Site-owned copy'); e.preventDefault(); };
        host.addEventListener('copy', siteHandler); const custom = new ClipboardEvent('copy', { bubbles:true, cancelable:true, clipboardData:new DataTransfer() }); host.dispatchEvent(custom); host.removeEventListener('copy',siteHandler);
        result.siteHandler = custom.clipboardData.getData('text/plain'); getSelection().removeAllRanges(); return result;
      });
      check('cross-paragraph plain copy preserves native block boundaries, not visual breaks', copied.handled && copied.text === nativeCopyText, { ...copied, nativeCopyText });
      check('cross-paragraph rich copy cleans markers and retains portable links', !copied.html.includes('data-ts-') && !copied.html.includes('data-typeset-done') && copied.html.includes(copied.url) && copied.html.includes('<em>'), copied.html);
      check('mixed selection preserves authored line breaks', copied.mixed.endsWith('An authored line.\nAnother authored line.') && copied.mixedHTML.includes('<br>'));
      check('copy respects native input and site handlers', copied.inputUntouched && copied.siteHandler === 'Site-owned copy');
      await page.evaluate(() => {
        const nodes = []; const walker = document.createTreeWalker(document.querySelector('#first'), NodeFilter.SHOW_TEXT); while(walker.nextNode()) nodes.push(walker.currentNode);
        getSelection().setBaseAndExtent(nodes.at(-1), nodes.at(-1).length - 3, nodes[0], 3); window.selected = getSelection().getRangeAt(0).toString();
      });
      for (const width of [320, 568, 280, 768, 390]) {
        await page.setViewportSize({ width, height: width > 500 ? 390 : 844 });
        await page.waitForTimeout(160);
        const state = await page.evaluate(() => ({ text: document.querySelector('#passages').textContent, selected: getSelection().getRangeAt(0).toString(), expectedSelection: selected, anchorAfterFocus: (() => { const s=getSelection(); const r=document.createRange();r.setStart(s.anchorNode,s.anchorOffset);r.setEnd(s.focusNode,s.focusOffset);return r.collapsed; })(), overflow: document.documentElement.scrollWidth - innerWidth, same: document.querySelector('#first a') === link && document.querySelector('#second').contains(head), outcomes: [...document.querySelectorAll('[data-compose]')].map(p => p.dataset.tsOutcome) }));
        check('rotation/reflow preserves text, reverse selection and nodes at ' + width, state.text === source.replaceAll('"Read', '\u201cRead').replace("curator's", 'curator\u2019s').replace('gallery,"', 'gallery,\u201d').replace('"There', '\u201cThere').replace('discover."', 'discover.\u201d') && state.selected === state.expectedSelection && state.anchorAfterFocus && state.same && state.overflow <= 1, state);
      }
      await page.evaluate(() => getSelection().removeAllRanges());
      for (const size of [36, 72]) {
        await page.evaluate(size => { document.querySelector('#passages').style.fontSize = size + 'px'; }, size);
        await page.waitForTimeout(180);
        const audit = await page.evaluate(() => ({ report: Typeset.auditJSON('[data-compose]'), elements: [...document.querySelectorAll('[data-compose]')].map(p => ({ outcome: p.dataset.tsOutcome, overflow: Typeset.measureLayout(p).overflow })) }));
        check('text enlargement remains honest at ' + size + 'px', audit.elements.every(item => item.outcome?.startsWith('native:') || item.overflow <= .75), audit);
        check('overflow cannot receive a passing audit at ' + size + 'px', !audit.elements.some(item => item.overflow > .75) || (!audit.report.pass && audit.report.issues.some(item=>item.type === 'overflow' && item.severity === 'error')));
        await page.screenshot({ path: `output/playwright/acceptance-${config.name}-${size}.png`, fullPage: true });
      }
      await page.evaluate(() => { document.querySelector('#passages').style.overflowWrap = 'anywhere'; controller.refresh(); });
      await page.waitForTimeout(180);
      const recovery = await page.evaluate(() => ({ overflow: document.documentElement.scrollWidth - innerWidth, outcomes: [...document.querySelectorAll('[data-compose]')].map(p=>p.dataset.tsOutcome), audit: Typeset.auditJSON('[data-compose]') }));
      check('author emergency wrapping safely recovers at 400% text size', recovery.overflow <= 1 && recovery.audit.pass && recovery.outcomes.every(outcome=>outcome==='native:break-policy'), recovery);
      await page.screenshot({ path: `output/playwright/acceptance-${config.name}-reflow-recovery.png`, fullPage: true });
      await page.evaluate(() => { document.querySelector('#passages').style.fontSize = '18px'; document.querySelector('#passages').style.overflowWrap = 'normal'; });
      // Delayed real variable font, then an update while the observer owns prose.
      await page.evaluate(async () => { const font = new FontFace('AcceptanceFont', 'url(/font.woff2)'); document.fonts.add(font); document.querySelector('#passages').style.fontFamily = 'AcceptanceFont, Georgia'; await font.load(); await document.fonts.ready; });
      await page.waitForTimeout(250);
      check('font loading preserves link identity and source', await page.evaluate(() => document.querySelector('#first a') === link && document.querySelector('#second').contains(head) && document.fonts.check('18px AcceptanceFont')));
      await page.evaluate(() => { document.querySelector('#second strong').textContent = 'Pine Avenue'; });
      await page.waitForTimeout(180);
      check('observed source updates are current', (await page.locator('#second').textContent()).includes('Pine Avenue') && !(await page.locator('#second').textContent()).includes('Oak Street'));
      await page.locator('#first a').tap();
      check('touch-emulated link activation occurs once', await page.evaluate(() => activations === 2));
      await page.click('#restore');
      check('restore removes all generated markers without undoing author edits', await page.locator('#passages [data-ts-break]').count() === 0 && (await page.locator('#second').textContent()).includes('Pine Avenue'));
      await page.goto(fixture.url); await page.evaluate(() => compose()); await page.click('#restore');
      check('untouched source restores byte-for-byte', original === await page.locator('#passages').innerHTML());
      await context.close();
      const noJS = await browser.newContext({ javaScriptEnabled: false, viewport: { width: 320, height: 640 } });
      const nativePage = await noJS.newPage(); await nativePage.goto(fixture.url);
      check('no JavaScript retains readable source and two links', await nativePage.locator('#passages').textContent() === source && await nativePage.locator('#passages a').count() === 2);
      await noJS.close();
    } catch(error) { report.errors.push({ browser: config.name, error: error.stack }); }
    finally { await browser.close(); }
  }
} finally { await fixture.close(); }
report.summary = { checks: report.checks.length, failed: report.checks.filter(c => !c.pass).length, errors: report.errors.length };
await writeFile('output/acceptance.json', JSON.stringify(report, null, 2));
console.log(JSON.stringify({ ...report.summary, failures: report.checks.filter(c => !c.pass), errors: report.errors }, null, 2));
if(report.summary.failed || report.summary.errors) process.exitCode = 1;
