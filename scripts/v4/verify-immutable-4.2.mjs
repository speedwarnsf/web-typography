// @ts-check
// typeset.us 4.2.0 is published and must stay byte-for-byte what npm,
// jsDelivr and typeset.us/go@4.2.0.js serve. This check holds the ledger's
// 4.2.0 entry to constants recorded independently at publication, so the
// archive cannot be rewritten by editing the files and the ledger together.
import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { verifyLedger, readLedger, ledgerBases } from './ledger.mjs';

// Recorded from `npm view typeset.us@4.2.0 dist` and the v4.2.0 tag.
const PUBLISHED = {
  version: '4.2.0',
  shasum: 'c24c7c0bd02950093eb012a404035770b61495dc',
  integrity: 'sha512-nPsQZwu2NNn4Y1w57BhX9QNOFTAXHHnGtc5kM6qprxHW0DHZBMD5D9IE7ze7nlB8apAhbGSRh92fTyCuDX6Q2A==',
  loaderSRI: 'sha384-KpyXtkC1KXixYXRIvrZCP7VPGJ2BcKJ07LeCuQpFXQms/QwY033ti1+QWU/XFD/a',
  tagCommit: '2a17b59b294c11982313cbbcd7877c17d21e5668',
  // sha256 of the canonical 4.2.0 ledger entry at seeding.
  entrySHA256: 'dc17c67eaabb8686ca1ce947998e688d5ed0be8cc01cd8516fc43a7887bbfb27',
};

/** @param {unknown} value @returns {string} */
const canonical = value => JSON.stringify(value, (key, v) => v && typeof v === 'object' && !Array.isArray(v) ? Object.fromEntries(Object.entries(v).sort(([a], [b]) => a < b ? -1 : 1)) : v);
const args = process.argv.slice(2);
const bases = ledgerBases();
const result = await verifyLedger({ versions: [PUBLISHED.version], bases, network: args.includes('--network'), npmCache: process.env.npm_config_cache });
const checks = result.checks;
const check = (/** @type {string} */ label, /** @type {unknown} */ pass, /** @type {unknown} */ detail) => { checks.push({ label, pass: !!pass, ...(pass ? {} : { detail }) }); };
const entry = (await readLedger()).releases[PUBLISHED.version];
check('4.2.0 ledger entry is the one recorded at seeding', entry && createHash('sha256').update(canonical(entry)).digest('hex') === PUBLISHED.entrySHA256, { actual: entry && createHash('sha256').update(canonical(entry)).digest('hex') });
check('4.2.0 ledger names the npm tarball published to the registry', entry?.npm?.shasum === PUBLISHED.shasum && entry?.npm?.integrity === PUBLISHED.integrity && entry?.tarball?.sha1 === PUBLISHED.shasum, entry?.npm);
const sri = JSON.parse(await readFile('public/sri.json', 'utf8'));
check('sri.json still carries the go@4.2.0.js integrity', sri.files?.['go@4.2.0.js'] === PUBLISHED.loaderSRI, sri.files?.['go@4.2.0.js']);
check('4.2.0 ledger records the tag commit', entry?.git?.commit === PUBLISHED.tagCommit, entry?.git);
let tag = null;
try { tag = execFileSync('git', ['rev-parse', '--verify', '-q', 'refs/tags/v4.2.0^{commit}'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim(); } catch {}
if (tag) check('tag v4.2.0 still names 2a17b59', tag === PUBLISHED.tagCommit, { actual: tag });
const failures = checks.filter(c => !c.pass);
await mkdir('output', { recursive: true });
await writeFile('output/immutable-4.2.json', JSON.stringify({ published: PUBLISHED, bases, checks }, null, 2));
console.log(JSON.stringify({ checks: checks.length, tagChecked: !!tag, failures }, null, 2));
if (failures.length) process.exitCode = 1;
