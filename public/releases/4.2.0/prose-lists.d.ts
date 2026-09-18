export interface ListStyleResult {
    styled: number;
    skipped: number;
    restore: () => void;
}
/** Explicit scope only. Load typeset.us/styles.css once; native markers retain semantics. */
export declare function styleProseLists(root: ParentNode): ListStyleResult;
