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

import {
  typeset,
  typesetAll,
  typesetText,
  typesetHeading,
  smoothRag,
  smoothRagSpans,
  optimizeBreaks,
  shapeRag,
  fixRealOrphans,
  fixRag,
  fixStrandedSentenceStarts,
  postRenderFix,
  measureCh,
  safeWrite,
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

  /** Smooth the right rag of an element via word-spacing adjustments */
  smoothRag,

  /** Smooth rag using pre-wrapped span elements (non-destructive) */
  smoothRagSpans,

  /** Optimize line breaks using Knuth-Plass algorithm */
  optimizeBreaks,

  /** Shape the rag (combine smoothing + optimization) */
  shapeRag,

  /** Fix orphans only */
  fixOrphans: fixRealOrphans,

  /** Fix rag only */
  fixRag,

  /** Fix stranded sentence starts */
  fixStrandedSentenceStarts,

  /** Post-render fix (orphans + rag) */
  postRenderFix,

  /** Measure element width in ch units */
  measureCh,

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

    const start = () => {
      document.fonts.ready.then(run).catch(() => setTimeout(run, 1000));

      // Late-loading webfonts: compositions measured against fallback metrics
      // render wrong once the real font arrives — recompose with true metrics.
      document.fonts.addEventListener?.('loadingdone', () => {
        setTimeout(() => {
          document.querySelectorAll<HTMLElement>(selector).forEach((p) => {
            if (!p.hasAttribute('data-typeset-done')) return;
            p.removeAttribute('data-typeset-done');
            runOne(p);
          });
        }, 50);
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
      document.querySelectorAll<HTMLElement>('[data-typeset]').forEach(el => {
        typeset(el);
      });
      document.querySelectorAll<HTMLElement>('[data-typeset-smooth]').forEach(el => {
        smoothRag(el);
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
