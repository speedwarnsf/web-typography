// @ts-check
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { join } from 'node:path';

/**
 * What a suite's evidence was produced against. A candidate reports its base
 * version, commit, whether engine sources were uncommitted, and the hash of
 * the bundle under test; a release or staged release reports its manifest.
 */
export async function releaseIdentity() {
  const dist = process.env.TYPESET_DIST;
  if (dist) {
    const manifestBytes = await readFile(join(dist, 'manifest.json'));
    const manifest = JSON.parse(manifestBytes.toString('utf8'));
    const bundle = await readFile(process.env.TYPESET_BUNDLE || join(dist, 'typeset.global.js'));
    const artifactSHA256 = createHash('sha256').update(bundle).digest('hex');
    if (manifest.candidate && process.env.TYPESET_CANDIDATE) {
      const identity = JSON.parse(await readFile(join(process.env.TYPESET_CANDIDATE, 'identity.json'), 'utf8'));
      return { ...identity, artifactSHA256 };
    }
    return { version: manifest.version, artifactSHA256: createHash('sha256').update(manifestBytes).digest('hex'), bundleSHA256: artifactSHA256, ...(process.env.TYPESET_RELEASE_STAGING ? { staged: true } : {}) };
  }
  if (process.env.TYPESET_BUNDLE) {
    const bytes = await readFile(process.env.TYPESET_BUNDLE);
    return { version: 'unpublished-candidate', artifactSHA256: createHash('sha256').update(bytes).digest('hex') };
  }
  const bytes = await readFile('packages/typeset-v4/dist/manifest.json');
  const manifest = JSON.parse(bytes.toString('utf8'));
  return { version: manifest.version, artifactSHA256: createHash('sha256').update(bytes).digest('hex') };
}
