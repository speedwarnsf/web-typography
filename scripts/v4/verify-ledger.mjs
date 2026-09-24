// @ts-check
// Published artifacts are immutable. Fails when any file recorded in
// public/releases/published.json is missing, changed or joined by an
// unrecorded file, when a pinned loader or its sri.json entry changed, or
// when a ledger entry present at a base commit was modified or removed.
//
//   node scripts/v4/verify-ledger.mjs [--network] [--version 4.2.0]
//   LEDGER_BASE=<sha> adds a base commit (CI passes the previous head).
import { mkdir, writeFile } from 'node:fs/promises';
import { verifyLedger, ledgerBases } from './ledger.mjs';

const args = process.argv.slice(2);
const versions = args.flatMap((arg, i) => arg === '--version' ? [args[i + 1]] : []);
const bases = ledgerBases();
const result = await verifyLedger({ versions: versions.length ? versions : undefined, bases, network: args.includes('--network'), npmCache: process.env.npm_config_cache });
const failures = result.checks.filter(check => !check.pass);
await mkdir('output', { recursive: true });
await writeFile('output/ledger-verification.json', JSON.stringify({ bases, versions: result.versions, checks: result.checks }, null, 2));
console.log(JSON.stringify({ checks: result.checks.length, versions: result.versions, bases: bases.map(b => b.slice(0, 12)), failures }, null, 2));
if (failures.length) process.exitCode = 1;
