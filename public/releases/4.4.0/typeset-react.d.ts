import type { TypesetAdapterProps } from './typeset-rich-react.js';
export { TypesetRichText } from './typeset-rich-react.js';
export type { TypesetRichTextProps, TypesetAdapterProps, TypesetTag, Priority } from './typeset-rich-react.js';
export interface TypesetTextProps extends TypesetAdapterProps {
    text: string;
}
/**
 * React owns the semantic host and its attributes; this adapter owns only
 * its text subtree. The stable initial child also supplies readable SSR.
 * Inline interactive children belong outside this plain-text adapter. A ref
 * resolves to the host element.
 */
export declare const TypesetText: import("react").ForwardRefExoticComponent<TypesetTextProps & import("react").RefAttributes<HTMLElement>>;
