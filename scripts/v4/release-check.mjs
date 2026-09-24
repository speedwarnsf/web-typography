// @ts-check
// Gate for publishing a cut release, run by .github/workflows/release.yml on
// the tag before `npm publish`. It proves that what is about to be published
// is exactly what the ledger records, and that the tagged sources rebuild it:
//
// - package.json, VERSION and capabilities.json all say <version>;
// - the ledger records <version> and every recorded file is on disk unchanged;
// - `release-cut --dry-run` on a git archive of the tag reproduces the npm
//   tarball, every archived file and the pinned loader byte for byte;
// - CHANGELOG.md has a dated "## <version>" section, and release notes build.
//
//   node scripts/v4/release-check.mjs --version 4.3.0 [--ref v4.3.0]
//
// Writes output/release-check.json and output/release-notes.md.
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { execFileSync, spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { verifyLedger, readLedger } from './ledger.mjs';
import { changelogSection, releaseNotes } from './release-notes.mjs';

/**
 * Rebuild <version> from a git ref with release-cut --dry-run and report
 * whether the result matches the ledger.
 * @param {string} version @param {string} ref
 */
export async function reproduceFromRef(version, ref) {
  const root = `output/reproduce-${version}-${process.pid}`;
  await rm(root, { recursive: true, force: true });
  await mkdir(root, { recursive: true });
  try {
    const archive = spawnSync('sh', ['-c', `git archive ${JSON.stringify(ref)} | tar -x -C ${JSON.stringify(root)}`], { encoding: 'utf8' });
    if (archive.status !== 0) throw new Error(`git archive ${ref}: ${archive.stderr}`);
    const cut = spawnSync(process.execPath, ['scripts/release-cut.mjs', '--version', version, '--dry-run', '--root', root], { encoding: 'utf8', timeout: 300000, maxBuffer: 64 * 1024 * 1024 });
    try { return JSON.parse(cut.stdout); } catch { throw new Error(`release-cut --dry-run failed: ${cut.stderr.slice(-800)}`); }
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}

/** @param {string} version @param {string} ref */
export async function releaseCheck(version, ref) {
  /** @type {{ label: string, pass: boolean, detail?: unknown }[]} */
  const checks = [];
  /** @param {string} label @param {unknown} pass @param {unknown} [detail] */
  const check = (label, pass, detail) => { checks.push({ label, pass: !!pass, ...(pass ? {} : { detail }) }); };
  const pkg = JSON.parse(await readFile('packages/typeset-v4/package.json', 'utf8'));
  const engine = await readFile('src/lib/v4/typeset.next.ts', 'utf8');
  const caps = JSON.parse(await readFile('packages/typeset-v4/capabilities.json', 'utf8'));
  check(`package.json version is ${version}`, pkg.version === version, pkg.version);
  check(`VERSION in typeset.next.ts is ${version}`, engine.includes(`export const VERSION = '${version}';`));
  check(`capabilities.json version is ${version}`, caps.version === version, caps.version);
  const ledger = await readLedger();
  const entry = ledger.releases[version];
  check(`the ledger records ${version} with its npm tarball`, !!entry?.tarball && entry.tarball.path === `public/releases/${version}/typeset.us-${version}.tgz`, entry?.tarball?.path);
  const recorded = await verifyLedger({ versions: [version], bases: [] });
  const bad = recorded.checks.filter(c => !c.pass);
  check(`every file the ledger records for ${version} is on disk unchanged`, bad.length === 0, bad);
  let commit = '';
  try { commit = execFileSync('git', ['rev-parse', '--verify', '-q', `${ref}^{commit}`], { encoding: 'utf8' }).trim(); } catch {}
  check(`${ref} resolves to a commit`, !!commit, ref);
  if (commit) {
    const report = await reproduceFromRef(version, ref);
    const r = report.reproduces ?? {};
    check(`${ref} rebuilds the npm tarball byte for byte (sha1 ${entry?.tarball?.sha1?.slice(0, 12)})`, r.tarballSHA1 === true, { built: report.tarball?.sha1, recorded: entry?.tarball?.sha1 });
    check(`${ref} rebuilds every archived file`, r.archivedFiles === true, r.changed);
    check(`${ref} rebuilds every file inside the tarball`, r.tarballContents === true, r.tarballContentsChanged);
    check(`${ref} rebuilds go@${version}.js`, r.loader !== false, r.loader);
  }
  const changelog = await readFile('CHANGELOG.md', 'utf8');
  const section = changelogSection(changelog, version);
  check(`CHANGELOG.md has a dated "## ${version}" section`, !!section && /^\S+ - \d{4}-\d{2}-\d{2}$/.test(section.heading) && section.body.length > 0, section?.heading);
  let notes = '';
  try { notes = await releaseNotes({ version }); check('release notes build', notes.length > 200); }
  catch (error) { check('release notes build', false, String(/** @type {Error} */ (error).message)); }
  return { version, ref, commit, checks, notes };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const { values } = parseArgs({ options: { version: { type: 'string' }, ref: { type: 'string' } } });
  if (!values.version) throw new Error('Pass --version x.y.z.');
  const result = await releaseCheck(values.version, values.ref ?? `v${values.version}`);
  await mkdir('output', { recursive: true });
  await writeFile('output/release-check.json', JSON.stringify({ ...result, notes: undefined }, null, 2));
  if (result.notes) await writeFile('output/release-notes.md', result.notes);
  const failures = result.checks.filter(c => !c.pass);
  console.log(JSON.stringify({ version: result.version, ref: result.ref, commit: result.commit, checks: result.checks.length, failures }, null, 2));
  if (failures.length) process.exitCode = 1;
}
