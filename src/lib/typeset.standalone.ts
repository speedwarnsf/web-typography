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
};

// Expose as global
(window as any).Typeset = Typeset;

export default Typeset;
