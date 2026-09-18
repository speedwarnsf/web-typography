/** Ink can extend left of its advance box, especially in an italic face. */
export declare function opticalInkOverhang(doc: Document, style: CSSStyleDeclaration, char: string, advance: number, measuredContext?: {
    text: string;
    advance: number;
}): number | null;
/** Locate the optical left contour from the actual rasterized font.
 * Compare to H in the same face so sidebearings and serifs are not guessed. */
export declare function opticalInkPull(doc: Document, style: CSSStyleDeclaration, char: string, advance: number): number | null;
