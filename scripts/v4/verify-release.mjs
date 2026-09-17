import { execFileSync } from 'node:child_process';
for (const script of ['verify-release-craft', 'verify-spacing', 'verify-promise', 'verify-acceptance']) {
  execFileSync(process.execPath, [`scripts/v4/${script}.mjs`], { stdio: 'inherit' });
}
