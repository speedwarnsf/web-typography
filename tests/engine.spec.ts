import { test, expect, type Page } from '@playwright/test';

/**
 * Engine invariants, asserted against the ACTUAL rendering of the plain-HTML
 * regression fixture (public/go-test.html) through the shipped go.js bundle —
 * the same artifact third-party sites load. Run `npm run build:dist` before
 * this suite; CI does.
 *
 * These tests encode the engine's own contract:
 *   - eligible paragraphs compose (a fallback on the fixture IS a regression)
 *   - Typeset.audit() finds no overflow and no orphan, in Chromium AND WebKit
 *   - composition never destroys words (the v3 merged-words disaster)
 *   - data-no-typeset is inviolable
 *   - the quarantined legacy API stays quarantined
 */

declare global {
  interface Window {
    Typeset: {
      audit: (selector?: string) => { type: string; detail: string }[];
      [key: string]: unknown;
    };
  }
}

async function loadFixture(page: Page) {
  await page.goto('/go-test.html');
  // go.js runs after fonts.ready; give every eligible paragraph time to settle.
  await page.waitForFunction(() => {
    const ps = Array.from(document.querySelectorAll('p:not([data-no-typeset])'));
    return ps.length > 0 && ps.every((p) => p.hasAttribute('data-typeset-done'));
  });
}

test('eligible paragraphs compose through the beam-search pipeline', async ({ page }) => {
  await loadFixture(page);
  const outcomes = await page.$$eval('p:not([data-no-typeset])', (ps) =>
    ps.map((p) => p.getAttribute('data-ts-outcome')),
  );
  expect(outcomes.length).toBeGreaterThanOrEqual(2);
  for (const outcome of outcomes) expect(outcome).toBe('composed');
});

test('audit finds no overflow and no orphan in the shipped rendering', async ({ page }) => {
  await loadFixture(page);
  const violations = await page.evaluate(() =>
    window.Typeset.audit().map((v) => ({ type: v.type, detail: v.detail })),
  );
  const hard = violations.filter((v) => v.type === 'overflow' || v.type === 'orphan');
  expect(hard, JSON.stringify(hard, null, 2)).toEqual([]);
});

test('audit finds no weak line-end on the fixture (regression baseline: 0)', async ({ page }) => {
  await loadFixture(page);
  const weak = await page.evaluate(() =>
    window.Typeset.audit().filter((v) => v.type === 'weak-line-end').map((v) => v.detail),
  );
  expect(weak, weak.join('\n')).toEqual([]);
});

test('composition preserves every word (no welding, no loss)', async ({ page }) => {
  await page.goto('/go-test.html');
  const before = await page.$$eval('p:not([data-no-typeset])', (ps) =>
    ps.map((p) => (p.textContent || '').trim().split(/\s+/).length),
  );
  await loadFixture(page);
  const after = await page.$$eval('p:not([data-no-typeset])', (ps) =>
    ps.map((p) => (p.textContent || '').trim().split(/\s+/).length),
  );
  // Word COUNT is invariant under composition (quote education may change
  // characters inside words; nothing may merge or drop a word).
  expect(after).toEqual(before);
});

test('data-no-typeset is inviolable: control paragraph stays raw', async ({ page }) => {
  await loadFixture(page);
  const control = page.locator('p[data-no-typeset]');
  const text = await control.textContent();
  expect(text).toContain('"quotes"'); // straight quotes uneducated
  expect(text).toContain('--'); // double hyphen untouched
  await expect(control.locator('.ts-line')).toHaveCount(0);
});

test('quarantined legacy API does not ship in the bundle', async ({ page }) => {
  await loadFixture(page);
  const legacy = await page.evaluate(() =>
    ['smoothRag', 'smoothRagSpans', 'optimizeBreaks', 'shapeRag', 'fixRag', 'postRenderFix']
      .filter((k) => k in window.Typeset),
  );
  expect(legacy).toEqual([]);
});

test('recomposition survives a width change without overflow', async ({ page }) => {
  await loadFixture(page);
  await page.setViewportSize({ width: 375, height: 800 });
  // ResizeObserver recomposes; wait for paragraphs to settle again.
  await page.waitForFunction(() =>
    Array.from(document.querySelectorAll('p:not([data-no-typeset])')).every((p) =>
      p.hasAttribute('data-typeset-done'),
    ),
  );
  const hard = await page.evaluate(() =>
    window.Typeset.audit().filter((v) => v.type === 'overflow' || v.type === 'orphan'),
  );
  expect(hard).toEqual([]);
});
