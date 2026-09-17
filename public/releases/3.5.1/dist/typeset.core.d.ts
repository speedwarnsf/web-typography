/**
 * typeset.core.ts — the live public API, and nothing else.
 *
 * This is the entry for the ESM distributable (public/typeset.esm.js) and
 * the npm package. It re-exports only the shipped pipeline; the legacy v5
 * passes (smoothRag, optimizeBreaks, shapeRag, postRenderFix, …) are
 * quarantined in src/lib/typeset.ts and deliberately not re-exported, so
 * they are tree-shaken out of every built artifact.
 */
export { typeset, typesetAll, typesetText, typesetHeading, audit, measureCh, linesOverflow, linesStarved, safeWrite, shouldIgnoreMutation, tokenize, composeParagraph, shapeExactLines, finalValidate, renderFrozenLines, } from './typeset.js';
