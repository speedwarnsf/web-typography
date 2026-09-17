import { typeset as compose, typesetAll as composeAll, mount as mountCore, planRichText as planCore } from './typeset.next';
import type { Options, Result, Controller, RichPlan } from './typeset.next';
export * from './typeset.next';
export { smartQuotes } from './smart-quotes';
export { styleProseLists } from './prose-lists';
export type { ListStyleResult } from './prose-lists';
// Retained for v3 advanced consumers; new integrations should use the owned adapters.
export { composeParagraph, finalValidate, linesOverflow, linesStarved, renderFrozenLines, shapeExactLines, tokenize } from './typeset';

/** Public v4 defaults. The research harness retains its explicit legacy baseline. */
const defaults = (options: Options): Options => ({ ...options, lineBreaks: options.lineBreaks ?? 'unicode', contour: options.contour ?? 'finished' });
export function typeset(element: HTMLElement, options: Options = {}): Result { return compose(element, defaults(options)); }
export function typesetAll(selector?: string, options: Options = {}): Result[] { return composeAll(selector, defaults(options)); }
export function mount(root?: ParentNode, selector?: string, options: Options = {}): Controller { return mountCore(root, selector, defaults(options)); }
export function planRichText(element: HTMLElement, options: Options = {}): RichPlan { return planCore(element, defaults(options)); }
