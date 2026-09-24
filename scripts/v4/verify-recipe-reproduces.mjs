// @ts-check
// The build recipe changes by release line (scripts/build-recipe.mjs
// RECIPES). A release cut at an older tag must still use that line's recipe
// and reproduce the published bytes, or the ledger's claim that a release can
// be rebuilt from its tag stops being true. This runs
// `release-cut --dry-run --version 4.2.0` on a git archive of tag v4.2.0 and
// requires the npm tarball, every archived file and the pinned loader to
// match the ledger byte for byte. release-check.mjs does the same for the
// version being published.
import { mkdir, writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { reproduceFromRef } from './release-check.mjs';

/** @type {{ label: string, pass: boolean, detail?: unknown }[]} */
const checks = [];
/** @type {string[]} */
const errors = [];
let report = null;
try {
  let tag = '';
  try { tag = execFileSync('git', ['rev-parse', '--verify', '-q', 'refs/tags/v4.2.0^{commit}'], { encoding: 'utf8' }).trim(); } catch {}
  if (!tag) throw new Error('Tag v4.2.0 is not in this checkout; fetch tags (CI uses fetch-depth: 0).');
  report = await reproduceFromRef('4.2.0', 'v4.2.0');
  const reproduces = report.reproduces ?? {};
  checks.push({ label: 'tag v4.2.0 is cut with the 4.2 recipe', pass: report.recipe === '4.2', detail: report.recipe });
  checks.push({ label: 'npm tarball sha1 equals the published c24c7c0b', pass: reproduces.tarballSHA1 === true && report.tarball.sha1 === 'c24c7c0bd02950093eb012a404035770b61495dc', detail: report.tarball.sha1 });
  checks.push({ label: 'every archived 4.2.0 file is reproduced', pass: reproduces.archivedFiles === true, detail: reproduces.changed });
  checks.push({ label: 'every file inside the tarball is reproduced', pass: reproduces.tarballContents === true, detail: reproduces.tarballContentsChanged });
  checks.push({ label: 'go@4.2.0.js is reproduced (sri.json integrity)', pass: reproduces.loader === true, detail: reproduces.loader });
} catch (error) {
  errors.push(String(/** @type {Error} */ (error).stack || error));
}
await mkdir('output', { recursive: true });
await writeFile('output/recipe-reproduces.json', JSON.stringify({ checks, errors, tarball: report?.tarball }, null, 2));
const failures = checks.filter(c => !c.pass);
console.log(JSON.stringify({ checks: checks.length, failures, errors }, null, 2));
if (failures.length || errors.length) process.exitCode = 1;
