// @ts-check
// The published-artifact ledger: public/releases/published.json.
//
// Every file a release put in front of users (its public/releases/<v>/
// archive, the npm tarball and each file inside it, the pinned go@<v>.js
// loader and its sri.json entry) is recorded by hash. verifyLedger() fails
// when a recorded file is missing, changed, or joined by an unrecorded file,
// and when an existing ledger entry was modified or removed relative to a
// base commit. Entries are only ever appended, by release-cut.mjs.
//
//   node scripts/v4/ledger.mjs --describe 4.2.0      print an entry from current bytes
//   node scripts/v4/ledger.mjs --seed 4.2.0 [...]    append entries (refuses to replace)
import { readFile, readdir, writeFile, stat } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { gunzipSync } from 'node:zlib';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const LEDGER = 'public/releases/published.json';
/**
 * Browser files in public/ whose bytes never change once written: the pinned
 * loaders go@x.y.z.js and, from 4.3, typeset@x.y.z.min.js and
 * typeset@x.y.z.esm.js. Only these may appear in public/sri.json; the
 * aliases go.js, go@<major>.js, typeset.min.js and typeset.esm.js move with
 * each release.
 */
export const IMMUTABLE_SITE_FILE = /^(?:go@\d+\.\d+\.\d+\.js|typeset@\d+\.\d+\.\d+\.(?:min|esm)\.js)$/;

/** @param {Uint8Array} bytes */
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
/** @param {Uint8Array} bytes @param {string} algorithm */
const integrity = (bytes, algorithm) => `${algorithm}-` + createHash(algorithm).update(bytes).digest('base64');

/**
 * Files inside a .tgz (ustar with pax extended headers), as name -> bytes.
 * @param {Uint8Array} gz
 */
export function readTarball(gz) {
  const tar = gunzipSync(gz);
  /** @type {Map<string, Buffer>} */
  const files = new Map();
  let offset = 0, paxPath = '';
  const text = (/** @type {number} */ start, /** @type {number} */ length) => tar.subarray(start, start + length).toString('utf8').replace(/\0.*$/s, '');
  while (offset + 512 <= tar.length) {
    const header = tar.subarray(offset, offset + 512);
    if (header.every(byte => byte === 0)) break;
    const size = parseInt(text(offset + 124, 12).trim() || '0', 8);
    const type = String.fromCharCode(header[156] || 48);
    const prefix = text(offset + 345, 155);
    const name = paxPath || (prefix ? prefix + '/' : '') + text(offset, 100);
    const body = tar.subarray(offset + 512, offset + 512 + size);
    paxPath = '';
    if (type === 'x') {
      for (const record of body.toString('utf8').split('\n')) {
        const match = /^\d+ path=(.*)$/.exec(record);
        if (match) paxPath = match[1];
      }
    } else if (type === '0' || type === '\0' || type === '7') files.set(name, Buffer.from(body));
    offset += 512 + Math.ceil(size / 512) * 512;
  }
  return files;
}

/** @param {string} dir @param {string} [prefix] @returns {Promise<string[]>} */
async function walk(dir, prefix = dir) {
  /** @type {string[]} */
  const out = [];
  for (const entry of (await readdir(dir, { withFileTypes: true })).sort((a, b) => a.name < b.name ? -1 : 1)) {
    const path = `${dir}/${entry.name}`;
    if (entry.isDirectory()) out.push(...await walk(path, prefix));
    else out.push(path);
  }
  return out;
}

/** @param {string} path */
const exists = path => stat(path).then(() => true, () => false);

/**
 * Describe a release from the bytes currently on disk. Used to seed the
 * ledger and by release-cut.mjs to append a new release.
 * @param {string} version
 * @param {{ npm?: { shasum: string, integrity: string } | null, git?: { tag: string, commit: string } | null, records?: string[], root?: string }} [facts]
 */
export async function describeRelease(version, { npm = null, git = null, records = [], root = '.' } = {}) {
  const dir = `public/releases/${version}`;
  /** @type {Record<string, string>} */
  const files = {};
  for (const path of await walk(join(root, dir))) files[path.slice(root === '.' ? 0 : root.length + 1)] = sha256(await readFile(path));
  const tarballPath = `${dir}/typeset.us-${version}.tgz`;
  /** @type {Record<string, unknown>} */
  const entry = {};
  if (npm) entry.npm = { spec: `typeset.us@${version}`, ...npm };
  if (files[tarballPath]) {
    const gz = await readFile(join(root, tarballPath));
    /** @type {Record<string, string>} */
    const contents = {};
    for (const [name, bytes] of [...readTarball(gz)].sort((a, b) => a[0] < b[0] ? -1 : 1)) contents[name] = sha256(bytes);
    entry.tarball = { path: tarballPath, sha1: createHash('sha1').update(gz).digest('hex'), integrity: integrity(gz, 'sha512'), contents };
  }
  if (files[`${dir}/manifest.json`]) entry.manifest = { path: `${dir}/manifest.json`, sha256: files[`${dir}/manifest.json`] };
  const pin = `go@${version}.js`;
  if (await exists(join(root, 'public', pin))) entry.loader = pin;
  entry.files = files;
  if (records.length) {
    /** @type {Record<string, string>} */
    const recorded = {};
    for (const path of records) recorded[path] = sha256(await readFile(join(root, path)));
    entry.records = recorded;
  }
  if (git) entry.git = git;
  return entry;
}

/**
 * Every immutable browser file in public/ (IMMUTABLE_SITE_FILE), with its SRI.
 * @param {string} [root]
 */
export async function describePins(root = '.') {
  /** @type {Record<string, { integrity: string, sha256: string }>} */
  const pins = {};
  for (const file of (await readdir(join(root, 'public'))).filter(f => IMMUTABLE_SITE_FILE.test(f)).sort()) {
    const bytes = await readFile(join(root, 'public', file));
    pins[file] = { integrity: integrity(bytes, 'sha384'), sha256: sha256(bytes) };
  }
  return pins;
}

/** @param {string} [root] */
export async function readLedger(root = '.') {
  return JSON.parse(await readFile(join(root, LEDGER), 'utf8'));
}

/** @param {string[]} args */
function git(args) {
  try { return execFileSync('git', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim(); }
  catch { return null; }
}

/**
 * Commits the ledger must be append-only against: LEDGER_BASE (CI passes the
 * push's previous head or the pull request base), the merge-base with
 * origin/master, and HEAD itself (catches uncommitted edits).
 */
export function ledgerBases() {
  const bases = new Set();
  if (process.env.LEDGER_BASE && !/^0+$/.test(process.env.LEDGER_BASE)) bases.add(process.env.LEDGER_BASE);
  for (const upstream of ['origin/master', 'master']) {
    const base = git(['merge-base', 'HEAD', upstream]);
    if (base) { bases.add(base); break; }
  }
  const head = git(['rev-parse', 'HEAD']);
  if (head) {
    bases.add(head);
    // On master itself the merge-base is HEAD; also hold HEAD's parent.
    const parent = git(['rev-parse', 'HEAD^']);
    if (parent && bases.size === 1) bases.add(parent);
  }
  return [...bases];
}

/** @param {unknown} value @returns {string} */
const canonical = value => JSON.stringify(value, (key, v) => v && typeof v === 'object' && !Array.isArray(v) ? Object.fromEntries(Object.entries(v).sort(([a], [b]) => a < b ? -1 : 1)) : v);

/**
 * @typedef {{ label: string, pass: boolean, detail?: unknown }} Check
 * @param {{ versions?: string[], bases?: string[], network?: boolean, npmCache?: string }} [options]
 * @returns {Promise<{ checks: Check[], versions: string[] }>}
 */
export async function verifyLedger({ versions, bases = ledgerBases(), network = false, npmCache } = {}) {
  /** @type {Check[]} */
  const checks = [];
  const check = (/** @type {string} */ label, /** @type {unknown} */ pass, /** @type {unknown} */ detail) => { checks.push({ label, pass: !!pass, ...(pass ? {} : { detail }) }); };
  const ledger = await readLedger();
  const selected = versions ?? Object.keys(ledger.releases);
  for (const version of selected) {
    const entry = ledger.releases[version];
    if (!entry) { check(`${version}: ledger entry exists`, false, `no entry for ${version} in ${LEDGER}`); continue; }
    // Every recorded file, byte for byte, and nothing added beside them.
    const dir = `public/releases/${version}`;
    const onDisk = await exists(dir) ? await walk(dir) : [];
    const missing = [], changed = [], added = [];
    for (const [path, hash] of Object.entries(entry.files)) {
      if (!await exists(path)) missing.push(path);
      else if (sha256(await readFile(path)) !== hash) changed.push(path);
    }
    for (const path of onDisk) if (!(path in entry.files)) added.push(path);
    check(`${version}: ${Object.keys(entry.files).length} archived files unchanged`, !missing.length && !changed.length, { missing, changed });
    check(`${version}: no unrecorded file added to ${dir}`, !added.length, { added });
    if (entry.tarball) {
      const gz = await exists(entry.tarball.path) ? await readFile(entry.tarball.path) : null;
      const sha1 = gz && createHash('sha1').update(gz).digest('hex');
      check(`${version}: npm tarball sha1 ${entry.tarball.sha1.slice(0, 12)}`, sha1 === entry.tarball.sha1 && gz && integrity(gz, 'sha512') === entry.tarball.integrity, { expected: entry.tarball.sha1, actual: sha1 });
      if (gz) {
        const contents = readTarball(gz);
        const diff = Object.entries(entry.tarball.contents).filter(([name, hash]) => !contents.has(name) || sha256(/** @type {Buffer} */ (contents.get(name))) !== hash).map(([name]) => name);
        const extra = [...contents.keys()].filter(name => !(name in entry.tarball.contents));
        check(`${version}: ${Object.keys(entry.tarball.contents).length} files inside the tarball unchanged`, !diff.length && !extra.length, { changed: diff, extra });
      }
      if (entry.npm) check(`${version}: ledger npm integrity matches the archived tarball`, entry.npm.integrity === entry.tarball.integrity && entry.npm.shasum === entry.tarball.sha1, entry.npm);
    }
    if (entry.manifest) check(`${version}: manifest hash`, entry.files[entry.manifest.path] === entry.manifest.sha256, entry.manifest);
    for (const [path, hash] of Object.entries(entry.records ?? {})) {
      const actual = await exists(path) ? sha256(await readFile(path)) : null;
      check(`${version}: release record ${path} unchanged`, actual === hash, { expected: hash, actual });
    }
    if (entry.git) {
      const commit = git(['rev-parse', '--verify', '-q', `refs/tags/${entry.git.tag}^{commit}`]);
      if (commit) check(`${version}: tag ${entry.git.tag} still names ${entry.git.commit.slice(0, 12)}`, commit === entry.git.commit, { actual: commit });
    }
    if (network && entry.npm) {
      try {
        const out = execFileSync('npm', ['view', entry.npm.spec, 'dist', '--json', ...(npmCache ? ['--cache', npmCache] : [])], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], timeout: 30000 });
        const dist = JSON.parse(out);
        check(`${version}: npm registry dist.integrity equals the ledger`, dist.integrity === entry.npm.integrity && dist.shasum === entry.npm.shasum, { registry: { integrity: dist.integrity, shasum: dist.shasum } });
      } catch (error) {
        check(`${version}: npm registry reachable for cross-check`, false, String(/** @type {Error} */ (error).message).split('\n')[0]);
      }
    }
  }
  // Pinned loaders: bytes, and their unchanged entries in public/sri.json.
  const sriFile = JSON.parse(await readFile('public/sri.json', 'utf8'));
  const pinNames = versions ? versions.map(v => ledger.releases[v]?.loader).filter(Boolean) : Object.keys(ledger.pins);
  for (const pin of pinNames) {
    const expected = ledger.pins[pin];
    if (!expected) { check(`${pin}: pin recorded`, false, 'missing from ledger.pins'); continue; }
    const bytes = await exists(`public/${pin}`) ? await readFile(`public/${pin}`) : null;
    check(`${pin}: loader bytes unchanged`, bytes && integrity(bytes, 'sha384') === expected.integrity && sha256(bytes) === expected.sha256, { expected: expected.integrity, actual: bytes && integrity(bytes, 'sha384') });
    check(`${pin}: sri.json entry unchanged`, sriFile.files?.[pin] === expected.integrity, { expected: expected.integrity, actual: sriFile.files?.[pin] });
  }
  // Append-only: no entry that existed at a base commit may change or vanish.
  for (const base of bases) {
    let previous;
    try { previous = JSON.parse(execFileSync('git', ['show', `${base}:${LEDGER}`], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] })); }
    catch { continue; } // The ledger did not exist yet at this base.
    const alteredReleases = Object.keys(previous.releases ?? {}).filter(v => (!versions || versions.includes(v)) && canonical(previous.releases[v]) !== canonical(ledger.releases[v]));
    const alteredPins = Object.keys(previous.pins ?? {}).filter(p => (!versions || pinNames.includes(p)) && canonical(previous.pins[p]) !== canonical(ledger.pins[p]));
    check(`ledger is append-only against ${base.slice(0, 12)}`, !alteredReleases.length && !alteredPins.length, { alteredReleases, alteredPins });
  }
  return { checks, versions: selected };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  const mode = args.shift();
  if (mode === '--describe') {
    for (const version of args) console.log(JSON.stringify({ [version]: await describeRelease(version) }, null, 2));
  } else if (mode === '--seed') {
    // One-time seeding from committed bytes that were verified equal to npm.
    const ledger = await exists(LEDGER) ? await readLedger() : { schema: 1, note: 'Append-only record of published artifacts; see scripts/v4/ledger.mjs.', releases: {}, pins: {} };
    const npmCache = process.env.npm_config_cache;
    for (const version of args) {
      if (ledger.releases[version]) throw new Error(`${version} is already in the ledger; entries are append-only.`);
      let npm = null;
      try {
        const dist = JSON.parse(execFileSync('npm', ['view', `typeset.us@${version}`, 'dist', '--json', ...(npmCache ? ['--cache', npmCache] : [])], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], timeout: 30000 }));
        npm = { shasum: dist.shasum, integrity: dist.integrity };
      } catch { /* not on npm (a website-only prerelease) */ }
      const tag = [`v${version}`, `archive/typeset-${version}`].find(name => git(['rev-parse', '--verify', '-q', `refs/tags/${name}`]));
      const records = await exists(`docs/RELEASE-${version}.md`) ? [`docs/RELEASE-${version}.md`] : [];
      const entry = await describeRelease(version, { npm, records, git: tag ? { tag, commit: /** @type {string} */ (git(['rev-parse', `${tag}^{commit}`])) } : null });
      if (npm && entry.tarball && /** @type {{ sha1: string }} */ (entry.tarball).sha1 !== npm.shasum) throw new Error(`${version}: the archived tarball differs from npm; refusing to seed.`);
      ledger.releases[version] = entry;
    }
    for (const [pin, value] of Object.entries(await describePins())) if (!ledger.pins[pin]) ledger.pins[pin] = value;
    await writeFile(LEDGER, JSON.stringify(ledger, null, 2) + '\n');
    console.log(`Ledger now records ${Object.keys(ledger.releases).join(', ')} and ${Object.keys(ledger.pins).length} pinned loaders.`);
  } else {
    console.error('Usage: ledger.mjs --describe <version...> | --seed <version...>');
    process.exitCode = 2;
  }
}
