// @ts-check
// Stage the npm package exactly as release-cut.mjs assembles it, from the
// dist under test (the candidate in test:v4) and the package sources in
// packages/typeset-v4, then pack it. Suites that install or inspect the
// package use this, so they test what the next release will publish rather
// than the committed 4.2.0 dist.
import { cp, mkdir, readdir, readFile, rm } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { join, resolve, relative } from 'node:path';
import { emitDeclarations, copyPackageFiles, writeManifest } from '../build-recipe.mjs';
import { artifacts } from './candidate.mjs';

const PACKAGE = 'packages/typeset-v4';

/**
 * @param {{ out: string, dist?: string, pack?: boolean, npmCache?: string }} options
 * `out` is a directory under the repository (it and `<out>-pack`, where the
 * tarball is written, are removed first).
 * @returns {Promise<{ dir: string, version: string, tarball: string | null, packed: { filename: string, files: { path: string, size: number }[], unpackedSize: number, size: number, entryCount: number } | null }>}
 */
export async function stagePackage({ out, dist = artifacts.dist, pack = true, npmCache = resolve('output/npm-cache') }) {
  const root = process.cwd();
  const stage = relative(root, resolve(out));
  if (stage.startsWith('..')) throw new Error('Stage the package inside the repository (got ' + out + ').');
  await rm(stage, { recursive: true, force: true });
  await mkdir(stage, { recursive: true });
  await cp(PACKAGE, stage, { recursive: true, filter: source => !/\/(dist|declarations|node_modules)(\/|$)/.test(source.slice(PACKAGE.length)) });
  await cp(dist, join(stage, 'dist'), { recursive: true });
  const { version } = JSON.parse(await readFile(join(stage, 'package.json'), 'utf8'));
  const hasTypes = (await readdir(join(stage, 'dist'))).some(file => file.endsWith('.d.ts'));
  if (!hasTypes) await emitDeclarations({ root, distDir: `${stage}/dist`, declarationDir: `${stage}/declarations` });
  await rm(join(stage, 'declarations'), { recursive: true, force: true });
  await copyPackageFiles({ root, packageDir: stage });
  const manifest = JSON.parse(await readFile(join(stage, 'dist/manifest.json'), 'utf8'));
  if (manifest.candidate || !hasTypes) await writeManifest({ root, distDir: `${stage}/dist`, version: manifest.version, extra: manifest.candidate ? { candidate: true } : {} });
  if (!pack) return { dir: resolve(stage), version, tarball: null, packed: null };
  const destination = resolve(stage + '-pack');
  await rm(destination, { recursive: true, force: true });
  await mkdir(destination, { recursive: true });
  const [packed] = JSON.parse(execFileSync('npm', ['pack', '--json', '--ignore-scripts', '--offline', '--cache', npmCache, '--pack-destination', destination], { cwd: resolve(stage), encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }));
  return { dir: resolve(stage), version, tarball: join(destination, packed.filename), packed };
}
