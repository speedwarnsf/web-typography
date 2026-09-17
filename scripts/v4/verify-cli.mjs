import http from 'node:http';
import { readFile, writeFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import assert from 'node:assert/strict';
import { browsers } from './browsers.mjs';
const { consumer, version, artifactSHA256 } = JSON.parse(await readFile('output/package-verification.json', 'utf8'));
const run = (command, args, extraEnv = {}) => new Promise((accept, reject) => {
  const child = spawn(command, args, { cwd: consumer, env: { ...process.env, ...extraEnv }, stdio: ['ignore', 'pipe', 'pipe'] });
  let stdout = '', stderr = ''; child.stdout.on('data', c => { stdout += c; }); child.stderr.on('data', c => { stderr += c; });
  child.on('error', reject); child.on('exit', code => accept({ code, stdout, stderr }));
});
const peer = await run('npm', ['install', '--ignore-scripts', '--no-audit', '--no-fund', '--save-dev', '--save-exact', 'playwright@1.61.1']);
assert.equal(peer.code, 0, peer.stderr);
const global = await readFile(consumer + '/node_modules/typeset.us/dist/go.js');
const plain = '<!doctype html><html lang="en"><head><style>body{padding:30px}p{font:20px/1.4 Georgia;width:240px}</style></head><body><p data-typeset>"Read <strong>the notes</strong> at <a href="#collection">the neighborhood gallery</a>," she said.</p>';
const server = http.createServer((req, res) => {
  if (req.url === '/go.js') { res.writeHead(200, { 'content-type': 'text/javascript' }); res.end(global); return; }
  res.writeHead(200, { 'content-type': 'text/html' });
  res.end(plain + (req.url === '/managed' ? '<script src="/go.js" data-typeset-smart-quotes="en" data-typeset-optical-hanging="true" defer></script>' : '') + '</body></html>');
});
await new Promise(resolve => server.listen(4194, '127.0.0.1', resolve));
const checks = [];
try {
  const cli = 'node_modules/typeset.us/bin/audit.mjs';
  const invoke = args => run('node', [cli, ...args], { TYPESET_BROWSER_PATH: browsers[0].executablePath || '' });
  for (const [label, args, expected] of [
    ['unprocessed scope fails', ['--url', 'http://127.0.0.1:4194/plain', '--widths', '320'], 1],
    ['preview composes explicit scope', ['--url', 'http://127.0.0.1:4194/plain', '--widths', '320,390', '--apply', '--smart-quotes', '--optical-hanging'], 0],
    ['existing loader is inspected without replacement', ['--url', 'http://127.0.0.1:4194/managed', '--widths', '320,390'], 0],
    ['empty scope fails', ['--url', 'http://127.0.0.1:4194/plain', '--selector', '#absent', '--widths', '320', '--apply'], 1],
    ['invalid width fails before navigation', ['--url', 'http://127.0.0.1:4194/plain', '--widths', '0'], 2],
  ]) {
    const result = await invoke(args); assert.equal(result.code, expected, label + '\n' + result.stderr + result.stdout);
    const output = JSON.parse(expected === 2 ? result.stderr : result.stdout);
    assert.equal(output.pass, expected === 0);
    if (label === 'preview composes explicit scope') assert.equal(output.reports[0].features.quotes.applied, 1);
    checks.push({ label, passed: true, exitCode: result.code });
  }
} finally { await new Promise(resolve => server.close(resolve)); }
await writeFile('output/cli-verification.json', JSON.stringify({ version, artifactSHA256, checks }, null, 2));
console.log(JSON.stringify(checks, null, 2));
