import { defineConfig, devices } from '@playwright/test';

/**
 * The engine's CI harness. Chromium AND WebKit — every measurement bug this
 * project has shipped (canvas font parsing, letterSpacing state, compositor
 * layers) was Safari-only and invisible in Chromium. A suite that runs in
 * one engine proves nothing about the other.
 */
// The static server's port comes from the environment so parallel runs do
// not collide, and a server left over from another run is never reused.
const port = Number(process.env.PLAYWRIGHT_PORT || 4173);

export default defineConfig({
  testDir: './tests',
  timeout: 30_000,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL: `http://localhost:${port}`,
  },
  webServer: {
    command: 'node scripts/static-server.mjs',
    env: { PORT: String(port) },
    url: `http://localhost:${port}/go-test.html`,
    reuseExistingServer: false,
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'webkit', use: { ...devices['Desktop Safari'] } },
  ],
});
