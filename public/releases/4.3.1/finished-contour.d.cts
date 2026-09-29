import type { ParagraphLine } from './typeset.cjs';
/** Measure once per paragraph, then rank all candidates without DOM writes. */
export declare function finishedContour(element: HTMLElement, words: readonly {
    index: number;
    text: string;
}[], measure: number, cache?: Map<string, number>): (lines: ParagraphLine[]) => number[];
