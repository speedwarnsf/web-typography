import { build } from 'esbuild';
import { execFileSync } from 'node:child_process';
import { readdir, readFile, writeFile, copyFile, mkdir, rename } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { gzipSync } from 'node:zlib';

const root = 'packages/typeset-v4';
const pkg = JSON.parse(await readFile(`${root}/package.json`, 'utf8'));
const version = pkg.version;
const release = `public/releases/${version}`;
const sri = bytes => 'sha384-' + createHash('sha384').update(bytes).digest('base64');
const common = { bundle: true, target: 'es2022', minify: false, sourcemap: true };
await mkdir('output/previous-builds', { recursive: true });
try { await rename(`${root}/dist`, `output/previous-builds/public-dist-${Date.now()}`); }
catch (error) { if (error.code !== 'ENOENT') throw error; }
await build({ ...common, entryPoints: { index: 'src/lib/v4/typeset.release.ts', react: 'src/lib/v4/typeset.release.react.tsx' }, format: 'esm', splitting: true, external: ['react'], outdir: `${root}/dist`, chunkNames: 'shared-[hash]' });
await build({ ...common, entryPoints: ['src/lib/v4/typeset.release.ts'], format: 'cjs', outfile: `${root}/dist/index.cjs` });
await build({ ...common, entryPoints: ['src/lib/v4/typeset.release.standalone.ts'], format: 'iife', minify: true, outfile: `${root}/dist/typeset.global.js` });
await build({ ...common, entryPoints: ['src/lib/v4/typeset.go.ts'], format: 'iife', minify: true, outfile: `${root}/dist/go.js` });
execFileSync('node_modules/.bin/tsc', ['src/lib/v4/typeset.release.ts', 'src/lib/v4/typeset.release.react.tsx', '--declaration', '--emitDeclarationOnly', '--outDir', `${root}/declarations`, '--target', 'es2022', '--moduleResolution', 'bundler', '--module', 'esnext', '--lib', 'es2022,dom,dom.iterable', '--skipLibCheck', '--strict', '--jsx', 'react-jsx'], { stdio: 'inherit' });
const declarationDir = `${root}/declarations`;
for (const file of await readdir(declarationDir)) {
  if (!file.endsWith('.d.ts')) continue;
  let text = await readFile(`${declarationDir}/${file}`, 'utf8');
  text = text.replace(/(from\s+['"])(\.\.?\/[^'"]+)(['"])/g, (m, a, b, c) => a + (b.endsWith('.js') ? b : b + '.js') + c);
  await writeFile(`${root}/dist/${file}`, text);
}
await copyFile('src/lib/v4/typeset-lists.css', `${root}/dist/styles.css`);
await copyFile('LICENSE', `${root}/LICENSE`);
for (const file of ['THIRD-PARTY-LICENSES.txt', 'UNICODE-LICENSE.txt']) await copyFile(`vendor/unicode/${file}`, `${root}/${file}`);
await copyFile(`${root}/for-agents.md`, `${root}/AGENTS.md`);

const artifacts = {};
for (const file of (await readdir(`${root}/dist`)).sort()) {
  const bytes = await readFile(`${root}/dist/${file}`);
  artifacts[file] = { bytes: bytes.length, integrity: sri(bytes) };
}
await writeFile(`${root}/dist/manifest.json`, JSON.stringify({ version, artifacts }, null, 2) + '\n');

// Never rewrite an existing committed pin. This also protects old releases in cloud builds.
async function pinned(path, bytes) {
  let original;
  try { original = execFileSync('git', ['show', `HEAD:${path}`], { stdio: ['ignore', 'pipe', 'ignore'] }); }
  catch {
    // In a cloud build without Git, an existing release directory is still immutable.
    try { execFileSync('git', ['rev-parse', '--git-dir'], { stdio: 'ignore' }); }
    catch { try { original = await readFile(path); } catch {} }
  }
  if (original && !original.equals(Buffer.from(bytes))) throw new Error(`Refusing to rewrite published artifact ${path}`);
  await writeFile(path, bytes);
}
await mkdir(release, { recursive: true });
for (const file of await readdir(`${root}/dist`)) await pinned(`${release}/${file}`, await readFile(`${root}/dist/${file}`));
for (const file of ['README.md', 'MIGRATION.md', 'SUPPORT.md', 'for-agents.md', 'capabilities.json', 'LICENSE', 'THIRD-PARTY-LICENSES.txt', 'UNICODE-LICENSE.txt']) {
  await pinned(`${release}/${file}`, await readFile(`${root}/${file}`));
}
await mkdir('output/release', { recursive: true });
const [pack] = JSON.parse(execFileSync('npm', ['pack', '--json', '--cache', '/tmp/typeset-release-npm-cache', '--pack-destination', '../../output/release'], { cwd: root, encoding: 'utf8' }));
await pinned(`${release}/${pack.filename}`, await readFile(`output/release/${pack.filename}`));

await build({ ...common, sourcemap: false, entryPoints: ['src/lib/v4/typeset.website-go.ts'], format: 'iife', minify: true, outfile: 'public/go.js', banner: { js: `/* typeset.us ${version}; automatic website loader. MIT. https://typeset.us */` } });
await copyFile(`${root}/dist/typeset.global.js`, 'public/typeset.min.js');
await copyFile(`${root}/dist/typeset.global.js.map`, 'public/typeset.global.js.map');
await build({ ...common, sourcemap: false, entryPoints: ['src/lib/v4/typeset.release.ts'], format: 'esm', minify: true, outfile: 'public/typeset.esm.js' });
await copyFile(`${root}/dist/styles.css`, 'public/typeset.css');
const go = await readFile('public/go.js');
await pinned(`public/go@${version}.js`, go);
const files = {};
for (const file of (await readdir('public')).filter(f => /^go@\d+\.\d+\.\d+\.js$/.test(f)).sort()) files[file] = sri(await readFile(`public/${file}`));
for (const file of ['typeset.min.js', 'typeset.esm.js']) files[file] = sri(await readFile(`public/${file}`));
await writeFile('public/sri.json', JSON.stringify({ version, files, snippet: `<script src="https://typeset.us/go@${version}.js" integrity="${sri(go)}" crossorigin="anonymous" defer></script>` }, null, 2) + '\n');
await writeFile('public/release.json', JSON.stringify({ version, previous: '4.1.0', previousBrowserPin: '4.1.0', package: `typeset.us@${version}`, download: `/releases/${version}/${pack.filename}`, archive: '/releases/4.1.0/README.md', manifest: `/releases/${version}/manifest.json`, loader: { url: `/go@${version}.js`, integrity: sri(go), bytes: go.length, gzipBytes: gzipSync(go).length }, validation: 'See SUPPORT.md for verified coverage and outstanding device acceptance.' }, null, 2) + '\n');
await copyFile(`${root}/for-agents.md`, 'public/for-agents.md');
await copyFile(`${root}/capabilities.json`, 'public/capabilities.json');
console.log(`Built typeset.us@${version}, immutable archive, npm tarball and website aliases (${gzipSync(go).length} bytes gzip).`);
