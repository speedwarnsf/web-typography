/** Token types for compositor */
type TokenKind = "word" | "space" | "openPunct" | "closePunct" | "dash" | "compound" | "longSlug";
/** Token with measurements and stickiness rules */
type Token = {
    text: string;
    kind: TokenKind;
    width: number;
    stickyPrev?: boolean;
    stickyNext?: boolean;
    weakEnd?: boolean;
    protectedCompound?: boolean;
    emergencyBreakParts?: string[];
    compoundId?: string;
};
/** Frozen line with exact membership and spacing adjustments */
interface FrozenLine {
    text: string;
    tokens: Token[];
    fill: number;
    width: number;
    wordSpacingEm: number;
}
/**
 * Options for typesetText
 */
export interface TypesetOptions {
    mode?: 'body' | 'heading';
    /** Line length in characters. Bindings scale with measure via width-tiered
     *  rules; the V2 compositor itself runs at every measure with tiered
     *  profiles (see profileForMeasure) and falls back to bindings when no
     *  valid composition exists. */
    measure?: number;
}
/**
 * Safe write wrapper for DOM mutations.
 * Sets isInternalWrite flag to prevent MutationObserver from reacting to our own changes.
 */
export declare function safeWrite(fn: () => void): void;
/**
 * Check if MutationObserver should ignore current mutations.
 */
export declare function shouldIgnoreMutation(): boolean;
/**
 * Tokenize text into typed tokens with measurements.
 * Detects compound words, long slugs, punctuation stickiness, weak-end words.
 */
declare function tokenize(text: string, measurer: (text: string) => number): Token[];
/**
 * Compose paragraph using beam search over exact break candidates.
 * Returns frozen lines with exact membership, or null if no valid composition.
 */
declare function composeParagraph(tokens: Token[], measurePx: number, measureCh: number, opts?: {
    isHeading?: boolean;
}): FrozenLine[] | null;
/**
 * Adjust word-spacing within fixed line membership.
 * May NOT change which words belong to which line.
 */
declare function shapeExactLines(lines: FrozenLine[], measureCh: number, measurePx: number): FrozenLine[] | null;
/**
 * Validate final composition before rendering.
 */
declare function finalValidate(lines: FrozenLine[], measureCh: number, isHeading?: boolean): boolean;
/**
 * Render exact lines as block spans (no pre-line + \n).
 */
declare function renderFrozenLines(p: HTMLElement, lines: FrozenLine[]): void;
/**
 * Insert non-breaking spaces to enforce typographic rules.
 * Works by analyzing word groups and binding words that must stay together.
 *
 * @param text The text to process
 * @param options Optional: { mode: 'body' | 'heading' }. Default: 'body'.
 */
export declare function typesetText(text: string, options?: TypesetOptions): string;
/**
 * Convenience export for heading mode.
 */
export declare function typesetHeading(text: string): string;
export declare function measureCh(element: HTMLElement): number;
/**
 * Post-render self-check: does any frozen line's actual rendered ink exceed
 * the paragraph's content box? Composition math and browser rendering can
 * disagree — most often when a webfont finished loading after measurement —
 * and a composed line that overflows the measure is worse than no composition
 * at all. Callers should restore plain text (or re-typeset) when this is true.
 */
export declare function linesOverflow(element: HTMLElement, tolerancePx?: number): boolean;
export interface TypesetAuditViolation {
    element: HTMLElement;
    type: 'overflow' | 'orphan' | 'weak-line-end';
    detail: string;
}
/**
 * Typeset.audit(selector?) — turn "trust us" into a checkable guarantee.
 * Scans composed elements (frozen .ts-line output) and returns typographic
 * violations measured from the ACTUAL rendering via DOM Range probes:
 * lines overflowing the measure, one-word last lines, and weak words
 * stranded at line ends. Suitable for CI and integration smoke tests.
 *
 * Note: a weak-line-end can be a deliberate trade at very narrow measures
 * (the engine bumps weak enders only "where width allows") — treat those
 * entries as review items, not hard failures.
 */
export declare function audit(selector?: string): TypesetAuditViolation[];
/**
 * The inverse of linesOverflow: were the composed lines rendered STARVED —
 * median non-last fill far below anything the compositor would choose on
 * purpose? Happens when the measurer overstated widths (e.g. a canvas that
 * silently kept a headline-sized font). Only meaningful with 3+ measured
 * lines; heading mode is exempt (display lines run loose by design).
 */
export declare function linesStarved(element: HTMLElement, medianFloor?: number): boolean;
/**
 * Apply typographic rules to a DOM element's text content.
 * Processes text nodes recursively.
 *
 * Measures the element's actual width in `ch` units so that binding rules
 * scale appropriately — narrow mobile columns won't get aggressive bindings
 * that create near-justified text with a stranded last line.
 */
export declare function typeset(element: HTMLElement): void;
/**
 * Apply typographic rules to all elements matching a selector.
 */
export declare function typesetAll(selector: string): void;
/**
 * Fix real orphans: only bind the last two words if the last line
 * actually contains a single word in the rendered layout.
 *
 * This is more accurate than the pre-render approach (which always binds
 * the last two words regardless of whether it's actually an orphan).
 */
export declare function fixRealOrphans(el: HTMLElement): boolean;
/**
 * Detect and fix lines with poor rag by applying targeted word-spacing
 * adjustments. Measures actual rendered line widths, computes a target,
 * and gently adjusts word-spacing per line to even out the right edge.
 *
 * This is a lighter version of smoothRag designed for all widths including mobile.
 * Uses smaller adjustment ranges on narrow screens.
 */
export declare function fixRag(el: HTMLElement): (() => void) | null;
/**
 * Fix stranded sentence-start words: detect when the last word on a line
 * is a sentence-start word (preceded by . ! ? punctuation), then bind it
 * to the next word so they move to the next line together.
 *
 * This runs post-render so it measures actual line breaks, not guessing
 * from character counts.
 */
export declare function fixStrandedSentenceStarts(el: HTMLElement): boolean;
/**
 * Full post-render typography pass: runs after the browser has laid out text.
 * Detects and fixes actual rendered problems without pre-render guessing.
 *
 * Call this AFTER typeset() (which handles pre-render bindings).
 */
export declare function postRenderFix(element: HTMLElement): (() => void) | null;
/**
 * React hook: apply typeset to a ref on mount/update.
 * The ref is typed structurally ({ current }) so this file stays dependency-free
 * — a React RefObject satisfies it, but no `react` import is required to compile.
 */
export declare function useTypeset(ref: {
    readonly current: HTMLElement | null;
}, deps?: any[]): void;
/**
 * DEPRECATED: smoothRag v4 — DOM-measured Knuth-Plass optimal line breaking.
 *
 * ⚠️ REPLACED BY composeParagraph() + shapeExactLines() in Compositor V2 (2026-03-17)
 *
 * Uses actual DOM measurement (not canvas) for pixel-accurate word widths,
 * then applies Knuth-Plass dynamic programming to find globally optimal
 * break points that minimize rag variance.
 *
 * Two passes:
 *   1. Measure each word's rendered width using a hidden span in the same
 *      font context as the target element
 *   2. Run Knuth-Plass to find optimal breaks, insert <br> tags
 *   3. Apply subtle per-line word-spacing to polish
 *
 * Returns a cleanup function. Re-runs on resize via ResizeObserver.
 */
export interface SmoothRagOptions {
    /** If true, only adjust word-spacing on existing browser lines — never rewrite breaks */
    preserveBreaks?: boolean;
}
export declare function smoothRag(element: HTMLElement, options?: SmoothRagOptions): () => void;
/**
 * smoothRagSpans — Non-destructive rag smoothing for word-wrapped content.
 *
 * Expects the container to hold words wrapped in <span data-w> elements
 * (with regular spaces between them in the DOM). Measures where the browser
 * placed each word, groups them into lines, and applies per-line word-spacing
 * adjustments to even out the right edge.
 *
 * Never rewrites innerHTML — only reads positions and sets inline styles.
 * Returns a cleanup function that removes the applied styles.
 *
 * Usage:
 *   // Render words as spans (React, vanilla JS, whatever)
 *   container.innerHTML = words.map((w, i) =>
 *     `<span data-w="${i}">${w}</span>`
 *   ).join(' ');
 *
 *   // Smooth the rag
 *   const cleanup = smoothRagSpans(container);
 *
 *   // Later, to reset:
 *   cleanup();
 */
export declare function smoothRagSpans(container: HTMLElement): () => void;
interface OptimizeBreaksOptions {
    /** Called after each apply (including resize re-runs). Use for Pass 2. */
    onApplied?: () => void;
}
export declare function optimizeBreaks(element: HTMLElement, opts?: OptimizeBreaksOptions): () => void;
/**
 * DEPRECATED: shapeRag — Pass 2: Active rag coastline sculpting via per-line word-spacing + letter-spacing.
 *
 * ⚠️ REPLACED BY shapeExactLines() in Compositor V2 (2026-03-17)
 *
 * THE KEY DIFFERENTIATOR: This is OFFENSIVE, not defensive. We actively detect
 * "flat runs" (consecutive lines at similar fill percentages) and CREATE variation
 * to produce a coastline-like rag, not a fence-like justified appearance.
 *
 * Runs AFTER optimizeBreaks (Pass 1) has set nbsp bindings.
 * Measures actual rendered line widths, then:
 *   1. Detects flat runs (2+ consecutive non-last lines within ~5% fill)
 *   2. Actively reshapes them with targeted word-spacing adjustments
 *   3. Creates wave pattern: tighten→expand→tighten or expand→tighten→expand
 *   4. Respects Tschichold tolerances: word-spacing 80–133% of natural space
 *   5. Conservative letter-spacing: ±2% of em
 *   6. Line-height adaptive scaling: more room at higher leading
 *   7. Narrow column awareness: reduced adjustments at <24ch
 *
 * Does NOT change line breaks — only adjusts spacing within existing lines.
 */
export declare function shapeRag(element: HTMLElement): void;
export { tokenize, composeParagraph, shapeExactLines, finalValidate, renderFrozenLines };
export type { Token, FrozenLine };
export default typeset;
