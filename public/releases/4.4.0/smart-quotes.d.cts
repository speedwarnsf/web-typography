/** English quote education only. No whitespace, dash, ellipsis, or length
 * changes, and each quote keeps its kind: single quotes are never turned into
 * double quotes or the reverse. Idempotent. */
export declare function smartQuotes(text: string): string;
export interface QuoteTransform {
    outcome: string;
    restore: () => void;
}
/** Whether quotes may be educated in text whose nearest lang is `tag`:
 * text declared English, in any spelling (en, en-GB, en_US), and, unless
 * `declared` (smartQuotes: 'en-declared'), untagged text. */
export declare function englishScope(tag: string | null | undefined, declared: boolean): boolean;
/** Same-length edits preserve source offsets, and restoration respects
 * external edits. `declared` educates only text an ancestor declares English
 * (smartQuotes: 'en-declared', the auto loader's default); otherwise
 * untagged text counts as English too. */
export declare function applySmartQuotes(element: HTMLElement, declared?: boolean): QuoteTransform;
