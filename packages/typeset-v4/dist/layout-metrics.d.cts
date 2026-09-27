export interface MeasuredLine {
    text: string;
    sourceStart: number;
    sourceEnd: number;
    width: number;
    left: number;
    right: number;
    top: number;
    bottom: number;
    words: number;
}
export interface LayoutMetrics {
    lines: MeasuredLine[];
    width: number;
    overflow: number;
    firstSingleton: boolean;
    lastSingleton: boolean;
    rag: number;
}
export declare function contentWidth(element: HTMLElement): number;
/** The inline size measured lines need from the content box: each line's
 * right edge from the content box's left edge, less any part of the line
 * that starts left of that edge. An optically hung quote or capital, or a
 * negative text-indent, sits in the margin, and a box sized by its content (a
 * shrink-to-fit flex item, w-fit, inline-block) leaves no room for it, so it
 * is no reason to think the lines no longer fit. */
export declare function linesExtent(element: HTMLElement, lines: readonly MeasuredLine[]): number;
/** Read real line boxes, including native and fallback text. No DOM writes. */
export declare function measureLayout(element: HTMLElement): LayoutMetrics;
/** measureLayout for the audit: a first line that starts left of the content
 * box by the author's negative text-indent (a hanging indent, as in a
 * bibliography) is the author's layout, not overflow. Composition keeps
 * measureLayout, so no decision it makes changes. */
export declare function measureForAudit(element: HTMLElement): LayoutMetrics;
