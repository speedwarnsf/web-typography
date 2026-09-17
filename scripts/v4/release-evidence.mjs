import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
export async function releaseIdentity() {
  const bytes = await readFile('packages/typeset-v4/dist/manifest.json');
  const manifest = JSON.parse(bytes);
  return { version: manifest.version, artifactSHA256: createHash('sha256').update(bytes).digest('hex') };
}
