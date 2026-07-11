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

test('rich paragraphs compose with markup intact', async ({ page }) => {
  // Inline composition: links/em/code paragraphs go through the full
  // compositor. The contract: every href survives with its exact value and
  // text, nested emphasis is rebuilt, and a visibly-boxed chip (padding/
  // background) is atomic — never split across two lines.
  await loadFixture(page);
  const rich = await page.evaluate(() => {
    const read = (id: string) => {
      const p = document.getElementById(id)!;
      return {
        outcome: p.getAttribute('data-ts-outcome'),
        richFlag: p.getAttribute('data-ts-rich'),
        lines: p.querySelectorAll(':scope > .ts-line').length,
        anchors: [...p.querySelectorAll('a')].map((a) => ({
          href: a.getAttribute('href'),
          text: a.textContent,
        })),
        codeClones: p.querySelectorAll('code').length,
        codeText: p.querySelector('code')?.textContent ?? null,
        emCount: p.querySelectorAll('em').length,
      };
    };
    return { link: read('rich-link'), mixed: read('rich-mixed'), chip: read('rich-chip') };
  });

  expect(rich.link.outcome).toBe('composed');
  expect(rich.link.richFlag).toBe('1');
  expect(rich.link.lines).toBeGreaterThan(1);
  // Split anchors are allowed (one clone per line) but every clone carries
  // the exact href, and their combined text is the original link text.
  expect(rich.link.anchors.length).toBeGreaterThanOrEqual(1);
  for (const a of rich.link.anchors) expect(a.href).toBe('https://typeset.us/library');
  expect(rich.link.anchors.map((a) => a.text).join('')).toContain('documented in the library');

  expect(rich.mixed.outcome).toBe('composed');
  expect(rich.mixed.emCount).toBeGreaterThanOrEqual(2);
  for (const a of rich.mixed.anchors) expect(a.href).toBe('https://typeset.us/fix');

  expect(rich.chip.outcome).toBe('composed');
  expect(rich.chip.codeClones, 'boxed chip must never split across lines').toBe(1);
  expect(rich.chip.codeText).toBe('text-wrap: pretty');
});

test('rich paragraphs preserve every word and survive recomposition', async ({ page }) => {
  await page.goto('/go-test.html');
  const before = await page.$$eval('#rich-link, #rich-mixed, #rich-chip', (ps) =>
    ps.map((p) => (p.textContent || '').trim().split(/\s+/).length),
  );
  await loadFixture(page);
  const after = await page.$$eval('#rich-link, #rich-mixed, #rich-chip', (ps) =>
    ps.map((p) => (p.textContent || '').trim().split(/\s+/).length),
  );
  expect(after).toEqual(before);

  // Width change → engine restores its stored original innerHTML and
  // recomposes; markup must survive the round trip.
  await page.setViewportSize({ width: 375, height: 800 });
  await page.waitForFunction(() =>
    ['rich-link', 'rich-mixed', 'rich-chip'].every((id) =>
      document.getElementById(id)?.hasAttribute('data-typeset-done'),
    ),
  );
  const roundTrip = await page.evaluate(() => ({
    hrefs: [...document.querySelectorAll('#rich-link a')].map((a) => a.getAttribute('href')),
    chipClones: document.querySelectorAll('#rich-chip code').length,
    words: (document.getElementById('rich-link')!.textContent || '').trim().split(/\s+/).length,
  }));
  for (const href of roundTrip.hrefs) expect(href).toBe('https://typeset.us/library');
  expect(roundTrip.chipClones).toBe(1);
  expect(roundTrip.words).toBe(before[0]);
});

test('spacing accordion is centered, not biased tight', async ({ page }) => {
  // Texture invariant (added 2026-07-09 after the whole-page-reads-tight
  // regression): the accordion must breathe AROUND the compositor's chosen
  // fills — short lines expand, genuinely overfull lines contract. When the
  // spacing-pass target clamp falls below the compositor's admissible band,
  // the broad middle of every page gets pulled down and body text reads
  // "kerned tight" while every violation-based check still passes. Guard the
  // distribution itself: no more than a quarter of shaped lines may sit at
  // maximum contraction.
  await loadFixture(page);
  const stats = await page.$$eval('p:not([data-no-typeset])', (ps) => {
    const ws: number[] = [];
    for (const p of ps) {
      const lines = Array.from(p.querySelectorAll<HTMLElement>(':scope > .ts-line'));
      // Non-last lines only: the last line is the rag's tail and unshaped.
      for (const line of lines.slice(0, -1)) {
        ws.push(parseFloat(line.style.wordSpacing) || 0);
      }
    }
    // -0.049: at-max means the body contraction cap (-0.05em, the
    // Tschichold/InDesign 80%-of-natural floor) — keep in step with
    // shapeExactLines.
    const atMaxContraction = ws.filter((v) => v <= -0.049).length;
    const mean = ws.reduce((a, b) => a + b, 0) / (ws.length || 1);
    return { lines: ws.length, atMaxContraction, mean };
  });
  expect(stats.lines).toBeGreaterThan(4);
  const share = stats.atMaxContraction / stats.lines;
  expect(share, `${stats.atMaxContraction}/${stats.lines} lines at max contraction (mean ${stats.mean.toFixed(4)}em)`).toBeLessThan(0.25);
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
