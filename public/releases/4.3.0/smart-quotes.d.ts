/** English quote education only. No whitespace, dash, ellipsis, or length
 * changes, and each quote keeps its kind: single quotes are never turned into
 * double quotes or the reverse. Idempotent. */
export declare function smartQuotes(text: string): string;
export interface QuoteTransform {
    outcome: string;
    restore: () => void;
}
/** Same-length edits preserve source offsets, and restoration respects external edits. */
export declare function applySmartQuotes(element: HTMLElement): QuoteTransform;
