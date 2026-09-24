// @ts-check
// Cut a release. This is the only script that writes packages/typeset-v4/dist,
// public/releases/<v>/, public/go@<v>.js and the website aliases, and the only
// place the package version changes. Development builds use
// scripts/build-candidate.mjs, which writes nothing outside output/.
//
//   node scripts/release-cut.mjs --version 4.3.0 --summary "One sentence for the archive page."
//   node scripts/release-cut.mjs --version 4.3.0 --dry-run [--verify]
//   node scripts/release-cut.mjs --version 4.2.0 --dry-run --root <checkout of v4.2.0>
//
// Order of work: check that the version is new (no archive, no pin, not on
// npm), copy the sources into a fresh staging directory under output/, bump
// the version there, build, pack and verify there, and only then move the
// results into the tree. Nothing in the tree is touched until every check
// has passed. A dry run stops before the move, and when the ledger already
// records the version it reports whether the build reproduces those bytes.
import { cp, mkdtemp, mkdir, readFile, readdir, rename, rm, stat, symlink, writeFile, copyFile } from 'node:fs/promises';
import { execFileSync, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { gzipSync } from 'node:zlib';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { buildPackageDist, emitDeclarations, writeManifest, buildSite, copyPackageFiles, compareVersions, sri, sha256, recipeFor } from './build-recipe.mjs';
import { readLedger, describeRelease, describePins, readTarball, LEDGER } from './v4/ledger.mjs';

const { values } = parseArgs({ options: {
  version: { type: 'string' }, 'dry-run': { type: 'boolean', default: false }, root: { type: 'string' },
  summary: { type: 'string' }, verify: { type: 'boolean', default: false }, keep: { type: 'boolean', default: false },
} });
const version = values.version ?? '';
const dryRun = values['dry-run'];
if (!/^\d+\.\d+\.\d+(-[0-9A-Za-z.]+)?$/.test(version)) throw new Error('Pass --version x.y.z.');
if (!dryRun && !values.summary) throw new Error('Pass --summary with one sentence for public/releases/' + version + '/index.html.');
const repo = process.cwd();
const root = resolve(values.root ?? repo);
const exists = (/** @type {string} */ path) => stat(path).then(() => true, () => false);
const report = { version, dryRun, root, recipe: /** @type {string | null} */ (null), preconditions: /** @type {Record<string, unknown>} */ ({}), tarball: /** @type {Record<string, unknown>} */ ({}), reproduces: /** @type {Record<string, unknown> | null} */ (null), wrote: /** @type {string[]} */ ([]) };
/** @param {string} name @param {boolean} pass @param {unknown} [detail] */
function precondition(name, pass, detail) {
  report.preconditions[name] = { pass, ...(detail === undefined ? {} : { detail }) };
  if (!pass && !dryRun) throw new Error(`release-cut: ${name} failed${detail === undefined ? '' : ': ' + JSON.stringify(detail)}. Nothing was written.`);
}

// 1. The version must be new everywhere it could already exist.
const releases = (await readdir(join(root, 'public/releases'), { withFileTypes: true })).filter(d => d.isDirectory()).map(d => d.name).sort(compareVersions);
precondition('no public/releases/' + version, !releases.includes(version));
precondition('no public/go@' + version + '.js', !await exists(join(root, `public/go@${version}.js`)));
const stable = releases.filter(v => !v.includes('-') && compareVersions(v, version) < 0);
const previous = stable.at(-1) ?? null;
precondition('newer than every archived release', releases.every(v => v === version || compareVersions(v, version) < 0), { newest: releases.at(-1) });
const npmCache = await mkdtemp(join(tmpdir(), 'typeset-release-npm-'));
{
  const view = spawnSync('npm', ['view', `typeset.us@${version}`, 'version', '--json', '--cache', npmCache], { encoding: 'utf8', timeout: 60000 });
  const notFound = /E404|is not in this registry|No match found/.test(view.stderr + view.stdout);
  const published = view.status === 0 && view.stdout.trim() !== '';
  precondition(`typeset.us@${version} unused on npm`, notFound && !published, notFound ? undefined : (published ? 'already published' : (view.stderr || 'npm registry unreachable').split('\n')[0]));
}
if (!dryRun) {
  const dirty = execFileSync('git', ['status', '--porcelain'], { cwd: root, encoding: 'utf8' }).trim();
  precondition('clean working tree', dirty === '', dirty.split('\n').slice(0, 10));
}

// 2. Stage the sources and bump the version in the staged copy only.
await mkdir(join(repo, 'output'), { recursive: true });
const staging = await mkdtemp(join(repo, 'output', `release-cut-${version}-`));
const pkgDir = 'packages/typeset-v4', distDir = `${pkgDir}/dist`;
try {
  for (const path of ['src/lib/v4', 'src/vendor', 'vendor/unicode', 'LICENSE']) await cp(join(root, path), join(staging, path), { recursive: true });
  await cp(join(root, pkgDir), join(staging, pkgDir), { recursive: true, filter: source => !/\/(dist|declarations|node_modules)(\/|$)/.test(source.slice(join(root, pkgDir).length)) });
  await symlink(join(repo, 'node_modules'), join(staging, 'node_modules'), 'dir');
  const pkgPath = join(staging, pkgDir, 'package.json');
  const pkgText = await readFile(pkgPath, 'utf8');
  const bumpedPkg = pkgText.replace(/("version":\s*")[^"]+(")/, `$1${version}$2`);
  if (JSON.parse(bumpedPkg).version !== version) throw new Error('Could not set the package version.');
  await writeFile(pkgPath, bumpedPkg);
  const enginePath = join(staging, 'src/lib/v4/typeset.next.ts');
  const engineText = await readFile(enginePath, 'utf8');
  if ((engineText.match(/export const VERSION = '[^']+';/g) ?? []).length !== 1) throw new Error('Expected one VERSION constant in typeset.next.ts.');
  await writeFile(enginePath, engineText.replace(/export const VERSION = '[^']+';/, `export const VERSION = '${version}';`));

  // 3. Build, pack and assemble the archive inside staging.
  // The recipe this version is cut with: a dry run at an older tag uses that
  // release line's recipe and so reproduces its published bytes.
  const recipe = recipeFor(version);
  report.recipe = recipe.line;
  await buildPackageDist({ root: staging, distDir, recipe });
  await emitDeclarations({ root: staging, distDir, declarationDir: `${pkgDir}/declarations`, tsc: join(repo, 'node_modules/.bin/tsc') });
  await copyPackageFiles({ root: staging, packageDir: pkgDir });
  await writeManifest({ root: staging, distDir, version });
  await mkdir(join(staging, 'pack'));
  const [pack] = JSON.parse(execFileSync('npm', ['pack', '--json', '--cache', npmCache, '--pack-destination', join(staging, 'pack')], { cwd: join(staging, pkgDir), encoding: 'utf8' }));
  const tgz = await readFile(join(staging, 'pack', pack.filename));
  report.tarball = { filename: pack.filename, sha1: createHash('sha1').update(tgz).digest('hex'), integrity: 'sha512-' + createHash('sha512').update(tgz).digest('base64'), files: pack.entryCount, unpackedSize: pack.unpackedSize };
  const archive = join(staging, 'archive', version);
  await mkdir(archive, { recursive: true });
  for (const file of await readdir(join(staging, distDir))) await copyFile(join(staging, distDir, file), join(archive, file));
  for (const file of recipe.archivedFiles) await copyFile(join(staging, pkgDir, file), join(archive, file));
  await copyFile(join(staging, 'pack', pack.filename), join(archive, pack.filename));
  if (values.summary) await writeFile(join(archive, 'index.html'), archivePage(version, values.summary, stable));
  await buildSite({ root: staging, distDir, siteDir: 'site', version });
  const go = await readFile(join(staging, 'site/go.js'));

  // 4. Verify the staged release with the full suite before touching the tree.
  if (!dryRun || values.verify) {
    const env = { ...process.env, TYPESET_RELEASE_STAGING: staging, TYPESET_DIST: join(staging, distDir), TYPESET_BUNDLE: join(staging, distDir, 'typeset.global.js'), TYPESET_ESM: join(staging, distDir, 'index.js'), TYPESET_REACT: join(staging, distDir, 'react.js'), TYPESET_GO: join(staging, distDir, 'go.js'), TYPESET_STYLES: join(staging, distDir, 'styles.css'), TYPESET_SITE_GO: join(staging, 'site/go.js') };
    const run = spawnSync(process.execPath, ['scripts/v4/verify-release.mjs', '--prebuilt'], { cwd: repo, env, stdio: 'inherit' });
    report.preconditions['staged release passes test:v4'] = { pass: run.status === 0 };
    if (run.status !== 0 && !dryRun) throw new Error('release-cut: the staged release failed test:v4. Nothing was written.');
    const budgets = spawnSync(process.execPath, ['scripts/v4/verify-budgets.mjs', '--runtime'], { cwd: repo, env, stdio: 'inherit' });
    report.preconditions['staged release meets runtime budgets'] = { pass: budgets.status === 0 };
    if (budgets.status !== 0 && !dryRun) throw new Error('release-cut: the staged release exceeded its runtime budgets. Nothing was written.');
  }

  // A dry run for a recorded version proves the recipe reproduces it.
  const ledger = await readLedger(repo).catch(() => null);
  const recorded = ledger?.releases?.[version];
  if (recorded) {
    const changed = [];
    for (const [path, hash] of Object.entries(/** @type {Record<string, string>} */ (recorded.files))) {
      const file = path.slice(`public/releases/${version}/`.length);
      if (file === 'index.html' && !values.summary) continue;
      const staged = join(archive, file);
      if (!await exists(staged)) changed.push({ file, reason: 'not produced' });
      else if (sha256(await readFile(staged)) !== hash) changed.push({ file, reason: 'different bytes' });
    }
    const contents = readTarball(tgz);
    const tarballContents = Object.entries(/** @type {Record<string, string>} */ (recorded.tarball?.contents ?? {})).filter(([name, hash]) => sha256(/** @type {Buffer} */ (contents.get(name) ?? Buffer.alloc(0))) !== hash).map(([name]) => name);
    const pin = ledger.pins?.[`go@${version}.js`];
    report.reproduces = {
      tarballSHA1: report.tarball.sha1 === recorded.tarball?.sha1,
      archivedFiles: changed.length === 0, changed,
      tarballContents: tarballContents.length === 0, tarballContentsChanged: tarballContents,
      loader: pin ? pin.integrity === sri(go) : null,
      indexHtmlCompared: !!values.summary,
    };
  }

  if (dryRun) {
    report.wrote = [];
    console.log(JSON.stringify({ ...report, staging: values.keep ? staging : '(removed)' }, null, 2));
    if (report.reproduces && !(report.reproduces.tarballSHA1 && report.reproduces.archivedFiles && report.reproduces.tarballContents && report.reproduces.loader !== false)) process.exitCode = 1;
  } else {
    // 5. Move the verified results into the tree.
    const move = async (/** @type {string} */ from, /** @type {string} */ to) => { await rename(from, join(root, to)); report.wrote.push(to); };
    const place = async (/** @type {string} */ to, /** @type {Uint8Array | string} */ bytes, flag = 'w') => {
      const temp = join(staging, 'place-' + createHash('sha1').update(to).digest('hex'));
      await writeFile(temp, bytes, { flag: 'wx' });
      if (flag === 'wx' && await exists(join(root, to))) throw new Error(`Refusing to replace published ${to}`);
      await rename(temp, join(root, to)); report.wrote.push(to);
    };
    await move(archive, `public/releases/${version}`);
    await place(`public/go@${version}.js`, go, 'wx');
    await rename(join(root, distDir), join(staging, 'previous-dist'));
    await move(join(staging, distDir), distDir);
    for (const file of ['package.json', 'LICENSE', 'THIRD-PARTY-LICENSES.txt', 'UNICODE-LICENSE.txt', 'AGENTS.md']) await place(`${pkgDir}/${file}`, await readFile(join(staging, pkgDir, file)));
    await place('src/lib/v4/typeset.next.ts', await readFile(join(staging, 'src/lib/v4/typeset.next.ts')));
    for (const file of ['go.js', 'typeset.min.js', 'typeset.global.js.map', 'typeset.esm.js', 'typeset.css']) await place(`public/${file}`, await readFile(join(staging, 'site', file)));
    await place('public/for-agents.md', await readFile(join(staging, pkgDir, 'for-agents.md')));
    await place('public/capabilities.json', await readFile(join(staging, pkgDir, 'capabilities.json')));
    /** @type {Record<string, string>} */
    const files = {};
    for (const file of (await readdir(join(root, 'public'))).filter(f => /^go@\d+\.\d+\.\d+\.js$/.test(f)).sort(byPinVersion)) files[file] = sri(await readFile(join(root, 'public', file)));
    for (const file of ['typeset.min.js', 'typeset.esm.js']) files[file] = sri(await readFile(join(root, 'public', file)));
    await place('public/sri.json', JSON.stringify({ version, files, snippet: `<script src="https://typeset.us/go@${version}.js" integrity="${sri(go)}" crossorigin="anonymous" defer></script>` }, null, 2) + '\n');
    const pins = (await readdir(join(root, 'public'))).filter(f => /^go@\d+\.\d+\.\d+\.js$/.test(f)).map(f => f.slice(3, -3)).filter(v => compareVersions(v, version) < 0).sort(compareVersions);
    await place('public/release.json', JSON.stringify({ version, previous, previousBrowserPin: pins.at(-1) ?? null, package: `typeset.us@${version}`, download: `/releases/${version}/${pack.filename}`, archive: previous ? `/releases/${previous}/README.md` : null, manifest: `/releases/${version}/manifest.json`, loader: { url: `/go@${version}.js`, integrity: sri(go), bytes: go.length, gzipBytes: gzipSync(go).length }, validation: 'See SUPPORT.md for verified coverage and outstanding device acceptance.' }, null, 2) + '\n');
    // 6. Append the new release to the ledger. It records the tarball that
    //    must be published: npm publish public/releases/<v>/<tarball>.
    const nextLedger = await readLedger(root);
    if (nextLedger.releases[version]) throw new Error(`${version} is already in the ledger.`);
    const entry = await describeRelease(version, { root, npm: { shasum: String(report.tarball.sha1), integrity: String(report.tarball.integrity) } });
    nextLedger.releases[version] = entry;
    for (const [pin, value] of Object.entries(await describePins(root))) if (!nextLedger.pins[pin]) nextLedger.pins[pin] = value;
    await place(LEDGER, JSON.stringify(nextLedger, null, 2) + '\n');
    console.log(JSON.stringify(report, null, 2));
    console.log(`Cut typeset.us@${version}. Review and commit the tree, tag v${version}, then publish exactly public/releases/${version}/${pack.filename}.`);
  }
} finally {
  if (!values.keep) await rm(staging, { recursive: true, force: true });
  await rm(npmCache, { recursive: true, force: true });
}

/** @param {string} a @param {string} b */
function byPinVersion(a, b) { return compareVersions(a.slice(3, -3), b.slice(3, -3)); }

/**
 * The archive landing page, in the form 4.1.0 and 4.2.0 shipped.
 * @param {string} v @param {string} summary @param {string[]} earlier stable releases before v, ascending
 */
function archivePage(v, summary, earlier) {
  const major = Number(v.split('.')[0]);
  const links = [];
  for (const old of [...earlier].reverse()) {
    const oldMajor = Number(old.split('.')[0]);
    if (oldMajor === major) links.push(`<a href="/releases/${old}/">${old} archive</a>`);
  }
  for (let m = major - 1; m >= 3; m--) {
    const last = earlier.filter(old => Number(old.split('.')[0]) === m).at(-1);
    if (last) links.push(`<a href="/releases/${last}/">V${m} archive</a>`);
  }
  links.push('<a href="/">typeset.us</a>');
  return `<!doctype html><html lang="en"><base href="/releases/${v}/"><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Typeset ${v}</title><style>body{font:18px/1.6 system-ui;max-width:48rem;margin:3rem auto;padding:0 1.5rem;background:#101010;color:#eee}a{color:#a8d6b2}h1{font-size:2rem}code{overflow-wrap:anywhere}</style><main><h1>Typeset ${v}</h1><p>${summary}</p><p><code>npm install typeset.us@${v}</code></p><ul><li><a href="README.md">Installation and selector targeting</a></li><li><a href="MIGRATION.md">Migration and rollback</a></li><li><a href="SUPPORT.md">Support range and testing limits</a></li><li><a href="for-agents.md">Agent integration contract</a></li><li><a href="capabilities.json">Machine-readable capabilities</a></li><li><a href="typeset.us-${v}.tgz">npm package download</a></li><li><a href="/go@${v}.js">Automatic website loader</a></li><li><a href="index.js">ES module</a></li><li><a href="typeset.global.js">Browser global</a></li><li><a href="styles.css">Optional native list styles</a></li><li><a href="manifest.json">Package artifact integrity hashes</a></li><li><a href="/sri.json">Website loader integrity hashes</a></li></ul><p>${links.join(' / ')}</p></main></html>\n`;
}
