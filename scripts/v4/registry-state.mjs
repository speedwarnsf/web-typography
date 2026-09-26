// @ts-check
// Whether npm already serves typeset.us@<version>, and if it does, whether
// those are the bytes the ledger records. release.yml asks before it
// publishes: until npm trusted publishing is configured
// (docs/OWNER-ACTIONS.md), the maintainer account publishes the
// ledger-recorded tarball itself, as it did 4.2.0 and 4.3.0, and the workflow
// then creates only the GitHub Release.
//
//   node scripts/v4/registry-state.mjs --version 4.3.0
//
// Prints "unpublished" (npm answers 404 for the version) or "published" (the
// registry's dist.integrity equals the ledger's). Exits 1, saying why, when
// npm serves the version with other bytes, when the ledger does not record
// the version, or when npm cannot be asked.
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { readLedger } from './ledger.mjs';

/** @typedef {{ status: number | null, stdout: string, stderr: string }} ViewResult */
/** @typedef {{ state: 'published' | 'unpublished' | 'conflict' | 'unknown', detail: string }} RegistryState */

/**
 * `npm view typeset.us@<version> dist.integrity`, with the npm on PATH.
 * @param {string} version @returns {ViewResult}
 */
export function npmViewIntegrity(version) {
  const cache = process.env.npm_config_cache;
  const run = spawnSync('npm', ['view', `typeset.us@${version}`, 'dist.integrity', ...(cache ? ['--cache', cache] : [])], { encoding: 'utf8', timeout: 60000 });
  return { status: run.status, stdout: run.stdout ?? '', stderr: (run.stderr ?? '') + (run.error ? String(run.error.message) : '') };
}

/**
 * What an `npm view <spec> dist.integrity` result means for a version whose
 * ledger integrity is `ledgerIntegrity`.
 * @param {{ version: string, ledgerIntegrity: string | undefined, view: ViewResult }} input
 * @returns {RegistryState}
 */
export function classifyRegistry({ version, ledgerIntegrity, view }) {
  const spec = `typeset.us@${version}`;
  if (!ledgerIntegrity) return { state: 'unknown', detail: `the ledger does not record ${spec}; cut it with release-cut.mjs first` };
  const registry = view.stdout.trim();
  if (view.status === 0 && /^sha512-[A-Za-z0-9+/]+={0,2}$/.test(registry)) {
    if (registry === ledgerIntegrity) return { state: 'published', detail: `npm serves ${spec} with the ledger's integrity ${registry}` };
    return { state: 'conflict', detail: `npm serves ${spec} with ${registry}, but the ledger records ${ledgerIntegrity}: these are not the cut's bytes` };
  }
  if (view.status !== 0 && /\bE404\b/.test(view.stdout + view.stderr)) return { state: 'unpublished', detail: `npm has no ${spec}` };
  const lines = (view.stderr + '\n' + view.stdout).split('\n').map(line => line.trim()).filter(Boolean);
  const said = lines.find(line => /^npm error\b/.test(line)) ?? lines.find(line => !/^npm warn\b/.test(line)) ?? '';
  return { state: 'unknown', detail: `npm view ${spec} dist.integrity exited ${view.status}${said ? `: ${said}` : ' with no integrity'}` };
}

/**
 * @param {{ version: string, root?: string, view?: (version: string) => ViewResult }} options
 * @returns {Promise<RegistryState>}
 */
export async function registryState({ version, root = '.', view = npmViewIntegrity }) {
  const ledger = await readLedger(root);
  return classifyRegistry({ version, ledgerIntegrity: ledger.releases?.[version]?.tarball?.integrity, view: view(version) });
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const { values } = parseArgs({ options: { version: { type: 'string' } } });
  if (!values.version || !/^\d+\.\d+\.\d+(-[0-9A-Za-z.]+)?$/.test(values.version)) throw new Error('Pass --version x.y.z.');
  const result = await registryState({ version: values.version });
  if (result.state === 'published' || result.state === 'unpublished') {
    console.error(result.detail);
    console.log(result.state);
  } else {
    if (process.env.GITHUB_ACTIONS) console.error(`::error title=typeset.us@${values.version} on npm::${result.detail}`);
    console.error(`${result.state}: ${result.detail}`);
    process.exitCode = 1;
  }
}
