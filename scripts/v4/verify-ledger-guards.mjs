// @ts-check
// Guards the guard: in a throwaway clone, tamper with published artifacts in
// the ways the old HEAD-only check missed and confirm verify-ledger.mjs
// fails each time, and passes on the untouched clone.
import { mkdtemp, rm, writeFile, appendFile, unlink, readFile } from 'node:fs/promises';
import { execFileSync, spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const repo = process.cwd();
const verifier = resolve('scripts/v4/verify-ledger.mjs');
const head = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
/** @type {{ label: string, pass: boolean, detail?: unknown }[]} */
const checks = [];
const work = await mkdtemp(join(tmpdir(), 'typeset-ledger-guard-'));
try {
  /** @param {string} name */
  const fresh = name => {
    const dir = join(work, name);
    execFileSync('git', ['clone', '--quiet', '--shared', '--no-checkout', repo, dir]);
    execFileSync('git', ['checkout', '--quiet', head], { cwd: dir });
    // The working tree's (possibly uncommitted) ledger is what is under test.
    execFileSync('cp', [join(repo, 'public/releases/published.json'), join(dir, 'public/releases/published.json')]);
    return dir;
  };
  /** @param {string} dir @param {Record<string, string>} [env] */
  const verify = (dir, env = {}) => {
    const run = spawnSync(process.execPath, [verifier], { cwd: dir, encoding: 'utf8', env: { ...process.env, ...env }, timeout: 60000 });
    let failures = [];
    try { failures = JSON.parse(run.stdout).failures.map((/** @type {{ label: string }} */ f) => f.label); } catch { failures = [run.stderr.split('\n')[0]]; }
    return { status: run.status, failures };
  };
  /** @param {string} label @param {(dir: string) => Promise<Record<string, string> | void>} tamper @param {boolean} expectPass */
  const scenario = async (label, tamper, expectPass) => {
    const dir = fresh(String(checks.length));
    const env = await tamper(dir) || {};
    const result = verify(dir, env);
    checks.push({ label, pass: expectPass ? result.status === 0 : result.status === 1 && result.failures.length > 0, detail: result });
  };
  await scenario('untouched clone passes', async () => {}, true);
  await scenario('edited public/releases/4.2.0/README.md fails', async dir => { await appendFile(join(dir, 'public/releases/4.2.0/README.md'), '\nEdited.\n'); }, false);
  await scenario('deleted public/go@4.2.0.js fails', async dir => { await unlink(join(dir, 'public/go@4.2.0.js')); }, false);
  await scenario('file added to public/releases/4.2.0 fails', async dir => { await writeFile(join(dir, 'public/releases/4.2.0/extra.js'), 'x'); }, false);
  await scenario('changed go@4.2.0.js entry in sri.json fails', async dir => {
    const sri = JSON.parse(await readFile(join(dir, 'public/sri.json'), 'utf8'));
    sri.files['go@4.2.0.js'] = 'sha384-AAAA'; await writeFile(join(dir, 'public/sri.json'), JSON.stringify(sri, null, 2));
  }, false);
  await scenario('rewriting a file and its ledger entry in one commit fails append-only', async dir => {
    const base = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: dir, encoding: 'utf8' }).trim();
    execFileSync('git', ['add', 'public/releases/published.json'], { cwd: dir });
    execFileSync('git', ['-c', 'user.name=guard', '-c', 'user.email=guard@example.invalid', 'commit', '--quiet', '--allow-empty', '-m', 'ledger'], { cwd: dir });
    const ledgerBase = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: dir, encoding: 'utf8' }).trim();
    await appendFile(join(dir, 'public/releases/4.2.0/README.md'), '\nEdited.\n');
    const { createHash } = await import('node:crypto');
    const ledger = JSON.parse(await readFile(join(dir, 'public/releases/published.json'), 'utf8'));
    ledger.releases['4.2.0'].files['public/releases/4.2.0/README.md'] = createHash('sha256').update(await readFile(join(dir, 'public/releases/4.2.0/README.md'))).digest('hex');
    await writeFile(join(dir, 'public/releases/published.json'), JSON.stringify(ledger, null, 2) + '\n');
    execFileSync('git', ['add', '-A'], { cwd: dir });
    execFileSync('git', ['-c', 'user.name=guard', '-c', 'user.email=guard@example.invalid', 'commit', '--quiet', '-m', 'rewrite 4.2.0'], { cwd: dir });
    void base;
    return { LEDGER_BASE: ledgerBase };
  }, false);
} finally {
  await rm(work, { recursive: true, force: true });
}
const failures = checks.filter(c => !c.pass);
console.log(JSON.stringify({ checks: checks.length, results: checks.map(c => ({ label: c.label, pass: c.pass, failures: /** @type {{ failures: string[] }} */ (c.detail).failures })) }, null, 2));
await writeFile('output/ledger-guards.json', JSON.stringify({ checks }, null, 2));
if (failures.length) process.exitCode = 1;
