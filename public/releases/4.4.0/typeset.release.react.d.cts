import type { TypesetTextProps, TypesetRichTextProps } from './typeset-react.cjs';
export type { TypesetTextProps, TypesetRichTextProps, TypesetAdapterProps, TypesetTag, Priority } from './typeset-react.cjs';
export { whenSettled } from './settled.cjs';
export type { SettleOptions, Settled } from './settled.cjs';
/** Plain text composed in a React-owned host. A ref resolves to the host element. */
export declare const TypesetText: import("react").ForwardRefExoticComponent<TypesetTextProps & import("react").RefAttributes<HTMLElement>>;
/** Rich inline markup (links, emphasis) composed by React. A ref resolves to the host element. */
export declare const TypesetRichText: import("react").ForwardRefExoticComponent<TypesetRichTextProps & import("react").RefAttributes<HTMLElement>>;
