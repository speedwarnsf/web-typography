import type { AllHTMLAttributes, HTMLAttributes, ReactNode } from 'react';
import type { Priority } from './adapter-registry.cjs';
export type { Priority } from './adapter-registry.cjs';
import type { Mode, Options, Result } from './typeset.next.cjs';
/** Host elements the adapters render. The engine decides at run time what it
 * composes: an inline host such as a default label reports native:inline. */
export type TypesetTag = 'p' | 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6' | 'span' | 'div' | 'li' | 'blockquote' | 'figcaption' | 'dd' | 'dt' | 'td' | 'th' | 'caption' | 'label' | 'legend' | 'summary';
/** Options and host attributes shared by TypesetText and TypesetRichText. */
export interface TypesetAdapterProps extends Omit<HTMLAttributes<HTMLElement>, 'children' | 'dangerouslySetInnerHTML'>, Pick<AllHTMLAttributes<HTMLElement>, 'cite' | 'colSpan' | 'rowSpan' | 'headers' | 'scope' | 'htmlFor' | 'value'> {
    as?: TypesetTag;
    mode?: Mode;
    keep?: readonly string[];
    maxLines?: number;
    density?: Options['density'];
    lineBreaks?: Options['lineBreaks'];
    smartQuotes?: Options['smartQuotes'];
    opticalHanging?: Options['opticalHanging'];
    spacing?: Options['spacing'];
    tracking?: Options['tracking'];
    contour?: Options['contour'];
    /** Default: Options.coverage's. `'core'` leaves native what 4.3.1 left
     * native (other Latin-script languages, time, dfn, kbd, ins, visually
     * hidden text, sup and sub); `'extended'` composes them. */
    coverage?: Options['coverage'];
    /** Default `true`: copying composed text puts the source on the clipboard,
     * without the generated line breaks. `false` leaves copying to the
     * browser, whose copied text then has a line break at every composed line
     * end (Options.copy). */
    copy?: Options['copy'];
    /** 'auto' (default) composes in the commit only what is on screen, within
     * a small time budget, and the rest before its first paint or in idle
     * time. 'sync' composes in the commit, as 4.2 did, for hero text.
     * Server-rendered HTML paints natively first and composes after hydration. */
    priority?: Priority;
    /** Called after each composition of the block with the engine's result
     * (outcome, measured lines before and after, and feature statuses). */
    onResult?: (result: Result) => void;
}
export interface TypesetRichTextProps extends TypesetAdapterProps {
    children: ReactNode;
}
/** Rich inline markup composed by React: author elements and breaks are
 * React's, and a ref resolves to the host element. */
export declare const TypesetRichText: import("react").ForwardRefExoticComponent<TypesetRichTextProps & import("react").RefAttributes<HTMLElement>>;
