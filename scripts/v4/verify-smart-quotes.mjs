// @ts-check
// Smart quotes (C15).
//
// 1. The education table: a single quote right after a curled opening
//    double quote opens too ("'Quoted' inside," gave a closing single quote),
//    and rock 'n' roll, 'bout, 'round and 'nuff are elisions, but a quoted
//    key letter ('n') and a quotation that opens with 'round or 'bout still
//    open with a left quote. 4.2's results for '90s, 'Tis, 'em, primes such
//    as 5'10" and possessives are kept, and the shipped corpora change nowhere.
//    4.4: a double quote with space on both sides (French spaced quotes) or
//    with no quotation to close (width="100") stays straight.
// 2. Server rendering: TypesetText curled quotes only on the client, so server
//    HTML, no-JS readers and crawlers kept straight quotes and the glyphs
//    swapped after hydration. Its server HTML now has them, and hydration in
//    three engines reports nothing.
// 3. TypesetRichText with smartQuotes but no lang of its own (it cannot see an
//    ancestor's lang during render) warns once in development builds only.
import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { build } from 'esbuild';
import { browsers } from './browsers.mjs';
import { artifacts } from './candidate.mjs';

const watchdog = setTimeout(() => { console.error('verify-smart-quotes: watchdog'); process.exit(3); }, 170_000);
watchdog.unref();

/** @type {{ browser?: string, label: string, pass: boolean, detail?: unknown }[]} */
const checks = [];
/** @type {{ browser?: string, error: string }[]} */
const errors = [];
/** @param {string} label @param {unknown} pass @param {unknown} [detail] @param {string} [browser] */
const check = (label, pass, detail, browser) => checks.push({ ...(browser ? { browser } : {}), label, pass: !!pass, ...(detail === undefined ? {} : { detail }) });

const { smartQuotes } = await import(pathToFileURL(resolve(artifacts.esm)).href);
const TABLE = [
  ['"\'Quoted\' inside," he said.', '“‘Quoted’ inside,” he said.'],
  ['"\'Read\' the notes," she said.', '“‘Read’ the notes,” she said.'],
  ["rock 'n' roll", 'rock ’n’ roll'],
  ["rock 'n roll", 'rock ’n roll'],
  ["It's 'bout time", 'It’s ’bout time'],
  ["come 'round later", 'come ’round later'],
  ["that's 'nuff", 'that’s ’nuff'],
  ["fish 'n' chips", 'fish ’n’ chips'],
  // Quotations the elisions must not take: a quoted key letter, a phrase
  // that opens with 'round or 'bout and closes later in the sentence.
  ["Type 'n' to cancel or 'y' to continue", 'Type ‘n’ to cancel or ‘y’ to continue'],
  ["Press 'n' for no.", 'Press ‘n’ for no.'],
  ["Enter 'N' or 'Y'.", 'Enter ‘N’ or ‘Y’.'],
  ["the 'round robin' plan", 'the ‘round robin’ plan'],
  ["He yelled 'bout face!' twice.", 'He yelled ‘bout face!’ twice.'],
  ["'cause I said so", '’cause I said so'],
  // Kept from 4.2.
  ["the '90s", 'the ’90s'],
  ["'Tis the season", '’Tis the season'],
  ["get 'em", 'get ’em'],
  ['5\'10" tall', '5\'10" tall'],
  ['A 6\' 2" frame, a 12" print, and the \'90s.', 'A 6\' 2" frame, a 12" print, and the ’90s.'],
  ["the students' notes", 'the students’ notes'],
  ["y'all's plans", 'y’all’s plans'],
  ["O'Brien's", 'O’Brien’s'],
  ['"Read \'the notes\'," she said.', '“Read ‘the notes’,” she said.'],
  ['"1984" and don\'t -- change... this.', '“1984” and don’t -- change... this.'],
  ["'single' stays single", '‘single’ stays single'],
  // 4.4: a double quote with space on both sides, or with no quotation to
  // close, stays straight (4.3.1 in brackets).
  ['Set width="100" here', 'Set width="100" here'], // (width=”100")
  ['Il a dit : " Bonjour "', 'Il a dit : " Bonjour "'], // (: ” Bonjour ”)
  ['the `aria-live="polite"` value', 'the `aria-live="polite"` value'], // (=”polite”)
  ['said:"hello" twice', 'said:"hello" twice'], // (:”hello”)
  ['"Hello," she said.', '“Hello,” she said.'],
  ['He is 5\'10" tall; the screen is 27" wide.', 'He is 5\'10" tall; the screen is 27" wide.'],
  ["Rock 'n' roll in the '90s", 'Rock ’n’ roll in the ’90s'],
  ['"Room 101" is open', '“Room 101” is open'],
  ['"', '"'], // (”)
];
for (const [input, expected] of TABLE) {
  const output = smartQuotes(input);
  check(`education: ${input}`, output === expected && output.length === input.length && smartQuotes(output) === output, { output, expected });
}
{
  // Education stays linear in the text. The 'n pair look-back searched all
  // the text before each quote from every start: 1.6 KB of letters and 'n
  // tokens took about 0.7 s, 3.5 KB about 7 s, and CJK prose with one
  // "rock 'n' roll" 1 s (4.2.0 and now: under 1 ms). Server rendering and
  // the auto loader educate before the size budget applies.
  const inputs = {
    'letters then many \'n': 'a'.repeat(1000) + '.' + " 'n".repeat(200),
    'CJK then one pair': '\u4e00'.repeat(8000) + " rock 'n' roll",
    "6,000 characters of 'round": " 'round".repeat(857),
    'spaces before many \'n': 'rock' + ' '.repeat(6000) + " 'n".repeat(2000),
  };
  for (const [name, input] of Object.entries(inputs)) {
    smartQuotes(input.slice(0, 50));
    const began = performance.now();
    smartQuotes(input);
    const ms = performance.now() - began;
    check(`education time: ${name} (${input.length} characters) under 100 ms`, ms < 100, { ms: Math.round(ms * 10) / 10 });
  }
}
// Education is linear at 120 KB. Two paths were still quadratic after the
// 'n look-back: the character before each quote was read back from the
// growing output string, which flattened it once per quote, and each 'round,
// 'bout or 'nuff searched the rest of the text for a closing quote when no
// sentence end followed. In node, 120 KB of "it's " took 278 to 353 ms (4.2.0:
// 2 ms) and 120 KB of " 'round" 742 to 858 ms (4.2.0: 6 ms), and server
// rendering TypesetText with smartQuotes="en" took 604 and 1,601 ms.
/** @type {[string, string, number][]} */
const LARGE = [["it's ", "it's ", 24000], [" 'round", " 'round", 17142], [" 'round, then one closing quote", " 'round", 17142], ['"x" ', '"x" ', 30000], [" 'bout it.", " 'bout it.", 12000], [" rock 'n' roll", " rock 'n' roll", 8571]];
const large = (/** @type {string} */ unit, /** @type {number} */ count, /** @type {string} */ name) => unit.repeat(count) + (name.includes('closing') ? " x'" : '');
for (const [name, unit, count] of LARGE) {
  const input = large(unit, count, name);
  smartQuotes(input.slice(0, 50));
  const began = performance.now();
  smartQuotes(input);
  const ms = performance.now() - began;
  check(`education time: 120 KB of ${JSON.stringify(name)} (${input.length.toLocaleString('en-US')} characters) under 50 ms`, ms < 50, { ms: Math.round(ms * 10) / 10 });
}
{
  // The same output as a plain reference (4.3's release candidate function,
  // 4f1815c, with 4.4's double-quote rules), on a million random texts built
  // from quotes, elisions, pair words, sentence ends, spaces and letters and
  // digits in and out of the BMP, and on the corpora and the docs'
  // paragraphs, as written and with straight quotes.
  /** @param {string} text */
  const reference = text => {
    const elision = /^(?:\d{2}s\b|tis\b|twas\b|em\b|cause\b|til\b)/iu;
    const loose = /^(?:bout|round|nuff)\b/iu;
    const nPairs = new Set(['rock', 'rhythm', 'fish', 'salt', 'pick', 'shake', 'surf', 'drag', 'grab', 'meet', 'stop', 'park', 'cash', 'wash',
      'rip', 'plug', 'spick', 'bump', 'nip', 'scratch', 'peel', 'lock', 'snack', 'bread', 'mix']);
    const nPairLongest = Math.max(...[...nPairs].map(word => word.length));
    const pairWordBefore = (/** @type {number} */ index) => {
      let end = index;
      while (end > 0 && /\s/u.test(text[end - 1])) end--;
      let start = end;
      while (start > 0 && end - start <= nPairLongest) {
        const low = text.charCodeAt(start - 1);
        if (low >= 0xdc00 && low <= 0xdfff && start > 1 && /^\p{L}$/u.test(text.slice(start - 2, start))) start -= 2;
        else if (/\p{L}/u.test(text[start - 1])) start--;
        else break;
      }
      return start < end && end - start <= nPairLongest && nPairs.has(text.slice(start, end).toLowerCase());
    };
    const closesLater = (/** @type {number} */ index) => {
      const rest = text.slice(index + 1);
      const end = rest.search(/[.!?](?:\s|$)/u);
      return /[\p{L}\p{N}.,!?]['\u2019](?![\p{L}\p{N}])/u.test(end < 0 ? rest : rest.slice(0, end + 1));
    };
    let doubleOpen = false, singleOpen = false, out = '';
    for (let index = 0; index < text.length; index++) {
      const quote = text[index];
      if (!/["'\u201c\u201d\u2018\u2019]/u.test(quote)) { out += quote; continue; }
      if (quote === '\u201c') doubleOpen = true;
      else if (quote === '\u201d') doubleOpen = false;
      else if (quote === '\u2018') singleOpen = true;
      if (quote !== '"' && quote !== "'") { out += quote; continue; }
      const before = out[index - 1] || '';
      const after = text[index + 1] || '';
      const opening = !before || /[\s([{\u2014\u2013\u201c\u2018]/u.test(before);
      if (quote === '"') {
        if ((!before || /\s/u.test(before)) && (!after || /\s/u.test(after))) out += quote;
        else if (opening && after && !/\s/u.test(after)) { doubleOpen = true; out += '\u201c'; }
        else if (!doubleOpen) out += quote;
        else { doubleOpen = false; out += '\u201d'; }
        continue;
      }
      const rest = text.slice(index + 1);
      if (/\p{L}/u.test(before) && /\p{L}/u.test(after)) out += '\u2019';
      else if (opening && (elision.test(rest) || (loose.test(rest) && !closesLater(index))
        || (/^n(?=['\u2019]?(?:\s|$))/iu.test(rest) && pairWordBefore(index)))) out += '\u2019';
      else if (opening && after && !/\s/u.test(after)) { singleOpen = true; out += '\u2018'; }
      else if (/\d/u.test(before) && !singleOpen) out += quote;
      else { singleOpen = false; out += '\u2019'; }
    }
    return out;
  };
  let seed = 1515;
  const random = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 2 ** 32; };
  const atoms = ["'", "'", '"', '"', '\u2018', '\u2019', '\u201c', '\u201d', ' ', ' ', '\n', '\t', '\u00a0', 'a', 'x', 'Q', '5', '9', '.', '!', '?', ',', ';', '(', '[', '{', '\u2014', '\u2013', '-',
    'round', 'bout', 'nuff', 'Round', 'n', 'N', 'tis', 'twas', 'em', 'cause', 'til', '90s', 'rock', 'fish', 'roll', "'round", "'bout", "'n'", "'n", " rock 'n' roll", ".'", "s'", "it's",
    '\ud835\udc00', '\ud835\udfce', '\ud83d\ude00', '\ud835', '\udc00', '\u4e00', '\u00e9', '_'];
  /** @type {string[]} */
  const texts = [];
  for (let n = 0; n < 1_000_000; n++) {
    let text = '';
    for (let parts = Math.floor(random() * 24); parts > 0; parts--) text += atoms[Math.floor(random() * atoms.length)];
    texts.push(text);
  }
  /** @type {string[]} */
  const prose = TABLE.map(([input]) => input);
  const collect = (/** @type {unknown} */ value) => { if (typeof value === 'string') prose.push(value); else if (Array.isArray(value)) value.forEach(collect); else if (value && typeof value === 'object') Object.values(value).forEach(collect); };
  for (const file of ['tests/v4-corpus.json', 'corpus.json', 'tests/v4-corpus-adversarial.json']) collect(JSON.parse(await readFile(file, 'utf8')));
  for (const file of ['README.md', 'CHANGELOG.md', 'ROADMAP.md', 'packages/typeset-v4/SUPPORT.md', 'packages/typeset-v4/MIGRATION.md', 'packages/typeset-v4/README.md']) prose.push(...(await readFile(file, 'utf8')).split(/\n{2,}/u));
  const corpus = [...prose, ...prose.map(text => text.replace(/[\u2018\u2019]/gu, "'").replace(/[\u201c\u201d]/gu, '"'))];
  let differ = 0, curled = 0;
  /** @type {{ input: string, expected: string, actual: string }[]} */
  const examples = [];
  for (const text of [...texts, ...corpus]) {
    const expected = reference(text), actual = smartQuotes(text);
    if (expected !== text) curled++;
    if (expected !== actual && differ++ < 3) examples.push({ input: text.slice(0, 200), expected: expected.slice(0, 200), actual: actual.slice(0, 200) });
  }
  check(`education matches the reference on ${texts.length.toLocaleString('en-US')} random texts and ${corpus.length.toLocaleString('en-US')} corpus and docs paragraphs`,
    texts.length >= 1_000_000 && corpus.length > 1000 && curled > 500_000 && differ === 0, { random: texts.length, corpus: corpus.length, curled, differ, examples });
}
{
  // No change on real prose against the published 4.2.0 function.
  const { smartQuotes: published } = await import(pathToFileURL(resolve('public/releases/4.2.0/index.js')).href);
  /** @type {string[]} */
  const texts = [];
  const collect = (/** @type {unknown} */ value) => { if (typeof value === 'string') texts.push(value); else if (Array.isArray(value)) value.forEach(collect); else if (value && typeof value === 'object') Object.values(value).forEach(collect); };
  collect(JSON.parse(await readFile('tests/v4-corpus.json', 'utf8')));
  collect(JSON.parse(await readFile('corpus.json', 'utf8')));
  const quoted = texts.filter(text => /["']/.test(text));
  const changed = quoted.filter(text => smartQuotes(text) !== published(text));
  check('corpora: no text with quotes educates differently from 4.2.0', quoted.length > 10 && changed.length === 0, { texts: texts.length, quoted: quoted.length, changed: changed.slice(0, 3) });
}

// Server rendering with the React adapter under test.
const TEXT = 'It\'s "fine," she said. "\'Quoted\' inside," he said, and the regulars read the chalkboard before they even say hello.';
const RICH = 'Read the curator\'s notes at the neighborhood gallery before the tour, and keep "one line" you would want to remember.';
const tree = `
import { createElement as h } from 'react';
import { TypesetText, TypesetRichText } from ${JSON.stringify(resolve(artifacts.react))};
export const App = () => h('main', null,
  h(TypesetText, { id: 'plain', smartQuotes: 'en', text: ${JSON.stringify(TEXT)} }),
  h(TypesetText, { id: 'english', lang: 'en', smartQuotes: 'en', text: ${JSON.stringify(TEXT)} }),
  h(TypesetText, { id: 'french', lang: 'fr', smartQuotes: 'en', text: ${JSON.stringify(TEXT)} }),
  h(TypesetText, { id: 'off', text: ${JSON.stringify(TEXT)} }),
  h(TypesetRichText, { id: 'rich', lang: 'en', smartQuotes: 'en' }, h('span', null, ${JSON.stringify(RICH)})));
`;
const serverModule = (await build({ stdin: { contents: tree + `\nimport { renderToString } from 'react-dom/server';\nexport const html = renderToString(h(App));\nexport const renderText = text => renderToString(h(TypesetText, { smartQuotes: 'en', lang: 'en', text }));`, resolveDir: process.cwd(), loader: 'js' }, bundle: true, write: false, format: 'esm', platform: 'node', target: 'node22', external: ['react', 'react-dom'], define: { 'process.env.NODE_ENV': '"production"' }, logLevel: 'silent' })).outputFiles[0].text;
const serverFile = resolve('output/smart-quotes-server.mjs');
await writeFile(serverFile, serverModule);
const { html: serverHTML } = await import(pathToFileURL(serverFile).href + '?' + Date.now());
// Server rendering educates the whole text before any size budget applies:
// the release candidate took 604 ms on 120 KB of "it's " and 1,601 ms on
// 120 KB of " 'round" (4.2.0: 2 ms).
{
  const { renderText } = await import(pathToFileURL(serverFile).href + '?' + Date.now());
  renderText("warm 'up' it's");
  for (const [name, unit, count] of LARGE.slice(0, 2)) {
    const began = performance.now();
    const html = renderText(unit.repeat(count));
    const ms = performance.now() - began;
    check(`server HTML: TypesetText with smartQuotes on 120 KB of ${JSON.stringify(name)} renders in under 100 ms`, ms < 100, { ms: Math.round(ms * 10) / 10, length: html.length });
  }
}
const paragraph = (/** @type {string} */ id) => (serverHTML.match(new RegExp(`<p[^>]*id="${id}"[^>]*>([\\s\\S]*?)</p>`)) ?? [])[1] ?? '';
const decode = (/** @type {string} */ html) => html.replace(/<[^>]+>/g, '').replace(/&#x27;/g, "'").replace(/&quot;/g, '"').replace(/&amp;/g, '&');
check('server HTML: TypesetText with smartQuotes and no lang has curled quotes', decode(paragraph('plain')) === smartQuotes(TEXT), decode(paragraph('plain')));
check('server HTML: TypesetText with lang="en" has curled quotes', decode(paragraph('english')) === smartQuotes(TEXT), decode(paragraph('english')));
check('server HTML: TypesetText with another lang or without smartQuotes keeps straight quotes', decode(paragraph('french')) === TEXT && decode(paragraph('off')) === TEXT);
check('server HTML: TypesetRichText with lang="en" has curled quotes', decode(paragraph('rich')) === smartQuotes(RICH), decode(paragraph('rich')));

const bundle = async (/** @type {string} */ mode) => (await build({ stdin: { contents: tree + `
import { hydrateRoot } from 'react-dom/client';
import { TypesetRichText as Rich } from ${JSON.stringify(resolve(artifacts.react))};
import { createRoot } from 'react-dom/client';
window.recoverable = [];
hydrateRoot(document.getElementById('root'), h(App), { onRecoverableError: (error) => window.recoverable.push(String(error && error.message || error)) });
window.warnWithoutLang = () => { const host = document.createElement('div'); document.body.append(host); createRoot(host).render(h('div', null, h(Rich, { smartQuotes: 'en' }, h('span', null, 'one')), h(Rich, { smartQuotes: 'en' }, h('span', null, 'two')))); };
// A component child, as next/link's <Link> is: the paragraph stays native.
const Link = props => h('a', props);
window.warnComponent = () => { const host = document.createElement('div'); document.body.append(host); createRoot(host).render(h('div', null, h(Rich, { id: 'component', lang: 'en' }, 'Read the notes at ', h(Link, { href: '/gallery' }, 'the neighborhood gallery'), ' before the tour and the talk.'), h(Rich, { lang: 'en' }, 'Two ', h(Link, { href: '/two' }, 'links'), '.'))); };
`, resolveDir: process.cwd(), loader: 'js' }, bundle: true, write: false, format: 'iife', target: 'es2022', define: { 'process.env.NODE_ENV': JSON.stringify(mode) }, logLevel: 'silent' })).outputFiles[0].text;
const clients = { production: await bundle('production'), development: await bundle('development') };
const PAGE = `<!doctype html><html lang="en"><head><meta charset="utf-8"><style>body{margin:16px;font:18px/1.5 Georgia}main{width:320px}</style></head><body><div id="root">${serverHTML}</div><script src="/client.js"></script></body></html>`;

await Promise.all(browsers.map(async config => {
  const browser = await config.engine.launch({ executablePath: config.executablePath, timeout: 20000 });
  try {
    {
      // The script-tag build's smartQuotes at 120 KB (the release candidate:
      // 223 to 2,458 ms in WebKit, 250 to 776 ms in Chromium, 1,149 ms on
      // 'round in Firefox).
      const page = await browser.newPage();
      page.setDefaultTimeout(20000);
      await page.setContent('<!doctype html><html lang="en"><body></body></html>');
      await page.addScriptTag({ path: artifacts.bundle });
      const times = await page.evaluate(LARGE => LARGE.map(([name, unit, count]) => {
        const input = unit.repeat(count) + (name.includes('closing') ? " x'" : '');
        /** @type {any} */ (window).Typeset.smartQuotes(input.slice(0, 50));
        const began = performance.now();
        /** @type {any} */ (window).Typeset.smartQuotes(input);
        return { name, length: input.length, ms: Math.round((performance.now() - began) * 10) / 10 };
      }), LARGE);
      for (const { name, length, ms } of times) check(`education time in the browser: 120 KB of ${JSON.stringify(name)} (${length.toLocaleString('en-US')} characters) under 100 ms`, ms < 100, { ms }, config.name);
      await page.close();
    }
    for (const mode of /** @type {const} */ (['production', 'development'])) {
      const page = await browser.newPage({ viewport: { width: 420, height: 900 } });
      page.setDefaultTimeout(20000);
      /** @type {string[]} */
      const console_ = [];
      page.on('console', message => { if (['error', 'warning'].includes(message.type())) console_.push(message.type() + ': ' + message.text().slice(0, 200)); });
      page.on('pageerror', error => errors.push({ browser: config.name, error: `${mode}: ${error.message}` }));
      await page.route('http://quotes.test/**', route => new URL(route.request().url()).pathname === '/client.js'
        ? route.fulfill({ contentType: 'text/javascript', body: clients[mode] })
        : route.fulfill({ contentType: 'text/html; charset=utf-8', body: PAGE }));
      await page.goto('http://quotes.test/page');
      await page.waitForFunction(() => ['plain', 'english', 'rich'].every(id => document.getElementById(id)?.dataset.tsOutcome));
      await page.evaluate(() => new Promise(resolve => setTimeout(resolve, 300)));
      const facts = await page.evaluate(() => ({ recoverable: /** @type {any} */ (window).recoverable, text: Object.fromEntries(['plain', 'english', 'french', 'off', 'rich'].map(id => [id, document.getElementById(id)?.textContent])), quotes: document.getElementById('plain')?.dataset.tsQuotes }));
      const hydration = [...facts.recoverable, ...console_.filter(line => /hydrat|did not match|server/i.test(line))];
      check(`${mode}: hydrating the server HTML reports nothing`, hydration.length === 0, hydration.slice(0, 3), config.name);
      check(`${mode}: quotes stay curled after hydration and composition`, facts.text.plain === smartQuotes(TEXT) && facts.text.english === smartQuotes(TEXT) && facts.text.rich === smartQuotes(RICH) && facts.text.french === TEXT, facts.text, config.name);
      const before = console_.length;
      await page.evaluate(() => /** @type {any} */ (window).warnWithoutLang());
      await page.evaluate(() => new Promise(resolve => setTimeout(resolve, 200)));
      const warnings = console_.slice(before).filter(line => line.includes('smartQuotes="en" needs lang'));
      check(`${mode}: TypesetRichText without lang warns ${mode === 'development' ? 'once' : 'never'}`, warnings.length === (mode === 'development' ? 1 : 0), warnings, config.name);
      const beforeComponent = console_.length;
      await page.evaluate(() => /** @type {any} */ (window).warnComponent());
      await page.evaluate(() => new Promise(resolve => setTimeout(resolve, 300)));
      const component = console_.slice(beforeComponent).filter(line => line.includes('native:react-component'));
      const componentOutcome = await page.evaluate(() => document.getElementById('component')?.dataset.tsOutcome);
      check(`${mode}: TypesetRichText with a component child stays native and warns ${mode === 'development' ? 'once' : 'never'}`, componentOutcome === 'native:react-component' && component.length === (mode === 'development' ? 1 : 0), { componentOutcome, component }, config.name);
      await page.close();
    }
  } catch (error) {
    errors.push({ browser: config.name, error: String(/** @type {Error} */ (error).stack || error) });
  } finally { await browser.close(); }
}));

assert.ok(checks.length > 20);
const failures = checks.filter(c => !c.pass);
await writeFile('output/smart-quotes.json', JSON.stringify({ esm: artifacts.esm, react: artifacts.react, checks, errors }, null, 2));
console.log(JSON.stringify({ checks: checks.length, failed: failures.length, failures, errors }, null, 2));
if (failures.length || errors.length) process.exitCode = 1;
