/**
 * typeset.standalone.ts — Standalone entry point for browser bundle
 * 
 * Strips React dependencies, exposes global `Typeset` object.
 * 
 * Usage:
 *   <script src="https://typeset.us/typeset.min.js"></script>
 *   <script>
 *     Typeset.all('p, h1, h2, h3');
 *   </script>
 * 
 * Compositor V2 (recommended for highest quality):
 *   <script>
 *     Typeset.compose('p');  // beam-search compositor on all <p>
 *   </script>
 */

// Only the live pipeline is imported here. The legacy v5 passes (smoothRag,
// optimizeBreaks, shapeRag, postRenderFix, …) are quarantined: they are NOT
// part of the public bundle API, so esbuild tree-shakes their ~1,400 lines
// (including innerHTML paths unsafe on user-generated text) out of every
// distributable. If you relied on them, migrate to Typeset.run/compose —
// the compositor replaces all of them through one verified path.
import {
  typeset,
  typesetAll,
  typesetText,
  typesetHeading,
  audit,
  measureCh,
  shouldIgnoreMutation,
  tokenize,
  composeParagraph,
  shapeExactLines,
  finalValidate,
  renderFrozenLines,
} from './typeset';

const Typeset = {
  /** Process a single element — orphans, rag, binding */
  run: typeset,

  /** Process all elements matching a CSS selector */
  all: typesetAll,

  /** Process text string (returns string with nbsp/hair-space insertions) */
  text: typesetText,

  /** Process a heading string (returns string with semantic line breaks) */
  heading: typesetHeading,

  /** Measure element width in ch units */
  measureCh,

  /**
   * Audit composed elements from the actual rendering (DOM Range probes):
   * returns violations — overflows, one-word last lines, weak line ends.
   * Turns "trust us" into a CI-testable guarantee: Typeset.audit().length === 0
   */
  audit,

  /**
   * Compositor V2 — beam-search paragraph compositor.
   * Routes each eligible element through the full engine pipeline via
   * typeset(): quote education, composition with contour re-ranking, spacing
   * pass, post-render overflow self-check, graceful binding fallback.
   *
   * Runs after fonts are ready — directly, never inside requestAnimationFrame,
   * which does not fire in hidden/background tabs. Re-typesets when webfonts
   * finish loading late and when an element's width changes.
   *
   * @param selector CSS selector for elements to compose (default: 'p')
   */
  compose(selector: string = 'p') {
    const eligible = (p: HTMLElement): boolean => {
      if (p.hasAttribute('data-no-typeset')) return false;
      if ((p.textContent || '').length < 30) return false;
      if (p.closest('[data-no-typeset], pre, code, .demo')) return false;
      if (getComputedStyle(p).textAlign === 'center') return false;
      return true;
    };

    const runOne = (p: HTMLElement) => {
      try {
        if (eligible(p)) typeset(p);
      } catch {}
    };

    const run = () => {
      document.querySelectorAll<HTMLElement>(selector).forEach((p) => {
        if (p.hasAttribute('data-typeset-done')) return;
        runOne(p);
      });
    };

    /**
     * Canvas and DOM must agree about text width before we compose.
     *
     * The compositor measures on a canvas and the browser paints in the DOM.
     * Everything downstream assumes those two agree. document.fonts.ready
     * does not actually promise that: it reports font LOADING, not that
     * canvas measureText has picked the face up.
     *
     * DEFENSIVE, NOT A REPRODUCED FIX — be honest about the provenance. A
     * test run reported Firefox composing non-deterministically with a named
     * system font (8 loads, 3 distinct compositions, a paragraph failing to
     * compose in 5). We could NOT reproduce it: original code, 8 Firefox
     * loads with Georgia, quiet and again under full CPU saturation, was
     * deterministic every time in all three engines. The report came from a
     * machine running six browser suites at once, so it may have been
     * contention, or the missing data-typeset-done flag (fixed separately,
     * and that one WAS reproduced) making a harness read a half-composed
     * page.
     *
     * This gate is kept anyway because the invariant is real and checking it
     * is nearly free: when metrics already agree — the normal case — it costs
     * one measurement and returns immediately.
     */
    const metricsAgree = (): boolean => {
      try {
        const sample = document.querySelector<HTMLElement>(selector);
        if (!sample) return true; // nothing to compose — do not stall
        const cs = getComputedStyle(sample);
        const font = `${cs.fontStyle} ${cs.fontWeight} ${cs.fontSize} / ${cs.lineHeight} ${cs.fontFamily}`;
        const probe = 'Handgloves mixed 0123 — quick brown fox';

        const span = document.createElement('span');
        span.textContent = probe;
        span.style.cssText =
          'position:absolute;left:-99999px;top:0;white-space:pre;visibility:hidden';
        span.style.font = font;
        document.body.appendChild(span);
        const range = document.createRange();
        range.selectNodeContents(span);
        const domW = range.getBoundingClientRect().width;
        span.remove();
        if (!domW) return true; // cannot tell; do not stall the page

        const ctx = document.createElement('canvas').getContext('2d');
        if (!ctx) return true;
        ctx.font = font;
        const canvasW = ctx.measureText(probe).width;

        return Math.abs(canvasW - domW) <= Math.max(0.5, domW * 0.002);
      } catch {
        return true; // never let the check itself block composition
      }
    };

    const start = () => {
      // Bounded: ~500ms worst case, then compose regardless. A page must
      // never fail to typeset because a font never settled.
      const whenMetricsSettle = (cb: () => void) => {
        let tries = 0;
        const tick = () => {
          if (metricsAgree() || tries++ >= 20) cb();
          else setTimeout(tick, 25);
        };
        tick();
      };
      document.fonts.ready
        .then(() => whenMetricsSettle(run))
        .catch(() => setTimeout(run, 1000));

      // Late-loading webfonts: compositions measured against fallback metrics
      // render wrong once the real font arrives — recompose with true metrics.
      // Surgical: debounced across events, only elements set in a face that
      // actually loaded, and the reader's scroll position preserved (pages
      // that stream in many fonts must not become recompose storms).
      const pendingFamilies = new Set<string>();
      let fontsTimer: ReturnType<typeof setTimeout> | null = null;
      document.fonts.addEventListener?.('loadingdone', (e: Event) => {
        const faces = (e as unknown as { fontfaces?: { family: string }[] }).fontfaces ?? [];
        for (const f of faces) pendingFamilies.add(f.family.replace(/['"]/g, '').toLowerCase());
        if (fontsTimer) clearTimeout(fontsTimer);
        fontsTimer = setTimeout(() => {
          const families = Array.from(pendingFamilies);
          pendingFamilies.clear();
          if (!families.length) return;
          const sx = window.scrollX;
          const sy = window.scrollY;
          let touched = 0;
          document.querySelectorAll<HTMLElement>(selector).forEach((p) => {
            if (!p.hasAttribute('data-typeset-done')) return;
            const fam = getComputedStyle(p).fontFamily.toLowerCase();
            if (!families.some((f) => fam.includes(f))) return;
            touched++;
            p.removeAttribute('data-typeset-done');
            runOne(p);
          });
          if (touched) setTimeout(() => window.scrollTo(sx, sy), 60);
        }, 150);
      });

      // Width changes (rotation, window resize): recompose to the new measure.
      if (typeof ResizeObserver !== 'undefined') {
        const widths = new WeakMap<Element, number>();
        const ro = new ResizeObserver((entries) => {
          if (shouldIgnoreMutation()) return;
          for (const entry of entries) {
            const el = entry.target as HTMLElement;
            const w = entry.contentRect.width;
            const prev = widths.get(el) ?? -1;
            if (Math.abs(w - prev) < 2) continue;
            widths.set(el, w);
            if (el.hasAttribute('data-typeset-done')) {
              el.removeAttribute('data-typeset-done');
              runOne(el);
            }
          }
        });
        document.querySelectorAll<HTMLElement>(selector).forEach((p) => ro.observe(p));
      }
    };

    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', start);
    } else {
      start();
    }
  },

  /** Auto-run on DOMContentLoaded for elements with [data-typeset] */
  auto() {
    const run = () => {
      document.querySelectorAll<HTMLElement>('[data-typeset], [data-typeset-smooth]').forEach(el => {
        // [data-typeset-smooth] used to invoke the legacy smoothRag pass;
        // the compositor supersedes it, so both attributes route to typeset().
        typeset(el);
      });
      document.querySelectorAll<HTMLElement>('[data-typeset-heading]').forEach(el => {
        el.innerHTML = typesetHeading(el.textContent || '');
      });
    };

    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', run);
    } else {
      run();
    }
  },

  // Low-level compositor functions (for advanced users)
  _tokenize: tokenize,
  _composeParagraph: composeParagraph,
  _shapeExactLines: shapeExactLines,
  _finalValidate: finalValidate,
  _renderFrozenLines: renderFrozenLines,
};

// Expose as global
(window as any).Typeset = Typeset;

export default Typeset;
