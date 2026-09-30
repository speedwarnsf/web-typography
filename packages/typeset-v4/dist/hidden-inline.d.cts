/**
 * Descendants that paint no inline box: visually hidden text (the sr-only
 * pattern: position absolute or fixed, a box at most 1 px square that clips
 * its overflow, as Bootstrap, Tailwind and WordPress write it) and aria-hidden
 * elements with no width. Screen readers read the first and nothing reads
 * the second; neither takes room on a line. The outermost ones, in document
 * order; engine markers are never among them.
 */
export declare function hiddenInline(element: HTMLElement): HTMLElement[];
/** Whether a node is inside one of `hidden` (see hiddenInline). */
export declare const withinHidden: (node: Node, hidden: readonly Element[]) => boolean;
