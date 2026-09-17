/** Conservative English attachments, not a general syntactic parser. */
import type { LayoutMetrics } from './layout-metrics.js';
export interface PhraseGroup {
    start: number;
    end: number;
    kind: 'nominal' | 'infinitive';
}
/** A colon can introduce a thought without introducing a new sentence. */
export declare const proseBoundary: (text: string) => boolean;
export declare function strandedOpener(line: string): boolean;
/** Retain naturally aligned sentences only when there is no geometric defect. */
export declare function retainSentenceLayout(source: string, before: LayoutMetrics, chosenEnds: readonly number[]): boolean;
export declare function englishPhraseGroups(texts: readonly string[], width: number, measure: (start: number, end: number) => number): PhraseGroup[];
export declare function phraseBreakCosts(texts: readonly string[], groups: readonly PhraseGroup[], title: boolean): number[];
