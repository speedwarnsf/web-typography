// @ts-check
// What typeset.us tells other sites to pin, and how it serves those files.
//
// - public/sri.json lists integrity hashes only for immutable, ledger-listed
//   paths. (The sri.json that 4.2.0's cut wrote also hashes the mutable
//   typeset.min.js and typeset.esm.js; the 4.3.0 cut replaces it, and
//   scripts/v4/known-failures.json expects those two checks to fail until
//   then.)
// - sriIndex(), which the next cut uses to write sri.json, lists only
//   immutable paths, includes the new typeset@<v> pins, and leaves the
//   go@4.2.0.js entry byte-identical.
// - next.config.ts headers make versioned files immutable and aliases,
//   indexes and the ledger revalidate, all readable cross-origin; go@4.js is
//   never cached as immutable.
// - The firewall bypass rule in docs/ops covers the same paths.
import { cp, mkdir, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { join } from 'node:path';
import { transform } from 'esbuild';
import { sriIndex, pinnedGlobal, sri } from '../build-recipe.mjs';
import { readLedger, IMMUTABLE_SITE_FILE } from './ledger.mjs';

/** @type {{ label: string, pass: boolean, detail?: unknown }[]} */
const checks = [];
/** @type {string[]} */
const errors = [];
/** @param {string} label @param {unknown} pass @param {unknown} [detail] */
const check = (label, pass, detail) => { checks.push({ label, pass: !!pass, ...(pass ? {} : { detail }) }); };
const GO_420 = 'sha384-KpyXtkC1KXixYXRIvrZCP7VPGJ2BcKJ07LeCuQpFXQms/QwY033ti1+QWU/XFD/a';

try {
  const ledger = await readLedger();
  const committed = JSON.parse(await readFile('public/sri.json', 'utf8'));
  for (const [file, integrity] of Object.entries(committed.files)) {
    check(`sri.json: ${file} is a ledger-listed immutable path`, IMMUTABLE_SITE_FILE.test(file) && ledger.pins[file]?.integrity === integrity, { immutable: IMMUTABLE_SITE_FILE.test(file), ledger: ledger.pins[file]?.integrity ?? null });
  }
  check('sri.json: go@4.2.0.js keeps its published integrity', committed.files['go@4.2.0.js'] === GO_420, committed.files['go@4.2.0.js']);

  // The index the next cut writes, over today's public/.
  const go = await readFile(`public/go@${committed.version}.js`);
  const today = await sriIndex({ root: '.', version: committed.version, go });
  const pins = Object.keys(ledger.pins).sort();
  check('sriIndex() over public/ lists exactly the ledger pins', JSON.stringify(Object.keys(today.files).sort()) === JSON.stringify(pins), { index: Object.keys(today.files), ledger: pins });
  check('sriIndex() keeps every existing pin entry byte-identical', Object.entries(today.files).every(([file, value]) => ledger.pins[file]?.integrity === value) && today.files['go@4.2.0.js'] === GO_420);
  check('sriIndex() keeps the pinned snippet form', today.snippet === committed.snippet, { index: today.snippet, committed: committed.snippet });

  // A simulated 4.3.0 cut: new pins are listed, aliases are not.
  const sandbox = await mkdtemp(join('output', 'site-index-'));
  try {
    await mkdir(join(sandbox, 'public'), { recursive: true });
    for (const file of await readdir('public')) if (/\.js$/.test(file)) await cp(join('public', file), join(sandbox, 'public', file));
    const global = Buffer.from('/*! test */(()=>{})();\n//# sourceMappingURL=typeset.global.js.map\n');
    await writeFile(join(sandbox, 'public/typeset@4.3.0.min.js'), pinnedGlobal(global, '4.3.0'));
    await writeFile(join(sandbox, 'public/typeset@4.3.0.esm.js'), 'export {};\n');
    await writeFile(join(sandbox, 'public/go@4.3.0.js'), '/* 4.3.0 */\n');
    await writeFile(join(sandbox, 'public/go@4.js'), '/* 4.x */\n');
    const next = await sriIndex({ root: sandbox, version: '4.3.0', go: Buffer.from('/* 4.3.0 */\n') });
    const keys = Object.keys(next.files);
    check('a 4.3.0 index lists typeset@4.3.0.min.js, typeset@4.3.0.esm.js and go@4.3.0.js', ['typeset@4.3.0.min.js', 'typeset@4.3.0.esm.js', 'go@4.3.0.js'].every(file => keys.includes(file)), keys);
    check('a 4.3.0 index lists no alias (go.js, go@4.js, typeset.min.js, typeset.esm.js)', keys.every(file => IMMUTABLE_SITE_FILE.test(file)) && !keys.some(file => ['go.js', 'go@4.js', 'typeset.min.js', 'typeset.esm.js'].includes(file)), keys);
    check('a 4.3.0 index leaves go@4.2.0.js byte-identical', next.files['go@4.2.0.js'] === GO_420, next.files['go@4.2.0.js']);
    check('a 4.3.0 index orders loaders before bundles, each by version', keys.indexOf('go@4.3.0.js') < keys.indexOf('typeset@4.3.0.esm.js') && keys.indexOf('go@3.3.2.js') === 0, keys);
    check('the pinned typeset@<v>.min.js maps to the immutable archive map', (await readFile(join(sandbox, 'public/typeset@4.3.0.min.js'), 'utf8')).endsWith('//# sourceMappingURL=/releases/4.3.0/typeset.global.js.map\n'));
    check('sriIndex() hashes the bytes on disk', next.files['typeset@4.3.0.esm.js'] === sri(Buffer.from('export {};\n')));
  } finally { await rm(sandbox, { recursive: true, force: true }); }

  // next.config.ts headers, matched the way Next matches them.
  const require = createRequire(import.meta.url);
  const { getPathMatch } = require('next/dist/shared/lib/router/utils/path-match.js');
  const source = await transform(await readFile('next.config.ts', 'utf8'), { loader: 'ts', format: 'esm' });
  const config = (await import('data:text/javascript;base64,' + Buffer.from(source.code).toString('base64'))).default;
  const rules = await config.headers();
  /** @param {string} path */
  const headersFor = path => {
    /** @type {Record<string, string>} */
    const out = {};
    for (const rule of rules) if (getPathMatch(rule.source, { strict: true, removeUnnamedParams: true })(path)) for (const header of rule.headers) out[header.key.toLowerCase()] = header.value;
    return out;
  };
  const IMMUTABLE_PATHS = ['/go@4.2.0.js', '/go@3.3.2.js', '/go@4.3.0.js', '/typeset@4.3.0.min.js', '/typeset@4.3.0.esm.js', '/releases/4.2.0/typeset.us-4.2.0.tgz', '/releases/3.5.1/README.md'];
  const REVALIDATED_PATHS = ['/go@4.js', '/go.js', '/typeset.min.js', '/typeset.esm.js', '/sri.json', '/release.json', '/for-agents.md', '/capabilities.json', '/llms.txt', '/releases/published.json'];
  for (const path of IMMUTABLE_PATHS) {
    const h = headersFor(path);
    check(`headers: ${path} is immutable for a year and readable cross-origin`, h['access-control-allow-origin'] === '*' && h['cache-control'] === 'public, max-age=31536000, immutable', h);
  }
  for (const path of REVALIDATED_PATHS) {
    const h = headersFor(path);
    check(`headers: ${path} revalidates and is readable cross-origin`, h['access-control-allow-origin'] === '*' && /max-age=300/.test(h['cache-control'] ?? '') && !/immutable/.test(h['cache-control'] ?? ''), h);
  }

  // The firewall bypass covers every file other sites and tools fetch.
  const rule = JSON.parse(await readFile('docs/ops/vercel-firewall-bypass.json', 'utf8'));
  const pattern = new RegExp(rule.conditionGroup[0].conditions.find((/** @type {{ type: string }} */ c) => c.type === 'path').value);
  const uncovered = [...IMMUTABLE_PATHS, ...REVALIDATED_PATHS].filter(path => !pattern.test(path));
  check('firewall bypass rule covers every published path', uncovered.length === 0, uncovered);
  check('firewall bypass rule does not cover the site or the fetch API', !['/', '/audit', '/api/fetch-url', '/go@4.2.0.js.evil/x', '/support'].some(path => pattern.test(path)));
  check('firewall bypass rule is a GET/HEAD bypass', rule.action?.mitigate?.action === 'bypass' && JSON.stringify(rule.conditionGroup[0].conditions.find((/** @type {{ type: string }} */ c) => c.type === 'method')?.value) === '["GET","HEAD"]', rule.action);
} catch (error) {
  errors.push(String(/** @type {Error} */ (error).stack || error));
}
await mkdir('output', { recursive: true });
await writeFile('output/site-index.json', JSON.stringify({ checks, errors }, null, 2));
const failures = checks.filter(c => !c.pass);
console.log(JSON.stringify({ checks: checks.length, failures, errors }, null, 2));
if (failures.length || errors.length) process.exitCode = 1;
