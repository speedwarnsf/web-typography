import { defineConfig, devices } from '@playwright/test';

/**
 * The engine's CI harness. Chromium AND WebKit — every measurement bug this
 * project has shipped (canvas font parsing, letterSpacing state, compositor
 * layers) was Safari-only and invisible in Chromium. A suite that runs in
 * one engine proves nothing about the other.
 */
export default defineConfig({
  testDir: './tests',
  timeout: 30_000,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL: 'http://localhost:4173',
  },
  webServer: {
    command: 'node scripts/static-server.mjs',
    url: 'http://localhost:4173/go-test.html',
    reuseExistingServer: !process.env.CI,
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'webkit', use: { ...devices['Desktop Safari'] } },
  ],
});
