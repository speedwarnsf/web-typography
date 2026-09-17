import { execFileSync } from 'node:child_process';
let failed = false;
for (const script of ['verify-release-craft', 'verify-spacing', 'verify-promise', 'verify-acceptance', 'verify-inline-code', 'verify-controller', 'verify-tracking-clipping', 'verify-loaders']) {
  try { execFileSync(process.execPath, [`scripts/v4/${script}.mjs`], { stdio: 'inherit' }); }
  catch { failed = true; }
}
if (failed) process.exitCode = 1;
