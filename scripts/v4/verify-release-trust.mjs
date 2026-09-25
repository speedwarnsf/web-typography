// @ts-check
// The release pipeline and security policy people are asked to trust (K9):
// workflows pinned by commit SHA with least-privilege permissions, a release
// workflow that publishes only the ledger-recorded tarball with provenance
// after release-check and test:release, Dependabot for npm and Actions,
// SECURITY.md in the repository and the package, a machine-readable list of
// advisories for published files, and release notes that build for every
// published 4.x version.
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { readLedger } from './ledger.mjs';
import { releaseNotes } from './release-notes.mjs';

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
  check('ci.yml runs on master, release/** and pull requests', /branches: \[master, 'codex\/release-\*', 'release\/\*\*'\]/.test(ci) && /pull_request:/.test(ci));

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
  check('release.yml confirms registry integrity and an attestation after publishing', /verify-ledger\.mjs --network/.test(publish) && /dist\.attestations/.test(publish));
  check('release.yml creates the GitHub Release with notes and evidence attached', /release-notes\.mjs --version "\$VERSION" --provenance/.test(publish) && /gh release create "\$TAG" --verify-tag/.test(publish) && /output\/\*\.json/.test(publish));

  const dependabot = await readFile('.github/dependabot.yml', 'utf8');
  check('Dependabot watches npm and GitHub Actions', /package-ecosystem: npm/.test(dependabot) && /package-ecosystem: github-actions/.test(dependabot));
  check('Dependabot leaves the pinned esbuild alone (reproducible builds)', /dependency-name: esbuild/.test(dependabot));

  const security = await readFile('SECURITY.md', 'utf8');
  check('SECURITY.md names supported versions, private reporting and response targets', /\| 4\.3\.x \|/.test(security) && /\| 4\.2\.x \| Security fixes only \|/.test(security) && /security\/advisories\/new/.test(security) && /3 business days/.test(security));
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
