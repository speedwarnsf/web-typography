import type { ParagraphLine } from './typeset.js';
/** Measure once per paragraph, then rank all candidates without DOM writes. */
export declare function finishedContour(element: HTMLElement, words: readonly {
    index: number;
    text: string;
}[], measure: number): (lines: ParagraphLine[]) => number[];
