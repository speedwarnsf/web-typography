// @ts-check
// Smart quotes (C15).
//
// 1. The education table: a single quote right after a curled opening
//    double quote opens too ("'Quoted' inside," gave a closing single quote),
//    and rock 'n' roll, 'bout, 'round and 'nuff are elisions, but a quoted
//    key letter ('n') and a quotation that opens with 'round or 'bout still
//    open with a left quote. 4.2's results for '90s, 'Tis, 'em, primes such
//    as 5'10" and possessives are kept, and the shipped corpora change nowhere.
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
];
for (const [input, expected] of TABLE) {
  const output = smartQuotes(input);
  check(`education: ${input}`, output === expected && output.length === input.length && smartQuotes(output) === output, { output, expected });
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
const serverModule = (await build({ stdin: { contents: tree + `\nimport { renderToString } from 'react-dom/server';\nexport const html = renderToString(h(App));`, resolveDir: process.cwd(), loader: 'js' }, bundle: true, write: false, format: 'esm', platform: 'node', target: 'node22', external: ['react', 'react-dom'], define: { 'process.env.NODE_ENV': '"production"' }, logLevel: 'silent' })).outputFiles[0].text;
const serverFile = resolve('output/smart-quotes-server.mjs');
await writeFile(serverFile, serverModule);
const { html: serverHTML } = await import(pathToFileURL(serverFile).href + '?' + Date.now());
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
`, resolveDir: process.cwd(), loader: 'js' }, bundle: true, write: false, format: 'iife', target: 'es2022', define: { 'process.env.NODE_ENV': JSON.stringify(mode) }, logLevel: 'silent' })).outputFiles[0].text;
const clients = { production: await bundle('production'), development: await bundle('development') };
const PAGE = `<!doctype html><html lang="en"><head><meta charset="utf-8"><style>body{margin:16px;font:18px/1.5 Georgia}main{width:320px}</style></head><body><div id="root">${serverHTML}</div><script src="/client.js"></script></body></html>`;

await Promise.all(browsers.map(async config => {
  const browser = await config.engine.launch({ executablePath: config.executablePath, timeout: 20000 });
  try {
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
