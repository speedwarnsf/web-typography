/** Locate the optical left contour from the actual rasterized font.
 * Compare to H in the same face so sidebearings and serifs are not guessed. */
export declare function opticalInkPull(doc: Document, style: CSSStyleDeclaration, char: string, advance: number): number | null;
