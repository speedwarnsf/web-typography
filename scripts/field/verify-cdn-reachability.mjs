// @ts-check
// Can tools fetch the files other sites and agents depend on? Requests each
// path repeatedly with a headless-browser user agent, as CI jobs and agents
// do, and fails on a non-200, a Vercel challenge page, or cache and CORS
// headers that differ from next.config.ts. Run after the firewall bypass in
// docs/ops/vercel-firewall.md is published, and after each deploy.
//
//   node scripts/field/verify-cdn-reachability.mjs [--base https://typeset.us] [--repeat 30]
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { parseArgs } from 'node:util';

const { values } = parseArgs({ options: { base: { type: 'string', default: process.env.SITE_URL || 'https://typeset.us' }, repeat: { type: 'string', default: '30' } } });
const base = values.base.replace(/\/$/, '');
const repeat = Number(values.repeat);
const release = JSON.parse(await readFile('public/release.json', 'utf8'));
const v = release.version;
const major = v.split('.')[0];
/** @type {[string, 'immutable' | 'revalidated'][]} */
const paths = [
  [`/go@${v}.js`, 'immutable'], ['/go@4.2.0.js', 'immutable'], [`/releases/${v}/manifest.json`, 'immutable'], [`/releases/${v}/typeset.us-${v}.tgz`, 'immutable'],
  ['/sri.json', 'revalidated'], ['/release.json', 'revalidated'], ['/for-agents.md', 'revalidated'], ['/capabilities.json', 'revalidated'], ['/llms.txt', 'revalidated'], ['/go.js', 'revalidated'],
];
const sri = JSON.parse(await readFile('public/sri.json', 'utf8'));
for (const file of Object.keys(sri.files)) if (file.startsWith('typeset@')) paths.push([`/${file}`, 'immutable']);
if (Object.keys(sri.files).some(file => file.startsWith('typeset@'))) paths.push([`/go@${major}.js`, 'revalidated']);
const agent = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/140.0.0.0 Safari/537.36';
/** @type {{ label: string, pass: boolean, detail?: unknown }[]} */
const checks = [];
for (const [path, kind] of paths) {
  /** @type {number[]} */
  const statuses = [];
  let challenged = 0, headers = /** @type {Headers | null} */ (null);
  for (let n = 0; n < repeat; n++) {
    const response = await fetch(`${base}${path}?reachability=${n}`, { headers: { 'user-agent': agent }, redirect: 'manual' });
    statuses.push(response.status);
    if (response.headers.get('x-vercel-mitigated')) challenged++;
    headers = response.headers;
    await response.arrayBuffer();
  }
  const cache = headers?.get('cache-control') ?? '';
  checks.push({ label: `${path}: ${repeat} automated GETs return 200 with no challenge`, pass: statuses.every(s => s === 200) && !challenged, detail: { statuses: [...new Set(statuses)], challenged } });
  checks.push({ label: `${path}: ${kind} cache and CORS headers`, pass: headers?.get('access-control-allow-origin') === '*' && (kind === 'immutable' ? /immutable/.test(cache) && /max-age=31536000/.test(cache) : !/immutable/.test(cache) && /max-age=300/.test(cache)), detail: { cache, cors: headers?.get('access-control-allow-origin') } });
}
await mkdir('output', { recursive: true });
await writeFile('output/cdn-reachability.json', JSON.stringify({ base, repeat, checks }, null, 2));
const failures = checks.filter(c => !c.pass);
console.log(JSON.stringify({ base, checks: checks.length, failures }, null, 2));
if (failures.length) process.exitCode = 1;
