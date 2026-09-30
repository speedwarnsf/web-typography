import type { ForwardedRef, ReactNode, Ref } from 'react';
/** Every prop except children, refs and callbacks, by value. */
export declare function propsKey(props: object): string;
/** Text, element types, keys and non-callback props of a JSX tree, by value. */
export declare function childrenKey(children: ReactNode): string;
/** Every FontFace and its status. A face can be added already loaded, or
 * replaced while the set stays loaded, without any loading event. */
export declare function fontKey(doc: Document): string;
/** Everything a composed host's line breaks depend on, read without writing:
 * its text, its content width and its parent's (as drawn, then as laid out),
 * fonts, and the computed type of the host and every author descendant.
 * Ancestor attributes are not part of it, only their effect on these values.
 * The two drawn widths come first (see transformOnly). */
export declare function layoutKey(element: HTMLElement, fonts?: string): string;
/** Whether two layout keys differ only in the size a transform draws the host
 * at (a scale, a rotation on an ancestor), not in its layout: its lines break
 * where they did. */
export declare function transformOnly(a: string, b: string): boolean;
/** Set a caller's ref to `node`; returns the cleanup a React 19 callback ref gave, if any. */
export declare function assignRef(ref: Ref<HTMLElement> | ForwardedRef<HTMLElement> | undefined, node: HTMLElement | null): (() => void) | undefined;
