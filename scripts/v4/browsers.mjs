import { chromium, webkit, firefox } from 'playwright';
import { existsSync, readdirSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
function cached(prefix, suffix) {
  const root = join(homedir(), 'Library/Caches/ms-playwright');
  if (!existsSync(root)) return undefined;
  for (const entry of readdirSync(root).filter(n => n.startsWith(prefix)).sort().reverse()) {
    const file = join(root, entry, suffix);
    if (existsSync(file)) return file;
  }
}
export const browsers = [
  { name: 'chromium', engine: chromium, executablePath: process.env.CHROMIUM_PATH || cached('chromium_headless_shell-', 'chrome-headless-shell-mac-arm64/chrome-headless-shell'), headedExecutablePath: process.env.HEADED_CHROMIUM_PATH || cached('chromium-', 'chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing') },
  { name: 'webkit', engine: webkit, executablePath: process.env.WEBKIT_PATH || cached('webkit-', 'pw_run.sh') },
  { name: 'firefox', engine: firefox, executablePath: process.env.FIREFOX_PATH || cached('firefox-', 'firefox/Nightly.app/Contents/MacOS/firefox') },
];
