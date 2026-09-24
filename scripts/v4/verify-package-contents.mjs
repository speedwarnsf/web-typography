// @ts-check
// What the next npm release would publish: the package staged from the dist
// under test (the candidate in test:v4) exactly as release-cut.mjs assembles
// it, packed offline. Checks package.json metadata, peers, exports and the
// packed file list. Installs against real React versions are in
// verify-react-matrix.mjs, which needs the registry.
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { stagePackage } from './stage-package.mjs';
import { artifacts } from './candidate.mjs';

/** @type {{ label: string, pass: boolean, detail?: unknown }[]} */
const checks = [];
/** @type {string[]} */
const errors = [];
/** @param {string} label @param {unknown} pass @param {unknown} [detail] */
const check = (label, pass, detail) => { checks.push({ label, pass: !!pass, ...(pass ? {} : { detail }) }); };

const out = `output/package-contents-${process.pid}`;
let staged;
try {
  staged = await stagePackage({ out, dist: artifacts.dist });
  const pkg = JSON.parse(await readFile(`${staged.dir}/package.json`, 'utf8'));
  const packed = /** @type {NonNullable<typeof staged.packed>} */ (staged.packed);
  const files = new Map(packed.files.map(file => [file.path, file.size]));

  // K3: installs must not fail or upgrade React or Playwright underneath an app.
  check('react peer covers React 18.2+ and every React 19 minor', pkg.peerDependencies?.react === '^18.2.0 || ^19.0.0', pkg.peerDependencies);
  check('react peer is optional', pkg.peerDependenciesMeta?.react?.optional === true, pkg.peerDependenciesMeta);
  check('playwright is not a peer (the CLI imports it on demand)', !pkg.peerDependencies?.playwright && !pkg.peerDependenciesMeta?.playwright, pkg.peerDependencies);
  check('no runtime dependencies or install scripts', !pkg.dependencies && !pkg.scripts?.install && !pkg.scripts?.preinstall && !pkg.scripts?.postinstall, { dependencies: pkg.dependencies, scripts: pkg.scripts });
  const reactTypes = await readFile(`${staged.dir}/dist/typeset.release.react.d.ts`, 'utf8');
  const plainTypes = await readFile(`${staged.dir}/dist/typeset-react.d.ts`, 'utf8');
  check('React adapters declare ReactElement, not inferred @types/react internals', /TypesetText\(props: TypesetTextProps\): ReactElement/.test(reactTypes) && /TypesetRichText\(props: TypesetRichTextProps\): ReactElement/.test(reactTypes) && /\): ReactElement;/.test(plainTypes) && !/DetailedReactHTMLElement|ChangeEventHandler|SubmitEventHandler/.test(plainTypes + reactTypes), plainTypes.match(/export declare function TypesetText[^;]*;/)?.[0]);

  check('packed file list includes the CLI, docs and dist', ['bin/audit.mjs', 'README.md', 'SUPPORT.md', 'MIGRATION.md', 'for-agents.md', 'capabilities.json', 'dist/manifest.json', 'dist/styles.css'].every(path => files.has(path)), [...files.keys()]);
  check('nothing from the repository leaks into the package', [...files.keys()].every(path => !/^(?:output|src|node_modules|\.env|scripts)/.test(path)), [...files.keys()]);
  const report = { version: staged.version, dist: artifacts.dist, tarball: packed.filename, entryCount: packed.entryCount, unpackedSize: packed.unpackedSize, size: packed.size, files: Object.fromEntries(files), checks, errors };
  await mkdir('output', { recursive: true });
  await writeFile('output/package-contents.json', JSON.stringify(report, null, 2));
} catch (error) {
  errors.push(String(/** @type {Error} */ (error).stack || error));
  await writeFile('output/package-contents.json', JSON.stringify({ checks, errors }, null, 2));
} finally {
  await rm(out, { recursive: true, force: true });
  await rm(`${out}-pack`, { recursive: true, force: true });
}
const failures = checks.filter(c => !c.pass);
console.log(JSON.stringify({ checks: checks.length, unpackedSize: staged?.packed?.unpackedSize, failures, errors }, null, 2));
if (failures.length || errors.length) process.exitCode = 1;
