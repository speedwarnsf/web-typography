/**
 * Server-side fetch of a visitor-supplied URL, for /api/fetch-url. It must not
 * become a way into private networks (SSRF) or a free bandwidth amplifier:
 *
 * - only http and https on ports 80, 443, 8080 and 8443, with no credentials;
 * - every address a hostname resolves to is checked, and the socket connects
 *   only to a checked address, so DNS cannot change between check and connect;
 * - loopback, private, link-local (including 169.254.169.254 metadata),
 *   carrier-grade NAT, multicast, reserved and unspecified addresses, and
 *   their IPv4-mapped IPv6 forms, are refused;
 * - redirects are followed by hand, at most five, and each hop is checked
 *   again;
 * - the body is streamed and cut at a byte cap, after decompression.
 */
import { lookup as dnsLookup } from 'node:dns';
import type { LookupAddress } from 'node:dns';
import { isIP } from 'node:net';
import http from 'node:http';
import https from 'node:https';
import { createBrotliDecompress, createGunzip, createInflate } from 'node:zlib';
import type { Readable } from 'node:stream';

export class FetchRefused extends Error {
  constructor(message: string, readonly status = 400) { super(message); }
}

const ALLOWED_PORTS = new Set(['', '80', '443', '8080', '8443']);

function ipv4(address: string): number[] | null {
  const parts = address.split('.').map(Number);
  return parts.length === 4 && parts.every(n => Number.isInteger(n) && n >= 0 && n <= 255) ? parts : null;
}

/** True for any address a public fetch must never reach. */
export function isBlockedAddress(address: string): boolean {
  const family = isIP(address);
  if (family === 4) {
    const [a, b, c] = ipv4(address) as number[];
    return a === 0 || a === 10 || a === 127 || a >= 224
      || (a === 100 && b >= 64 && b <= 127) // carrier-grade NAT
      || (a === 169 && b === 254) // link-local, cloud metadata
      || (a === 172 && b >= 16 && b <= 31)
      || (a === 192 && b === 168)
      || (a === 192 && b === 0 && (c === 0 || c === 2)) // IETF, TEST-NET-1
      || (a === 198 && (b === 18 || b === 19)) // benchmarking
      || (a === 198 && b === 51 && c === 100) || (a === 203 && b === 0 && c === 113); // TEST-NET-2/3
  }
  if (family === 6) {
    const lower = address.toLowerCase().replace(/^\[|\]$/g, '');
    const mapped = /^(?:0*:)*:?ffff:(\d+\.\d+\.\d+\.\d+)$/.exec(lower) || /^::(\d+\.\d+\.\d+\.\d+)$/.exec(lower);
    if (mapped) return isBlockedAddress(mapped[1]);
    const hex = /^::ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/.exec(lower);
    if (hex) { const n = (parseInt(hex[1], 16) << 16) | parseInt(hex[2], 16); return isBlockedAddress([n >>> 24, (n >>> 16) & 255, (n >>> 8) & 255, n & 255].join('.')); }
    return lower === '::' || lower === '::1'
      || /^f[cd]/.test(lower) // unique local
      || /^fe[89ab]/.test(lower) // link-local
      || /^ff/.test(lower) // multicast
      || /^2001:0?db8:/.test(lower) // documentation
      || /^64:ff9b:/.test(lower) // NAT64 can reach IPv4 private space
      || /^2002:/.test(lower); // 6to4 embeds an IPv4 address
  }
  return true;
}

type Lookup = (hostname: string, callback: (error: Error | null, addresses: LookupAddress[]) => void) => void;
const systemLookup: Lookup = (hostname, callback) => dnsLookup(hostname, { all: true, verbatim: true }, callback);

export interface SafeFetchOptions {
  /** Resolver, replaceable in tests. */
  lookup?: Lookup;
  /** Address policy, replaceable in tests. */
  blocked?: (address: string) => boolean;
  /** Ports that may be fetched ('' is the scheme's default). */
  ports?: ReadonlySet<string>;
  maxBytes?: number;
  maxRedirects?: number;
  timeoutMs?: number;
}

export interface SafeFetchResult { url: string; status: number; contentType: string; body: string; truncated: boolean; hops: number }

/** Parse and check one URL before any network use. */
export function checkUrl(input: string | URL, ports: ReadonlySet<string> = ALLOWED_PORTS): URL {
  let url: URL;
  try { url = new URL(input); } catch { throw new FetchRefused('Invalid URL'); }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') throw new FetchRefused('Only http and https URLs can be fetched');
  if (url.username || url.password) throw new FetchRefused('URLs with credentials are not fetched');
  if (!ports.has(url.port)) throw new FetchRefused('Only ports 80, 443, 8080 and 8443 are fetched');
  const host = url.hostname.toLowerCase();
  if (host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.local') || host.endsWith('.internal') || !host.includes('.') && !isIP(host.replace(/^\[|\]$/g, ''))) throw new FetchRefused('Private hostnames are not fetched', 403);
  return url;
}

export async function safeFetch(input: string, options: SafeFetchOptions = {}): Promise<SafeFetchResult> {
  const { lookup = systemLookup, blocked = isBlockedAddress, ports = ALLOWED_PORTS, maxBytes = 500_000, maxRedirects = 5, timeoutMs = 10_000 } = options;
  const deadline = Date.now() + timeoutMs;
  let url = checkUrl(input, ports);
  for (let hops = 0; ; hops++) {
    const response = await request(url, { lookup, blocked, maxBytes, deadline });
    if (response.status >= 300 && response.status < 400 && response.location) {
      if (hops >= maxRedirects) throw new FetchRefused('Too many redirects', 502);
      url = checkUrl(new URL(response.location, url), ports);
      continue;
    }
    return { url: url.href, status: response.status, contentType: response.contentType, body: response.body, truncated: response.truncated, hops };
  }
}

function request(url: URL, { lookup, blocked, maxBytes, deadline }: { lookup: Lookup; blocked: (address: string) => boolean; maxBytes: number; deadline: number }) {
  return new Promise<{ status: number; location?: string; contentType: string; body: string; truncated: boolean }>((resolve, reject) => {
    const literal = url.hostname.replace(/^\[|\]$/g, '');
    // The socket connects only to an address this function has checked.
    const checkedLookup = (hostname: string, lookupOptions: { all?: boolean } | undefined, callback: (error: Error | null, address: string | LookupAddress[], family?: number) => void) => {
      const done = (error: Error | null, addresses: LookupAddress[]) => {
        if (error) return callback(error, '');
        if (!addresses.length) return callback(new FetchRefused('Host did not resolve', 502), '');
        // Any private answer refuses the host: a mixed answer is a rebinding tell.
        const refused = addresses.find(a => blocked(a.address));
        if (refused) return callback(new FetchRefused('This address is private and cannot be fetched', 403), '');
        if (lookupOptions?.all) callback(null, addresses);
        else callback(null, addresses[0].address, addresses[0].family);
      };
      if (isIP(hostname)) done(null, [{ address: hostname, family: isIP(hostname) }]);
      else lookup(hostname, done);
    };
    if (isIP(literal) && blocked(literal)) return reject(new FetchRefused('This address is private and cannot be fetched', 403));
    const remaining = deadline - Date.now();
    if (remaining <= 0) return reject(new FetchRefused('Request timed out (10s)', 504));
    const client = url.protocol === 'https:' ? https : http;
    const req = client.request(url, {
      method: 'GET',
      lookup: checkedLookup as never,
      headers: { 'User-Agent': 'Typeset.us Type Audit/1.1 (+https://typeset.us)', Accept: 'text/html,application/xhtml+xml', 'Accept-Encoding': 'gzip, deflate, br' },
      timeout: remaining,
    }, res => {
      const status = res.statusCode ?? 0;
      const contentType = String(res.headers['content-type'] ?? '');
      if (status >= 300 && status < 400 && res.headers.location) {
        res.resume();
        return resolve({ status, location: res.headers.location, contentType, body: '', truncated: false });
      }
      let stream: Readable = res;
      const encoding = String(res.headers['content-encoding'] ?? '').toLowerCase();
      if (encoding === 'gzip' || encoding === 'x-gzip') stream = res.pipe(createGunzip());
      else if (encoding === 'deflate') stream = res.pipe(createInflate());
      else if (encoding === 'br') stream = res.pipe(createBrotliDecompress());
      const chunks: Buffer[] = [];
      let bytes = 0, truncated = false;
      stream.on('data', (chunk: Buffer) => {
        if (truncated) return;
        const room = maxBytes - bytes;
        if (chunk.length >= room) { chunks.push(chunk.subarray(0, room)); bytes = maxBytes; truncated = true; req.destroy(); resolve({ status, contentType, body: Buffer.concat(chunks).toString('utf8'), truncated }); return; }
        chunks.push(chunk); bytes += chunk.length;
      });
      stream.on('end', () => { if (!truncated) resolve({ status, contentType, body: Buffer.concat(chunks).toString('utf8'), truncated }); });
      stream.on('error', error => { if (!truncated) reject(error); });
    });
    const timer = setTimeout(() => req.destroy(new FetchRefused('Request timed out (10s)', 504)), remaining);
    req.on('timeout', () => req.destroy(new FetchRefused('Request timed out (10s)', 504)));
    req.on('error', reject);
    req.on('close', () => clearTimeout(timer));
    req.end();
  });
}
