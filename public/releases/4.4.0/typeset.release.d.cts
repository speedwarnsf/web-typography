import type { Options, Result, Controller, RichPlan } from './typeset.next.cjs';
export * from './typeset.next.cjs';
export { smartQuotes } from './smart-quotes.cjs';
export { OUTCOMES } from './outcomes.cjs';
export type { Outcome, FeatureStatus, QuoteStatus, HangingStatus, SpacingStatus, TrackingStatus } from './outcomes.cjs';
export { styleProseLists } from './prose-lists.cjs';
export { whenSettled } from './settled.cjs';
export type { SettleOptions, Settled } from './settled.cjs';
export type { ListStyleResult } from './prose-lists.cjs';
export { composeParagraph, finalValidate, linesOverflow, linesStarved, renderFrozenLines, shapeExactLines, tokenize } from './typeset.cjs';
export declare function typeset(element: HTMLElement, options?: Options): Result;
export declare function typesetAll(selector?: string, options?: Options): Result[];
/** mount('article p') is mount(document, 'article p'). */
export declare function mount(selector: string, options?: Options): Controller;
export declare function mount(root?: ParentNode, selector?: string, options?: Options): Controller;
export declare function planRichText(element: HTMLElement, options?: Options): RichPlan;
