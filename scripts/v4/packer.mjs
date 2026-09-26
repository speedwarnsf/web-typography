// @ts-check
// Whether the npm that release-cut packs with, and the node it runs on,
// rebuild a recorded release's tarball byte for byte. npm gzips the tarball
// with that node's zlib, so the bytes follow the node build, not the npm
// version: official Node builds (nodejs.org, nvm, actions/setup-node) bundle
// the zlib that packed 4.2.0, and a node linked to the system zlib
// (Homebrew's, zlib 1.2.12) packs the same files into different bytes with
// npm 11.6.0 and 11.8.0 alike. CI's release-check repacks every cut with
// setup-node's node 22, so a cut packed elsewhere would fail there only
// after its tag was pushed. release-cut refuses to cut when this fails.
import { mkdir, mkdtemp, readFile, rm } from 'node:fs/promises';
import { execFileSync, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { readLedger } from './ledger.mjs';
import { compareVersions } from '../build-recipe.mjs';

/**
 * Repack the newest recorded release (older than `before`, if given) from
 * its own tarball's files and compare the bytes with the ledger.
 * @param {{ root?: string, cache: string, before?: string, npm?: string[] }} options
 *   `npm`: the command that runs npm (default: the npm on PATH).
 * @returns {Promise<{ pass: boolean, version?: string, recorded?: string, packed?: string, npm?: string, node?: string, zlib?: string, reason?: string }>}
 */
export async function packerReproduces({ root = process.cwd(), cache, before, npm = ['npm'] }) {
  const { releases } = await readLedger(root);
  const version = Object.keys(releases).filter(v => releases[v].tarball?.path && (!before || compareVersions(v, before) < 0)).sort(compareVersions).at(-1);
  if (!version) return { pass: false, reason: `no recorded tarball${before ? ` older than ${before}` : ''}` };
  const { path, sha1 } = releases[version].tarball;
  const work = await mkdtemp(join(tmpdir(), 'typeset-packer-'));
  try {
    const unpacked = spawnSync('tar', ['-xzf', join(root, path), '-C', work], { encoding: 'utf8' });
    if (unpacked.status !== 0) return { version, pass: false, reason: `tar -xzf ${path}: ${unpacked.stderr}` };
    const [command, ...prefix] = npm;
    const dir = join(work, 'package'), out = join(work, 'out');
    await mkdir(out);
    const run = (/** @type {string[]} */ args) => execFileSync(command, [...prefix, ...args, '--cache', cache], { cwd: dir, encoding: 'utf8', timeout: 120000 });
    const [pack] = JSON.parse(run(['pack', '--json', '--ignore-scripts', '--pack-destination', out]));
    const packed = createHash('sha1').update(await readFile(join(out, pack.filename))).digest('hex');
    // `npm version` with no argument prints the versions of the node npm runs on.
    const versions = JSON.parse(run(['version', '--json']));
    return { version, pass: packed === sha1, recorded: sha1, packed, npm: versions.npm, node: versions.node, zlib: versions.zlib };
  } finally {
    await rm(work, { recursive: true, force: true });
  }
}
