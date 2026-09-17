import { readFile, writeFile } from 'node:fs/promises';
import { browsers } from './browsers.mjs';

const bundle = await readFile(process.env.TYPESET_BUNDLE || 'packages/typeset-v4/dist/typeset.global.js', 'utf8');
const report = { checks: [], cases: [], errors: [] };
for (const { name, engine, executablePath } of browsers) {
  const browser = await engine.launch({ executablePath });
  try {
    const page = await browser.newPage({ viewport: { width: 1100, height: 900 } });
    await page.setContent('<html lang="en"><style>body{margin:32px}p{margin:0;font:20px/1.5 Georgia}a{color:green}strong{font-weight:700}</style><body></body></html>');
    await page.addScriptTag({ content: bundle });
    const result = await page.evaluate(() => {
      const api = window.Typeset, checks = [], cases = [];
      const check = (label, pass, detail) => checks.push({ label, pass: !!pass, detail });
      const bounds = layout => JSON.stringify(layout.lines.map(line => [line.sourceStart, line.sourceEnd]));
      const gaps = (p, layout) => {
        const values = [], walker = document.createTreeWalker(p, NodeFilter.SHOW_TEXT), range = document.createRange();
        const cache = new Map();
        let node, offset = 0;
        while ((node = walker.nextNode())) {
          for (const match of node.data.matchAll(/ +/g)) {
            const start = offset + match.index, end = start + match[0].length;
            if (!layout.lines.some(line => line.sourceStart < start && line.sourceEnd > end)) continue;
            range.setStart(node, match.index); range.setEnd(node, match.index + match[0].length);
            const cs = getComputedStyle(node.parentElement), key = [cs.font, cs.letterSpacing, cs.wordSpacing].join('|');
            if (!cache.has(key)) {
              const probe = document.createElement('span');
              probe.style.cssText = 'position:fixed;display:inline-block;visibility:hidden;white-space:pre;letter-spacing:inherit;word-spacing:inherit;padding:0;border:0;margin:0;';
              // WebKit rounds individual Range edges. A layout box averages
              // actual advances instead; keep a much tighter .03px tolerance.
              probe.textContent = ' '.repeat(32); node.parentElement.append(probe);
              cache.set(key, probe.getBoundingClientRect().width / 32); probe.remove();
            }
            values.push({ start, width: cache.get(key), rangeWidth: range.getBoundingClientRect().width });
          }
          offset += node.length;
        }
        return values;
      };
      const text = 'Your browser does not know what a sentence is. It does not know that a thought should not snap in half, or that a word left alone on a line looks abandoned, because it is. It fills each line until the words run out, and calls that typography.';
      let applied = 0;
      for (const font of ['Georgia', 'Arial', 'Times New Roman']) for (const width of [220, 320, 420, 560]) for (const rich of [false, true]) {
        const p = document.createElement('p'); p.style.width = width + 'px'; p.style.fontFamily = font;
        if (rich) {
          const link = document.createElement('a'); link.href = '#test'; link.textContent = text.slice(35, 110);
          const strong = document.createElement('strong'); strong.textContent = text.slice(110, 160);
          p.append(text.slice(0, 35), link, strong, text.slice(160));
        } else p.textContent = text;
        document.body.append(p);
        const original = p.innerHTML, first = p.firstChild, link = p.querySelector('a');
        const base = api.typeset(p, { tracking: false }), baseGaps = gaps(p, base.after); api.restore(p);
        const r = api.typeset(p), wrappers = [...p.querySelectorAll('[data-ts-track]')];
        if (r.features.tracking === 'applied') applied++;
        const label = font + ':' + width + ':' + rich;
        check('fixed membership ' + label, bounds(base.after) === bounds(r.after));
        check('source and final line ' + label, p.textContent === text && Math.abs(base.after.lines.at(-1).width - r.after.lines.at(-1).width) < .5);
        check('bounded tracking ' + label, wrappers.every(span => Math.abs(parseFloat(span.style.letterSpacing)) <= .01 * parseFloat(getComputedStyle(span).fontSize) + .001));
        check('no overflow ' + label, r.after.overflow <= .5);
        const gapChanges = gaps(p, r.after).map(gap => ({ ...gap, before: baseGaps.find(before => before.start === gap.start)?.width }));
        check('word spaces preserved ' + label, gapChanges.every(gap => Math.abs(gap.width - gap.before) <= .03), gapChanges.filter(gap => Math.abs(gap.width - gap.before) > .03).slice(0, 3));
        check('honest feature result ' + label, (r.features.tracking === 'applied') === (wrappers.length > 0));
        const output = p.innerHTML; check('idempotent ' + label, !api.typeset(p).changed && p.innerHTML === output);
        const selection = getSelection(), range = document.createRange(); range.selectNodeContents(p); selection.removeAllRanges(); selection.addRange(range);
        const copy = new ClipboardEvent('copy', { bubbles: true, cancelable: true, clipboardData: new DataTransfer() }); p.dispatchEvent(copy);
        check('copy source ' + label, copy.clipboardData.getData('text/plain') === text && !copy.clipboardData.getData('text/html').includes('data-ts-'));
        selection.removeAllRanges();
        cases.push({ label, tracking: r.features.tracking, wrappers: wrappers.length, before: base.after.lines.map(line => line.width), after: r.after.lines.map(line => line.width) });
        api.restore(p); check('exact restoration ' + label, p.innerHTML === original && p.firstChild === first && (!link || p.querySelector('a') === link)); p.remove();
      }
      check('tracking genuinely applies across matrix', applied >= 12, applied);
      const p = document.createElement('p'); p.style.width = '320px';
      p.innerHTML = text.slice(0, 35) + '<a href="#test">' + text.slice(35, 160) + '</a>' + text.slice(160); document.body.append(p);
      const original = p.innerHTML, head = p.firstChild, link = p.querySelector('a');
      let clicks = 0; link.addEventListener('click', event => { event.preventDefault(); clicks++; }); link.focus();
      getSelection().setBaseAndExtent(p.lastChild, 20, head, 5); const selected = getSelection().toString();
      api.typeset(p);
      check('tracked backward selection and focus', getSelection().getRangeAt(0).toString() === selected && document.activeElement === link);
      link.click(); check('tracked link listener', clicks === 1 && p.querySelector('a') === link);
      getSelection().removeAllRanges(); api.restore(p);
      check('tracked exact selection restore', p.innerHTML === original && p.firstChild === head);
      p.style.letterSpacing = '.02em'; p.style.wordSpacing = '1px';
      api.typeset(p); check('authored tracking preserved additively', [...p.querySelectorAll('[data-ts-track]')].every(span => Math.abs(parseFloat(span.style.letterSpacing) - .4) <= .201)); api.restore(p);
      p.style.letterSpacing = ''; p.style.wordSpacing = '';
      p.style.fontFeatureSettings = '"ss01"';
      const createElement = document.createElement; let canvases = 0;
      document.createElement = function (...args) { if (args[0] === 'canvas') canvases++; return createElement.apply(this, args); };
      const unsupportedFont = api.typeset(p, { opticalHanging: true }); document.createElement = createElement;
      check('unsupported optical fonts do not allocate canvases', canvases === 0 && unsupportedFont.features.hanging === 'native:hanging-font', { canvases, features: unsupportedFont.features });
      api.restore(p); p.style.fontFeatureSettings = '';
      if (CSS.supports('word-spacing', '10%')) {
        p.style.wordSpacing = '10%';
        const unresolved = !/^(normal|-?[\d.]+px)$/.test(getComputedStyle(p).wordSpacing), relative = api.typeset(p);
        check('unresolved relative spacing is not treated as pixels', !unresolved || relative.features.tracking !== 'applied', relative.features.tracking);
        api.restore(p); p.style.wordSpacing = '';
      }
      const hostile = document.createElement('style'); hostile.textContent = '[data-ts-track]{letter-spacing:5px!important}'; document.head.append(hostile);
      const unsafe = api.typeset(p);
      check('unsafe tracking retains composed word-space finish', unsafe.outcome === 'composed:rich' && unsafe.features.tracking === 'native:tracking-verification' && p.querySelector('[data-ts-space]') && !p.querySelector('[data-ts-track]'));
      api.restore(p); hostile.remove();
      api.typeset(p); link.textContent = 'Updated link text with a new destination';
      api.typeset(p); check('tracked source updates are not resurrected', link.textContent === 'Updated link text with a new destination'); api.restore(p);
      api.typeset(p); const clone = link.cloneNode(true); link.replaceWith(clone); api.restore(p);
      check('cloned engine spans removed without replacing author clone', p.querySelector('a') === clone && !p.querySelector('[data-ts-track]'));
      check('spacing off also disables tracking', api.typeset(p, { spacing: false }).features.tracking === 'off'); api.restore(p); p.remove();
      for (const sample of [
        { name: 'hidden padded parent', css: 'overflow:hidden;padding:24px;', expected: 'applied' },
        { name: 'clip padded parent', css: 'overflow:clip;padding:24px;', expected: 'applied' },
        { name: 'scroll padded parent', css: 'overflow:auto;padding:24px;height:70px;', expected: 'applied' },
        { name: 'paint containment', css: 'contain:paint;padding:24px;', expected: 'applied' },
        { name: 'rounded padded parent', css: 'overflow:hidden;padding:24px;border-radius:8px;', expected: 'applied' },
        { name: 'no room', css: 'overflow:hidden;', expected: 'native:hanging-clipped' },
        { name: 'paint without room', css: 'contain:paint;', expected: 'native:hanging-clipped' },
        { name: 'unknown clip path', css: 'clip-path:circle(40%);padding:24px;', expected: 'native:hanging-clipped' },
        { name: 'self padded', css: '', self: 'overflow:hidden;padding:24px;', expected: 'applied' },
        { name: 'nested tight clip', css: 'overflow:hidden;padding:24px;', self: 'overflow:hidden;', expected: 'native:hanging-clipped' },
        { name: 'border is not padding', css: 'overflow:hidden;border-left:24px solid red;', expected: 'native:hanging-clipped' },
        { name: 'translated padded clip', css: 'overflow:hidden;padding:24px;transform:translate(12px,6px);', expected: 'applied' },
        { name: 'rounded tight corner', css: 'overflow:hidden;border-radius:40px;padding:4px;', expected: 'native:hanging-clipped' },
        { name: 'masked container', css: 'padding:24px;mask-image:linear-gradient(black,transparent);', expected: 'native:hanging-clipped' },
      ]) {
        const parent = document.createElement('section'); parent.style.cssText = sample.css + 'width:300px;margin-bottom:10px;background:#eee;';
        const p = document.createElement('p'); p.style.cssText = sample.self || ''; p.textContent = '\u201cA short quotation.\u201d'; parent.append(p); document.body.append(parent);
        const original = p.innerHTML, style = parent.getAttribute('style');
        const r = api.typeset(p, { opticalHanging: true });
        check('clipping geometry: ' + sample.name, r.features.hanging === sample.expected, r.features.hanging);
        check('author overflow unchanged: ' + sample.name, parent.getAttribute('style') === style);
        api.restore(p); check('clip restore: ' + sample.name, p.innerHTML === original); parent.remove();
      }
      return { checks, cases };
    });
    report.checks.push(...result.checks.map(check => ({ browser: name, ...check })));
    report.cases.push(...result.cases.map(sample => ({ browser: name, ...sample })));
    await page.setContent('<html lang="en"><style>body{margin:40px;background:white;color:black}section{width:280px;padding:24px;overflow:hidden;border:1px solid #777}p{margin:0;font:italic 24px/1.5 Georgia}</style><body><section><p>\u201cA short quotation.\u201d</p></section></body></html>');
    await page.addScriptTag({ content: bundle });
    const outcome = await page.evaluate(() => window.Typeset.typeset(document.querySelector('p'), { opticalHanging: true }).features.hanging);
    const clipped = await page.screenshot({ path: `output/playwright/hanging-clipped-${name}.png` });
    await page.locator('section').evaluate(el => el.style.overflow = 'visible');
    const unclipped = await page.screenshot({ path: `output/playwright/hanging-visible-${name}.png` });
    report.checks.push({ browser: name, label: 'italic hung ink has identical clipped/unclipped pixels', pass: outcome === 'applied' && clipped.equals(unclipped), detail: outcome });
  } catch (error) { report.errors.push({ browser: name, error: error.stack }); }
  finally { await browser.close(); }
}
await writeFile('output/tracking-clipping.json', JSON.stringify(report, null, 2));
const failures = report.checks.filter(check => !check.pass);
console.log(JSON.stringify({ checks: report.checks.length, failures: failures.slice(0, 20), errors: report.errors, applied: report.cases.filter(sample => sample.tracking === 'applied').length }, null, 2));
if (failures.length || report.errors.length) process.exitCode = 1;
