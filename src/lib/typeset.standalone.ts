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
    // data-no-typeset (on the element or an ancestor) is the author's
    // explicit "hands off" — never touched, not even to mark it decided.
    const optedOut = (p: HTMLElement): boolean =>
      p.hasAttribute('data-no-typeset') || !!p.closest('[data-no-typeset]');

    // Every OTHER gate is a decision, and 3.4.0's contract says decisions
    // set the flag: data-typeset-done means "the engine is finished with
    // this element, whatever it decided". These skips used to exit silently,
    // so anyone polling the flag across a page containing one short or
    // centered paragraph waited forever — the exact bug class the 3.4.0
    // readiness fix closed inside the engine, reopened at this wrapper.
    const skipReasonOf = (p: HTMLElement): string | null => {
      if ((p.textContent || '').length < 30) return 'skipped:short';
      if (p.closest('pre, code, .demo')) return 'skipped:excluded';
      if (getComputedStyle(p).textAlign === 'center') return 'skipped:centered';
      return null;
    };

    // Width baseline for the ResizeObserver below, recorded at COMPOSE time
    // (content-box, matching contentRect). Seeding from the first RO
    // delivery instead is wrong in exactly the scenario this file champions:
    // composed in a hidden tab, resized/rotated while hidden, first delivery
    // on focus — adopting that delivery as the baseline would silently
    // absorb the change and leave frozen lines at a stale measure.
    const widths = new WeakMap<Element, number>();
    const recordWidth = (p: HTMLElement) => {
      const cs = getComputedStyle(p);
      widths.set(p, p.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight));
    };

    const runOne = (p: HTMLElement) => {
      if (optedOut(p)) return;
      try {
        const skip = skipReasonOf(p);
        if (skip) {
          p.dataset.tsOutcome = skip;
          p.dataset.typesetDone = '1';
          return;
        }
        typeset(p);
      } catch {
        // A throw is a decision too — never leave the element pending.
        p.dataset.tsOutcome = 'fallback:error';
        p.dataset.typesetDone = '1';
      } finally {
        recordWidth(p);
      }
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
            // An opted-out element's done flag belongs to whoever set it
            // (the page's own composition code) — never strip it.
            if (optedOut(p)) return;
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
        const ro = new ResizeObserver((entries) => {
          // ALWAYS record widths — even for our own writes' deliveries and
          // the initial observe() notification. Bailing out before recording
          // left the map unseeded (prev = -1), so the first later event —
          // including a pure height change, the case the width filter exists
          // to ignore — read as a width change and forced a recompose of a
          // paragraph whose measure never moved.
          const internal = shouldIgnoreMutation();
          for (const entry of entries) {
            const el = entry.target as HTMLElement;
            const w = entry.contentRect.width;
            const first = !widths.has(el);
            const prev = widths.get(el) ?? -1;
            widths.set(el, w);
            if (internal) continue;
            // First sight seeds silently — EXCEPT an element composed while
            // unmeasurable that now has width: that is the 0 → N retry the
            // done-flag-on-every-outcome contract exists to enable.
            if (first && !(el.dataset.tsOutcome === 'unmeasurable' && w > 0)) continue;
            if (Math.abs(w - prev) < 2) continue;
            if (el.hasAttribute('data-typeset-done')) {
              el.removeAttribute('data-typeset-done');
              runOne(el);
            }
          }
        });
        // Opted-out elements are never observed: recomposition would strip a
        // done flag that belongs to the page's own composition code.
        document.querySelectorAll<HTMLElement>(selector).forEach((p) => {
          if (!optedOut(p)) ro.observe(p);
        });
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
        // typesetHeading returns plain text (unicode NBSP/NBHY, no markup).
        // Writing it back through innerHTML re-parsed the element's own
        // escaped text as live HTML — a script-injection sink on any page
        // that put user-supplied text in a heading.
        el.textContent = typesetHeading(el.textContent || '');
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
