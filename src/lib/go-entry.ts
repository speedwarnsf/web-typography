/**
 * go-entry.ts — build entry for https://typeset.us/go.js
 *
 * The universal drop-in. One script tag, no configuration required:
 *
 *   <script src="https://typeset.us/go.js" defer></script>
 *
 * Optional attributes:
 *   data-typeset-selector — override which elements are composed
 *     (default: paragraphs, list items, blockquotes, captions, headings,
 *      table cells, definition lists)
 *
 * go.js is GENERATED from the same engine that runs typeset.us
 * (src/lib/typeset.ts) via `npm run build:dist` — never edit it by hand.
 * v3 replaces the hand-written v2 script, which had only the pre-render
 * binding pass; this build carries the full pipeline: beam-search
 * composition with contour re-ranking, Tschichold spacing, hanging
 * punctuation, overflow self-checks, and font-load healing.
 */

import Typeset from './typeset.standalone';

const script = (typeof document !== 'undefined'
  ? document.currentScript
  : null) as HTMLScriptElement | null;

const selector =
  script?.getAttribute('data-typeset-selector') ||
  'p, li, blockquote, figcaption, h1, h2, h3, h4, h5, h6, td, th, dd, dt';

Typeset.compose(selector);
