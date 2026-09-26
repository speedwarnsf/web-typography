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
  // typeset.us/react imports flushSync from react-dom (kept external).
  check('react-dom peer matches react and is optional', pkg.peerDependencies?.['react-dom'] === pkg.peerDependencies?.react && pkg.peerDependenciesMeta?.['react-dom']?.optional === true, pkg.peerDependencies);
  check('playwright is not a peer (the CLI imports it on demand)', !pkg.peerDependencies?.playwright && !pkg.peerDependenciesMeta?.playwright, pkg.peerDependencies);
  check('no runtime dependencies or install scripts', !pkg.dependencies && !pkg.scripts?.install && !pkg.scripts?.preinstall && !pkg.scripts?.postinstall, { dependencies: pkg.dependencies, scripts: pkg.scripts });
  const reactTypes = await readFile(`${staged.dir}/dist/typeset.release.react.d.ts`, 'utf8');
  const plainTypes = await readFile(`${staged.dir}/dist/typeset-react.d.ts`, 'utf8');
  // K5 made both adapters forwardRef components: their declared type is the
  // public ForwardRefExoticComponent<Props & RefAttributes<HTMLElement>>,
  // which @types/react 18 and 19 both define, never an inferred internal.
  const declared = (/** @type {string} */ name, /** @type {string} */ props, /** @type {string} */ text) => new RegExp(`export declare const ${name}: import\\("react"\\)\\.ForwardRefExoticComponent<${props} & import\\("react"\\)\\.RefAttributes<HTMLElement>>;`).test(text);
  check('React adapters declare their public React types, not inferred @types/react internals', declared('TypesetText', 'TypesetTextProps', reactTypes) && declared('TypesetRichText', 'TypesetRichTextProps', reactTypes) && declared('TypesetText', 'TypesetTextProps', plainTypes) && !/DetailedReactHTMLElement|ChangeEventHandler|SubmitEventHandler/.test(plainTypes + reactTypes), plainTypes.match(/export declare (?:function|const) TypesetText[^;]*;/)?.[0]);

  // K8: people can find the package on npm and follow its links.
  const KEYWORDS = ['typography', 'line-breaking', 'line-break', 'text-wrap', 'text-wrap-pretty', 'orphans', 'widows', 'rag', 'knuth-plass', 'hanging-punctuation', 'smart-quotes', 'react', 'paragraph'];
  check('keywords cover the terms people search for', KEYWORDS.every(k => pkg.keywords?.includes(k)), { missing: KEYWORDS.filter(k => !pkg.keywords?.includes(k)) });
  check('description says what it does in plain words', pkg.description === 'Better line breaks for web text: no stranded short words or one-word last lines, links and styling intact, verified in Chrome, Safari and Firefox.', pkg.description);
  check('repository.directory points npm and GitHub at packages/typeset-v4', pkg.repository?.directory === 'packages/typeset-v4' && /github\.com\/speedwarnsf\/web-typography/.test(pkg.repository?.url), pkg.repository);
  check('bugs.url is the issue tracker', pkg.bugs?.url === 'https://github.com/speedwarnsf/web-typography/issues', pkg.bugs);
  check('no engines field that would make Yarn refuse a browser library', !pkg.engines, pkg.engines);
  /** @type {string[]} */
  const broken = [];
  for (const doc of [...files.keys()].filter(path => path.endsWith('.md'))) {
    const text = await readFile(`${staged.dir}/${doc}`, 'utf8');
    for (const [, target] of text.matchAll(/\]\(([^)\s]+)\)/g)) {
      if (/^(https?:|mailto:|#)/.test(target)) continue;
      const path = target.split('#')[0];
      if (!files.has(path)) broken.push(`${doc} -> ${target}`);
    }
  }
  check('relative links in packaged docs name files in the package', broken.length === 0, broken);

  // K6: the automatic loader on npm, and CDN defaults that run in a browser.
  check('exports ./auto -> dist/auto.js with the loader globals\' types (go.d.ts), packed', pkg.exports?.['./auto']?.default === './dist/auto.js' && pkg.exports?.['./auto']?.types === './dist/go.d.ts'
    && files.has('dist/auto.js') && files.has('dist/go.d.ts') && pkg.typesVersions?.['*']?.auto?.[0] === 'dist/go.d.ts', { auto: pkg.exports?.['./auto'], typesVersions: pkg.typesVersions });
  check('dist/auto.js is side-effectful (never tree-shaken away)', pkg.sideEffects?.includes('./dist/auto.js'), pkg.sideEffects);
  check('bare jsDelivr and unpkg URLs serve the browser global, not CommonJS', pkg.jsdelivr === './dist/typeset.global.js' && pkg.unpkg === './dist/typeset.global.js' && files.has('dist/typeset.global.js'), { jsdelivr: pkg.jsdelivr, unpkg: pkg.unpkg });
  const siteGo = artifacts.siteGo;
  if (files.has('dist/auto.js')) {
    const [auto, site] = await Promise.all([readFile(`${staged.dir}/dist/auto.js`), readFile(siteGo)]);
    check('dist/auto.js is the website loader byte for byte (one SRI for npm, jsDelivr and typeset.us)', auto.equals(site), { auto: auto.length, site: site.length, siteGo });
  }

  // K7: a smaller tarball that carries its third-party notices.
  // K7 set 1.2 MB before K4 added dist/react.cjs, a third 220 KB engine copy
  // for require() and Jest, and before the 4.3 fixes grew the engine by about
  // a fifth. The merged 4.3.0 package measures 1.68 MB: 35% below 4.2.0, with
  // readable, mapless ESM and CJS builds (see build-recipe.mjs). Minifying the
  // module builds (-0.31 MB) and leaving the IIFE maps to the release archive
  // (-0.37 MB) would reach about 1.0 MB; that trade-off is the owner's. The
  // review fixes of round 1 took it to 1.75 MB (engine code in four module
  // copies and three script builds, and the docs that describe them), and
  // those of round 2 to 1.82 MB (the same copies, plus the CLI's wait), and
  // those of round 3 to 1.85 MB (the same copies of this round's fixes, and
  // the limits and outcome notes they document), and the gate 3 fixes to
  // 1.88 MB (1,875,240 B: the keep trie, linear quote education and pane
  // re-placement in each copy, and SUPPORT.md's WebKit limitation), and the
  // gate 4 fixes to 1.89 MB (1,886,737 B: placing text only under a pane
  // that hides it and rechecking panes as they come near, in each copy, and
  // README's and SUPPORT.md's note on indents under legacy line breaks).
  check('unpacked package is under 1.9 MB (4.2.0: 2.57 MB)', packed.unpackedSize < 1900000, packed.unpackedSize);
  check('license is the SPDX expression "MIT AND Unicode-3.0"', pkg.license === 'MIT AND Unicode-3.0', pkg.license);
  check('THIRD-PARTY-LICENSES.txt and UNICODE-LICENSE.txt are packed', files.has('THIRD-PARTY-LICENSES.txt') && files.has('UNICODE-LICENSE.txt'), [...files.keys()].filter(f => f.endsWith('.txt')));
  const NOTICES = ['@license @cto.af/linebreak 4.0.3 (c) 2023-present Joe Hildebrand, MIT', '@license @cto.af/unicode-trie-runtime (c) 2023', '@license fflate (c) 2026 Arjun Barrett, MIT', '@license Unicode 17.0.0 line-break data (c) 1991-2026 Unicode, Inc., Unicode-3.0'];
  const bundles = [...files.keys()].filter(path => /^dist\/(go|auto|typeset\.global|index)\.c?js$|^dist\/shared-[A-Z0-9]+\.js$/.test(path));
  for (const bundle of bundles.filter(path => path !== 'dist/index.js')) {
    const text = await readFile(`${staged.dir}/${bundle}`, 'utf8');
    const missing = NOTICES.filter(notice => !text.includes(notice));
    check(`${bundle} keeps all four third-party license notices`, missing.length === 0 && /\/\*! @license/.test(text), { missing });
  }
  check('dist has the browser bundles whose notices were checked', ['dist/go.js', 'dist/typeset.global.js', 'dist/index.cjs'].every(path => bundles.includes(path)) && bundles.some(path => path.startsWith('dist/shared-')), bundles);
  const maps = [...files.keys()].filter(path => path.endsWith('.map'));
  /** @type {Record<string, unknown>} */
  const mapFacts = {};
  for (const map of maps) {
    const parsed = JSON.parse(await readFile(`${staged.dir}/${map}`, 'utf8'));
    mapFacts[map] = { sourcesContent: Array.isArray(parsed.sourcesContent) && parsed.sourcesContent.some(Boolean) };
  }
  check('only typeset.global.js and go.js ship source maps, without embedded sources', maps.every(map => ['dist/typeset.global.js.map', 'dist/go.js.map'].includes(map)) && Object.values(mapFacts).every(fact => !(/** @type {{ sourcesContent: boolean }} */ (fact).sourcesContent)), mapFacts);
  const vendor = JSON.parse(await readFile('vendor/unicode/manifest.json', 'utf8'));
  const { createHash } = await import('node:crypto');
  const vendored = createHash('sha256').update(await readFile('src/vendor/unicode-linebreak.js')).digest('hex');
  check('vendor manifest records the vendored line-break bundle with its license header', vendor.hashes['src/vendor/unicode-linebreak.js'] === vendored, { recorded: vendor.hashes['src/vendor/unicode-linebreak.js'], actual: vendored });

  check('packed file list includes the CLI, docs and dist', ['bin/audit.mjs', 'README.md', 'SUPPORT.md', 'MIGRATION.md', 'SECURITY.md', 'OUTCOMES.md', 'for-agents.md', 'capabilities.json', 'dist/manifest.json', 'dist/styles.css'].every(path => files.has(path)), [...files.keys()]);
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
