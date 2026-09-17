import { createServer } from 'node:http';
import { spawn } from 'node:child_process';
import { readFile, writeFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
const pkg = JSON.parse(await readFile('output/package-verification.json', 'utf8'));
// An occupied preview must not satisfy readiness, even with the same artifacts.
const stale = createServer((req, res) => { res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify({ artifactSHA256: pkg.artifactSHA256, verificationToken: 'older-consumer' })); });
await new Promise(resolve => stale.listen(0, '127.0.0.1', resolve));
let result;
try {
  result = await new Promise((resolve, reject) => {
    const child = spawn('node', ['scripts/v4/verify-consumer-browser.mjs'], { env: { ...process.env, CONSUMER_PORT: String(stale.address().port) }, stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = '', stderr = '';
    child.stdout.on('data', chunk => stdout += chunk); child.stderr.on('data', chunk => stderr += chunk);
    const timeout = setTimeout(() => child.kill('SIGTERM'), 15000);
    child.on('error', error => { clearTimeout(timeout); reject(error); });
    child.on('exit', (code, signal) => { clearTimeout(timeout); resolve({ code, signal, stdout, stderr }); });
  });
} finally { await new Promise(resolve => stale.close(resolve)); }
assert.equal(result.signal, null, 'Stale-preview check timed out');
assert.equal(result.code, 1, 'An occupied preview was incorrectly accepted');
assert.match(result.stderr, /Consumer server exited/);
const report = { artifactSHA256: pkg.artifactSHA256, verificationToken: pkg.verificationToken, pass: true, checks: 1, detail: 'An occupied port serving the same artifact hash but a different consumer token is rejected.' };
await writeFile('output/consumer-identity.json', JSON.stringify(report, null, 2));
console.log(report.detail);
