// @ts-check
// The release pipeline and security policy people are asked to trust (K9):
// workflows pinned by commit SHA with least-privilege permissions, a release
// workflow that publishes only the ledger-recorded tarball with provenance
// after release-check and test:release, and that leaves alone a version the
// maintainer account already published with the ledger's bytes (claiming no
// provenance for it) but stops on any other bytes, Dependabot for npm and
// Actions, SECURITY.md in the repository and the package, a machine-readable
// list of advisories for published files, and release notes that build for
// every published 4.x version.
import { chmod, cp, mkdir, mkdtemp, readFile, readdir, rm, symlink, writeFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { readLedger } from './ledger.mjs';
import { packerReproduces } from './packer.mjs';
import { releaseNotes } from './release-notes.mjs';
import { classifyRegistry } from './registry-state.mjs';

/** @type {{ label: string, pass: boolean, detail?: unknown }[]} */
const checks = [];
/** @type {string[]} */
const errors = [];
/** @param {string} label @param {unknown} pass @param {unknown} [detail] */
const check = (label, pass, detail) => { checks.push({ label, pass: !!pass, ...(pass ? {} : { detail }) }); };

/**
 * The indented block under a YAML key, as text (enough for these checks).
 * @param {string} text @param {string} key e.g. '  publish:' @returns {string}
 */
function block(text, key) {
  const lines = text.split('\n');
  const start = lines.findIndex(line => line === key || line.startsWith(key + ' '));
  if (start < 0) return '';
  const indent = key.length - key.trimStart().length;
  const out = [];
  for (const line of lines.slice(start + 1)) {
    if (line.trim() && line.length - line.trimStart().length <= indent) break;
    out.push(line);
  }
  return out.join('\n');
}

/**
 * The `run: |` script of the step whose name starts with `name`, in a job's
 * block of release.yml; null when there is no such step.
 * @param {string} job @param {string} name @returns {string | null}
 */
function stepScript(job, name) {
  const lines = job.split('\n');
  const start = lines.findIndex(line => /^\s*- name: /.test(line) && line.replace(/^\s*- name: /, '').startsWith(name));
  if (start < 0) return null;
  const stepIndent = lines[start].indexOf('-');
  let at = start + 1;
  for (; at < lines.length; at++) {
    const line = lines[at];
    if (line.trim() && line.length - line.trimStart().length <= stepIndent) return null;
    if (/^\s*run: \|\s*$/.test(line)) break;
  }
  if (at >= lines.length) return null;
  const runIndent = lines[at].length - lines[at].trimStart().length;
  const body = [];
  for (const line of lines.slice(at + 1)) {
    if (line.trim() && line.length - line.trimStart().length <= runIndent) break;
    body.push(line);
  }
  const indent = Math.min(...body.filter(line => line.trim()).map(line => line.length - line.trimStart().length));
  return body.map(line => line.slice(indent)).join('\n').trimEnd() + '\n';
}

/**
 * A stand-in for npm (CommonJS, run from a temporary PATH entry): it logs
 * every call, answers `npm view` from the ledger as FAKE_NPM says (ledger:
 * the ledger's integrity; other: other bytes under FAKE_VERSION; absent: 404
 * for FAKE_VERSION; offline: no registry) and pretends to publish.
 */
const FAKE_NPM = `#!/usr/bin/env node
const { appendFileSync, readFileSync } = require('node:fs');
const args = process.argv.slice(2);
appendFileSync(process.env.FAKE_LOG, JSON.stringify(['npm', ...args]) + '\\n');
if (args[0] === 'publish') process.exit(0);
if (args[0] !== 'view') process.exit(0);
const mode = process.env.FAKE_NPM;
const version = args[1].slice(args[1].lastIndexOf('@') + 1);
if (mode === 'offline') { process.stderr.write('npm error code ENOTFOUND\\nnpm error network request to https://registry.npmjs.org/ failed\\n'); process.exit(1); }
if (mode === 'absent' && version === process.env.FAKE_VERSION) { process.stderr.write('npm error code E404\\nnpm error 404 No match found for version ' + version + '\\n'); process.exit(1); }
const entry = JSON.parse(readFileSync('public/releases/published.json', 'utf8')).releases[version];
if (!entry || !entry.npm) { process.stderr.write('npm error code E404\\n'); process.exit(1); }
const dist = { integrity: entry.npm.integrity, shasum: entry.npm.shasum };
if (mode === 'other' && version === process.env.FAKE_VERSION) dist.integrity = 'sha512-' + 'A'.repeat(86) + '==';
if (args[2] === 'dist.integrity') process.stdout.write(dist.integrity + '\\n');
else if (args[2] === 'dist') process.stdout.write(JSON.stringify(dist) + '\\n');
else if (args[2] === 'dist.attestations') process.stdout.write(process.env.FAKE_ATTESTATIONS || '');
`;

/** A stand-in for gh that logs its arguments. */
const FAKE_GH = `#!/usr/bin/env node
require('node:fs').appendFileSync(process.env.FAKE_LOG, JSON.stringify(['gh', ...process.argv.slice(2)]) + '\\n');
`;

/** npm, then its tarball gzipped again at level 1: the same tar in other bytes. */
const REGZIP = `import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { gunzipSync, gzipSync } from 'node:zlib';
import { join } from 'node:path';
const args = process.argv.slice(2);
const out = execFileSync('npm', args, { encoding: 'utf8' });
if (args[0] === 'pack') {
  const dest = args[args.indexOf('--pack-destination') + 1];
  for (const { filename } of JSON.parse(out)) writeFileSync(join(dest, filename), gzipSync(gunzipSync(readFileSync(join(dest, filename))), { level: 1 }));
}
process.stdout.write(out);
`;

try {
  const workflows = (await readdir('.github/workflows')).filter(file => file.endsWith('.yml'));
  for (const file of workflows) {
    const text = await readFile(`.github/workflows/${file}`, 'utf8');
    const uses = [...text.matchAll(/^\s*(?:-\s*)?uses:\s*(\S+)(.*)$/gm)].map(m => ({ ref: m[1], comment: m[2].trim() }));
    const unpinned = uses.filter(u => !/^[\w.-]+\/[\w.-]+(?:\/[\w./-]+)?@[0-9a-f]{40}$/.test(u.ref) || !/^# v\d/.test(u.comment));
    check(`${file}: every action is pinned to a commit SHA with its version noted`, uses.length > 0 && unpinned.length === 0, unpinned);
    check(`${file}: top-level permissions are contents: read`, /^permissions:\n {2}contents: read\n/m.test(text));
    if (file !== 'release.yml') check(`${file}: no job asks for write permissions`, !/:\s*write\b/.test(text), text.match(/.*: write.*/g));
    check(`${file}: checkout does not persist credentials`, [...text.matchAll(/uses: actions\/checkout@/g)].length === [...text.matchAll(/persist-credentials: false/g)].length);
  }
  const ci = await readFile('.github/workflows/ci.yml', 'utf8');
  check('ci.yml runs on master pushes and pull requests, once per pull request', /push:\s*\n\s*branches: \[master\]/.test(ci) && /pull_request:/.test(ci) && /cancel-in-progress: true/.test(ci));

  const release = await readFile('.github/workflows/release.yml', 'utf8');
  const verify = block(release, '  verify:'), publish = block(release, '  publish:');
  check('release.yml runs on v* tags', /push:\n\s+tags: \['v\*'\]/.test(release));
  check('release.yml requires CI to have passed on the tagged commit', /actions\/workflows\/ci\.yml\/runs\?head_sha=\$SHA&status=success/.test(verify));
  check('release.yml verifies the rebuild and runs test:release before publishing', /release-check\.mjs --version/.test(verify) && /npm run test:release/.test(verify) && /needs: verify/.test(publish));
  check('release.yml verify job cannot write or mint tokens', !/write/.test(verify.split('steps:')[0]));
  check('release.yml publishes only on a tag push, from the npm environment', /if: github\.event_name == 'push'/.test(publish) && /environment: npm/.test(publish));
  check('release.yml publishes the commit the verify job checked, and stops if the tag has moved since', /sha=\$\(git rev-parse "\$TAG\^\{commit\}"\)/.test(verify) && /sha: \$\{\{ steps\.version\.outputs\.sha \}\}/.test(release)
    && /ref: \$\{\{ needs\.verify\.outputs\.sha \}\}/.test(publish) && !/ref: \$\{\{ env\.TAG \}\}/.test(publish)
    && /git fetch --force --no-tags origin "refs\/tags\/\$TAG:refs\/tags\/\$TAG"/.test(publish) && /"\$NOW" != "\$VERIFIED"/.test(publish) && publish.indexOf('The tag still names the verified commit') < publish.indexOf('npm publish'));
  check('release.yml publish job may mint an OIDC token (trusted publishing)', /id-token: write/.test(publish));
  check('release.yml publishes exactly the committed tarball with provenance', /npm publish "public\/releases\/\$VERSION\/typeset\.us-\$VERSION\.tgz" --provenance/.test(publish) && !/npm publish(?! "public\/releases)/.test(publish.replace(/--dry-run/g, '')));
  check('release.yml asks the registry (registry-state.mjs) before the dry run and before publishing', /registry-state\.mjs --version "\$VERSION"\)" \|\| exit 1/.test(verify) && verify.indexOf('registry-state.mjs') < verify.indexOf('npm publish')
    && /registry-state\.mjs --version "\$VERSION"\)" \|\| exit 1/.test(publish) && publish.indexOf('registry-state.mjs') < publish.indexOf('npm publish'));
  check('release.yml confirms registry integrity, and an attestation only for a version it published', /verify-ledger\.mjs --network/.test(publish)
    && /PUBLISHED_BY: \$\{\{ steps\.publish\.outputs\.by \}\}/.test(publish) && /if \[ "\$PUBLISHED_BY" = workflow \]; then\n\s+npm view "typeset\.us@\$VERSION" dist\.attestations/.test(publish));
  check('release.yml creates the GitHub Release with notes and evidence attached, claiming provenance only for a version it published', /workflow\) NOTES=--provenance ;;/.test(publish) && /maintainer\) NOTES=--maintainer ;;/.test(publish)
    && /release-notes\.mjs --version "\$VERSION" "\$NOTES"/.test(publish) && /gh release create "\$TAG" --verify-tag/.test(publish) && /output\/\*\.json/.test(publish));

  // The maintainer-published path, run: the publish job's scripts with npm and
  // gh replaced by stand-ins, against the newest 4.x release in the ledger.
  {
    const ledger = await readLedger();
    const version = Object.keys(ledger.releases).filter(v => /^4\.\d+\.\d+$/.test(v) && ledger.releases[v].npm && ledger.releases[v].tarball).sort((a, b) => a.localeCompare(b, 'en', { numeric: true })).at(-1) ?? '';
    const integrity = ledger.releases[version]?.tarball?.integrity;
    const other = 'sha512-' + 'A'.repeat(86) + '==';
    const cases = /** @type {[string, Parameters<typeof classifyRegistry>[0]['view'], string][]} */ ([
      ['the ledger\'s integrity', { status: 0, stdout: `${integrity}\n`, stderr: '' }, 'published'],
      ['other bytes', { status: 0, stdout: `${other}\n`, stderr: '' }, 'conflict'],
      ['a 404', { status: 1, stdout: '', stderr: 'npm error code E404\nnpm error 404 No match found for version\n' }, 'unpublished'],
      ['no registry', { status: 1, stdout: '', stderr: 'npm warn config\nnpm error code ENOTFOUND\n' }, 'unknown'],
      ['an empty answer', { status: 0, stdout: '\n', stderr: '' }, 'unknown'],
    ]);
    const classified = cases.map(([label, view, expected]) => ({ label, expected, actual: classifyRegistry({ version, ledgerIntegrity: integrity, view }).state }));
    check(`registry-state classifies npm's answer for ${version}: ledger bytes published, other bytes a conflict, 404 unpublished, errors unknown`, !!integrity && classified.every(c => c.actual === c.expected)
      && classifyRegistry({ version: '0.0.0', ledgerIntegrity: undefined, view: cases[0][1] }).state === 'unknown', classified);

    const work = await mkdtemp(join(tmpdir(), 'typeset-trust-release-'));
    try {
      const bin = join(work, 'bin'), tree = join(work, 'tree');
      await mkdir(bin); await mkdir(join(tree, 'output'), { recursive: true });
      // The scripts are copied, not linked: a script run through a symlink
      // does not see itself as the main module. The data they read is linked.
      await cp('scripts/v4', join(tree, 'scripts/v4'), { recursive: true, filter: source => !source.includes('/node_modules') });
      for (const path of ['public', 'docs', '.github', 'CHANGELOG.md']) await symlink(resolve(path), join(tree, path));
      await writeFile(join(bin, 'npm'), FAKE_NPM); await writeFile(join(bin, 'gh'), FAKE_GH);
      await chmod(join(bin, 'npm'), 0o755); await chmod(join(bin, 'gh'), 0o755);
      const scripts = {
        dryRun: stepScript(verify, 'npm accepts the tarball'),
        publish: stepScript(publish, 'Publish exactly the ledger-recorded tarball'),
        registry: stepScript(publish, "The registry serves the ledger's bytes"),
        release: stepScript(publish, 'GitHub Release with notes and evidence'),
      };
      check('release.yml: the dry-run, publish, registry and GitHub Release steps have run scripts without ${{ }} expressions (they read env)', Object.values(scripts).every(text => text && !text.includes('${{')), Object.fromEntries(Object.entries(scripts).map(([k, v]) => [k, v === null ? null : v.includes('${{')])));
      let run = 0;
      /** @param {string | null} script @param {Record<string, string>} env */
      const runStep = async (script, env) => {
        const dir = join(work, `run-${++run}`);
        await mkdir(dir);
        const log = join(dir, 'calls.jsonl'), output = join(dir, 'github-output'), file = join(dir, 'step.sh');
        await writeFile(log, ''); await writeFile(output, ''); await writeFile(file, script ?? 'exit 99\n');
        await rm(join(tree, 'output'), { recursive: true, force: true }); await mkdir(join(tree, 'output'));
        const base = { ...process.env };
        delete base.GITHUB_ACTIONS; delete base.GITHUB_OUTPUT; delete base.npm_config_cache;
        const result = spawnSync('bash', ['--noprofile', '--norc', '-e', file], { cwd: tree, encoding: 'utf8', timeout: 120000, env: { ...base, PATH: `${bin}:${process.env.PATH}`, VERSION: version, TAG: `v${version}`, GITHUB_OUTPUT: output, FAKE_LOG: log, FAKE_VERSION: version, PRERELEASE: 'false', DIST_TAG: 'latest', EVENT: 'push', ...env } });
        const calls = (await readFile(log, 'utf8')).split('\n').filter(Boolean).map(line => JSON.parse(line));
        const notes = await readFile(join(tree, 'output/release-notes.md'), 'utf8').catch(() => '');
        return { status: result.status, calls, output: (await readFile(output, 'utf8')).trim(), notes, tail: (result.stdout + result.stderr).trim().split('\n').slice(-3) };
      };
      /** @param {{ calls: string[][] }} r */
      const published = r => r.calls.filter(call => call[0] === 'npm' && call[1] === 'publish');
      const tarball = `public/releases/${version}/typeset.us-${version}.tgz`;

      const dryPublished = await runStep(scripts.dryRun, { FAKE_NPM: 'ledger' });
      const dryOther = await runStep(scripts.dryRun, { FAKE_NPM: 'other' });
      const dryAbsent = await runStep(scripts.dryRun, { FAKE_NPM: 'absent' });
      check(`verify job, ${version} already on npm with the ledger's integrity: passes without a dry-run publish`, dryPublished.status === 0 && published(dryPublished).length === 0, dryPublished);
      check(`verify job, ${version} on npm with other bytes: fails before any publish`, dryOther.status !== 0 && published(dryOther).length === 0, dryOther);
      check(`verify job, ${version} not on npm: runs the dry-run publish of the ledger's tarball`, dryAbsent.status === 0 && published(dryAbsent).length === 1 && published(dryAbsent)[0].includes('--dry-run') && published(dryAbsent)[0][2] === tarball, dryAbsent);

      const byMaintainer = await runStep(scripts.publish, { FAKE_NPM: 'ledger' });
      const byOther = await runStep(scripts.publish, { FAKE_NPM: 'other' });
      const offline = await runStep(scripts.publish, { FAKE_NPM: 'offline' });
      const byWorkflow = await runStep(scripts.publish, { FAKE_NPM: 'absent' });
      check(`publish job, ${version} already on npm with the ledger's integrity: does not publish, records the maintainer as publisher`, byMaintainer.status === 0 && published(byMaintainer).length === 0 && byMaintainer.output === 'by=maintainer', byMaintainer);
      check(`publish job, ${version} on npm with other bytes: fails loudly and publishes nothing`, byOther.status !== 0 && published(byOther).length === 0 && byOther.output === '' && byOther.tail.some(line => /conflict: .*not the cut's bytes/.test(line)), byOther);
      check('publish job, registry unreachable: fails and publishes nothing', offline.status !== 0 && published(offline).length === 0 && offline.output === '', offline);
      check(`publish job, ${version} not on npm: publishes exactly the ledger's tarball with provenance`, byWorkflow.status === 0 && published(byWorkflow).length === 1 && published(byWorkflow)[0].join(' ') === `npm publish ${tarball} --provenance --access public --tag latest` && byWorkflow.output === 'by=workflow', byWorkflow);

      const attestations = (/** @type {{ calls: string[][] }} */ r) => r.calls.filter(call => call[0] === 'npm' && call.includes('dist.attestations'));
      const registryMaintainer = await runStep(scripts.registry, { FAKE_NPM: 'ledger', PUBLISHED_BY: 'maintainer' });
      const registryMissing = await runStep(scripts.registry, { FAKE_NPM: 'ledger', PUBLISHED_BY: 'workflow' });
      const registryAttested = await runStep(scripts.registry, { FAKE_NPM: 'ledger', PUBLISHED_BY: 'workflow', FAKE_ATTESTATIONS: '{"url":"https://registry.npmjs.org/-/npm/v1/attestations/x","provenance":{"predicateType":"https://slsa.dev/provenance/v1"}}' });
      const registryUnknown = await runStep(scripts.registry, { FAKE_NPM: 'ledger', PUBLISHED_BY: '' });
      check('registry step, maintainer-published: checks the ledger against the registry and asks for no attestation', registryMaintainer.status === 0 && attestations(registryMaintainer).length === 0 && registryMaintainer.calls.some(call => call[1] === 'view' && call[2] === `typeset.us@${version}` && call[3] === 'dist'), registryMaintainer);
      check('registry step, workflow-published: fails without an attestation and passes with one', registryMissing.status !== 0 && attestations(registryMissing).length === 1 && registryAttested.status === 0 && attestations(registryAttested).length === 1, { registryMissing, registryAttested });
      check('registry step, publisher unknown: fails', registryUnknown.status !== 0, registryUnknown);

      const releaseMaintainer = await runStep(scripts.release, { PUBLISHED_BY: 'maintainer' });
      const releaseWorkflow = await runStep(scripts.release, { PUBLISHED_BY: 'workflow' });
      const releaseUnknown = await runStep(scripts.release, { PUBLISHED_BY: '' });
      const gh = (/** @type {{ calls: string[][] }} */ r) => r.calls.filter(call => call[0] === 'gh');
      // Who published is stated under "## Integrity"; the CHANGELOG section
      // above it may describe the release process in general.
      const integrityOf = (/** @type {string} */ notes) => notes.split('\n## Integrity\n')[1]?.split('\n## Evidence\n')[0] ?? '';
      check(`GitHub Release, maintainer-published: notes say so and claim no provenance`, releaseMaintainer.status === 0 && gh(releaseMaintainer).length === 1 && gh(releaseMaintainer)[0].slice(1, 5).join(' ') === `release create v${version} --verify-tag`
        && /published to npm by the maintainer account/i.test(integrityOf(releaseMaintainer.notes)) && /no npm provenance attestation/.test(integrityOf(releaseMaintainer.notes)) && !/with npm provenance|dist\.attestations/.test(integrityOf(releaseMaintainer.notes)) && integrityOf(releaseMaintainer.notes).includes(ledger.releases[version].tarball.sha1), { ...releaseMaintainer, notes: integrityOf(releaseMaintainer.notes) });
      check('GitHub Release, workflow-published: notes name the provenance attestation', releaseWorkflow.status === 0 && gh(releaseWorkflow).length === 1 && /with npm provenance/.test(integrityOf(releaseWorkflow.notes)) && integrityOf(releaseWorkflow.notes).includes(`npm view typeset.us@${version} dist.attestations`) && !/maintainer account/.test(integrityOf(releaseWorkflow.notes)), { ...releaseWorkflow, notes: integrityOf(releaseWorkflow.notes) });
      check('GitHub Release, publisher unknown: fails and creates no release', releaseUnknown.status !== 0 && gh(releaseUnknown).length === 0, releaseUnknown);
      let both = '';
      try { await releaseNotes({ version, provenance: true, maintainer: true }); } catch (error) { both = String(/** @type {Error} */ (error).message); }
      check('release notes refuse to say both "provenance" and "maintainer"', /not both/.test(both), both);
    } finally {
      await rm(work, { recursive: true, force: true });
    }
  }

  const dependabot = await readFile('.github/dependabot.yml', 'utf8');
  check('Dependabot watches npm and GitHub Actions', /package-ecosystem: npm/.test(dependabot) && /package-ecosystem: github-actions/.test(dependabot));
  check('Dependabot leaves the pinned esbuild alone (reproducible builds)', /dependency-name: esbuild/.test(dependabot));
  check('Dependabot does not propose TypeScript majors (tsc writes the published .d.ts)', /- dependency-name: typescript\n\s+update-types: \['version-update:semver-major'\]/.test(dependabot));

  // The release process names what the workflows assume: a node whose zlib
  // packs the bytes release-check rebuilds (they follow the node build, not
  // the npm version: 4.2.0's files repack identically with npm 11.6.0 and
  // 11.8.0 on an official node, and differently with either on Homebrew's),
  // and master holding the files the published docs link at blob/master.
  const releasing = await readFile('docs/RELEASING.md', 'utf8');
  check('RELEASING.md asks for an official Node build, whose bundled zlib packs the recorded bytes', /official Node build/.test(releasing) && /process\.versions\.zlib/.test(releasing));
  check('no workflow or RELEASING.md says the npm version changes the tarball bytes', ![releasing, release, ci].some(text => /npm 11\.8\.0 packs/.test(text)));
  const cut = await readFile('scripts/release-cut.mjs', 'utf8');
  check('release-cut refuses to cut unless its npm repacks the previous release byte for byte', /packerReproduces\(\{ root: repo, cache: npmCache, before: version \}\)/.test(cut) && /precondition\(`the npm on PATH repacks/.test(cut));
  // The hosted-runner flag relaxes speed-calibrated checks and runtime times;
  // the cut must enforce both, and budgets that cannot hold times must fail.
  const budgetScript = await readFile('scripts/v4/verify-budgets.mjs', 'utf8');
  check('release-cut refuses to run its suites with TYPESET_HOSTED_RUNNER set', /if \(\(!dryRun \|\| values\.verify\) && process\.env\.TYPESET_HOSTED_RUNNER\) throw/.test(cut));
  check('verify-budgets --runtime fails where it cannot enforce times, unless --record-times asks it to record them', /if \(!comparable && !values\['record-times'\] && !values\.calibrate\) checks\.push\(\{[^\n]*pass: false/.test(budgetScript));
  const cache = await mkdtemp(join(tmpdir(), 'typeset-trust-npm-'));
  try {
    const here = await packerReproduces({ cache });
    check(`release-cut's packer check passes here: this npm repacks typeset.us@${here.version} byte for byte`, here.pass, here);
    // The same tar gzipped at another level, as a system zlib's deflate differs.
    const shim = join(cache, 'regzip.mjs');
    await writeFile(shim, REGZIP);
    const other = await packerReproduces({ cache, npm: [process.execPath, shim] });
    check("release-cut's packer check refuses an npm that gzips the same files into other bytes", here.pass && !other.pass && !!other.packed && other.packed !== here.packed, other);
  } finally {
    await rm(cache, { recursive: true, force: true });
  }
  const linked = /** @type {string[]} */ ([]);
  for (const file of ['packages/typeset-v4/README.md', 'packages/typeset-v4/MIGRATION.md', 'packages/typeset-v4/SECURITY.md', 'SECURITY.md', 'docs/security/advisories.json']) {
    for (const [, path] of (await readFile(file, 'utf8')).matchAll(/github\.com\/speedwarnsf\/web-typography\/blob\/master\/([\w./-]+?)\.?(?=[\s")\]]|$)/gm)) linked.push(path);
  }
  check('RELEASING.md says master must hold what the published docs link at blob/master before tagging', new Set(linked).size >= 5 && /Merge the release branch into `master` and push `master` before you tag/.test(releasing)
    && [...new Set(linked)].every(path => releasing.includes(path.replace(/^docs\/security\/advisory-.*$/, 'advisory'))), { linked: [...new Set(linked)] });
  const security = await readFile('SECURITY.md', 'utf8');
  // The support window is dated: the line's end, the previous minor's end,
  // and the 60-day rule that sets it. Email comes first: it works whether or
  // not the repository has private vulnerability reporting switched on.
  check('SECURITY.md names supported versions with dated windows, email and private reporting, and response targets', /\| 4\.3\.x \|/.test(security) && /\| 4\.2\.x \| Security fixes only, until \d{4}-\d{2}-\d{2}\b/.test(security)
    && /4\.x\s+line\s+gets\s+bug\s+and\s+security\s+fixes\s+until\s+at\s+least\s+\d{4}-\d{2}-\d{2}/.test(security) && /security\s+fixes for 60 days/.test(security)
    && /dyork@typeset\.us[\s\S]*security\/advisories\/new/.test(security) && /3 business days/.test(security));
  const packaged = await readFile('packages/typeset-v4/SECURITY.md', 'utf8').catch(() => '');
  check('packages/typeset-v4/SECURITY.md is the repository SECURITY.md', packaged === security);
  const pkg = JSON.parse(await readFile('packages/typeset-v4/package.json', 'utf8'));
  check('the package publishes SECURITY.md', pkg.files.includes('SECURITY.md'), pkg.files);

  const ledger = await readLedger();
  const { advisories } = JSON.parse(await readFile('docs/security/advisories.json', 'utf8'));
  for (const advisory of advisories) {
    check(`advisory "${advisory.title}": affected pins are published pins`, advisory.pins.every((/** @type {string} */ pin) => ledger.pins[pin]), advisory.pins);
    check(`advisory "${advisory.title}": npm range, patched version and CWE are stated`, /^>=\d+\.\d+\.\d+ <\d+\.\d+\.\d+$/.test(advisory.npm.affected) && /^\d+\.\d+\.\d+$/.test(advisory.npm.patched) && /^CWE-\d+$/.test(advisory.cwe));
    check(`advisory "${advisory.title}": SECURITY.md lists it`, security.includes(advisory.title.replace(/^DOM XSS in the 3\.x /, '').split(' ')[0]));
  }
  const draft = await readFile('docs/security/advisory-3x-heading-xss.md', 'utf8');
  check('the 3.x advisory draft states range, patch, severity and CWE', /`>= 3\.0\.0, < 3\.4\.1`/.test(draft) && /`3\.4\.1`/.test(draft) && /CWE-79/.test(draft) && /CVSS 3\.1/.test(draft));
  // release.json and sri.json link to this file, so it reads as the advisory,
  // not a draft with owner instructions. Its proof of concept must fire on
  // 3.4.0: the 3.x heading pass curls straight quotes before reparsing, so a
  // quoted handler never compiles and the page would look safe.
  const handler = /<h2 data-typeset-heading>[^\n]*?onerror=([^\n]*?)&gt;<\/h2>/.exec(draft)?.[1];
  check('the 3.x advisory reads as published text and its proof of concept uses an unquoted handler', !/^# DRAFT|^Status: draft/m.test(draft) && !!handler && !/["']/.test(handler), { handler });
  const deprecate = await readFile('docs/security/deprecate-3x.sh', 'utf8');
  check('npm deprecate targets exactly the affected range', deprecate.includes(`npm deprecate 'typeset.us@${advisories[0].npm.affected}'`));

  for (const version of Object.keys(ledger.releases).filter(v => /^4\.\d+\.\d+$/.test(v))) {
    try {
      const notes = await releaseNotes({ version, backfill: true });
      check(`release notes build for ${version} (CHANGELOG section, pinned snippet, tarball hashes)`, notes.includes(`npm i -E typeset.us@${version}`) && notes.includes(ledger.releases[version].tarball.sha1) && (!ledger.pins[`go@${version}.js`] || notes.includes(ledger.pins[`go@${version}.js`].integrity)));
    } catch (error) {
      check(`release notes build for ${version} (CHANGELOG section, pinned snippet, tarball hashes)`, false, String(/** @type {Error} */ (error).message));
    }
  }
} catch (error) {
  errors.push(String(/** @type {Error} */ (error).stack || error));
}
await mkdir('output', { recursive: true });
await writeFile('output/release-trust.json', JSON.stringify({ checks, errors }, null, 2));
const failures = checks.filter(c => !c.pass);
console.log(JSON.stringify({ checks: checks.length, failures, errors }, null, 2));
if (failures.length || errors.length) process.exitCode = 1;
