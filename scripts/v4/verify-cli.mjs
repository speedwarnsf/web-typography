// @ts-check
// The typeset-audit CLI (packages/typeset-v4/bin/audit.mjs), run as it ships:
// from a package directory whose dist/ is the artifact under test. By default
// the package is staged under output/ from TYPESET_DIST (the candidate in
// test:v4) with the repository's Playwright; --consumer instead runs the CLI
// installed in the packed consumer that verify-package.mjs created.
import http from 'node:http';
import { cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { resolve } from 'node:path';
import { browsers } from './browsers.mjs';
import { artifacts, expectedVersion } from './candidate.mjs';
import { releaseIdentity } from './release-evidence.mjs';

const consumerMode = process.argv.includes('--consumer');
let cwd, cli, identity;
if (consumerMode) {
  const installed = JSON.parse(await readFile('output/package-verification.json', 'utf8'));
  cwd = installed.consumer; cli = 'node_modules/typeset.us/bin/audit.mjs';
  identity = { version: installed.version, artifactSHA256: installed.artifactSHA256 };
} else {
  // A staged package inside the repository resolves `playwright` from the
  // repository's node_modules, exactly as an installed peer would.
  cwd = resolve(`output/cli-stage-${process.pid}`);
  await rm(cwd, { recursive: true, force: true });
  await mkdir(cwd, { recursive: true });
  await cp('packages/typeset-v4/bin', `${cwd}/bin`, { recursive: true });
  await cp(artifacts.dist, `${cwd}/dist`, { recursive: true });
  await writeFile(`${cwd}/package.json`, JSON.stringify({ name: 'typeset-cli-stage', private: true, type: 'module', version: await expectedVersion() }));
  cli = 'bin/audit.mjs';
  identity = await releaseIdentity();
}
/** @param {string} command @param {string[]} args @param {Record<string, string>} [extraEnv] @returns {Promise<{ code: number | null, stdout: string, stderr: string }>} */
const run = (command, args, extraEnv = {}) => new Promise((accept, reject) => {
  const child = spawn(command, args, { cwd, env: { ...process.env, ...extraEnv }, stdio: ['ignore', 'pipe', 'pipe'] });
  let stdout = '', stderr = ''; child.stdout.on('data', c => { stdout += c; }); child.stderr.on('data', c => { stderr += c; });
  const watchdog = setTimeout(() => child.kill('SIGKILL'), 90000);
  child.on('error', reject); child.on('exit', code => { clearTimeout(watchdog); accept({ code, stdout, stderr }); });
});
if (consumerMode) {
  const peer = await run('npm', ['install', '--ignore-scripts', '--no-audit', '--no-fund', '--save-dev', '--save-exact', 'playwright@1.61.1']);
  if (peer.code !== 0) throw new Error(peer.stderr);
}
const goJS = await readFile(consumerMode ? `${cwd}/node_modules/typeset.us/dist/go.js` : `${cwd}/dist/go.js`);
const plain = '<!doctype html><html lang="en"><head><style>body{padding:30px}p{font:20px/1.4 Georgia;width:240px}</style></head><body><p data-typeset>"Read <strong>the notes</strong> at <a href="#collection">the neighborhood gallery</a>," she said.</p>';
const server = http.createServer((req, res) => {
  if (req.url === '/go.js') { res.writeHead(200, { 'content-type': 'text/javascript' }); res.end(goJS); return; }
  res.writeHead(200, { 'content-type': 'text/html' });
  res.end(plain + (req.url === '/managed' ? '<script src="/go.js" data-typeset-smart-quotes="en" data-typeset-optical-hanging="true" defer></script>' : '') + '</body></html>');
});
await new Promise(resolve => server.listen(0, '127.0.0.1', () => resolve(undefined)));
const address = server.address();
const base = `http://127.0.0.1:${address && typeof address === 'object' ? address.port : 0}`;
/** @type {{ label: string, pass: boolean, exitCode: number | null, detail?: unknown }[]} */
const checks = [];
/** @type {{ error: string }[]} */
const errors = [];
try {
  const invoke = (/** @type {string[]} */ args) => run('node', [cli, ...args], { TYPESET_BROWSER_PATH: browsers[0].executablePath || '' });
  for (const [label, args, expected] of /** @type {[string, string[], number][]} */ ([
    ['unprocessed scope fails', ['--url', `${base}/plain`, '--widths', '320'], 1],
    ['preview composes explicit scope', ['--url', `${base}/plain`, '--widths', '320,390', '--apply', '--smart-quotes', '--optical-hanging'], 0],
    ['existing loader is inspected without replacement', ['--url', `${base}/managed`, '--widths', '320,390'], 0],
    ['empty scope fails', ['--url', `${base}/plain`, '--selector', '#absent', '--widths', '320', '--apply'], 1],
    ['invalid width fails before navigation', ['--url', `${base}/plain`, '--widths', '0'], 2],
  ])) {
    const result = await invoke(args);
    let output = null;
    try { output = JSON.parse(expected === 2 ? result.stderr : result.stdout); } catch {}
    const errorIssues = output?.reports?.flatMap((/** @type {{ width: number, issues: { severity: string, type: string, detail: string }[] }} */ r) => r.issues.filter(i => i.severity === 'error').map(i => `${r.width}px ${i.type}: ${i.detail}`)) ?? [];
    const pass = result.code === expected && output?.pass === (expected === 0)
      && (label !== 'preview composes explicit scope' || output?.reports?.[0]?.features?.quotes?.applied === 1);
    checks.push({ label, pass, exitCode: result.code, ...(pass ? {} : { detail: { expectedExit: expected, pass: output?.pass, errorIssues: errorIssues.slice(0, 6), stderr: result.stderr.slice(0, 300) } }) });
  }
} catch (error) {
  errors.push({ error: String(/** @type {Error} */ (error).stack || error) });
} finally {
  await new Promise(resolve => server.close(() => resolve(undefined)));
  if (!consumerMode) await rm(cwd, { recursive: true, force: true });
}
await writeFile('output/cli-verification.json', JSON.stringify({ ...identity, mode: consumerMode ? 'packed-consumer' : 'staged-package', checks, errors }, null, 2));
const failures = checks.filter(c => !c.pass);
console.log(JSON.stringify({ checks: checks.length, failures, errors }, null, 2));
if (failures.length || errors.length) process.exitCode = 1;
