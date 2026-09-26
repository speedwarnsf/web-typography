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
/** Read real line boxes, including native and fallback text. No DOM writes. */
export declare function measureLayout(element: HTMLElement): LayoutMetrics;
/** measureLayout for the audit: a first line that starts left of the content
 * box by the author's negative text-indent (a hanging indent, as in a
 * bibliography) is the author's layout, not overflow. Composition keeps
 * measureLayout, so no decision it makes changes. */
export declare function measureForAudit(element: HTMLElement): LayoutMetrics;
