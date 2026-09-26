// @ts-check
// GitHub Release notes for a published or about-to-be-published version,
// from .github/release-notes-template.md: the version's CHANGELOG section,
// install lines with the pinned loader's integrity, the npm tarball's hashes
// from the ledger, and the evidence files attached to the release.
//
//   node scripts/v4/release-notes.mjs --version 4.3.0 [--out output/release-notes.md] [--provenance | --maintainer]
//   node scripts/v4/release-notes.mjs --version 4.2.0 --backfill   (notes for an existing tag)
//
// --provenance: release.yml published the version with npm provenance.
// --maintainer: the maintainer account published the ledger-recorded tarball
// (4.2.0 and 4.3.0, before trusted publishing was configured); the notes say
// it has no provenance attestation instead of claiming one.
//
// Fails when CHANGELOG.md has no "## <version>" section or the ledger does not
// record the version, so a release cannot go out without both.
import { readFile, readdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { readLedger } from './ledger.mjs';

/**
 * The CHANGELOG section for a version: from its "## <version>" heading to the
 * next "## " heading or rule, without the heading. Null when absent.
 * @param {string} changelog @param {string} version
 */
export function changelogSection(changelog, version) {
  const lines = changelog.split('\n');
  const escaped = version.replace(/\./g, '\\.');
  const start = lines.findIndex(line => new RegExp(`^## ${escaped}(?:\\s|$)`).test(line));
  if (start < 0) return null;
  let end = lines.findIndex((line, index) => index > start && (/^## /.test(line) || /^---\s*$/.test(line)));
  if (end < 0) end = lines.length;
  return { heading: lines[start].slice(3).trim(), body: lines.slice(start + 1, end).join('\n').trim() };
}

/**
 * @param {{ version: string, evidenceDir?: string, provenance?: boolean, maintainer?: boolean, backfill?: boolean, root?: string }} options
 */
export async function releaseNotes({ version, evidenceDir = 'output', provenance = false, maintainer = false, backfill = false, root = '.' }) {
  if (provenance && maintainer) throw new Error('Pass --provenance or --maintainer, not both: a version is published by the workflow or by the maintainer account.');
  const changelog = await readFile(resolve(root, 'CHANGELOG.md'), 'utf8');
  const section = changelogSection(changelog, version);
  if (!section) throw new Error(`CHANGELOG.md has no "## ${version}" section.`);
  const ledger = await readLedger(root);
  const entry = ledger.releases[version];
  if (!entry?.tarball) throw new Error(`The ledger does not record typeset.us@${version}; cut it with release-cut.mjs first.`);
  const pin = ledger.pins[`go@${version}.js`];
  const snippet = pin
    ? `<script src="https://typeset.us/go@${version}.js" integrity="${pin.integrity}" crossorigin="anonymous" defer></script>`
    : '<!-- no browser pin was published for this version -->';
  /** @type {string[]} */
  const evidence = [];
  if (backfill) {
    const record = Object.keys(entry.records ?? {})[0];
    evidence.push(record
      ? `This release predates evidence attachments. Its acceptance record is [${record}](https://github.com/speedwarnsf/web-typography/blob/master/${record}).`
      : 'This release predates evidence attachments; its CI artifacts have expired.');
  } else {
    const files = (await readdir(resolve(root, evidenceDir)).catch(() => [])).filter(file => file.endsWith('.json')).sort();
    for (const file of files) {
      let line = `- \`${file}\``;
      try {
        const data = JSON.parse(await readFile(resolve(root, evidenceDir, file), 'utf8'));
        if (file === 'test-v4-summary.json') line += `: ${data.suites} suites, ${data.passed} passed, ${data.knownFailing} known failing, ${data.failed} failed; ${data.checks} checks (${data.mode}).`;
        else if (Array.isArray(data.checks)) line += `: ${data.checks.length} checks, ${data.checks.filter((/** @type {{ pass?: boolean }} */ c) => c.pass === false).length} failed.`;
      } catch {}
      evidence.push(line);
    }
    if (!evidence.length) evidence.push('No evidence files were found.');
    evidence.unshift('Attached to this release (retained with the release, unlike CI artifacts):');
  }
  const template = await readFile(resolve(root, '.github/release-notes-template.md'), 'utf8');
  const body = template
    .replaceAll('{{changelog}}', section.body)
    .replaceAll('{{tarball}}', backfill ? `The same bytes are at https://typeset.us/releases/${version}/typeset.us-${version}.tgz.` : 'The same tarball is attached below.')
    .replaceAll('{{version}}', version)
    .replaceAll('{{snippet}}', snippet)
    .replaceAll('{{sha1}}', entry.tarball.sha1)
    .replaceAll('{{integrity}}', entry.tarball.integrity)
    .replaceAll('{{provenance}}', provenance
      ? '- Published from GitHub Actions with npm provenance: `npm view typeset.us@' + version + ' dist.attestations`.'
      : maintainer ? '- Published to npm by the maintainer account, not by GitHub Actions, so it has no npm provenance attestation. The release workflow rebuilt this tarball from the tag byte for byte and checked that the registry serves the ledger\'s integrity.'
      : backfill ? '- Published by hand before provenance publishing existed.' : '')
    .replaceAll('{{evidence}}', evidence.join('\n'));
  return body.replace(/\n{3,}/g, '\n\n');
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const { values } = parseArgs({ options: { version: { type: 'string' }, out: { type: 'string' }, evidence: { type: 'string', default: 'output' }, provenance: { type: 'boolean', default: false }, maintainer: { type: 'boolean', default: false }, backfill: { type: 'boolean', default: false } } });
  if (!values.version) throw new Error('Pass --version x.y.z.');
  const notes = await releaseNotes({ version: values.version, evidenceDir: values.evidence, provenance: values.provenance, maintainer: values.maintainer, backfill: values.backfill });
  if (values.out) await writeFile(values.out, notes);
  else process.stdout.write(notes);
}
