// @ts-check
// Bundle sizes a consumer pays: min, gzip and brotli of esbuild bundles that
// import one entry point from a dist directory, and of the shipped files.
import { build } from 'esbuild';
import { readFile } from 'node:fs/promises';
import { gzipSync, brotliCompressSync } from 'node:zlib';
import { join, resolve } from 'node:path';

/** @param {Uint8Array} bytes */
const sizes = bytes => ({ min: bytes.length, gzip: gzipSync(bytes, { level: 9 }).length, brotli: brotliCompressSync(bytes).length });

/** @param {string} contents @param {string[]} [external] */
async function bundleSize(contents, external = []) {
  const result = await build({ stdin: { contents, resolveDir: process.cwd(), loader: 'js' }, bundle: true, minify: true, write: false, format: 'esm', target: 'es2022', external, treeShaking: true, logLevel: 'silent' });
  return sizes(result.outputFiles[0].contents);
}

/** @param {string} dir a dist directory (index.js, react.js, go.js, typeset.global.js) */
export async function measureSizes(dir) {
  const esm = JSON.stringify(resolve(dir, 'index.js')), react = JSON.stringify(resolve(dir, 'react.js'));
  return {
    'mount-only': await bundleSize(`import { mount } from ${esm}; mount(document, 'p');`),
    'TypesetText-only': await bundleSize(`import { TypesetText } from ${react}; globalThis.x = TypesetText;`, ['react', 'react-dom']),
    'TypesetRichText-only': await bundleSize(`import { TypesetRichText } from ${react}; globalThis.x = TypesetRichText;`, ['react', 'react-dom']),
    'smartQuotes-only': await bundleSize(`import { smartQuotes } from ${esm}; globalThis.x = smartQuotes;`),
    'react.js+shared': await bundleSize(`export * from ${react};`, ['react', 'react-dom']),
    'go.js': sizes(await readFile(join(dir, 'go.js'))),
    'typeset.global.js': sizes(await readFile(join(dir, 'typeset.global.js'))),
  };
}
