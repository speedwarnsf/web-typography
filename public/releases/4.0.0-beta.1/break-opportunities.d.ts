import type { Token } from './typeset.js';
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
export declare function languageOf(tag: string | null | undefined): string;
export declare function languageWeakEnding(word: string, language: string): boolean;
/** Unicode opportunities, conservatively tailored to horizontal Latin-script CSS.
 * This never inserts hyphens or treats a word boundary as a legal line break. */
export declare function analyzeBreaks(source: string, options?: {
    language?: string | null;
    hyphens?: string;
}): BreakAnalysis;
export declare function tokenForUnit(unit: BreakUnit, language: string): Token;
