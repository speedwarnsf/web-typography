/** Intl.Segmenter, Range geometry and real layout: enough to compose now.
 * A page whose root has no box yet is asked again on the next call. */
export declare function canCompose(doc: Document): boolean;
/** The APIs that keep a composition correct as text, styles and widths
 * change: MutationObserver and ResizeObserver, with Intl.Segmenter and Range
 * geometry (mount()). Layout itself is checked per composition. */
export declare function canMaintain(doc: Document): boolean;
export declare const ENVIRONMENT_OUTCOME = "native:environment";
