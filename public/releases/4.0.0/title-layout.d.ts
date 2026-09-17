import type { FrozenLine, Token } from './typeset.js';
export interface TitlePolicy {
    weakEnding?: (word: string) => boolean;
    keep?: readonly string[];
    maxLines?: number;
    /** Indexed measurement distinguishes identical words in different styles. */
    measureRange?: (start: number, end: number) => number;
    breakPenalty?: (end: number) => number;
}
/**
 * Short text uses exact dynamic programming, not paragraph fill economics.
 * Minimize line count first; then weigh phrase splits, isolated words, and
 * visual balance. Every constraint has a feasible fallback.
 */
export declare function composeTitle(tokens: Token[], width: number, measure: (text: string) => number, policy?: TitlePolicy): FrozenLine[] | null;
