import type { Token } from './typeset.js';
import { languageOf } from './language.js';
import type { Coverage } from './coverage.js';
export { languageOf };
export declare const UNICODE_VERSION = "17.0.0";
export interface BreakUnit {
    text: string;
    index: number;
    hyphen: boolean;
}
export interface BreakAnalysis {
    unicode: string;
    language: string;
    outcome: 'supported' | 'native:language' | 'native:script' | 'native:soft-hyphen' | 'native:author-breaks';
    units: BreakUnit[];
    opportunities: number[];
}
/**
 * The most code points (collapsible white space aside) a paragraph may hold
 * between two line-break opportunities. Measuring reads each word's boxes,
 * and WebKit's Range.getClientRects() takes time in proportion to the length
 * of the line a range is on, so a longer unbreakable run costs the square of
 * its length: 11,000 closing quotes and a letter took about 37 s in
 * typeset() in WebKit, 11,000 letters, a hyphen and a letter about 15 s.
 * Prose has no such runs; untrusted text (a comment, a profile) can. A block
 * with one is declined as native:run-budget before anything is measured.
 */
export declare const RUN_BUDGET = 500;
/** Whether some stretch of `source` between two line-break opportunities
 * holds more than RUN_BUDGET code points. Linear, and nearly free for
 * prose: the Unicode rules run only where the text goes more than
 * RUN_BUDGET characters without a space between letters. */
export declare function exceedsRunBudget(source: string): boolean;
export declare function languageWeakEnding(word: string, language: string): boolean;
/** Unicode opportunities, conservatively tailored to horizontal Latin-script CSS.
 * This never inserts hyphens or treats a word boundary as a legal line break. */
export declare function analyzeBreaks(source: string, options?: {
    language?: string | null;
    hyphens?: string;
    outcomeOnly?: boolean;
    coverage?: Coverage;
}): BreakAnalysis;
export declare function tokenForUnit(unit: BreakUnit, language: string): Token;
