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
   * Runs the full pipeline: tokenize → composeParagraph → shapeExactLines → validate → render.
   * This is the highest-quality typesetting mode.
   * 
   * @param selector CSS selector for elements to compose (default: 'p')
   */
  compose(selector: string = 'p') {
    const run = () => {
      document.querySelectorAll<HTMLElement>(selector).forEach((p) => {
        if (p.hasAttribute('data-typeset-done') || p.hasAttribute('data-no-typeset')) return;

        const text = p.textContent || '';
        if (text.length < 30) return;
        if (p.closest('[data-no-typeset], pre, code, .demo')) return;

        const textAlign = getComputedStyle(p).textAlign;
        if (textAlign === 'center') return;

        const measureChars = measureCh(p);
        const cs = getComputedStyle(p);
        let measurePx = p.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
        if (cs.fontStyle === 'italic') measurePx *= 0.92;
        if (measurePx <= 0) return;

        const measurer = document.createElement('span');
        measurer.style.cssText =
          'position:absolute;visibility:hidden;white-space:nowrap;pointer-events:none;' +
          'font:inherit;letter-spacing:inherit;word-spacing:inherit;';
        p.style.position = p.style.position || 'relative';
        p.appendChild(measurer);

        const measureText = (txt: string): number => {
          measurer.textContent = txt;
          return measurer.getBoundingClientRect().width;
        };

        try {
          const tokens = tokenize(text, measureText);
          const composition = composeParagraph(tokens, measurePx, measureChars);
          p.removeChild(measurer);

          if (!composition) return;

          const shaped = shapeExactLines(composition, measureChars, measurePx);
          if (!shaped) return;

          finalValidate(shaped, measureChars);
          renderFrozenLines(p, shaped);
        } catch {
          try { p.removeChild(measurer); } catch {}
        }
      });
    };

    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => {
        document.fonts.ready.then(() => requestAnimationFrame(run)).catch(() => setTimeout(run, 1000));
      });
    } else {
      document.fonts.ready.then(() => requestAnimationFrame(run)).catch(() => setTimeout(run, 1000));
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
