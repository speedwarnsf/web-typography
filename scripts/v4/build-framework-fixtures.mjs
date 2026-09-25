// @ts-check
// Build the framework fixtures verify-framework-text.mjs loads: the same four
// paragraphs rendered by Svelte 5, Vue 3.5, Solid 1.9 and Lit 3, each bundled
// with its framework into one minified IIFE under tests/frameworks/dist/.
// The bundles are committed, so the suite needs no framework install; this
// script records how they were made. React is bundled at test time from the
// repository's own react and react-dom.
//
//   npm i --prefix <dir> svelte@5 vue@3.5 solid-js@1.9 lit@3
//   node scripts/v4/build-framework-fixtures.mjs --modules <dir>/node_modules
import { createRequire } from 'node:module';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { parseArgs } from 'node:util';
import { build } from 'esbuild';

const { values } = parseArgs({ options: { modules: { type: 'string' } } });
if (!values.modules) throw new Error('Pass --modules <node_modules containing svelte, vue, solid-js and lit>.');
const modules = resolve(values.modules);
const require = createRequire(join(modules, 'noop.js'));
const src = resolve('tests/frameworks/src'), dist = resolve('tests/frameworks/dist');
await mkdir(dist, { recursive: true });

/** A compiler's compile(), from its ESM or CommonJS build. @param {string} specifier */
const compiler = async specifier => { const module = await import(pathToFileURL(require.resolve(specifier)).href); return module.compile ?? module.default.compile; };
const compileSvelte = await compiler('svelte/compiler');
const compileVue = await compiler('@vue/compiler-dom');

/** @type {import('esbuild').Plugin} */
const frameworks = {
  name: 'framework-sources',
  setup(context) {
    context.onLoad({ filter: /\.svelte$/ }, async args => ({
      contents: compileSvelte(await readFile(args.path, 'utf8'), { generate: 'client', filename: args.path }).js.code,
      loader: 'js', resolveDir: src,
    }));
    context.onResolve({ filter: /^\.\/vue-template\.js$/ }, () => ({ path: join(src, 'vue-template.html'), namespace: 'vue-template' }));
    context.onLoad({ filter: /.*/, namespace: 'vue-template' }, async args => ({
      contents: compileVue(await readFile(args.path, 'utf8'), { mode: 'module', prefixIdentifiers: true }).code,
      loader: 'js', resolveDir: src,
    }));
  },
};

/** @type {Record<string, string>} */
const versions = {};
for (const name of ['svelte', 'vue', 'solid-js', 'lit']) versions[name] = JSON.parse(await readFile(join(modules, name, 'package.json'), 'utf8')).version;
for (const name of ['svelte', 'vue', 'solid', 'lit']) {
  await build({
    entryPoints: [join(src, `${name}.js`)], outfile: join(dist, `${name}.js`), bundle: true, format: 'iife', minify: true, target: 'es2022',
    nodePaths: [modules], plugins: [frameworks], legalComments: 'eof', logLevel: 'warning',
    conditions: ['browser', 'production'],
    define: { 'process.env.NODE_ENV': '"production"', __VUE_OPTIONS_API__: 'false', __VUE_PROD_DEVTOOLS__: 'false', __VUE_PROD_HYDRATION_MISMATCH_DETAILS__: 'false' },
    banner: { js: `/* Test fixture for typeset.us verify-framework-text.mjs: ${name} ${versions[name === 'solid' ? 'solid-js' : name]} and tests/frameworks/src/${name}.js. Built by scripts/v4/build-framework-fixtures.mjs. */` },
  });
}
await writeFile(join(dist, 'versions.json'), JSON.stringify(versions, null, 2) + '\n');
// Every bundle carries its framework's code, so every notice goes with them.
const notices = [];
for (const [name, file] of [['svelte', 'LICENSE.md'], ['vue', 'LICENSE'], ['solid-js', 'LICENSE'], ['lit', 'LICENSE'], ['lit-html', 'LICENSE'], ['@lit/reactive-element', 'LICENSE']]) {
  notices.push(`${name} ${JSON.parse(await readFile(join(modules, name, 'package.json'), 'utf8')).version}\n${'-'.repeat(60)}\n${(await readFile(join(modules, name, file), 'utf8')).trim()}\n`);
}
await writeFile(join(dist, 'THIRD-PARTY-LICENSES.txt'), 'Third-party code bundled into the test fixtures in this directory.\n\n' + notices.join('\n'));
console.log(JSON.stringify(versions));
