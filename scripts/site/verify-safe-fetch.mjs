// @ts-check
// /api/fetch-url must not reach private networks (K10). This compiles
// src/lib/safe-fetch.ts and exercises it against a local server whose
// hostnames are mapped by an injected resolver:
//   public.test   -> 127.0.0.1 (treated as public in this test only)
//   internal.test -> 127.0.0.2 (private)
//   mixed.test    -> 127.0.0.1 and 10.0.0.1 (a rebinding-style answer)
// With the production policy, loopback, metadata and private literals are
// refused before any connection is made.
import { build } from 'esbuild';
import http from 'node:http';
import { gzipSync } from 'node:zlib';
import { mkdir, writeFile, rm } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

/** @type {{ label: string, pass: boolean, detail?: unknown }[]} */
const checks = [];
/** @param {string} label @param {unknown} pass @param {unknown} [detail] */
const check = (label, pass, detail) => { checks.push({ label, pass: !!pass, ...(pass ? {} : { detail }) }); };
const watchdog = setTimeout(() => { console.error('verify-safe-fetch: watchdog'); process.exit(3); }, 60000);

await mkdir('output', { recursive: true });
const modulePath = resolve(`output/safe-fetch-${process.pid}.mjs`);
await build({ entryPoints: ['src/lib/safe-fetch.ts'], bundle: true, platform: 'node', format: 'esm', outfile: modulePath, logLevel: 'silent' });
const { safeFetch, isBlockedAddress, checkUrl, FetchRefused } = await import(pathToFileURL(modulePath).href);

let hits = 0;
const server = http.createServer((req, res) => {
  hits++;
  const path = req.url ?? '/';
  const send = (/** @type {number} */ status, /** @type {Record<string, string>} */ headers, /** @type {string | Buffer} */ body = '') => { res.writeHead(status, headers); res.end(body); };
  if (path === '/page') return send(200, { 'content-type': 'text/html' }, '<p>ok</p>');
  if (path === '/big') return send(200, { 'content-type': 'text/html' }, 'x'.repeat(2_000_000));
  if (path === '/bomb') return send(200, { 'content-type': 'text/html', 'content-encoding': 'gzip' }, gzipSync(Buffer.alloc(20_000_000, 97)));
  if (path === '/loop') return send(302, { location: '/loop' });
  if (path.startsWith('/to?')) return send(302, { location: decodeURIComponent(path.slice(4)) });
  send(404, {});
});
await new Promise(accept => server.listen(0, '127.0.0.1', () => accept(undefined)));
const port = /** @type {import('node:net').AddressInfo} */ (server.address()).port;
const ports = new Set([String(port), '', '80', '443']);
/** @type {Record<string, { address: string, family: number }[]>} */
const zone = { 'public.test': [{ address: '127.0.0.1', family: 4 }], 'internal.test': [{ address: '127.0.0.2', family: 4 }], 'mixed.test': [{ address: '127.0.0.1', family: 4 }, { address: '10.0.0.1', family: 4 }] };
const lookup = (/** @type {string} */ host, /** @type {(e: Error | null, a: { address: string, family: number }[]) => void} */ cb) => zone[host] ? cb(null, zone[host]) : cb(Object.assign(new Error('ENOTFOUND ' + host), { code: 'ENOTFOUND' }), []);
const blocked = (/** @type {string} */ address) => address !== '127.0.0.1' && isBlockedAddress(address);
const options = { lookup, blocked, ports, timeoutMs: 5000 };
/** @param {string} url @param {object} [extra] */
const attempt = async (url, extra = {}) => { try { return { ok: await safeFetch(url, { ...options, ...extra }) }; } catch (error) { return { error: /** @type {any} */ (error) }; } };
const base = `http://public.test:${port}`;

try {
  for (const address of ['127.0.0.1', '127.1.2.3', '10.1.2.3', '172.16.0.1', '172.31.255.255', '192.168.1.1', '169.254.169.254', '100.64.0.1', '0.0.0.0', '224.0.0.1', '255.255.255.255', '::1', '::', 'fc00::1', 'fd12::1', 'fe80::1', '::ffff:127.0.0.1', '::ffff:7f00:1', '::ffff:a9fe:a9fe', '64:ff9b::a00:1', 'ff02::1']) {
    check(`policy refuses ${address}`, isBlockedAddress(address) === true);
  }
  for (const address of ['93.184.216.34', '1.1.1.1', '8.8.8.8', '172.32.0.1', '2606:4700:4700::1111', '2a00:1450:4001::200e']) {
    check(`policy allows public ${address}`, isBlockedAddress(address) === false);
  }
  for (const [url, reason] of [['file:///etc/passwd', 'protocol'], ['ftp://example.com/', 'protocol'], ['javascript:alert(1)', 'protocol'], ['http://user:pass@example.com/', 'credentials'], ['http://example.com:22/', 'port'], ['http://localhost/', 'private hostname'], ['http://app.localhost/', 'private hostname'], ['http://intranet/', 'private hostname'], ['http://printer.local/', 'private hostname']]) {
    let refused = false;
    try { checkUrl(url); } catch (error) { refused = error instanceof FetchRefused; }
    check(`URL check refuses ${url} (${reason})`, refused);
  }
  check('URL check accepts https://example.com/page', checkUrl('https://example.com/page').hostname === 'example.com');

  // Production policy: refused before any connection is attempted.
  const before = hits;
  for (const url of ['http://127.0.0.1/', 'http://169.254.169.254/latest/meta-data/', 'http://[::1]/', 'http://0x7f000001/', 'http://2130706433/', 'http://[::ffff:127.0.0.1]/', 'http://10.0.0.1/']) {
    const { error } = await (async () => { try { return { ok: await safeFetch(url, { timeoutMs: 3000 }) }; } catch (error) { return { error: /** @type {any} */ (error) }; } })();
    check(`production policy refuses ${url} with 403`, error instanceof FetchRefused && error.status === 403, error && String(error.message));
  }
  check('no refused request reached a server', hits === before);

  const page = await attempt(`${base}/page`);
  check('a public page is fetched', page.ok?.status === 200 && page.ok.body === '<p>ok</p>', page.error?.message);
  for (const [label, target] of [['a literal private address', `http://127.0.0.2:${port}/page`], ['a hostname that resolves privately', `http://internal.test:${port}/page`], ['cloud metadata', 'http://169.254.169.254/latest/meta-data/'], ['a file URL', 'file:///etc/passwd'], ['localhost', `http://localhost:${port}/page`]]) {
    const hitsBefore = hits;
    const result = await attempt(`${base}/to?${encodeURIComponent(target)}`);
    check(`a redirect to ${label} is refused`, result.error instanceof FetchRefused && hits === hitsBefore + 1, result.error?.message ?? result.ok);
  }
  const mixed = await attempt(`http://mixed.test:${port}/page`);
  check('a host whose DNS answer includes a private address is refused', mixed.error instanceof FetchRefused && mixed.error.status === 403, mixed.error?.message ?? mixed.ok);
  const loop = await attempt(`${base}/loop`);
  check('redirects stop after five hops', loop.error instanceof FetchRefused && /redirects/.test(loop.error.message), loop.error?.message);
  const big = await attempt(`${base}/big`, { maxBytes: 100_000 });
  check('a large body is cut at the byte cap', big.ok?.truncated === true && big.ok.body.length === 100_000, big.ok?.body.length);
  const bomb = await attempt(`${base}/bomb`, { maxBytes: 100_000 });
  check('a compressed body is capped after decompression', bomb.ok?.truncated === true && bomb.ok.body.length === 100_000, bomb.ok?.body.length ?? bomb.error?.message);
} finally {
  await new Promise(accept => server.close(() => accept(undefined)));
  await rm(modulePath, { force: true });
  clearTimeout(watchdog);
}
await writeFile('output/safe-fetch.json', JSON.stringify({ checks }, null, 2));
const failures = checks.filter(c => !c.pass);
console.log(JSON.stringify({ checks: checks.length, failures }, null, 2));
if (failures.length) process.exitCode = 1;
